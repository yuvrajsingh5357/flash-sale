package com.flashsale.worker_service.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Mirror of the OrderEvent published by order-service.
 * Must match the JSON structure exactly.
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
