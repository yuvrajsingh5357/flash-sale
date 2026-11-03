package com.flashsale.core_service.service;

import com.flashsale.core_service.dto.MockPaymentRequest;
import com.flashsale.core_service.entity.Order;
import com.flashsale.core_service.entity.OrderStatus;
import com.flashsale.core_service.entity.Payment;
import com.flashsale.core_service.entity.PaymentStatus;
import com.flashsale.core_service.exception.BadRequestException;
import com.flashsale.core_service.exception.ResourceNotFoundException;
import com.flashsale.core_service.repository.OrderRepository;
import com.flashsale.core_service.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditService auditService;

    private static final String STOCK_KEY = "flashsale:stock:%d";
    private static final String USER_ORDERS_KEY = "flashsale:user_orders:%d:%d";
    private static final String ORDER_KEY = "flashsale:order:%s";

    @Transactional
    public Payment processMockPayment(Long userId, MockPaymentRequest request) {
        UUID orderId = request.getOrderId();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BadRequestException("Unauthorized access to order");
        }

        if (order.getStatus() != OrderStatus.RESERVED) {
            throw new BadRequestException("Order cannot be paid. Current status: " + order.getStatus());
        }

        Instant now = Instant.now();
        if (order.getReservedUntil().isBefore(now)) {
            throw new BadRequestException("Reservation expired. Cannot process payment.");
        }

        UUID paymentId = UUID.randomUUID();

        if (request.isShouldSucceed()) {
            Payment payment = Payment.builder()
                    .id(paymentId)
                    .orderId(orderId)
                    .userId(userId)
                    .amount(order.getTotalAmount())
                    .currency("INR")
                    .provider("MOCK")
                    .gatewayPaymentId("mock_pay_" + UUID.randomUUID())
                    .status(PaymentStatus.SUCCESS)
                    .build();

            payment = paymentRepository.save(payment);

            order.setStatus(OrderStatus.PAID);
            orderRepository.save(order);

            // Update Redis
            redisTemplate.opsForValue().set(String.format(ORDER_KEY, orderId.toString()), OrderStatus.PAID.name());
            // Delete reservation TTL key
            redisTemplate.delete("flashsale:reservation:" + orderId);

            auditService.log(userId, "PAYMENT_SUCCESS", "ORDER", orderId.toString(), "Mock payment succeeded", null);
            log.info("Payment SUCCESS for orderId={}, paymentId={}", orderId, paymentId);
            return payment;
        } else {
            Payment payment = Payment.builder()
                    .id(paymentId)
                    .orderId(orderId)
                    .userId(userId)
                    .amount(order.getTotalAmount())
                    .currency("INR")
                    .provider("MOCK")
                    .status(PaymentStatus.FAILED)
                    .errorMessage(request.getFailureReason() != null ? request.getFailureReason() : "Payment rejected by user/bank")
                    .build();

            payment = paymentRepository.save(payment);
            auditService.log(userId, "PAYMENT_FAILED", "ORDER", orderId.toString(), "Mock payment failed", null);
            log.warn("Payment FAILED for orderId={}, reason={}", orderId, payment.getErrorMessage());
            return payment;
        }
    }

    @Transactional
    public void cancelReservation(Long userId, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BadRequestException("Unauthorized access to order");
        }

        if (order.getStatus() != OrderStatus.RESERVED) {
            throw new BadRequestException("Only RESERVED orders can be cancelled. Current status: " + order.getStatus());
        }

        int updated = orderRepository.transitionStatus(orderId, OrderStatus.RESERVED, OrderStatus.CANCELLED, Instant.now());
        if (updated > 0) {
            // Restore Redis stock
            String stockKey = String.format(STOCK_KEY, order.getSaleId());
            redisTemplate.opsForValue().increment(stockKey, order.getQuantity());

            // Decrement user limit
            String userOrdersKey = String.format(USER_ORDERS_KEY, order.getSaleId(), userId);
            redisTemplate.opsForValue().decrement(userOrdersKey, order.getQuantity());

            // Update Redis order status & delete reservation TTL
            redisTemplate.opsForValue().set(String.format(ORDER_KEY, orderId.toString()), OrderStatus.CANCELLED.name());
            redisTemplate.delete("flashsale:reservation:" + orderId);

            auditService.log(userId, "ORDER_CANCELLED", "ORDER", orderId.toString(), "Reservation cancelled by shopper", null);
            log.info("Reservation cancelled: orderId={}, restored stock={}", orderId, order.getQuantity());
        }
    }

    @Transactional
    public Payment refundOrder(UUID orderId, String reason) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));

        if (order.getStatus() != OrderStatus.PAID) {
            throw new BadRequestException("Only PAID orders can be refunded. Current status: " + order.getStatus());
        }

        order.setStatus(OrderStatus.REFUNDED);
        orderRepository.save(order);

        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElse(Payment.builder()
                        .id(UUID.randomUUID())
                        .orderId(orderId)
                        .userId(order.getUserId())
                        .amount(order.getTotalAmount())
                        .currency("INR")
                        .provider("MOCK")
                        .build());

        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setErrorMessage("Refunded: " + (reason != null ? reason : "Admin initiated"));
        payment = paymentRepository.save(payment);

        redisTemplate.opsForValue().set(String.format(ORDER_KEY, orderId.toString()), OrderStatus.REFUNDED.name());
        auditService.log(order.getUserId(), "ORDER_REFUNDED", "ORDER", orderId.toString(), reason, null);
        log.info("Order refunded: orderId={}", orderId);
        return payment;
    }
}
