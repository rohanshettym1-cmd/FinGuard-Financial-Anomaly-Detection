CREATE TABLE customers (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_customers_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE accounts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    balance DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_accounts_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT ck_accounts_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_accounts_balance CHECK (balance >= 0)
) ENGINE=InnoDB;
CREATE INDEX idx_accounts_customer ON accounts(customer_id);

CREATE TABLE financial_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    type VARCHAR(16) NOT NULL,
    amount DECIMAL(19,2) NOT NULL,
    balance_after DECIMAL(19,2) NOT NULL,
    description VARCHAR(255),
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT ck_transactions_type CHECK (type IN ('CREDIT', 'DEBIT')),
    CONSTRAINT ck_transactions_amount CHECK (amount > 0),
    CONSTRAINT ck_transactions_balance CHECK (balance_after >= 0)
) ENGINE=InnoDB;
CREATE INDEX idx_transactions_account_id ON financial_transactions(account_id, id);
