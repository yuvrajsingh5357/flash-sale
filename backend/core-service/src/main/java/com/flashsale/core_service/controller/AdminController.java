package com.flashsale.core_service.controller;

import com.flashsale.core_service.dto.OrderDto;
import com.flashsale.core_service.dto.ReconciliationReportDto;
import com.flashsale.core_service.entity.AuditLog;
import com.flashsale.core_service.entity.Payment;
import com.flashsale.core_service.service.AuditService;
import com.flashsale.core_service.service.PaymentService;
import com.flashsale.core_service.service.ReconciliationService;
import com.flashsale.core_service.service.RedisRecoveryService;
import com.flashsale.core_service.service.ShopperOrderService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.Instant;
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
    private final ReconciliationService reconciliationService;
    private final RedisRecoveryService redisRecoveryService;

    // ─── Orders & Refunds (A6) ────────────────────────────────────────────────

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDto>> getAllOrders() {
        return ResponseEntity.ok(shopperOrderService.getAllOrdersForAdmin());
    }

    @PostMapping("/orders/{orderId}/refund")
    public ResponseEntity<Payment> refundOrder(@PathVariable UUID orderId, @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : "Admin refund";
        return ResponseEntity.ok(paymentService.refundOrder(orderId, reason));
    }

    // A6: CSV Export
    @GetMapping("/orders/export")
    public void exportOrdersCsv(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"flashsale_orders_" + Instant.now().getEpochSecond() + ".csv\"");

        List<OrderDto> orders = shopperOrderService.getAllOrdersForAdmin();

        String[] headers = {"Order ID", "Sale ID", "User ID", "Product ID", "Product Name", "Quantity", "Total Amount", "Status", "Reserved Until", "Created At"};
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader(headers).build();

        try (CSVPrinter printer = new CSVPrinter(response.getWriter(), format)) {
            for (OrderDto o : orders) {
                printer.printRecord(
                        o.getId(),
                        o.getSaleId(),
                        o.getUserId(),
                        o.getProductId(),
                        o.getProductName(),
                        o.getQuantity(),
                        o.getTotalAmount(),
                        o.getStatus(),
                        o.getReservedUntil(),
                        o.getCreatedAt()
                );
            }
            printer.flush();
        }
    }

    // ─── Inventory Reconciliation (S5) ────────────────────────────────────────

    @GetMapping("/reconciliation/report")
    public ResponseEntity<List<ReconciliationReportDto>> getReconciliationReports() {
        return ResponseEntity.ok(reconciliationService.reconcileAllSales());
    }

    @GetMapping("/reconciliation/report/{saleId}")
    public ResponseEntity<ReconciliationReportDto> getReconciliationReportForSale(@PathVariable Long saleId) {
        return ResponseEntity.ok(reconciliationService.reconcileSale(saleId));
    }

    // ─── Redis Recovery (S6) ──────────────────────────────────────────────────

    @PostMapping("/sales/{saleId}/rebuild-redis")
    public ResponseEntity<Map<String, Object>> rebuildRedis(@PathVariable Long saleId) {
        return ResponseEntity.ok(redisRecoveryService.rebuildRedisForSale(saleId));
    }

    // ─── Audit Log (A7) ───────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditService.getRecentLogs());
    }
}
