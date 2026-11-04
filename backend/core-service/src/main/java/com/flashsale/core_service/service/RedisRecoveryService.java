package com.flashsale.core_service.service;

import com.flashsale.core_service.entity.Order;
import com.flashsale.core_service.entity.OrderStatus;
import com.flashsale.core_service.entity.Sale;
import com.flashsale.core_service.exception.ResourceNotFoundException;
import com.flashsale.core_service.repository.OrderRepository;
import com.flashsale.core_service.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisRecoveryService {

    private final SaleRepository saleRepository;
    private final OrderRepository orderRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditService auditService;

    private static final String STOCK_KEY = "flashsale:stock:%d";
    private static final String SALE_STATUS_KEY = "flashsale:sale:%d:status";
    private static final String SALE_LIMIT_KEY = "flashsale:sale:%d:limit";
    private static final String SALE_PRICE_KEY = "flashsale:sale:%d:price";
    private static final String SALE_PRODUCT_KEY = "flashsale:sale:%d:productId";
    private static final String USER_ORDERS_KEY = "flashsale:user_orders:%d:%d";
    private static final String ORDER_KEY = "flashsale:order:%s";
    private static final String RESERVATION_KEY = "flashsale:reservation:%s";

    /**
     * S6: Rebuilds Redis stock and metadata from Postgres after cold restart or data loss.
     * Formula: remaining_stock = total_stock_allocation - (active_reserved_orders + paid_orders)
     */
    @Transactional
    public Map<String, Object> rebuildRedisForSale(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + saleId));

        Instant now = Instant.now();
        List<Order> orders = orderRepository.findBySaleIdOrderByCreatedAtDesc(saleId);

        int activeReservedCount = 0;
        int paidCount = 0;
        Map<Long, Integer> userOrderCounts = new HashMap<>();

        for (Order order : orders) {
            if (order.getStatus() == OrderStatus.PAID) {
                paidCount += order.getQuantity();
                userOrderCounts.merge(order.getUserId(), order.getQuantity(), Integer::sum);
                redisTemplate.opsForValue().set(String.format(ORDER_KEY, order.getId().toString()), OrderStatus.PAID.name());
            } else if (order.getStatus() == OrderStatus.RESERVED) {
                if (order.getReservedUntil().isAfter(now)) {
                    // Active reservation within 5-min window
                    activeReservedCount += order.getQuantity();
                    userOrderCounts.merge(order.getUserId(), order.getQuantity(), Integer::sum);

                    Duration remainingTtl = Duration.between(now, order.getReservedUntil());
                    redisTemplate.opsForValue().set(String.format(RESERVATION_KEY, order.getId().toString()), "1", remainingTtl);
                    redisTemplate.opsForValue().set(String.format(ORDER_KEY, order.getId().toString()), OrderStatus.RESERVED.name());
                } else {
                    // Stale reservation -> mark EXPIRED in Postgres and Redis
                    order.setStatus(OrderStatus.EXPIRED);
                    orderRepository.save(order);
                    redisTemplate.opsForValue().set(String.format(ORDER_KEY, order.getId().toString()), OrderStatus.EXPIRED.name());
                    redisTemplate.delete(String.format(RESERVATION_KEY, order.getId().toString()));
                }
            } else {
                redisTemplate.opsForValue().set(String.format(ORDER_KEY, order.getId().toString()), order.getStatus().name());
            }
        }

        // 1. Rebuild true stock allocation
        int initialStock = sale.getStockAllocation();
        int rebuiltStock = Math.max(0, initialStock - (activeReservedCount + paidCount));

        redisTemplate.opsForValue().set(String.format(STOCK_KEY, saleId), String.valueOf(rebuiltStock));

        // 2. Rebuild sale configuration
        redisTemplate.opsForValue().set(String.format(SALE_STATUS_KEY, saleId), sale.getStatus().name());
        redisTemplate.opsForValue().set(String.format(SALE_LIMIT_KEY, saleId), String.valueOf(sale.getPerUserLimit()));
        redisTemplate.opsForValue().set(String.format(SALE_PRICE_KEY, saleId), sale.getSalePrice().toPlainString());
        if (sale.getProduct() != null) {
            redisTemplate.opsForValue().set(String.format(SALE_PRODUCT_KEY, saleId), String.valueOf(sale.getProduct().getId()));
        }

        // 3. Rebuild user limits to prevent bypass
        for (Map.Entry<Long, Integer> entry : userOrderCounts.entrySet()) {
            redisTemplate.opsForValue().set(String.format(USER_ORDERS_KEY, saleId, entry.getKey()), String.valueOf(entry.getValue()));
        }

        auditService.log(1L, "REDIS_RECOVERY", "SALE", saleId.toString(),
                String.format("Rebuilt Redis stock: %d (initial: %d, reserved: %d, paid: %d)",
                        rebuiltStock, initialStock, activeReservedCount, paidCount),
                null);

        log.info("Redis recovery complete for saleId={}: rebuiltStock={}, activeReserved={}, paid={}, userKeys={}",
                saleId, rebuiltStock, activeReservedCount, paidCount, userOrderCounts.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("saleId", saleId);
        result.put("saleTitle", sale.getTitle());
        result.put("initialStock", initialStock);
        result.put("rebuiltStock", rebuiltStock);
        result.put("activeReservedCount", activeReservedCount);
        result.put("paidCount", paidCount);
        result.put("usersRestored", userOrderCounts.size());
        result.put("status", "SUCCESS");
        result.put("recoveredAt", now);

        return result;
    }
}
