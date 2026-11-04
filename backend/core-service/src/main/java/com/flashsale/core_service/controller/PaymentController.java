package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.MockPaymentRequest;
import com.flashsale.core_service.dto.RazorpayOrderRequest;
import com.flashsale.core_service.dto.RazorpayOrderResponse;
import com.flashsale.core_service.entity.Payment;
import com.flashsale.core_service.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/mock-complete")
    public ResponseEntity<Payment> mockCompletePayment(
            Authentication authentication,
            @Valid @RequestBody MockPaymentRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(paymentService.processMockPayment(userId, request));
    }

    @PostMapping("/razorpay/create-order")
    public ResponseEntity<RazorpayOrderResponse> createRazorpayOrder(
            Authentication authentication,
            @Valid @RequestBody RazorpayOrderRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(paymentService.createRazorpayOrder(userId, request.getOrderId()));
    }

    @PostMapping("/webhook/razorpay")
    public ResponseEntity<Map<String, String>> razorpayWebhook(
            @RequestBody String rawPayload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        paymentService.processRazorpayWebhook(rawPayload, signature);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
