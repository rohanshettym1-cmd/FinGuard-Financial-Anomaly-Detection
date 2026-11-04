package com.finguard.transaction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import static com.finguard.transaction.TransactionDtos.*;

@RestController
@RequestMapping("/api/transactions")
@Validated
public class TransactionController {
    private final TransactionService service;
    public TransactionController(TransactionService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<TransactionResponse> create(@Valid @RequestBody CreateTransaction request) {
        var transaction = service.create(request);
        return ResponseEntity.created(URI.create("/api/transactions/" + transaction.id())).body(transaction);
    }

    @GetMapping("/{id}")
    public TransactionResponse get(@PathVariable @Positive long id) { return service.get(id); }

    @GetMapping
    public TransactionPage list(@RequestParam @Positive long accountId,
                                @RequestParam(defaultValue = "0") @Min(0) int page,
                                @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.listByAccount(accountId, page, size);
    }
}
