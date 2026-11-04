package com.finguard.anomaly;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;
import java.util.Map;
import static com.finguard.anomaly.AlertDtos.*;

@RestController
@RequestMapping("/api")
@Validated
public class AlertController {
    private final AlertService service;
    public AlertController(AlertService service) { this.service = service; }
    @GetMapping("/alerts")
    public AlertPage list(@RequestParam(required = false) InvestigationStatus status,
                          @RequestParam(defaultValue = "false") boolean includeNormal,
                          @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
                          @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(status, includeNormal, page, size);
    }
    @GetMapping("/alerts/{id}")
    public AlertResponse get(@PathVariable @Positive long id) { return service.get(id); }
    @GetMapping("/transactions/{id}/risk")
    public ResponseEntity<?> risk(@PathVariable @Positive long id) {
        var result = service.transactionRisk(id);
        if (result.isPresent()) { return ResponseEntity.ok(result.get()); }
        return ResponseEntity.accepted().body(Map.of("status", "PENDING", "transactionId", id));
    }
    @PostMapping("/alerts/{id}/reviews")
    public ResponseEntity<ReviewResponse> review(@PathVariable @Positive long id, @Valid @RequestBody ReviewRequest request) {
        var review = service.review(id, request);
        return ResponseEntity.created(URI.create("/api/alerts/" + id + "/reviews")).body(review);
    }
    @GetMapping("/alerts/{id}/reviews")
    public List<ReviewResponse> reviews(@PathVariable @Positive long id) { return service.reviews(id); }
}
