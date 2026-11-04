package com.finguard.account;

import com.finguard.common.ApiException;
import com.finguard.customer.Customer;
import com.finguard.transaction.TransactionType;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "accounts")
public class Account {
    public static final BigDecimal MAX_BALANCE = new BigDecimal("99999999999999999.99");

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 16)
    private AccountStatus status;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Account() { }

    public Account(Customer customer, AccountStatus status) {
        this.customer = customer;
        this.status = status;
        this.balance = new BigDecimal("0.00");
        this.createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    /** Called only after acquiring the account's database write lock. Never round money silently. */
    public void post(TransactionType type, BigDecimal amount) {
        if (type == null || amount == null || amount.signum() <= 0 || amount.compareTo(MAX_BALANCE) > 0) {
            throw ApiException.invalid("INVALID_AMOUNT", "Type and a positive amount within the supported range are required");
        }
        try {
            amount = amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw ApiException.invalid("INVALID_AMOUNT", "Amount must have at most two decimal places");
        }
        if (status != AccountStatus.ACTIVE) {
            throw ApiException.invalid("INACTIVE_ACCOUNT", "Inactive accounts cannot accept transactions");
        }
        if (type == TransactionType.DEBIT && balance.compareTo(amount) < 0) {
            throw ApiException.invalid("INSUFFICIENT_FUNDS", "Account has insufficient funds");
        }
        var updated = type == TransactionType.CREDIT ? balance.add(amount) : balance.subtract(amount);
        if (updated.compareTo(MAX_BALANCE) > 0) {
            throw ApiException.invalid("BALANCE_LIMIT", "Credit would exceed the supported balance limit");
        }
        balance = updated;
    }

    public Long getId() { return id; }
    public Customer getCustomer() { return customer; }
    public AccountStatus getStatus() { return status; }
    public BigDecimal getBalance() { return balance; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
