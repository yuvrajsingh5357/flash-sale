package com.flashsale.worker_service.controller;

import com.flashsale.worker_service.entity.Order;
import com.flashsale.worker_service.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final OrderRepository orderRepository;
    private static final String ADMIN_KEY = "super-secret";

    private boolean isAuthorized(String key) {
        return ADMIN_KEY.equals(key);
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getAllOrders(@RequestHeader(value = "X-ADMIN-KEY", required = false) String key) {
        if (!isAuthorized(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(orderRepository.findAll());
    }

    @GetMapping("/reservations")
    public ResponseEntity<List<Order>> getActiveReservations(@RequestHeader(value = "X-ADMIN-KEY", required = false) String key) {
        if (!isAuthorized(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(orderRepository.findByStatus("RESERVED"));
    }
}
