package com.flashsale.worker_service.scheduler;

import com.flashsale.worker_service.entity.Order;
import com.flashsale.worker_service.repository.OrderRepository;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
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
    private static final String USER_ORDERS_KEY = "flashsale:user_orders:%d:%d";
    private static final String ORDER_KEY = "flashsale:order:%s";

    @Scheduled(cron = "*/15 * * * * *") // Runs every 15 seconds
    @SchedulerLock(name = "expire_reservations", lockAtMostFor = "14s", lockAtLeastFor = "3s")
    public void recoverExpiredReservations() {
        Instant now = Instant.now();
        List<Order> expiredOrders = orderRepository.findExpiredReservations(now);

        if (!expiredOrders.isEmpty()) {
            log.info("Found {} expired reservations to process", expiredOrders.size());
        }

        for (Order order : expiredOrders) {
            // Conditional atomic SQL update: WHERE status = 'RESERVED'
            // Guarantees that if order was marked PAID in the interim, update returns 0 rows.
            int updatedRows = orderRepository.markAsExpired(order.getId(), now);

            if (updatedRows > 0) {
                // DB update succeeded: safe to restore Redis stock and user limits
                String stockKey = String.format(STOCK_KEY, order.getSaleId());
                redisTemplate.opsForValue().increment(stockKey, order.getQuantity());

                String userOrdersKey = String.format(USER_ORDERS_KEY, order.getSaleId(), order.getUserId());
                redisTemplate.opsForValue().decrement(userOrdersKey, order.getQuantity());

                // Update Redis status and delete TTL key
                String orderKey = String.format(ORDER_KEY, order.getId().toString());
                redisTemplate.opsForValue().set(orderKey, "EXPIRED");
                redisTemplate.delete("flashsale:reservation:" + order.getId());

                log.info("Reservation expired. Stock restored for orderId={}, saleId={}, qty={}",
                        order.getId(), order.getSaleId(), order.getQuantity());
            } else {
                log.debug("Order {} was already processed or paid by another transaction.", order.getId());
            }
        }
    }
}
