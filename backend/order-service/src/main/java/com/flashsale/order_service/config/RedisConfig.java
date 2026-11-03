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
     * Lua script for atomic stock decrement.
     * Returns 1 if success, 0 if stock is exhausted.
     *
     * KEYS[1] = flashsale:stock:{productId}
     * ARGV[1] = quantity to decrement
     */
    @Bean
    public DefaultRedisScript<Long> stockDecrementScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText("""
                local stock = tonumber(redis.call('GET', KEYS[1]))
                if stock == nil or stock < tonumber(ARGV[1]) then
                    return 0
                end
                redis.call('DECRBY', KEYS[1], ARGV[1])
                return 1
                """);
        script.setResultType(Long.class);
        return script;
    }
}
