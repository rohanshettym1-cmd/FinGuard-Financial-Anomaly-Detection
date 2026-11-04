package com.finguard.anomaly;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface AlertRepository extends JpaRepository<AnomalyAlert, Long> {
    Optional<AnomalyAlert> findByTransactionId(long transactionId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AnomalyAlert a where a.id = :id")
    Optional<AnomalyAlert> lockById(@Param("id") long id);
    @Query("select a from AnomalyAlert a where (:status is null or a.status = :status) "
            + "and (:includeNormal = true or a.riskScore >= 40)")
    Page<AnomalyAlert> search(@Param("status") InvestigationStatus status,
                              @Param("includeNormal") boolean includeNormal, Pageable pageable);
}
