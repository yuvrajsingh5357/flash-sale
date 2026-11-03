package com.flashsale.order_service.service;

import com.flashsale.order_service.config.KafkaConfig;
import com.flashsale.order_service.event.OrderEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;

@Slf4j
@Component
@RequiredArgsConstructor
public class FallbackProcessor {

    private final RedisTemplate<String, String> redisTemplate;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    private static final String FALLBACK_QUEUE = "flashsale:fallback_queue";

    @Scheduled(fixedDelay = 5000)
    public void processFallbackQueue() {
        String eventJson = redisTemplate.opsForList().leftPop(FALLBACK_QUEUE);
        while (eventJson != null) {
            final String currentEventJson = eventJson;
            try {
                OrderEvent event = objectMapper.readValue(currentEventJson, OrderEvent.class);
                log.info("Retrying Kafka publish from fallback queue for orderId={}", event.getOrderId());
                kafkaTemplate.send(KafkaConfig.ORDER_TOPIC, event.getOrderId(), currentEventJson)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.error("Kafka publish failed again for orderId={}. Pushing back to queue.", event.getOrderId());
                                redisTemplate.opsForList().rightPush(FALLBACK_QUEUE, currentEventJson);
                            } else {
                                log.info("Successfully recovered Kafka publish for orderId={}", event.getOrderId());
                            }
                        });
            } catch (Exception e) {
                log.error("Failed to parse event from fallback queue: {}", currentEventJson, e);
            }
            eventJson = redisTemplate.opsForList().leftPop(FALLBACK_QUEUE);
        }
    }
}
