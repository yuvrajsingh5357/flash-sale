package com.flashsale.core_service.service;

import com.flashsale.core_service.entity.Sale;
import com.flashsale.core_service.entity.SaleStatus;
import com.flashsale.core_service.repository.SaleRepository;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalePreloaderService {

    private final SaleRepository saleRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String STOCK_KEY = "flashsale:stock:%d";
    private static final String SALE_STATUS_KEY = "flashsale:sale:%d:status";
    private static final String SALE_LIMIT_KEY = "flashsale:sale:%d:limit";
    private static final String SALE_PRICE_KEY = "flashsale:sale:%d:price";
    private static final String SALE_PRODUCT_KEY = "flashsale:sale:%d:productId";

    @Scheduled(fixedDelay = 10000)
    @SchedulerLock(name = "sale_lifecycle_job", lockAtMostFor = "8s", lockAtLeastFor = "2s")
    @Transactional
    public void processSaleLifecycle() {
        Instant now = Instant.now();

        // 1. Preload sales starting within 2 minutes
        Instant preloadWindow = now.plus(2, ChronoUnit.MINUTES);
        List<Sale> salesToPreload = saleRepository.findSalesToPreload(preloadWindow);
        for (Sale sale : salesToPreload) {
            preloadSale(sale);
        }

        // 2. Start scheduled sales that reached start time
        List<Sale> salesToStart = saleRepository.findSalesToStart(now);
        for (Sale sale : salesToStart) {
            startSale(sale);
        }

        // 3. End live sales that reached end time
        List<Sale> salesToEnd = saleRepository.findSalesToEnd(now);
        for (Sale sale : salesToEnd) {
            endSale(sale);
        }
    }

    private void preloadSale(Sale sale) {
        Long saleId = sale.getId();
        log.info("Preloading stock and configuration into Redis for saleId={}", saleId);

        String stockKey = String.format(STOCK_KEY, saleId);
        redisTemplate.opsForValue().set(stockKey, String.valueOf(sale.getStockAllocation()));
        redisTemplate.opsForValue().set(String.format(SALE_LIMIT_KEY, saleId), String.valueOf(sale.getPerUserLimit()));
        redisTemplate.opsForValue().set(String.format(SALE_PRICE_KEY, saleId), sale.getSalePrice().toPlainString());
        redisTemplate.opsForValue().set(String.format(SALE_PRODUCT_KEY, saleId), String.valueOf(sale.getProduct().getId()));
        redisTemplate.opsForValue().set(String.format(SALE_STATUS_KEY, saleId), sale.getStatus().name());

        sale.setPreloaded(true);
        saleRepository.save(sale);
    }

    private void startSale(Sale sale) {
        Long saleId = sale.getId();
        log.info("Transitioning saleId={} to LIVE", saleId);

        // Ensure stock is seeded if not already preloaded
        if (!Boolean.TRUE.equals(sale.getPreloaded())) {
            preloadSale(sale);
        }

        sale.setStatus(SaleStatus.LIVE);
        saleRepository.save(sale);

        redisTemplate.opsForValue().set(String.format(SALE_STATUS_KEY, saleId), SaleStatus.LIVE.name());
    }

    private void endSale(Sale sale) {
        Long saleId = sale.getId();
        log.info("Ending saleId={}", saleId);

        sale.setStatus(SaleStatus.ENDED);
        saleRepository.save(sale);

        redisTemplate.opsForValue().set(String.format(SALE_STATUS_KEY, saleId), SaleStatus.ENDED.name());
    }
}
