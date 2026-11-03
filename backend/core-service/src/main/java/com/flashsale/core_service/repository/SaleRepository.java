package com.flashsale.core_service.repository;

import com.flashsale.core_service.entity.Sale;
import com.flashsale.core_service.entity.SaleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {

    List<Sale> findByStatus(SaleStatus status);

    @Query("SELECT s FROM Sale s WHERE s.status IN ('SCHEDULED', 'LIVE', 'ENDED') ORDER BY s.startTime DESC")
    List<Sale> findPublicSales();

    // Sales that need Redis preloading: SCHEDULED, preloaded = false, start_time <= now + 2 minutes
    @Query("SELECT s FROM Sale s WHERE s.status = 'SCHEDULED' AND s.preloaded = false AND s.startTime <= :preloadWindow")
    List<Sale> findSalesToPreload(@Param("preloadWindow") Instant preloadWindow);

    // Sales ready to transition to LIVE: SCHEDULED, start_time <= now
    @Query("SELECT s FROM Sale s WHERE s.status = 'SCHEDULED' AND s.startTime <= :now")
    List<Sale> findSalesToStart(@Param("now") Instant now);

    // Sales that should end: LIVE, end_time <= now
    @Query("SELECT s FROM Sale s WHERE s.status = 'LIVE' AND s.endTime <= :now")
    List<Sale> findSalesToEnd(@Param("now") Instant now);
}
