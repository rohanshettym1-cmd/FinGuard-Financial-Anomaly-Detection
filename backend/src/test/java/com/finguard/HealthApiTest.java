package com.finguard;

import com.finguard.health.HealthController.HealthResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;

/** Starts the full application on a random port and exercises actual HTTP requests. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HealthApiTest {
    @Autowired
    private TestRestTemplate client;

    @Test
    void healthReturnsUpAsJson() {
        var response = client.getForEntity("/api/health", HealthResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType()).isNotNull();
        assertThat(response.getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_JSON)).isTrue();
        assertThat(response.getBody()).isEqualTo(new HealthResponse("UP", "finguard-backend"));
    }

    @Test
    void unknownRouteReturnsNotFound() {
        var response = client.getForEntity("/api/does-not-exist", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).doesNotContain("stackTrace", "java.lang.");
    }
}
