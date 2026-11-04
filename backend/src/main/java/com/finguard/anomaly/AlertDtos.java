package com.finguard.anomaly;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public final class AlertDtos {
    private AlertDtos() { }
    public record AlertResponse(Long id, Long transactionId, int riskScore, int ruleScore, Integer mlScore,
                                String mlStatus, String modelVersion, List<String> triggeredRules,
                                JsonNode features, LocalDateTime detectedAt, InvestigationStatus status) { }
    public record AlertPage(List<AlertResponse> content, int page, int size, long totalElements, int totalPages) { }
    public record ReviewRequest(@NotNull InvestigationStatus status, @NotBlank @Size(max = 100) String analyst,
                                 @NotBlank @Size(max = 1000) String notes) { }
    public record ReviewResponse(Long id, Long alertId, InvestigationStatus previousStatus,
                                  InvestigationStatus status, String analyst, String notes, LocalDateTime reviewedAt) {
        public static ReviewResponse from(AlertReview review) {
            return new ReviewResponse(review.getId(), review.getAlertId(), review.getPreviousStatus(), review.getStatus(),
                    review.getAnalyst(), review.getNotes(), review.getReviewedAt());
        }
    }
}
