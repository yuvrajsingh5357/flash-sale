package com.flashsale.core_service.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class SaleRequest {
    @NotNull
    private Long productId;

    @NotBlank
    private String title;

    @NotNull
    private Instant startTime;

    @NotNull
    private Instant endTime;

    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal salePrice;

    @NotNull
    @Min(value = 1)
    private Integer stockAllocation;

    @NotNull
    @Min(value = 1)
    private Integer perUserLimit;
}
