package com.finguard.anomaly;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "detection_jobs")
public class DetectionJob {
    @Id private Long transactionId;
    @Column(nullable = false) private boolean completed;
    @Column(nullable = false) private LocalDateTime createdAt;

    protected DetectionJob() { }
    public DetectionJob(Long transactionId) {
        this.transactionId = transactionId;
        this.createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }
    public Long getTransactionId() { return transactionId; }
    public boolean isCompleted() { return completed; }
    public void complete() { completed = true; }
}
