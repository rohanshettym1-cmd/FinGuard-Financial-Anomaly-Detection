package com.finguard.demo;

import com.finguard.account.AccountDtos.CreateAccount;
import com.finguard.account.AccountService;
import com.finguard.account.AccountStatus;
import com.finguard.customer.CustomerDtos.CreateCustomer;
import com.finguard.customer.CustomerService;
import com.finguard.transaction.TransactionDtos.CreateTransaction;
import com.finguard.transaction.TransactionService;
import com.finguard.transaction.TransactionType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

/** An opt-in, all-or-nothing fixture. Uses normal services, never direct balance edits. */
@Service
public class DemoDataSeeder {
    public enum Result { CREATED, ALREADY_COMPLETE, SKIPPED_NONEMPTY }
    private final JdbcTemplate jdbc;
    private final CustomerService customers;
    private final AccountService accounts;
    private final TransactionService transactions;

    public DemoDataSeeder(JdbcTemplate jdbc, CustomerService customers, AccountService accounts, TransactionService transactions) {
        this.jdbc = jdbc; this.customers = customers; this.accounts = accounts; this.transactions = transactions;
    }

    @Transactional
    public Result seed() {
        // Serialize simultaneous startup attempts. The marker commits with the entire dataset.
        Boolean complete = jdbc.queryForObject("SELECT completed FROM demo_seed_runs WHERE seed_key = 'portfolio-v1' FOR UPDATE", Boolean.class);
        if (Boolean.TRUE.equals(complete)) { return Result.ALREADY_COMPLETE; }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM customers", Long.class) != 0) { return Result.SKIPPED_NONEMPTY; }
        String[] names = {"Demo Asha", "Demo Ravi", "Demo Mira"};
        for (int index = 0; index < names.length; index++) {
            var customer = customers.create(new CreateCustomer(names[index], "portfolio-" + index + "@example.test"));
            var account = accounts.create(new CreateAccount(customer.id(), AccountStatus.ACTIVE));
            post(account.id(), TransactionType.CREDIT, "20000.00", "Synthetic opening credit");
            for (int day = 0; day < 5; day++) {
                post(account.id(), TransactionType.DEBIT, Integer.toString(100 + index * 10 + day), "Synthetic purchase " + (day + 1));
            }
            post(account.id(), TransactionType.DEBIT, "1500.00", "Synthetic spending deviation");
            post(account.id(), TransactionType.CREDIT, "101.25", "Synthetic possible duplicate");
            post(account.id(), TransactionType.CREDIT, "101.25", "Synthetic possible duplicate");
            if (index == 0) { accounts.create(new CreateAccount(customer.id(), AccountStatus.INACTIVE)); }
        }
        jdbc.update("UPDATE demo_seed_runs SET completed = TRUE WHERE seed_key = 'portfolio-v1'");
        return Result.CREATED;
    }

    private void post(long account, TransactionType type, String amount, String description) {
        transactions.create(new CreateTransaction(account, type, new BigDecimal(amount), description));
    }
}
