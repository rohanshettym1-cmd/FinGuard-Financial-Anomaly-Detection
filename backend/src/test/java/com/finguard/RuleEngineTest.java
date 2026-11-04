package com.finguard;

import com.finguard.account.Account;
import com.finguard.customer.Customer;
import com.finguard.anomaly.RuleEngine;
import com.finguard.transaction.Transaction;
import com.finguard.transaction.TransactionType;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.LongStream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RuleEngineTest {
    private final RuleEngine rules = new RuleEngine();
    private final LocalDateTime now = LocalDateTime.of(2026, 1, 1, 12, 0);

    @Test
    void normalAndColdStartDoNotInventABaseline() {
        var result = rules.evaluate(transaction(1, 1, 1, "100", now), List.of());
        assertThat(result.score()).isZero();
        assertThat(result.features().prior_debit_count()).isZero();
        assertThat(result.features().baseline_mean()).isEqualByComparingTo("0");
    }

    @Test
    void largeAmountThresholdAndScoreCapAreExplicit() {
        var target = transaction(10, 1, 1, "10000", now);
        assertThat(rules.evaluate(target, List.of()).score()).isEqualTo(45);
        var history = LongStream.range(1, 10).mapToObj(id -> transaction(id, 1, 1, "10000", now.minusSeconds(10))).toList();
        assertThat(rules.evaluate(target, history).score()).isEqualTo(100);
    }

    @Test
    void duplicatesAndBurstsRespectAccountAndTimeWindows() {
        var target = transaction(10, 1, 1, "100", now);
        assertThat(rules.evaluate(target, List.of(transaction(1, 1, 1, "100", now.minusSeconds(60)))).score()).isEqualTo(45);
        assertThat(rules.evaluate(target, List.of(transaction(1, 1, 1, "100", now.minusSeconds(61)))).score()).isZero();
        assertThat(rules.evaluate(target, List.of(transaction(1, 1, 2, "100", now.minusSeconds(1)))).score()).isZero();
        var history = LongStream.range(1, 5).mapToObj(id -> transaction(id, 1, 1, "10", now.minusMinutes(5))).toList();
        assertThat(rules.evaluate(target, history).reasons()).anyMatch(reason -> reason.startsWith("RAPID_FREQUENCY"));
    }

    @Test
    void baselineUsesEarlierCustomerDebitsAcrossAccountsAndExcludesCurrentFutureAndOtherCustomers() {
        var history = new java.util.ArrayList<Transaction>();
        LongStream.range(1, 6).forEach(id -> history.add(transaction(id, 1, 2, "100", now.minusDays(1))));
        history.add(transaction(6, 2, 9, "90000", now.minusDays(1)));
        history.add(transaction(11, 1, 1, "90000", now.plusDays(1)));
        var target = transaction(10, 1, 1, "1000", now);
        history.add(target);
        var result = rules.evaluate(target, history);
        assertThat(result.features().prior_debit_count()).isEqualTo(5);
        assertThat(result.features().baseline_mean()).isEqualByComparingTo("100");
        assertThat(result.score()).isEqualTo(40);
        assertThat(result.reasons()).anyMatch(reason -> reason.startsWith("CUSTOMER_BASELINE"));
    }

    private Transaction transaction(long id, long customerId, long accountId, String amount, LocalDateTime time) {
        var customer = mock(Customer.class); when(customer.getId()).thenReturn(customerId);
        var account = mock(Account.class); when(account.getId()).thenReturn(accountId); when(account.getCustomer()).thenReturn(customer);
        var transaction = mock(Transaction.class);
        when(transaction.getId()).thenReturn(id); when(transaction.getAccount()).thenReturn(account);
        when(transaction.getAmount()).thenReturn(new BigDecimal(amount));
        when(transaction.getType()).thenReturn(TransactionType.DEBIT); when(transaction.getCreatedAt()).thenReturn(time);
        return transaction;
    }
}
