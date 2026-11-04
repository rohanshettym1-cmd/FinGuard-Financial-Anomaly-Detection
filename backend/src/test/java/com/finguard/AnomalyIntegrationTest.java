package com.finguard;

import com.finguard.account.AccountService;
import com.finguard.account.AccountDtos.CreateAccount;
import com.finguard.anomaly.*;
import com.finguard.customer.CustomerService;
import com.finguard.customer.CustomerDtos.CreateCustomer;
import com.finguard.transaction.TransactionService;
import com.finguard.transaction.TransactionType;
import com.finguard.transaction.TransactionDtos.CreateTransaction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles(resolver = TestDatabaseProfiles.class)
class AnomalyIntegrationTest {
    @Autowired CustomerService customers;
    @Autowired AccountService accounts;
    @Autowired TransactionService transactions;
    @Autowired DetectionService detection;
    @Autowired DetectionJobRepository jobs;
    @Autowired AlertRepository alerts;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean MlClient ml;

    @BeforeEach
    void fallback() { when(ml.predict(any())).thenReturn(new MlClient.Prediction("UNAVAILABLE", null, false, null)); }

    @Test
    void normalPostingIsQueuedAndAssessedWithoutChangingBalances() throws Exception {
        long account = account();
        long id = credit(account, "100");
        mvc.perform(get("/api/transactions/{id}/risk", id)).andExpect(status().isAccepted());
        assertThat(jobs.findById(id).orElseThrow().isCompleted()).isFalse();
        detection.process(id);
        detection.process(id); // Job locking and completion prevent duplicate assessments.
        var alert = alerts.findByTransactionId(id).orElseThrow();
        assertThat(alert.getRiskScore()).isZero();
        assertThat(alert.getStatus()).isEqualTo(InvestigationStatus.NOT_REQUIRED);
        assertThat(alert.getMlStatus()).isEqualTo("UNAVAILABLE");
        assertThat(accounts.balance(account).balance()).isEqualByComparingTo("100");
        mvc.perform(get("/api/transactions/{id}/risk", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.features.prior_debit_count").value(0));
        mvc.perform(get("/api/alerts").param("includeNormal", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void suspiciousRulesPersistAndAnalystReviewsHaveAnAuditTrail() throws Exception {
        long id = credit(account(), "12000"); detection.process(id);
        var alert = alerts.findByTransactionId(id).orElseThrow();
        assertThat(alert.getRiskScore()).isEqualTo(45);
        assertThat(alert.getReasons()).contains("LARGE_AMOUNT", "RULE_ONLY");
        mvc.perform(get("/api/alerts/{id}", alert.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"));
        mvc.perform(get("/api/alerts").param("status", "OPEN")).andExpect(status().isOk());
        mvc.perform(post("/api/alerts/{id}/reviews", alert.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_REVIEW\",\"analyst\":\"Demo Analyst\",\"notes\":\"Checking synthetic activity\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.previousStatus").value("OPEN"));
        mvc.perform(post("/api/alerts/{id}/reviews", alert.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"FALSE_POSITIVE\",\"analyst\":\"Demo Analyst\",\"notes\":\"Expected synthetic deposit\"}"))
                .andExpect(status().isCreated());
        assertThat(alerts.findById(alert.getId()).orElseThrow().getStatus()).isEqualTo(InvestigationStatus.FALSE_POSITIVE);
        mvc.perform(get("/api/alerts/{id}/reviews", alert.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(post("/api/alerts/{id}/reviews", alert.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"NOT_REQUIRED\",\"analyst\":\"Demo\",\"notes\":\"Invalid\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void duplicatesAndBurstsArePersistedAsSignals() {
        long account = account();
        credit(account, "101"); long duplicate = credit(account, "101"); detection.process(duplicate);
        assertThat(alerts.findByTransactionId(duplicate).orElseThrow().getReasons()).contains("POSSIBLE_DUPLICATE");
        credit(account, "102"); credit(account, "103"); long burst = credit(account, "104"); detection.process(burst);
        assertThat(alerts.findByTransactionId(burst).orElseThrow().getReasons()).contains("RAPID_FREQUENCY");
        assertThat(accounts.balance(account).balance()).isEqualByComparingTo("511");
    }

    @Test
    void historicalCustomerBaselineExcludesLaterSpending() throws Exception {
        long account = account(); credit(account, "100000");
        for (int i = 0; i < 5; i++) { debit(account, "100"); }
        long target = debit(account, "1500");
        debit(account, "20000"); // Must not contaminate the target's baseline even if detection runs later.
        detection.process(target);
        var alert = alerts.findByTransactionId(target).orElseThrow();
        assertThat(alert.getReasons()).contains("CUSTOMER_BASELINE");
        mvc.perform(get("/api/transactions/{id}/risk", target)).andExpect(status().isOk())
                .andExpect(jsonPath("$.features.prior_debit_count").value(5))
                .andExpect(jsonPath("$.features.baseline_mean").value(100));
    }

    @Test
    void mlCanAddAnAlertButCannotSuppressRuleSignals() {
        when(ml.predict(any())).thenReturn(new MlClient.Prediction("AVAILABLE", 98, true, "test-v1"));
        long id = credit(account(), "101"); detection.process(id);
        assertThat(alerts.findByTransactionId(id).orElseThrow().getRiskScore()).isEqualTo(98);
        when(ml.predict(any())).thenReturn(new MlClient.Prediction("AVAILABLE", 10, false, "test-v1"));
        long large = credit(account(), "15000"); detection.process(large);
        assertThat(alerts.findByTransactionId(large).orElseThrow().getRiskScore()).isEqualTo(45);
    }

    @Test
    void analyticsFailureLeavesCommittedPostingAndDurableRetryIntact() {
        long account = account(); long id = credit(account, "11000");
        when(ml.predict(any())).thenThrow(new IllegalStateException("Injected worker failure"));
        assertThatThrownBy(() -> detection.process(id)).isInstanceOf(IllegalStateException.class);
        assertThat(accounts.balance(account).balance()).isEqualByComparingTo("11000");
        assertThat(jobs.findById(id).orElseThrow().isCompleted()).isFalse();
        assertThat(alerts.findByTransactionId(id)).isEmpty();
        doReturn(new MlClient.Prediction("UNAVAILABLE", null, false, null)).when(ml).predict(any());
        detection.process(id);
        assertThat(alerts.findByTransactionId(id).orElseThrow().getRiskScore()).isEqualTo(45);
    }

    @Test
    void rolledBackPostingDoesNotLeaveAJobOrAlert() {
        long account = account(); AtomicLong id = new AtomicLong();
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            id.set(credit(account, "100")); throw new IllegalStateException("Rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jobs.findById(id.get())).isEmpty();
        assertThat(alerts.findByTransactionId(id.get())).isEmpty();
        assertThat(accounts.balance(account).balance()).isEqualByComparingTo("0");
    }

    @Test
    void alertValidationAndMissingIdsAreHandled() throws Exception {
        mvc.perform(get("/api/alerts/0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/alerts/9223372036854775807")).andExpect(status().isNotFound());
        mvc.perform(get("/api/transactions/9223372036854775807/risk")).andExpect(status().isNotFound());
        mvc.perform(get("/api/alerts?size=101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/alerts?status=UNKNOWN")).andExpect(status().isBadRequest());
    }
    private long account() {
        var customer = customers.create(new CreateCustomer("Synthetic Analytics", UUID.randomUUID() + "@example.test"));
        return accounts.create(new CreateAccount(customer.id(), null)).id();
    }
    private long credit(long account, String amount) {
        return transactions.create(new CreateTransaction(account, TransactionType.CREDIT, new BigDecimal(amount), "Synthetic")).id();
    }
    private long debit(long account, String amount) {
        return transactions.create(new CreateTransaction(account, TransactionType.DEBIT, new BigDecimal(amount), "Synthetic")).id();
    }
}
