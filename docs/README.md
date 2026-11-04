# FinGuard design notes

Milestones 1–2 provide the health endpoint and MySQL-backed customer, account, and
transaction APIs. ML and frontend implementation are reserved for later approval.

## Data model

One Customer owns many Accounts; one Account has many Transactions. JPA maps the
foreign-key side using lazy `@ManyToOne` relationships. We avoid reverse collections
to keep queries explicit and prevent recursive JSON serialization. DTOs expose IDs
and the fields clients need, rather than serializing database entities.

All accounts use INR in this milestone. There is no currency conversion. Accounts
open with zero balance; credits and debits are the only API balance changes. Status
defaults to ACTIVE; creation can explicitly specify INACTIVE. A status-management
endpoint is outside this milestone. Times are UTC, serialized as ISO local date-time
strings; clients should interpret the timestamps as UTC.

## Posting money safely

1. The service begins a Spring `@Transactional` unit of work.
2. A JPA `PESSIMISTIC_WRITE` query locks the account row (`SELECT ... FOR UPDATE`
   on MySQL). Competing writers to that account wait until commit or rollback.
3. The account rejects inactive status, invalid amounts, overdrafts, and overflow.
4. The service inserts an immutable transaction with `balanceAfter`. JPA dirty
   checking updates the account balance in the same database transaction.
5. An exception rolls back both changes, including SQL already flushed to the DB.

`BigDecimal` and `DECIMAL(19,2)` preserve exact decimal amounts. At most 17 integer
digits and two fractional digits are supported. Values are never silently rounded.
The API rejects amounts below 0.01. A debit can take the balance exactly to zero.
The lock protects application instances sharing the database; it is not an in-memory
Java lock. Direct SQL writers must follow the same locking and ledger rules.

References: [Spring Data JPA locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html)
and [Flyway MySQL support](https://documentation.red-gate.com/flyway/reference/database-driver-reference/mysql).

## Migrations and boundaries

Flyway runs versioned migrations at startup; Hibernate only validates the result
(`ddl-auto=validate`). Never edit an applied migration: add a new V2, V3, etc.
`database/schema.sql` mirrors V1 as a readable reference, not an additional startup
script. The synthetic seed is manual and is never applied to production automatically.
SQL dumps remain ignored; only named reference/fixture files and migration SQL are
allowed by Git configuration.

The current API has no authentication, ownership authorization, idempotency keys,
transfers, or transaction reversal. Use local development environments only until
those protections are implemented. Repeating a successful POST creates a second
posting. If a response is lost, inspect history before resubmitting. Pagination uses
zero-based pages and descending transaction ID order; inserts may shift page boundaries.
