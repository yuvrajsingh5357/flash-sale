package com.flashsale.core_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaleMetricsResponse {
    private Long saleId;
    private Integer initialStock;
    private Integer remainingStock;
    private Long reservedOrders;
    private Long paidOrders;
    private Long expiredOrders;
    private Long cancelledOrders;
}
