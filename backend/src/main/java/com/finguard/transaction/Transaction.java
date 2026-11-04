package com.finguard.transaction;

import com.finguard.account.Account;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "financial_transactions")
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false, updatable = false)
    private Account account;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 16, updatable = false)
    private TransactionType type;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal balanceAfter;
    @Column(length = 255, updatable = false)
    private String description;
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Transaction() { }

    public Transaction(Account account, TransactionType type, BigDecimal amount, String description) {
        this.account = account;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = account.getBalance();
        this.description = description;
        this.createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public Account getAccount() { return account; }
    public TransactionType getType() { return type; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getBalanceAfter() { return balanceAfter; }
    public String getDescription() { return description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
