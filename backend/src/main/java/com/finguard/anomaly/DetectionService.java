package com.finguard.anomaly;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finguard.transaction.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;

@Service
public class DetectionService {
    private final DetectionJobRepository jobs;
    private final TransactionRepository transactions;
    private final AlertRepository alerts;
    private final RuleEngine rules;
    private final MlClient ml;
    private final ObjectMapper json;

    public DetectionService(DetectionJobRepository jobs, TransactionRepository transactions, AlertRepository alerts,
                            RuleEngine rules, MlClient ml, ObjectMapper json) {
        this.jobs = jobs; this.transactions = transactions; this.alerts = alerts;
        this.rules = rules; this.ml = ml; this.json = json;
    }

    // Separate from posting: failure leaves the durable job pending and never touches a balance.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void process(long transactionId) {
        var job = jobs.lockById(transactionId).orElseThrow();
        if (job.isCompleted()) { return; }
        var target = transactions.findById(transactionId).orElseThrow();
        var history = transactions.customerHistory(target.getAccount().getCustomer().getId(),
                target.getId(), target.getCreatedAt());
        var result = rules.evaluate(target, history);
        var prediction = ml.predict(result.features());
        var reasons = new ArrayList<>(result.reasons());
        int mlContribution = prediction.anomalous() ? Math.max(40, prediction.score()) : 0;
        if (prediction.anomalous()) {
            reasons.add("ML_ISOLATION_FOREST: unusual feature combination; training-score percentile "
                    + prediction.score() + " (not a fraud probability)");
        }
        if (!prediction.status().equals("AVAILABLE")) {
            reasons.add("RULE_ONLY: ML " + prediction.status() + "; retained all rule checks");
        }
        if (reasons.isEmpty()) { reasons.add("NO_SIGNALS: no configured rule or ML outlier threshold triggered"); }
        try {
            alerts.saveAndFlush(new AnomalyAlert(transactionId, Math.max(result.score(), mlContribution),
                    result.score(), prediction, String.join("\n", reasons), json.writeValueAsString(result.features())));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot serialize detection features", exception);
        }
        job.complete();
    }
}
