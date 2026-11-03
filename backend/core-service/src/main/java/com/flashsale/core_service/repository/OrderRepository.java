package com.flashsale.core_service.repository;

import com.flashsale.core_service.entity.Order;
import com.flashsale.core_service.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Order> findBySaleIdOrderByCreatedAtDesc(Long saleId);

    long countBySaleIdAndStatus(Long saleId, OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.status = 'RESERVED' AND o.reservedUntil < :now")
    List<Order> findExpiredReservations(@Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = :newStatus, o.updatedAt = :now WHERE o.id = :id AND o.status = :expectedStatus")
    int transitionStatus(@Param("id") UUID id,
                         @Param("expectedStatus") OrderStatus expectedStatus,
                         @Param("newStatus") OrderStatus newStatus,
                         @Param("now") Instant now);
}
