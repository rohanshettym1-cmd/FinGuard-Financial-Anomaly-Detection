package com.finguard.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class CustomerDtos {
    private CustomerDtos() { }

    public record CreateCustomer(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 254) String email) { }

    public record CustomerResponse(Long id, String name, String email, LocalDateTime createdAt) {
        public static CustomerResponse from(Customer customer) {
            return new CustomerResponse(customer.getId(), customer.getName(), customer.getEmail(), customer.getCreatedAt());
        }
    }
}
