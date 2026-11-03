package com.flashsale.core_service.service;

import com.flashsale.core_service.dto.SaleMetricsResponse;
import com.flashsale.core_service.dto.SaleRequest;
import com.flashsale.core_service.dto.SaleResponse;
import com.flashsale.core_service.entity.OrderStatus;
import com.flashsale.core_service.entity.Product;
import com.flashsale.core_service.entity.Sale;
import com.flashsale.core_service.entity.SaleStatus;
import com.flashsale.core_service.exception.BadRequestException;
import com.flashsale.core_service.exception.ResourceNotFoundException;
import com.flashsale.core_service.repository.OrderRepository;
import com.flashsale.core_service.repository.ProductRepository;
import com.flashsale.core_service.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String STOCK_KEY = "flashsale:stock:%d";

    @Transactional
    public SaleResponse createSale(SaleRequest request) {
        if (request.getEndTime().isBefore(request.getStartTime())) {
            throw new BadRequestException("End time must be after start time");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        Sale sale = Sale.builder()
                .product(product)
                .title(request.getTitle())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .salePrice(request.getSalePrice())
                .stockAllocation(request.getStockAllocation())
                .perUserLimit(request.getPerUserLimit())
                .status(SaleStatus.SCHEDULED)
                .preloaded(false)
                .build();

        sale = saleRepository.save(sale);
        return mapToResponse(sale);
    }

    public List<SaleResponse> getPublicSales() {
        return saleRepository.findPublicSales().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public List<SaleResponse> getAllAdminSales() {
        return saleRepository.findAll().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public SaleResponse getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + id));
        return mapToResponse(sale);
    }

    @Transactional
    public SaleResponse updateStatus(Long id, SaleStatus newStatus) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + id));

        sale.setStatus(newStatus);
        sale = saleRepository.save(sale);

        // Update status in Redis
        redisTemplate.opsForValue().set("flashsale:sale:" + id + ":status", newStatus.name());
        return mapToResponse(sale);
    }

    public SaleMetricsResponse getSaleMetrics(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + saleId));

        Integer remainingStock = getRemainingStock(saleId, sale.getStockAllocation());
        long reserved = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.RESERVED);
        long paid = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.PAID);
        long expired = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.EXPIRED);
        long cancelled = orderRepository.countBySaleIdAndStatus(saleId, OrderStatus.CANCELLED);

        return SaleMetricsResponse.builder()
                .saleId(saleId)
                .initialStock(sale.getStockAllocation())
                .remainingStock(remainingStock)
                .reservedOrders(reserved)
                .paidOrders(paid)
                .expiredOrders(expired)
                .cancelledOrders(cancelled)
                .build();
    }

    private Integer getRemainingStock(Long saleId, Integer defaultStock) {
        try {
            String val = redisTemplate.opsForValue().get(String.format(STOCK_KEY, saleId));
            if (val != null) {
                return Integer.parseInt(val);
            }
        } catch (Exception e) {
            log.warn("Failed to read remaining stock from Redis for saleId={}", saleId);
        }
        return defaultStock;
    }

    private SaleResponse mapToResponse(Sale sale) {
        Integer remaining = getRemainingStock(sale.getId(), sale.getStockAllocation());

        return SaleResponse.builder()
                .id(sale.getId())
                .productId(sale.getProduct().getId())
                .productName(sale.getProduct().getName())
                .productDescription(sale.getProduct().getDescription())
                .productImageUrl(sale.getProduct().getImageUrl())
                .originalPrice(sale.getProduct().getPrice())
                .title(sale.getTitle())
                .startTime(sale.getStartTime())
                .endTime(sale.getEndTime())
                .salePrice(sale.getSalePrice())
                .stockAllocation(sale.getStockAllocation())
                .remainingStock(remaining)
                .perUserLimit(sale.getPerUserLimit())
                .status(sale.getStatus())
                .preloaded(sale.getPreloaded())
                .build();
    }
}
