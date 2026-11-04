package com.finguard.anomaly;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "alert_reviews")
public class AlertReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long alertId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 32) private InvestigationStatus previousStatus;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 32) private InvestigationStatus status;
    @Column(nullable = false, length = 100) private String analyst;
    @Column(nullable = false, length = 1000) private String notes;
    @Column(nullable = false) private LocalDateTime reviewedAt;
    protected AlertReview() { }
    public AlertReview(AnomalyAlert alert, InvestigationStatus status, String analyst, String notes) {
        this.alertId = alert.getId(); this.previousStatus = alert.getStatus(); this.status = status;
        this.analyst = analyst; this.notes = notes; this.reviewedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
    public Long getId() { return id; }
    public Long getAlertId() { return alertId; }
    public InvestigationStatus getPreviousStatus() { return previousStatus; }
    public InvestigationStatus getStatus() { return status; }
    public String getAnalyst() { return analyst; }
    public String getNotes() { return notes; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
}
