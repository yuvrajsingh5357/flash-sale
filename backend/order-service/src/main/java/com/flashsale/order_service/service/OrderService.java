package com.flashsale.order_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashsale.order_service.config.KafkaConfig;
import com.flashsale.order_service.dto.InitSaleRequest;
import com.flashsale.order_service.dto.OrderResponse;
import com.flashsale.order_service.dto.PlaceOrderRequest;
import com.flashsale.order_service.event.OrderEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
    private static final String USER_ORDERS_KEY = "flashsale:user_orders:%d:%d";
    private static final String SALE_LIMIT_KEY = "flashsale:sale:%d:limit";
    private static final String SALE_STATUS_KEY = "flashsale:sale:%d:status";
    private static final String SALE_PRICE_KEY = "flashsale:sale:%d:price";
    private static final String SALE_PRODUCT_KEY = "flashsale:sale:%d:productId";
    private static final String ORDER_KEY = "flashsale:order:%s";
    private static final String IDEM_KEY = "flashsale:idem:%s";

    // ─── Admin / Preload Support ──────────────────────────────────────────────

    public void initSale(InitSaleRequest req) {
        String key = String.format(STOCK_KEY, req.getProductId());
        redisTemplate.opsForValue().set(key, String.valueOf(req.getStock()));
        redisTemplate.opsForValue().set("flashsale:sale:" + req.getProductId() + ":status", "LIVE");
        log.info("Flash sale initialized: saleId={} stock={}", req.getProductId(), req.getStock());
    }

    // ─── Hot Path ─────────────────────────────────────────────────────────────

    public OrderResponse placeOrder(Long userId, PlaceOrderRequest req, String idempotencyKey) {
        // 0. Idempotency Check via Redis SET NX
        String idemKey = String.format(IDEM_KEY, idempotencyKey);
        Boolean isNewRequest = redisTemplate.opsForValue().setIfAbsent(idemKey, "PROCESSING", Duration.ofSeconds(300));

        if (Boolean.FALSE.equals(isNewRequest)) {
            String cachedResponse = redisTemplate.opsForValue().get(idemKey);
            if ("PROCESSING".equals(cachedResponse)) {
                return OrderResponse.builder()
                        .status("CONFLICT")
                        .message("Request is already processing. Please wait.")
                        .build();
            }
            try {
                return objectMapper.readValue(cachedResponse, OrderResponse.class);
            } catch (Exception e) {
                log.error("Failed to parse cached response for idemKey={}", idempotencyKey, e);
                return OrderResponse.builder().status("ERROR").message("Idempotency resolution error").build();
            }
        }

        Long saleId = req.getSaleId() != null ? req.getSaleId() : (req.getProductId() != null ? req.getProductId() : 1L);
        int quantity = req.getQuantity() != null && req.getQuantity() > 0 ? req.getQuantity() : 1;

        // 1. Rate Limiting Check (user requests per window)
        if (!rateLimiterService.isAllowed(userId != null ? userId.intValue() : 1)) {
            log.warn("Rate limit exceeded for userId={}", userId);
            OrderResponse response = OrderResponse.builder()
                    .userId(userId)
                    .saleId(saleId)
                    .status("RATE_LIMITED")
                    .message("Too many requests. Please slow down and try again.")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        }

        // 2. Atomic Inventory & Per-User Limit Check via Lua Script
        String stockKey = String.format(STOCK_KEY, saleId);
        String userOrdersKey = String.format(USER_ORDERS_KEY, saleId, userId);
        String limitKey = String.format(SALE_LIMIT_KEY, saleId);
        String statusKey = String.format(SALE_STATUS_KEY, saleId);

        Long result = redisTemplate.execute(
                stockDecrementScript,
                List.of(stockKey, userOrdersKey, limitKey, statusKey),
                String.valueOf(quantity)
        );

        if (result == null || result == 0) {
            log.info("Stock exhausted for saleId={}", saleId);
            OrderResponse response = OrderResponse.builder()
                    .userId(userId)
                    .saleId(saleId)
                    .status("SOLD_OUT")
                    .message("Sorry, this item is sold out!")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        } else if (result == -1) {
            log.info("Sale not live for saleId={}", saleId);
            OrderResponse response = OrderResponse.builder()
                    .userId(userId)
                    .saleId(saleId)
                    .status("SALE_NOT_LIVE")
                    .message("This flash sale is not currently live.")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        } else if (result == -2) {
            log.info("Per-user limit reached for userId={} on saleId={}", userId, saleId);
            OrderResponse response = OrderResponse.builder()
                    .userId(userId)
                    .saleId(saleId)
                    .status("LIMIT_REACHED")
                    .message("You have reached the maximum allowed quantity for this flash sale.")
                    .build();
            cacheResponse(idemKey, response);
            return response;
        }

        // 3. Generate Order UUID
        String orderId = UUID.randomUUID().toString();

        // 4. Store State and 5-Minute Reservation TTL
        String orderKey = String.format(ORDER_KEY, orderId);
        redisTemplate.opsForValue().set(orderKey, "RESERVED", Duration.ofMinutes(10));

        String resKey = "flashsale:reservation:" + orderId;
        redisTemplate.opsForValue().set(resKey, "1", Duration.ofSeconds(300)); // 5 min TTL

        // 5. Read Sale Metadata for Event
        String priceStr = redisTemplate.opsForValue().get(String.format(SALE_PRICE_KEY, saleId));
        BigDecimal unitPrice = priceStr != null ? new BigDecimal(priceStr) : new BigDecimal("39999.00");
        BigDecimal totalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity));

        String prodIdStr = redisTemplate.opsForValue().get(String.format(SALE_PRODUCT_KEY, saleId));
        Long productId = prodIdStr != null ? Long.parseLong(prodIdStr) : (req.getProductId() != null ? req.getProductId() : 1L);

        Instant reservedUntil = Instant.now().plus(5, ChronoUnit.MINUTES);

        // 6. Asynchronous Publish to Kafka with Retry and Fallback
        OrderEvent event = OrderEvent.builder()
                .orderId(orderId)
                .userId(userId)
                .saleId(saleId)
                .productId(productId)
                .quantity(quantity)
                .unitPrice(unitPrice)
                .totalAmount(totalAmount)
                .status("RESERVED")
                .createdAt(Instant.now())
                .reservedUntil(reservedUntil)
                .build();

        try {
            String eventJson = objectMapper.writeValueAsString(event);
            publishWithRetry(orderId, eventJson, 3);
        } catch (Exception e) {
            log.error("Failed to serialize OrderEvent for orderId={}", orderId, e);
        }

        log.info("Order RESERVED: orderId={} userId={} saleId={} qty={}", orderId, userId, saleId, quantity);

        OrderResponse response = OrderResponse.builder()
                .orderId(orderId)
                .saleId(saleId)
                .productId(productId)
                .userId(userId)
                .status("RESERVED")
                .message("Order reserved successfully. Complete checkout within 5 minutes.")
                .reservedUntil(reservedUntil)
                .build();

        cacheResponse(idemKey, response);
        return response;
    }

    private void cacheResponse(String idemKey, OrderResponse response) {
        try {
            redisTemplate.opsForValue().set(idemKey, objectMapper.writeValueAsString(response), Duration.ofSeconds(300));
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
