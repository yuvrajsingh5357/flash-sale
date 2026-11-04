package com.flashsale.core_service.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class RazorpayOrderRequest {
    @NotNull
    private UUID orderId;
}
