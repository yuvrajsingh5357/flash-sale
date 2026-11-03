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

        // 1. Idempotency check: skip if order is already saved in PostgreSQL
        UUID id = UUID.fromString(orderId);
        if (orderRepository.existsById(id)) {
            log.warn("Duplicate message detected for orderId={}. Skipping.", orderId);
            return;
        }

        // 2. Persist to PostgreSQL
        Order order = Order.builder()
                .id(id)
                .userId(event.getUserId() != null ? event.getUserId() : 1L)
                .saleId(event.getSaleId() != null ? event.getSaleId() : 1L)
                .productId(event.getProductId() != null ? event.getProductId() : 1L)
                .quantity(event.getQuantity() != null ? event.getQuantity() : 1)
                .unitPrice(event.getUnitPrice() != null ? event.getUnitPrice() : java.math.BigDecimal.valueOf(39999))
                .totalAmount(event.getTotalAmount() != null ? event.getTotalAmount() : java.math.BigDecimal.valueOf(39999))
                .status("RESERVED")
                .reservedUntil(event.getReservedUntil())
                .build();

        orderRepository.save(order);
        log.info("Order successfully persisted to PostgreSQL: orderId={}", orderId);

        // 3. Keep Redis status confirmed as RESERVED
        String redisKey = String.format(ORDER_STATUS_KEY, orderId);
        redisTemplate.opsForValue().set(redisKey, "RESERVED");
    }
}
