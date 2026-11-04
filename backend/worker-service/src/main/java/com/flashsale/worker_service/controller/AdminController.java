package com.flashsale.worker_service.controller;

import com.flashsale.worker_service.entity.Order;
import com.flashsale.worker_service.repository.OrderRepository;
import com.flashsale.worker_service.service.DltService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final OrderRepository orderRepository;
    private final DltService dltService;
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

    // ─── S7 Dead-Letter Handling & Replay ─────────────────────────────────────

    @GetMapping("/dlt")
    public ResponseEntity<List<String>> getDeadLetters(@RequestHeader(value = "X-ADMIN-KEY", required = false) String key) {
        if (!isAuthorized(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(dltService.getDeadLetterMessages());
    }

    @PostMapping("/dlt/replay")
    public ResponseEntity<Map<String, Object>> replayDeadLetters(@RequestHeader(value = "X-ADMIN-KEY", required = false) String key) {
        if (!isAuthorized(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int replayedCount = dltService.replayDeadLetters();
        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "replayedCount", replayedCount,
                "message", "Replayed " + replayedCount + " dead-letter messages to order_events"
        ));
    }
}
