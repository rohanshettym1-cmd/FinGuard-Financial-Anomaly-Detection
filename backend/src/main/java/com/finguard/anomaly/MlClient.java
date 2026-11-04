package com.finguard.anomaly;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Component
public class MlClient {
    public record Prediction(String status, Integer score, boolean anomalous, String modelVersion) { }
    private final ObjectMapper json;
    private final boolean enabled;
    private final URI endpoint;
    private final Duration timeout;
    private final HttpClient client;

    public MlClient(ObjectMapper json, @Value("${ml.enabled:true}") boolean enabled,
                    @Value("${ml.base-url:http://localhost:8000}") String baseUrl,
                    @Value("${ml.connect-timeout-ms:300}") int connectTimeout,
                    @Value("${ml.request-timeout-ms:1000}") int requestTimeout) {
        if (connectTimeout < 1 || connectTimeout > 10000 || requestTimeout < 1 || requestTimeout > 10000) {
            throw new IllegalArgumentException("ML timeouts must be between 1 and 10000 ms");
        }
        this.json = json;
        this.enabled = enabled;
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/predict");
        if (!"http".equals(endpoint.getScheme()) && !"https".equals(endpoint.getScheme())) {
            throw new IllegalArgumentException("ML URL must use HTTP or HTTPS");
        }
        this.timeout = Duration.ofMillis(requestTimeout);
        this.client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofMillis(connectTimeout)).build();
    }

    public Prediction predict(RuleEngine.Features features) {
        if (!enabled) { return new Prediction("DISABLED", null, false, null); }
        CompletableFuture<HttpResponse<String>> pending = null;
        try {
            var request = HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(features))).build();
            // Bound completion of the entire body, not just arrival of HTTP headers.
            pending = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
            var response = pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (response.statusCode() != 200 || response.body().length() > 64000) { return fallback(); }
            var body = json.readTree(response.body());
            var risk = body.path("risk_score");
            var flag = body.path("anomalous");
            var version = body.path("model_version");
            if (!risk.isIntegralNumber() || !risk.canConvertToInt() || risk.intValue() < 0 || risk.intValue() > 100
                    || !flag.isBoolean() || !version.isTextual() || version.asText().isBlank()
                    || version.asText().length() > 100) { return fallback(); }
            return new Prediction("AVAILABLE", risk.intValue(), flag.booleanValue(), version.asText());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return fallback();
        } catch (Exception exception) {
            return fallback();
        } finally {
            if (pending != null && !pending.isDone()) { pending.cancel(true); }
        }
    }
    private Prediction fallback() { return new Prediction("UNAVAILABLE", null, false, null); }
}
