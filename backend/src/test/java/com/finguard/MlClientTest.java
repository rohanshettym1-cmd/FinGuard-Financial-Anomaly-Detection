package com.finguard;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finguard.anomaly.MlClient;
import com.finguard.anomaly.RuleEngine;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

class MlClientTest {
    private final RuleEngine.Features features = new RuleEngine.Features(new BigDecimal("100"), 12, 1, 0, BigDecimal.ZERO, true);

    @Test
    void validResponseIsAcceptedAndRequestMatchesPythonContract() throws Exception {
        var json = new ObjectMapper();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            var input = json.readTree(exchange.getRequestBody());
            byte[] body = (input.has("frequency_5m") && input.path("amount").decimalValue().compareTo(new BigDecimal("100")) == 0
                    ? "{\"risk_score\":98,\"anomalous\":true,\"model_version\":\"test-v1\"}" : "{}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        try {
            var result = client(server, 500).predict(features);
            assertThat(result.status()).isEqualTo("AVAILABLE");
            assertThat(result.score()).isEqualTo(98);
            assertThat(result.anomalous()).isTrue();
            assertThat(result.explanation()).contains("model threshold"); // Older Python responses stay compatible.
        } finally { server.stop(0); }
    }

    @Test
    void modelExplanationIsRetainedAsOneBoundedLine() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            var body = new ObjectMapper().writeValueAsBytes(java.util.Map.of("risk_score", 99,
                    "anomalous", true, "model_version", "v2", "explanation", "Context:\n" + "x".repeat(1200)));
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        try {
            var result = client(server, 1000).predict(features);
            assertThat(result.status()).isEqualTo("AVAILABLE");
            assertThat(result.explanation()).startsWith("Context: ").hasSize(1000).doesNotContain("\n");
        } finally { server.stop(0); }
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-json", "{}", "{\"risk_score\":101,\"anomalous\":true,\"model_version\":\"v1\"}",
            "{\"risk_score\":1.5,\"anomalous\":true,\"model_version\":\"v1\"}",
            "{\"risk_score\":99,\"anomalous\":\"true\",\"model_version\":\"v1\"}"})
    void malformedOrOutOfRangeResponsesFallBack(String response) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        try { assertThat(client(server, 500).predict(features).status()).isEqualTo("UNAVAILABLE"); }
        finally { server.stop(0); }
    }

    @Test
    void timeoutAndHttpErrorsFallBack() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            try { Thread.sleep(300); exchange.sendResponseHeaders(503, -1); }
            catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            assertThat(client(server, 50).predict(features).status()).isEqualTo("UNAVAILABLE");
            assertThat(client(server, 1000).predict(features).status()).isEqualTo("UNAVAILABLE");
        } finally { server.stop(0); }
        assertThat(new MlClient(new ObjectMapper(), true, "http://127.0.0.1:" + server.getAddress().getPort(), 100, 100)
                .predict(features).status()).isEqualTo("UNAVAILABLE");
    }
    private MlClient client(HttpServer server, int timeout) {
        return new MlClient(new ObjectMapper(), true, "http://127.0.0.1:" + server.getAddress().getPort(), 100, timeout);
    }

    @Test
    void timeoutCoversStalledBodyAfterHeaders() throws Exception {
        var release = new CountDownLatch(1);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            exchange.sendResponseHeaders(200, 100);
            exchange.getResponseBody().write('{');
            exchange.getResponseBody().flush();
            try { release.await(10, TimeUnit.SECONDS); }
            catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            assertTimeoutPreemptively(Duration.ofSeconds(2), () ->
                    assertThat(client(server, 100).predict(features).status()).isEqualTo("UNAVAILABLE"));
        } finally { release.countDown(); server.stop(0); }
    }
}
