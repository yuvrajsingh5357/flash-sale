package com.flashsale.order_service.controller;

import com.flashsale.order_service.dto.InitSaleRequest;
import com.flashsale.order_service.dto.OrderResponse;
import com.flashsale.order_service.dto.PlaceOrderRequest;
import com.flashsale.order_service.service.OrderService;
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
     * Place a new order.
     * Returns 429 if rate-limited, 409 if sold out, 202 if accepted (PENDING).
     */
    @PostMapping("/orders/place")
    public ResponseEntity<OrderResponse> placeOrder(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody PlaceOrderRequest request) {
        OrderResponse response = orderService.placeOrder(request, idempotencyKey);

        HttpStatus status = switch (response.getStatus()) {
            case "RATE_LIMITED" -> HttpStatus.TOO_MANY_REQUESTS;
            case "SOLD_OUT" -> HttpStatus.CONFLICT;
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
        return ResponseEntity.ok("Flash sale initialized for productId: " + request.getProductId());
    }
}
