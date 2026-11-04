-- Synthetic fixtures only. Run once against an EMPTY local database AFTER Flyway migration.
-- All names and example.test addresses are fictitious. All timestamps are UTC.
START TRANSACTION;

INSERT INTO customers (id, name, email, created_at) VALUES
    (1001, 'Demo Asha', 'asha@example.test', '2026-01-01 09:00:00'),
    (1002, 'Demo Ravi', 'ravi@example.test', '2026-01-01 09:00:00');

INSERT INTO accounts (id, customer_id, status, balance, created_at) VALUES
    (2001, 1001, 'ACTIVE', 1000.00, '2026-01-01 09:05:00'),
    (2002, 1002, 'ACTIVE', 0.00, '2026-01-01 09:05:00'),
    (2003, 1001, 'INACTIVE', 0.00, '2026-01-01 09:05:00');

INSERT INTO financial_transactions
    (id, account_id, type, amount, balance_after, description, created_at) VALUES
    (3001, 2001, 'CREDIT', 1500.00, 1500.00, 'Synthetic opening credit', '2026-01-01 09:10:00'),
    (3002, 2001, 'DEBIT', 500.00, 1000.00, 'Synthetic purchase', '2026-01-01 09:15:00');

COMMIT;
