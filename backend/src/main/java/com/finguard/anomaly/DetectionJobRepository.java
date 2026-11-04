package com.finguard.anomaly;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface DetectionJobRepository extends JpaRepository<DetectionJob, Long> {
    List<DetectionJob> findByCompletedFalseOrderByTransactionIdAsc(Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from DetectionJob j where j.transactionId = :id")
    Optional<DetectionJob> lockById(@Param("id") long id);
}
