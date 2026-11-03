package com.flashsale.order_service.controller;

import com.flashsale.order_service.dto.InitSaleRequest;
import com.flashsale.order_service.dto.OrderResponse;
import com.flashsale.order_service.dto.PlaceOrderRequest;
import com.flashsale.order_service.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class OrderController {

    private final OrderService orderService;

    /**
     * Hot path reservation endpoint.
     * Accessible at both /orders/place and /orders/reserve.
     */
    @PostMapping({"/orders/place", "/orders/reserve"})
    public ResponseEntity<OrderResponse> placeOrder(
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody PlaceOrderRequest request) {

        Long userId = (Long) servletRequest.getAttribute("userId");
        if (userId == null) {
            userId = 1L; // Fallback for unauthenticated direct testing if filter bypassed
        }

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            idempotencyKey = java.util.UUID.randomUUID().toString();
        }

        OrderResponse response = orderService.placeOrder(userId, request, idempotencyKey);

        HttpStatus status = switch (response.getStatus()) {
            case "RATE_LIMITED" -> HttpStatus.TOO_MANY_REQUESTS;
            case "SOLD_OUT" -> HttpStatus.CONFLICT;
            case "LIMIT_REACHED", "SALE_NOT_LIVE" -> HttpStatus.BAD_REQUEST;
            case "CONFLICT" -> HttpStatus.CONFLICT;
            default -> HttpStatus.ACCEPTED;
        };

        return ResponseEntity.status(status).body(response);
    }

    /**
     * Get current order status (reads from Redis).
     */
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable String orderId) {
        OrderResponse response = orderService.getOrderStatus(orderId);

        HttpStatus status = "NOT_FOUND".equals(response.getStatus())
                ? HttpStatus.NOT_FOUND
                : HttpStatus.OK;

        return ResponseEntity.status(status).body(response);
    }

    /**
     * Admin endpoint to seed stock into Redis before a flash sale.
     */
    @PostMapping("/admin/init")
    public ResponseEntity<String> initSale(@RequestBody InitSaleRequest request) {
        orderService.initSale(request);
        return ResponseEntity.ok("Flash sale initialized for sale/productId: " + request.getProductId());
    }
}
