-- Metadata only: no demo ledger data is inserted by migrations.
CREATE TABLE demo_seed_runs (
    seed_key VARCHAR(64) NOT NULL PRIMARY KEY,
    completed BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;
INSERT INTO demo_seed_runs (seed_key, completed) VALUES ('portfolio-v1', FALSE);
