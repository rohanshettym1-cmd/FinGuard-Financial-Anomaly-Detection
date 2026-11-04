package com.finguard.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;
import static com.finguard.account.AccountDtos.*;

@RestController
@RequestMapping("/api/accounts")
@Validated
public class AccountController {
    private final AccountService service;
    public AccountController(AccountService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<AccountResponse> create(@Valid @RequestBody CreateAccount request) {
        var account = service.create(request);
        return ResponseEntity.created(URI.create("/api/accounts/" + account.id())).body(account);
    }

    @GetMapping("/{id}")
    public AccountResponse get(@PathVariable @Positive long id) { return service.get(id); }

    @GetMapping
    public List<AccountResponse> list(@RequestParam @Positive long customerId) {
        return service.listByCustomer(customerId);
    }

    @GetMapping("/{id}/balance")
    public BalanceResponse balance(@PathVariable @Positive long id) { return service.balance(id); }
}
