package com.flashsale.core_service.service;

import com.flashsale.core_service.dto.ReconciliationReportDto;
import com.flashsale.core_service.entity.OrderStatus;
import com.flashsale.core_service.entity.Sale;
import com.flashsale.core_service.exception.ResourceNotFoundException;
import com.flashsale.core_service.repository.OrderRepository;
import com.flashsale.core_service.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReconciliationService {

    private final SaleRepository saleRepository;
    private final OrderRepository orderRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditService auditService;

    private static final String STOCK_KEY = "flashsale:stock:%d";

    @Transactional(readOnly = true)
    public ReconciliationReportDto reconcileSale(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + saleId));

        int initialStock = sale.getStockAllocation();

        // 1. Fetch live Redis remaining stock
        String stockVal = redisTemplate.opsForValue().get(String.format(STOCK_KEY, saleId));
        int redisStock = stockVal != null ? Integer.parseInt(stockVal) : 0;

        // 2. Fetch DB counts of reserved and paid units
        long reservedCount = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.RESERVED);
        long paidCount = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.PAID);

        // 3. Invariant: initial = remaining + reserved + paid
        int expectedRemaining = Math.max(0, initialStock - (int) (reservedCount + paidCount));
        int drift = redisStock - expectedRemaining;
        boolean isConsistent = (drift == 0);

        ReconciliationReportDto report = ReconciliationReportDto.builder()
                .saleId(saleId)
                .saleTitle(sale.getTitle())
                .initialStock(initialStock)
                .redisStock(redisStock)
                .expectedRemainingStock(expectedRemaining)
                .reservedCount(reservedCount)
                .paidCount(paidCount)
                .drift(drift)
                .isConsistent(isConsistent)
                .auditedAt(Instant.now())
                .build();

        if (!isConsistent) {
            log.warn("INVENTORY DRIFT DETECTED for saleId={}: initial={}, redisStock={}, reserved={}, paid={}, drift={}",
                    saleId, initialStock, redisStock, reservedCount, paidCount, drift);
        }

        return report;
    }

    @Transactional(readOnly = true)
    public List<ReconciliationReportDto> reconcileAllSales() {
        List<Sale> sales = saleRepository.findAll();
        List<ReconciliationReportDto> reports = new ArrayList<>();
        for (Sale sale : sales) {
            reports.add(reconcileSale(sale.getId()));
        }
        return reports;
    }

    /**
     * S5: Scheduled reconciliation job running with distributed ShedLock.
     * Checks initial = remaining + reserved + paid every 5 minutes.
     */
    @Scheduled(cron = "0 */5 * * * *")
    @SchedulerLock(name = "reconciliation_job", lockAtLeastFor = "PT30S", lockAtMostFor = "PT4M")
    public void runScheduledReconciliation() {
        log.info("Running automated S5 inventory reconciliation job...");
        List<Sale> sales = saleRepository.findAll();

        for (Sale sale : sales) {
            ReconciliationReportDto report = reconcileSale(sale.getId());
            if (!report.isConsistent()) {
                auditService.log(1L, "INVENTORY_DRIFT_ALERT", "SALE", sale.getId().toString(),
                        String.format("Drift detected: redisStock=%d, expected=%d, drift=%d",
                                report.getRedisStock(), report.getExpectedRemainingStock(), report.getDrift()),
                        null);
            }
        }
    }
}
