package com.finguard.anomaly;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finguard.common.ApiException;
import com.finguard.transaction.TransactionRepository;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import static com.finguard.anomaly.AlertDtos.*;

@Service
@Transactional(readOnly = true)
public class AlertService {
    private final AlertRepository alerts;
    private final AlertReviewRepository reviews;
    private final TransactionRepository transactions;
    private final ObjectMapper json;
    public AlertService(AlertRepository alerts, AlertReviewRepository reviews,
                         TransactionRepository transactions, ObjectMapper json) {
        this.alerts = alerts; this.reviews = reviews; this.transactions = transactions; this.json = json;
    }
    public AlertResponse get(long id) { return response(requireAlert(id)); }
    public Optional<AlertResponse> transactionRisk(long id) {
        if (!transactions.existsById(id)) { throw ApiException.notFound("Transaction"); }
        return alerts.findByTransactionId(id).map(this::response);
    }
    public AlertPage list(InvestigationStatus status, boolean includeNormal, int page, int size) {
        var result = alerts.search(status, includeNormal, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        return new AlertPage(result.map(this::response).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }
    @Transactional
    public ReviewResponse review(long id, ReviewRequest request) {
        var alert = alerts.lockById(id).orElseThrow(() -> ApiException.notFound("Alert"));
        if (alert.getRiskScore() < 40 || request.status() == InvestigationStatus.NOT_REQUIRED) {
            throw ApiException.invalid("INVALID_REVIEW", "Only flagged alerts can be reviewed; choose an investigation status");
        }
        var review = reviews.saveAndFlush(new AlertReview(alert, request.status(), request.analyst().strip(), request.notes().strip()));
        alert.review(request.status());
        return ReviewResponse.from(review);
    }
    public List<ReviewResponse> reviews(long id) {
        requireAlert(id);
        return reviews.findByAlertIdOrderByIdAsc(id).stream().map(ReviewResponse::from).toList();
    }
    private AnomalyAlert requireAlert(long id) {
        return alerts.findById(id).orElseThrow(() -> ApiException.notFound("Alert"));
    }
    private AlertResponse response(AnomalyAlert alert) {
        try {
            return new AlertResponse(alert.getId(), alert.getTransactionId(), alert.getRiskScore(), alert.getRuleScore(),
                    alert.getMlScore(), alert.getMlStatus(), alert.getModelVersion(), Arrays.asList(alert.getReasons().split("\n")),
                    json.readTree(alert.getFeaturesJson()), alert.getDetectedAt(), alert.getStatus());
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Invalid stored features", exception); }
    }
}
