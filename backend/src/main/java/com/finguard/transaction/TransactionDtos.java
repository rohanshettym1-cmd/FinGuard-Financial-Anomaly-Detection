package com.finguard.transaction;

import jakarta.validation.constraints.*;
import org.springframework.data.domain.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class TransactionDtos {
    private TransactionDtos() { }

    public record CreateTransaction(
            @NotNull @Positive Long accountId,
            @NotNull TransactionType type,
            @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount,
            @Size(max = 255) String description) { }

    public record TransactionResponse(Long id, Long accountId, TransactionType type, BigDecimal amount,
                                      BigDecimal balanceAfter, String description, LocalDateTime createdAt) {
        public static TransactionResponse from(Transaction transaction) {
            return new TransactionResponse(transaction.getId(), transaction.getAccount().getId(), transaction.getType(),
                    transaction.getAmount(), transaction.getBalanceAfter(), transaction.getDescription(), transaction.getCreatedAt());
        }
    }

    public record TransactionPage(List<TransactionResponse> content, int page, int size,
                                   long totalElements, int totalPages) {
        public static TransactionPage from(Page<Transaction> transactions) {
            return new TransactionPage(transactions.map(TransactionResponse::from).getContent(), transactions.getNumber(),
                    transactions.getSize(), transactions.getTotalElements(), transactions.getTotalPages());
        }
    }
}
