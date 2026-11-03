package com.flashsale.order_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    /**
     * Generic RedisTemplate with String keys and values.
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        return template;
    }

    /**
     * Atomic Lua script checking sale status, user limit, and inventory stock.
     *
     * KEYS[1] = flashsale:stock:{saleId}
     * KEYS[2] = flashsale:user_orders:{saleId}:{userId}
     * KEYS[3] = flashsale:sale:{saleId}:limit
     * KEYS[4] = flashsale:sale:{saleId}:status
     *
     * ARGV[1] = quantity to reserve (typically 1)
     *
     * Returns:
     *   1 = RESERVED
     *   0 = SOLD_OUT
     *  -1 = SALE_NOT_LIVE
     *  -2 = LIMIT_REACHED
     */
    @Bean
    public DefaultRedisScript<Long> stockDecrementScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText("""
                -- 1. Check sale status
                local status = redis.call('GET', KEYS[4])
                if status ~= false and status ~= nil and status ~= 'LIVE' then
                    return -1
                end

                local qty = tonumber(ARGV[1])

                -- 2. Check per-user limit
                local limitVal = redis.call('GET', KEYS[3])
                local limit = limitVal and tonumber(limitVal) or 1
                local userCountVal = redis.call('GET', KEYS[2])
                local userCount = userCountVal and tonumber(userCountVal) or 0

                if (userCount + qty) > limit then
                    return -2
                end

                -- 3. Check inventory stock
                local stockVal = redis.call('GET', KEYS[1])
                local stock = stockVal and tonumber(stockVal) or 0
                if stock < qty then
                    return 0
                end

                -- 4. Atomic decrement stock & increment user order count
                redis.call('DECRBY', KEYS[1], qty)
                redis.call('INCRBY', KEYS[2], qty)
                return 1
                """);
        script.setResultType(Long.class);
        return script;
    }
}
