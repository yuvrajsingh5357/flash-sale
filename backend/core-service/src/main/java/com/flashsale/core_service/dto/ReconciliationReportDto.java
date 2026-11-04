package com.flashsale.core_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReconciliationReportDto {
    private Long saleId;
    private String saleTitle;
    private Integer initialStock;
    private Integer redisStock;
    private Integer expectedRemainingStock;
    private Long reservedCount;
    private Long paidCount;
    private Integer drift; // redisStock - expectedRemainingStock
    private boolean isConsistent;
    private Instant auditedAt;
}
