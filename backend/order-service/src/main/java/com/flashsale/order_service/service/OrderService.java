package com.flashsale.order_service.service;

import com.flashsale.order_service.config.KafkaConfig;
import com.flashsale.order_service.dto.InitSaleRequest;
import com.flashsale.order_service.dto.OrderResponse;
import com.flashsale.order_service.dto.PlaceOrderRequest;
import com.flashsale.order_service.event.OrderEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final RedisTemplate<String, String> redisTemplate;
    private final DefaultRedisScript<Long> stockDecrementScript;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    private static final String STOCK_KEY = "flashsale:stock:%d";
    private static final String ORDER_KEY = "flashsale:order:%s";
    private static final String IDEM_KEY = "flashsale:idem:%s";

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * Seeds initial stock into Redis.
     * POST /admin/init
     */
    public void initSale(InitSaleRequest req) {
        String key = String.format(STOCK_KEY, req.getProductId());
        redisTemplate.opsForValue().set(key, String.valueOf(req.getStock()));
        log.info("Flash sale initialized: productId={} stock={}", req.getProductId(), req.getStock());
    }

    // ─── Hot Path ─────────────────────────────────────────────────────────────

    /**
     * Core order placement — Redis-only hot path. No DB calls here.
     * POST /orders/place
     */
    public OrderResponse placeOrder(PlaceOrderRequest req, String idempotencyKey) {
        String idemKey = String.format(IDEM_KEY, idempotencyKey);
        Boolean isNewRequest = redisTemplate.opsForValue().setIfAbsent(idemKey, "PROCESSING", java.time.Duration.ofSeconds(300));

        if (Boolean.FALSE.equals(isNewRequest)) {
            String cachedResponse = redisTemplate.opsForValue().get(idemKey);
            if ("PROCESSING".equals(cachedResponse)) {
                return OrderResponse.builder().status("CONFLICT").message("Request is already processing. Please wait.").build();
            }
            try {
                return objectMapper.readValue(cachedResponse, OrderResponse.class);
            } catch (Exception e) {
                log.error("Failed to parse cached response", e);
                return OrderResponse.builder().status("ERROR").message("Idempotency error").build();
            }
        }

        int userId = req.getUserId();
        int productId = req.getProductId();
        int quantity = req.getQuantity();

        // 1. Rate limit check
        if (!rateLimiterService.isAllowed(userId)) {
            log.warn("Rate limit exceeded for userId={}", userId);
            OrderResponse response = OrderResponse.builder()
                    .status("RATE_LIMITED")
                    .message("Too many requests. Please try again later.")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        }

        // 2. Atomic stock decrement via Lua script
        String stockKey = String.format(STOCK_KEY, productId);
        Long result = redisTemplate.execute(
                stockDecrementScript,
                List.of(stockKey),
                String.valueOf(quantity));

        if (result == null || result == 0) {
            log.info("Stock exhausted for productId={}", productId);
            OrderResponse response = OrderResponse.builder()
                    .status("SOLD_OUT")
                    .message("Sorry, this item is sold out.")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        }

        // 3. Generate orderId
        String orderId = UUID.randomUUID().toString();

        // 4. Store RESERVED status in Redis
        String orderKey = String.format(ORDER_KEY, orderId);
        redisTemplate.opsForValue().set(orderKey, "RESERVED");

        // 5. Reservation TTL (5 minutes)
        String resKey = "flashsale:reservation:" + orderId;
        redisTemplate.opsForValue().set(resKey, "1", java.time.Duration.ofSeconds(300));

        // 6. Publish to Kafka (async with retry)
        Instant reservedUntil = Instant.now().plus(5, java.time.temporal.ChronoUnit.MINUTES);
        OrderEvent event = OrderEvent.builder()
                .orderId(orderId)
                .userId(userId)
                .productId(productId)
                .quantity(quantity)
                .createdAt(Instant.now())
                .reservedUntil(reservedUntil)
                .build();

        try {
            String eventJson = objectMapper.writeValueAsString(event);
            publishWithRetry(orderId, eventJson, 3);
        } catch (Exception e) {
            log.error("Failed to serialize OrderEvent", e);
        }

        log.info("Order placed: orderId={} userId={} productId={}", orderId, userId, productId);

        OrderResponse response = OrderResponse.builder()
                .orderId(orderId)
                .status("RESERVED")
                .message("Order reserved successfully. Processing...")
                .build();
        cacheResponse(idemKey, response);
        return response;
    }

    private void cacheResponse(String idemKey, OrderResponse response) {
        try {
            redisTemplate.opsForValue().set(idemKey, objectMapper.writeValueAsString(response), java.time.Duration.ofSeconds(300));
        } catch (Exception e) {
            log.error("Failed to cache response for idempotency", e);
        }
    }

    private void publishWithRetry(String orderId, String eventJson, int retriesLeft) {
        kafkaTemplate.send(KafkaConfig.ORDER_TOPIC, orderId, eventJson)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        if (retriesLeft > 0) {
                            log.warn("Kafka publish failed for orderId={}, retries left={}. Retrying...", orderId, retriesLeft);
                            publishWithRetry(orderId, eventJson, retriesLeft - 1);
                        } else {
                            log.error("Kafka publish failed after all retries for orderId={}. Pushing to fallback queue.", orderId);
                            redisTemplate.opsForList().rightPush("flashsale:fallback_queue", eventJson);
                        }
                    }
                });
    }

    // ─── Status Query ─────────────────────────────────────────────────────────

    /**
     * Reads order status from Redis.
     * GET /orders/{orderId}
     */
    public OrderResponse getOrderStatus(String orderId) {
        String key = String.format(ORDER_KEY, orderId);
        String status = redisTemplate.opsForValue().get(key);

        if (status == null) {
            return OrderResponse.builder()
                    .orderId(orderId)
                    .status("NOT_FOUND")
                    .message("Order not found.")
                    .build();
        }

        return OrderResponse.builder()
                .orderId(orderId)
                .status(status)
                .message("Order status retrieved.")
                .build();
    }
}
