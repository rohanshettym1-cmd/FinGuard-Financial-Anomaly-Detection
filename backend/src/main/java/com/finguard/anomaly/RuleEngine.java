package com.finguard.anomaly;

import com.finguard.transaction.Transaction;
import com.finguard.transaction.TransactionType;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Pure rules: only rows older than the target are eligible history. Never blocks a posting. */
@Component
public class RuleEngine {
    public record Features(BigDecimal amount, int hour, int frequency_5m, int prior_debit_count,
                           BigDecimal baseline_mean, boolean is_debit) { }
    public record Result(int score, List<String> reasons, Features features) { }

    public Result evaluate(Transaction target, List<Transaction> candidates) {
        var history = candidates.stream().filter(t -> t.getId() < target.getId()
                && !t.getCreatedAt().isAfter(target.getCreatedAt())
                && t.getAccount().getCustomer().getId().equals(target.getAccount().getCustomer().getId())).toList();
        var debits = history.stream().filter(t -> t.getType() == TransactionType.DEBIT).toList();
        BigDecimal mean = debits.isEmpty() ? BigDecimal.ZERO : debits.stream().map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(debits.size()), 8, RoundingMode.HALF_UP);
        var sameAccount = history.stream().filter(t -> t.getAccount().getId().equals(target.getAccount().getId())).toList();
        int frequency = 1 + (int) sameAccount.stream()
                .filter(t -> !t.getCreatedAt().isBefore(target.getCreatedAt().minusMinutes(5))).count();
        boolean duplicate = sameAccount.stream().anyMatch(t -> t.getType() == target.getType()
                && t.getAmount().compareTo(target.getAmount()) == 0
                && !t.getCreatedAt().isBefore(target.getCreatedAt().minusSeconds(60)));
        List<String> reasons = new ArrayList<>();
        int score = 0;
        if (target.getAmount().compareTo(new BigDecimal("10000")) >= 0) {
            score += 45; reasons.add("LARGE_AMOUNT: amount >= 10000 INR (+45)");
        }
        if (frequency >= 5) {
            score += 40; reasons.add("RAPID_FREQUENCY: " + frequency + " account postings within 5 minutes (+40)");
        }
        if (duplicate) {
            score += 45; reasons.add("POSSIBLE_DUPLICATE: same account, type and amount within 60 seconds (+45)");
        }
        boolean debit = target.getType() == TransactionType.DEBIT;
        if (debit && debits.size() >= 5 && target.getAmount().compareTo(new BigDecimal("1000")) >= 0
                && target.getAmount().compareTo(mean.multiply(new BigDecimal("3"))) >= 0) {
            score += 40; reasons.add("CUSTOMER_BASELINE: debit >= 3x prior mean " + mean.toPlainString()
                    + " INR across " + debits.size() + " historical debits (+40)");
        }
        return new Result(Math.min(100, score), List.copyOf(reasons),
                new Features(target.getAmount(), target.getCreatedAt().getHour(), frequency, debits.size(), mean, debit));
    }
}
