package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.OrderDto;
import com.flashsale.core_service.entity.AuditLog;
import com.flashsale.core_service.entity.Payment;
import com.flashsale.core_service.service.AuditService;
import com.flashsale.core_service.service.PaymentService;
import com.flashsale.core_service.service.ShopperOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final ShopperOrderService shopperOrderService;
    private final PaymentService paymentService;
    private final AuditService auditService;

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDto>> getAllOrders() {
        return ResponseEntity.ok(shopperOrderService.getAllOrdersForAdmin());
    }

    @PostMapping("/orders/{orderId}/refund")
    public ResponseEntity<Payment> refundOrder(@PathVariable UUID orderId, @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : "Admin refund";
        return ResponseEntity.ok(paymentService.refundOrder(orderId, reason));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditService.getRecentLogs());
    }
}
