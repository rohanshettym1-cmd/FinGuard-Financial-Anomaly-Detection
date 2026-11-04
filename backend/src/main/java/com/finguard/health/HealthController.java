package com.finguard.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Process health only; dependency readiness will be added with database integration. */
@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public HealthResponse health() {
        return new HealthResponse("UP", "finguard-backend");
    }

    public record HealthResponse(String status, String service) { }
}
