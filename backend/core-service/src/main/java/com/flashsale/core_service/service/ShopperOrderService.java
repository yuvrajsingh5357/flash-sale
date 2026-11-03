package com.flashsale.core_service.service;

import com.flashsale.core_service.dto.OrderDto;
import com.flashsale.core_service.entity.Order;
import com.flashsale.core_service.entity.Product;
import com.flashsale.core_service.exception.BadRequestException;
import com.flashsale.core_service.exception.ResourceNotFoundException;
import com.flashsale.core_service.repository.OrderRepository;
import com.flashsale.core_service.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopperOrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;

    public List<OrderDto> getOrdersForUser(Long userId) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Map<Long, String> productNames = productRepository.findAll().stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));

        return orders.stream()
                .map(o -> mapToDto(o, productNames.getOrDefault(o.getProductId(), "Flash Sale Item")))
                .toList();
    }

    public OrderDto getOrderById(Long userId, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BadRequestException("Unauthorized access to order");
        }

        String productName = productRepository.findById(order.getProductId())
                .map(Product::getName)
                .orElse("Flash Sale Item");

        return mapToDto(order, productName);
    }

    public List<OrderDto> getAllOrdersForAdmin() {
        List<Order> orders = orderRepository.findAll();
        Map<Long, String> productNames = productRepository.findAll().stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));

        return orders.stream()
                .map(o -> mapToDto(o, productNames.getOrDefault(o.getProductId(), "Flash Sale Item")))
                .toList();
    }

    private OrderDto mapToDto(Order order, String productName) {
        return OrderDto.builder()
                .id(order.getId())
                .userId(order.getUserId())
                .saleId(order.getSaleId())
                .productId(order.getProductId())
                .productName(productName)
                .quantity(order.getQuantity())
                .unitPrice(order.getUnitPrice())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .reservedUntil(order.getReservedUntil())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
