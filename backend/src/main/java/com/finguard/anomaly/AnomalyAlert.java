package com.finguard.anomaly;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "anomaly_alerts")
public class AnomalyAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private Long transactionId;
    @Column(nullable = false) private int riskScore;
    @Column(nullable = false) private int ruleScore;
    private Integer mlScore;
    @Column(nullable = false, length = 32) private String mlStatus;
    @Column(length = 100) private String modelVersion;
    @Column(nullable = false, length = 4000) private String reasons;
    @Column(nullable = false, length = 4000) private String featuresJson;
    @Column(nullable = false) private LocalDateTime detectedAt;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 32) private InvestigationStatus status;

    protected AnomalyAlert() { }
    public AnomalyAlert(long transactionId, int riskScore, int ruleScore, MlClient.Prediction ml,
                        String reasons, String featuresJson) {
        this.transactionId = transactionId;
        this.riskScore = riskScore;
        this.ruleScore = ruleScore;
        this.mlScore = ml.score();
        this.mlStatus = ml.status();
        this.modelVersion = ml.modelVersion();
        this.reasons = reasons;
        this.featuresJson = featuresJson;
        this.detectedAt = LocalDateTime.now(ZoneOffset.UTC);
        this.status = riskScore >= 40 ? InvestigationStatus.OPEN : InvestigationStatus.NOT_REQUIRED;
    }
    public Long getId() { return id; }
    public Long getTransactionId() { return transactionId; }
    public int getRiskScore() { return riskScore; }
    public int getRuleScore() { return ruleScore; }
    public Integer getMlScore() { return mlScore; }
    public String getMlStatus() { return mlStatus; }
    public String getModelVersion() { return modelVersion; }
    public String getReasons() { return reasons; }
    public String getFeaturesJson() { return featuresJson; }
    public LocalDateTime getDetectedAt() { return detectedAt; }
    public InvestigationStatus getStatus() { return status; }
    public void review(InvestigationStatus status) { this.status = status; }
}
