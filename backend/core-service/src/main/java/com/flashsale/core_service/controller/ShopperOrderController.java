package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.OrderDto;
import com.flashsale.core_service.service.PaymentService;
import com.flashsale.core_service.service.ShopperOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/user/orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ShopperOrderController {

    private final ShopperOrderService shopperOrderService;
    private final PaymentService paymentService;

    @GetMapping
    public ResponseEntity<List<OrderDto>> getMyOrders(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(shopperOrderService.getOrdersForUser(userId));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderDto> getOrderDetails(Authentication authentication, @PathVariable UUID orderId) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(shopperOrderService.getOrderById(userId, orderId));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<Map<String, String>> cancelReservation(Authentication authentication, @PathVariable UUID orderId) {
        Long userId = Long.parseLong(authentication.getName());
        paymentService.cancelReservation(userId, orderId);
        return ResponseEntity.ok(Map.of("message", "Reservation cancelled successfully", "orderId", orderId.toString()));
    }
}
