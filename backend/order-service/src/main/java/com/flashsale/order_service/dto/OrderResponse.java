package com.flashsale.order_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private String orderId;
    private Long saleId;
    private Long productId;
    private Long userId;
    private String status; // RESERVED, SOLD_OUT, LIMIT_REACHED, RATE_LIMITED, SALE_NOT_LIVE, NOT_FOUND, CONFLICT, ERROR
    private String message;
    private Instant reservedUntil;
}
