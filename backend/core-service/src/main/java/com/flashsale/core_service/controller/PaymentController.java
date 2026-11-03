package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.MockPaymentRequest;
import com.flashsale.core_service.entity.Payment;
import com.flashsale.core_service.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
}
