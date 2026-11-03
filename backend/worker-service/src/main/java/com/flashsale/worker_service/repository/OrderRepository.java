package com.flashsale.worker_service.repository;

import com.flashsale.worker_service.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = 'EXPIRED' WHERE o.id = :id AND o.status = 'RESERVED'")
    int markAsExpired(@Param("id") UUID id);

    @Query("SELECT o FROM Order o WHERE o.status = 'RESERVED' AND o.reservedUntil < :time")
    List<Order> findExpiredReservations(@Param("time") Instant time);

    List<Order> findByStatus(String status);
}
