package com.flashsale.order_service.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * The Kafka message payload published by order-service
 * and consumed by worker-service.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEvent {
    private String orderId;
    private int userId;
    private int productId;
    private int quantity;
    private Instant createdAt;
    private Instant reservedUntil;
}
