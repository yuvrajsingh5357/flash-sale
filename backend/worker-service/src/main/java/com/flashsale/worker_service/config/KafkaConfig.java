package com.flashsale.worker_service.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Slf4j
@Configuration
public class KafkaConfig {

    @Bean
    public CommonErrorHandler errorHandler(KafkaOperations<String, String> kafkaOperations) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaOperations,
                (record, exception) -> {
                    log.error("Moving failed order event from topic {} partition {} offset {} to order_events.DLT. Cause: {}",
                            record.topic(), record.partition(), record.offset(), exception.getMessage());
                    return new TopicPartition("order_events.DLT", 0);
                });

        // 3 retry attempts with 1000ms delay before publishing to DLT
        return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3L));
    }
}
