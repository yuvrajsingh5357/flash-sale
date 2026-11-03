package com.flashsale.core_service.dto;

import com.flashsale.core_service.entity.SaleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaleResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String productDescription;
    private String productImageUrl;
    private BigDecimal originalPrice;
    private String title;
    private Instant startTime;
    private Instant endTime;
    private BigDecimal salePrice;
    private Integer stockAllocation;
    private Integer remainingStock;
    private Integer perUserLimit;
    private SaleStatus status;
    private Boolean preloaded;
}
