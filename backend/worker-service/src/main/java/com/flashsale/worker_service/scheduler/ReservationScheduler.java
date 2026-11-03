package com.flashsale.worker_service.scheduler;

import com.flashsale.worker_service.entity.Order;
import com.flashsale.worker_service.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationScheduler {

    private final OrderRepository orderRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String STOCK_KEY = "flashsale:stock:%d";
    private static final String ORDER_KEY = "flashsale:order:%s";

    @Scheduled(cron = "0 * * * * *") // Runs every minute
    public void recoverExpiredReservations() {
        log.info("Running ReservationScheduler to find expired reservations");
        List<Order> expiredOrders = orderRepository.findExpiredReservations(Instant.now());

        for (Order order : expiredOrders) {
            // Optimistic lock: only 1 instance of scheduler will successfully update this row
            int updatedRows = orderRepository.markAsExpired(order.getId());
            
            if (updatedRows > 0) {
                // DB update succeeded, safe to restore stock
                String stockKey = String.format(STOCK_KEY, order.getProductId());
                redisTemplate.opsForValue().increment(stockKey, order.getQuantity());

                // Update Redis status
                String orderKey = String.format(ORDER_KEY, order.getId().toString());
                redisTemplate.opsForValue().set(orderKey, "EXPIRED");

                log.info("Reservation expired. Stock restored for orderId={}, quantity={}", order.getId(), order.getQuantity());
            } else {
                log.debug("Order {} was already processed by another instance or thread.", order.getId());
            }
        }
    }
}
