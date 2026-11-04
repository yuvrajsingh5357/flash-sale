package com.flashsale.worker_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DltService {

    private final RedisTemplate<String, String> redisTemplate;
    private final KafkaOperations<String, String> kafkaOperations;

    private static final String DLT_REDIS_KEY = "flashsale:dlt:messages";
    private static final String TARGET_TOPIC = "order_events";

    @KafkaListener(topics = "order_events.DLT", groupId = "worker-dlt-storage-group")
    public void captureDltMessage(String payload) {
        log.warn("Captured Dead-Letter message in order_events.DLT: {}", payload);
        redisTemplate.opsForList().rightPush(DLT_REDIS_KEY, payload);
    }

    public List<String> getDeadLetterMessages() {
        Long size = redisTemplate.opsForList().size(DLT_REDIS_KEY);
        if (size == null || size == 0) {
            return List.of();
        }
        List<String> messages = redisTemplate.opsForList().range(DLT_REDIS_KEY, 0, size - 1);
        return messages != null ? messages : List.of();
    }

    public int replayDeadLetters() {
        List<String> messages = getDeadLetterMessages();
        if (messages.isEmpty()) {
            return 0;
        }

        int count = 0;
        for (String msg : messages) {
            try {
                kafkaOperations.send(TARGET_TOPIC, msg);
                count++;
                log.info("Replayed message to {}: {}", TARGET_TOPIC, msg);
            } catch (Exception e) {
                log.error("Failed to replay message to {}: {}", TARGET_TOPIC, e.getMessage());
            }
        }

        // Clear the DLT Redis list after successful replay
        redisTemplate.delete(DLT_REDIS_KEY);
        log.info("S7: Successfully replayed {} dead-letter messages to {}", count, TARGET_TOPIC);
        return count;
    }
}
