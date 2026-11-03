package com.flashsale.order_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RedisTemplate<String, String> redisTemplate;

    @Value("${app.rate-limit.max-orders-per-user:3}")
    private int maxOrdersPerUser;

    @Value("${app.rate-limit.window-seconds:60}")
    private long windowSeconds;

    private static final String KEY_PREFIX = "flashsale:user:%d:count";

    /**
     * Returns true if the user is ALLOWED to place an order.
     * Uses an increment + expiry strategy — first request in the window sets the TTL.
     */
    public boolean isAllowed(int userId) {
        String key = String.format(KEY_PREFIX, userId);
        Long count = redisTemplate.opsForValue().increment(key);

        if (count == null) return false;

        // Set TTL only on first hit of the window
        if (count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
        }

        return count <= maxOrdersPerUser;
    }
}
