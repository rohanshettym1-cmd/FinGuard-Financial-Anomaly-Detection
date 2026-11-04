package com.finguard.account;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class AccountDtos {
    private AccountDtos() { }

    public record CreateAccount(@NotNull @Positive Long customerId, AccountStatus status) { }

    public record AccountResponse(Long id, Long customerId, AccountStatus status,
                                  BigDecimal balance, LocalDateTime createdAt) {
        public static AccountResponse from(Account account) {
            return new AccountResponse(account.getId(), account.getCustomer().getId(), account.getStatus(),
                    account.getBalance(), account.getCreatedAt());
        }
    }

    public record BalanceResponse(Long accountId, BigDecimal balance) { }
}
