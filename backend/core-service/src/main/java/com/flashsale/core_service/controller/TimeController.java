package com.flashsale.core_service.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/time")
@CrossOrigin(origins = "*")
public class TimeController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> getServerTime() {
        return ResponseEntity.ok(Map.of(
                "serverTime", Instant.now().toEpochMilli(),
                "iso", Instant.now().toString()
        ));
    }
}
