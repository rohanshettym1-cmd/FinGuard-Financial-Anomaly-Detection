package com.finguard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finguard.account.AccountService;
import com.finguard.common.ApiException;
import com.finguard.transaction.TransactionService;
import com.finguard.transaction.TransactionType;
import com.finguard.transaction.TransactionDtos.CreateTransaction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises controllers, real services, JPA, migrations, and committed database state. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles(resolver = TestDatabaseProfiles.class)
class FinancialApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AccountService accounts;
    @Autowired TransactionService transactions;
    @Autowired PlatformTransactionManager transactionManager;

    @Test
    void customerAndAccountApisPreserveRelationshipsAndStartAtZero() throws Exception {
        long customerId = customer();
        mvc.perform(get("/api/customers/{id}", customerId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Synthetic Customer"));
        mvc.perform(get("/api/customers")).andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        long accountId = account(customerId, "ACTIVE");
        mvc.perform(get("/api/accounts/{id}", accountId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value(customerId)).andExpect(jsonPath("$.balance").value(0));
        mvc.perform(get("/api/accounts").param("customerId", Long.toString(customerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/accounts/{id}/balance", accountId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(accountId)).andExpect(jsonPath("$.balance").value(0));
    }

    @Test
    void accountDefaultsToActiveAndRejectsInvalidInputs() throws Exception {
        long customerId = customer();
        var created = create("/api/accounts", "{\"customerId\":" + customerId + "}");
        assertThat(created.path("status").asText()).isEqualTo("ACTIVE");
        for (String body : List.of("{\"customerId\":0}", "{\"customerId\":-1}",
                "{\"customerId\":" + customerId + ",\"status\":\"UNKNOWN\"}",
                "{\"customerId\":" + customerId + ",\"balance\":100}")) {
            mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void creditsAndDebitsUseExactDecimalsAndReturnStablePages() throws Exception {
        long id = account(customer(), "ACTIVE");
        long first = postTransaction(id, "CREDIT", "100.10");
        long second = postTransaction(id, "DEBIT", "30.05");
        assertBalance(id, "70.05");
        mvc.perform(get("/api/transactions/{id}", second)).andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("DEBIT")).andExpect(jsonPath("$.balanceAfter").value(70.05));
        mvc.perform(get("/api/transactions").param("accountId", "" + id).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(second))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(1));
        mvc.perform(get("/api/transactions").param("accountId", "" + id).param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(first));
        mvc.perform(get("/api/transactions").param("accountId", "" + id).param("page", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        long other = account(customer(), "ACTIVE");
        assertThat(transactions.listByAccount(other, 0, 20).totalElements()).isZero();
    }

    @Test
    void insufficientBalanceDoesNotChangeBalanceOrHistory() throws Exception {
        long id = account(customer(), "ACTIVE");
        postTransaction(id, "CREDIT", "25.00");
        mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                .content(transactionJson(id, "DEBIT", "25.01")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"));
        assertBalance(id, "25.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isEqualTo(1);
        postTransaction(id, "DEBIT", "25.00");
        assertBalance(id, "0.00");
    }

    @Test
    void failureRollsBackPreviouslyFlushedBalanceAndLedgerInsert() throws Exception {
        long id = account(customer(), "ACTIVE");
        postTransaction(id, "CREDIT", "20.00");
        var unitOfWork = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> unitOfWork.executeWithoutResult(status -> {
            // create() flushes real SQL. The second operation fails after the first has written.
            transactions.create(request(id, TransactionType.CREDIT, "10.00"));
            transactions.create(request(id, TransactionType.DEBIT, "31.00"));
        })).isInstanceOf(ApiException.class).hasMessageContaining("insufficient funds");
        assertBalance(id, "20.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isEqualTo(1);
    }

    @Test
    void databaseInsertFailureAlsoRollsBackPosting() throws Exception {
        long id = account(customer(), "ACTIVE");
        // Bypass HTTP length validation to force a real database constraint failure in the service.
        assertThatThrownBy(() -> transactions.create(new CreateTransaction(id, TransactionType.CREDIT,
                new BigDecimal("10.00"), "x".repeat(256))))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertBalance(id, "0.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREDIT", "DEBIT"})
    void inactiveAccountRejectsPosting(String type) throws Exception {
        long id = account(customer(), "INACTIVE");
        mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                .content(transactionJson(id, type, "10.00")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INACTIVE_ACCOUNT"));
        assertBalance(id, "0.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1.00", "0.001", "1.234", "100000000000000000.00", "null"})
    void invalidAmountsAreRejectedWithoutWrites(String amount) throws Exception {
        long id = account(customer(), "ACTIVE");
        mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                .content(transactionJson(id, "CREDIT", amount)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertBalance(id, "0.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isZero();
    }

    @Test
    void balanceOverflowIsRejectedWithoutAnExtraLedgerEntry() throws Exception {
        long id = account(customer(), "ACTIVE");
        postTransaction(id, "CREDIT", "99999999999999999.99");
        mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                .content(transactionJson(id, "CREDIT", "0.01")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BALANCE_LIMIT"));
        assertBalance(id, "99999999999999999.99");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isEqualTo(1);
    }

    @Test
    void validationAndDuplicateEmailReturnSafeErrors() throws Exception {
        mvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" \",\"email\":\"invalid\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.name").exists())
                .andExpect(jsonPath("$.fields.email").exists());
        String email = UUID.randomUUID() + "@example.test";
        create("/api/customers", "{\"name\":\"First\",\"email\":\"" + email + "\"}");
        mvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Second\",\"email\":\"" + email.toUpperCase() + "\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DATA_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("SQL"))));
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"customerId\":1.5}" )).andExpect(status().isBadRequest());
        long id = account(customer(), "ACTIVE");
        for (String body : List.of(transactionJson(id, "OTHER", "1.00"),
                "{\"accountId\":" + id + ",\"type\":0,\"amount\":1}",
                "{\"accountId\":" + id + ",\"amount\":1}", "{broken")) {
            mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/customers/0", "/api/accounts/-1", "/api/transactions/not-a-number",
            "/api/accounts?customerId=0", "/api/transactions?accountId=1&page=-1",
            "/api/transactions?accountId=1&size=0", "/api/transactions?accountId=1&size=101"})
    void invalidIdsAndPaginationAreBadRequests(String url) throws Exception {
        mvc.perform(get(url)).andExpect(status().isBadRequest());
    }

    @Test
    void missingResourcesReturnNotFound() throws Exception {
        long missing = Long.MAX_VALUE;
        for (String url : List.of("/api/customers/" + missing, "/api/accounts/" + missing,
                "/api/accounts/" + missing + "/balance", "/api/transactions/" + missing,
                "/api/accounts?customerId=" + missing, "/api/transactions?accountId=" + missing)) {
            mvc.perform(get(url)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        }
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"customerId\":" + missing + "}" )).andExpect(status().isNotFound());
        mvc.perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                .content(transactionJson(missing, "CREDIT", "1.00"))).andExpect(status().isNotFound());
    }

    @Test
    void concurrentDebitsCannotOverspend() throws Exception {
        long id = account(customer(), "ACTIVE");
        postTransaction(id, "CREDIT", "100.00");
        var results = concurrently(2, () -> {
            try {
                transactions.create(request(id, TransactionType.DEBIT, "80.00"));
                return "POSTED";
            } catch (ApiException exception) {
                return exception.getCode();
            }
        });
        assertThat(results).containsExactlyInAnyOrder("POSTED", "INSUFFICIENT_FUNDS");
        assertBalance(id, "20.00");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isEqualTo(2);
    }

    @Test
    void concurrentCreditsDoNotLoseUpdates() throws Exception {
        long id = account(customer(), "ACTIVE");
        concurrently(8, () -> transactions.create(request(id, TransactionType.CREDIT, "0.10")).id());
        assertBalance(id, "0.80");
        assertThat(transactions.listByAccount(id, 0, 20).totalElements()).isEqualTo(8);
    }

    private <T> List<T> concurrently(int count, Callable<T> operation) throws Exception {
        var start = new CountDownLatch(1);
        var workers = Executors.newFixedThreadPool(count);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                futures.add(workers.submit(() -> {
                    if (!start.await(10, TimeUnit.SECONDS)) { throw new IllegalStateException("Start timeout"); }
                    return operation.call();
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (var future : futures) { results.add(future.get(30, TimeUnit.SECONDS)); }
            return results;
        } finally {
            workers.shutdownNow();
            workers.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    private long customer() throws Exception {
        return create("/api/customers", "{\"name\":\"Synthetic Customer\",\"email\":\""
                + UUID.randomUUID() + "@example.test\"}").path("id").asLong();
    }

    private long account(long customerId, String status) throws Exception {
        return create("/api/accounts", "{\"customerId\":" + customerId + ",\"status\":\"" + status + "\"}")
                .path("id").asLong();
    }

    private long postTransaction(long id, String type, String amount) throws Exception {
        return create("/api/transactions", transactionJson(id, type, amount)).path("id").asLong();
    }

    private JsonNode create(String url, String body) throws Exception {
        var result = mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(header().exists("Location")).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }

    private String transactionJson(long id, String type, String amount) {
        return "{\"accountId\":" + id + ",\"type\":\"" + type + "\",\"amount\":" + amount + "}";
    }

    private CreateTransaction request(long id, TransactionType type, String amount) {
        return new CreateTransaction(id, type, new BigDecimal(amount), "Synthetic test transaction");
    }

    private void assertBalance(long id, String expected) {
        assertThat(accounts.balance(id).balance()).isEqualByComparingTo(expected);
    }
}
