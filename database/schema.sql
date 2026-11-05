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

CREATE TABLE detection_jobs (
    transaction_id BIGINT NOT NULL PRIMARY KEY,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_jobs_transaction FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id)
) ENGINE=InnoDB;
CREATE INDEX idx_jobs_pending ON detection_jobs(completed, transaction_id);

CREATE TABLE anomaly_alerts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    risk_score INTEGER NOT NULL,
    rule_score INTEGER NOT NULL,
    ml_score INTEGER,
    ml_status VARCHAR(32) NOT NULL,
    model_version VARCHAR(100),
    reasons VARCHAR(4000) NOT NULL,
    features_json VARCHAR(4000) NOT NULL,
    detected_at DATETIME(6) NOT NULL,
    status VARCHAR(32) NOT NULL,
    CONSTRAINT uk_alert_transaction UNIQUE (transaction_id),
    CONSTRAINT fk_alert_transaction FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id),
    CONSTRAINT ck_alert_risk CHECK (risk_score BETWEEN 0 AND 100),
    CONSTRAINT ck_alert_rule CHECK (rule_score BETWEEN 0 AND 100),
    CONSTRAINT ck_alert_ml CHECK (ml_score IS NULL OR ml_score BETWEEN 0 AND 100),
    CONSTRAINT ck_alert_status CHECK (status IN ('NOT_REQUIRED', 'OPEN', 'IN_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE'))
) ENGINE=InnoDB;
CREATE INDEX idx_alert_status_id ON anomaly_alerts(status, id);

CREATE TABLE alert_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    analyst VARCHAR(100) NOT NULL,
    notes VARCHAR(1000) NOT NULL,
    reviewed_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_review_alert FOREIGN KEY (alert_id) REFERENCES anomaly_alerts(id)
) ENGINE=InnoDB;

-- Existing Milestone 2 transactions are queued without modifying ledger balances.
INSERT INTO detection_jobs (transaction_id, completed, created_at)
SELECT id, FALSE, CURRENT_TIMESTAMP(6) FROM financial_transactions;

-- Metadata only: no demo ledger data is inserted by migrations.
CREATE TABLE demo_seed_runs (
    seed_key VARCHAR(64) NOT NULL PRIMARY KEY,
    completed BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;
INSERT INTO demo_seed_runs (seed_key, completed) VALUES ('portfolio-v1', FALSE);
