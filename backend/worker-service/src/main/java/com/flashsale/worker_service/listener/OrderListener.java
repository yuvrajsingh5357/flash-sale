package com.flashsale.worker_service.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashsale.worker_service.entity.Order;
import com.flashsale.worker_service.event.OrderEvent;
import com.flashsale.worker_service.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderListener {

    private final OrderRepository orderRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String ORDER_STATUS_KEY = "flashsale:order:%s";

    @KafkaListener(topics = "order_events", groupId = "worker-group")
    public void handleOrderEvent(String eventJson) {
        OrderEvent event;
        try {
            event = objectMapper.readValue(eventJson, OrderEvent.class);
        } catch (Exception e) {
            log.error("Failed to parse Kafka message: {}", eventJson, e);
            return;
        }

        String orderId = event.getOrderId();
        log.info("Received order event: orderId={}", orderId);

        // ─── 1. Idempotency check ────────────────────────────────────────────
        // If this orderId already exists in DB, it's a duplicate Kafka message — skip.
        UUID id = UUID.fromString(orderId);
        if (orderRepository.existsById(id)) {
            log.warn("Duplicate message detected for orderId={}. Skipping.", orderId);
            return;
        }

        // ─── 2. Persist to PostgreSQL ────────────────────────────────────────
        Order order = Order.builder()
                .id(id)
                .userId(event.getUserId())
                .productId(event.getProductId())
                .quantity(event.getQuantity())
                .status("RESERVED")
                .createdAt(event.getCreatedAt())
                .reservedUntil(event.getReservedUntil())
                .build();

        orderRepository.save(order);
        log.info("Order persisted to DB: orderId={}", orderId);

        // ─── 3. Update Redis status to RESERVED ───────────────────────────────
        String redisKey = String.format(ORDER_STATUS_KEY, orderId);
        redisTemplate.opsForValue().set(redisKey, "RESERVED");
        log.info("Redis status updated to RESERVED: orderId={}", orderId);
    }
}
