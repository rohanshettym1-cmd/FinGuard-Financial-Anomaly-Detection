package com.finguard.customer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;
import static com.finguard.customer.CustomerDtos.*;

@RestController
@RequestMapping("/api/customers")
@Validated
public class CustomerController {
    private final CustomerService service;
    public CustomerController(CustomerService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<CustomerResponse> create(@Valid @RequestBody CreateCustomer request) {
        var customer = service.create(request);
        return ResponseEntity.created(URI.create("/api/customers/" + customer.id())).body(customer);
    }

    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable @Positive long id) { return service.get(id); }

    @GetMapping
    public List<CustomerResponse> list() { return service.list(); }
}
