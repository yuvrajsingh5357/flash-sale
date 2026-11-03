package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.SaleMetricsResponse;
import com.flashsale.core_service.dto.SaleRequest;
import com.flashsale.core_service.dto.SaleResponse;
import com.flashsale.core_service.entity.SaleStatus;
import com.flashsale.core_service.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SaleController {

    private final SaleService saleService;

    @GetMapping("/api/v1/sales/public")
    public ResponseEntity<List<SaleResponse>> getPublicSales() {
        return ResponseEntity.ok(saleService.getPublicSales());
    }

    @GetMapping("/api/v1/sales/{id}")
    public ResponseEntity<SaleResponse> getSaleById(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getSaleById(id));
    }

    @PostMapping("/api/v1/admin/sales")
    public ResponseEntity<SaleResponse> createSale(@Valid @RequestBody SaleRequest request) {
        return ResponseEntity.ok(saleService.createSale(request));
    }

    @GetMapping("/api/v1/admin/sales")
    public ResponseEntity<List<SaleResponse>> getAllAdminSales() {
        return ResponseEntity.ok(saleService.getAllAdminSales());
    }

    @PutMapping("/api/v1/admin/sales/{id}/status")
    public ResponseEntity<SaleResponse> updateSaleStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        SaleStatus status = SaleStatus.valueOf(body.get("status"));
        return ResponseEntity.ok(saleService.updateStatus(id, status));
    }

    @GetMapping("/api/v1/admin/sales/{id}/metrics")
    public ResponseEntity<SaleMetricsResponse> getSaleMetrics(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getSaleMetrics(id));
    }
}
