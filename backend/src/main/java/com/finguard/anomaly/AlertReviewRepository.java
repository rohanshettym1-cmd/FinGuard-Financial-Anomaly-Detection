package com.finguard.anomaly;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AlertReviewRepository extends JpaRepository<AlertReview, Long> {
    List<AlertReview> findByAlertIdOrderByIdAsc(long alertId);
}
