package com.finguard;

import com.finguard.customer.Customer;
import com.finguard.customer.CustomerRepository;
import com.finguard.demo.DemoDataSeeder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.assertThat;

/** Own isolated H2 database: never clears or mutates another test's/customer's records. */
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:demo-seed-tests;MODE=MySQL;DB_CLOSE_DELAY=-1", "demo.enabled=false"})
@ActiveProfiles("test")
class DemoSeedIntegrationTest {
    @Autowired DemoDataSeeder seeder;
    @Autowired JdbcTemplate jdbc;
    @Autowired CustomerRepository customers;
    @Autowired PlatformTransactionManager manager;

    @Test
    void seedSkipsExistingDataRollsBackAtomicallyAndDoesNotDuplicateOnRepeat() {
        var existing = customers.saveAndFlush(new Customer("Existing Synthetic", "existing@example.test"));
        assertThat(seeder.seed()).isEqualTo(DemoDataSeeder.Result.SKIPPED_NONEMPTY);
        assertThat(customers.count()).isEqualTo(1);
        customers.deleteById(existing.getId()); // Only this test's own isolated record.

        new TransactionTemplate(manager).executeWithoutResult(status -> {
            assertThat(seeder.seed()).isEqualTo(DemoDataSeeder.Result.CREATED);
            status.setRollbackOnly();
        });
        assertThat(customers.count()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM financial_transactions", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM detection_jobs", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT completed FROM demo_seed_runs WHERE seed_key='portfolio-v1'", Boolean.class)).isFalse();

        assertThat(seeder.seed()).isEqualTo(DemoDataSeeder.Result.CREATED);
        assertThat(seeder.seed()).isEqualTo(DemoDataSeeder.Result.ALREADY_COMPLETE);
        assertThat(customers.count()).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounts", Long.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM financial_transactions", Long.class)).isEqualTo(27);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM detection_jobs", Long.class)).isEqualTo(27);
        assertThat(jdbc.queryForObject("SELECT SUM(balance) FROM accounts", java.math.BigDecimal.class))
                .isEqualByComparingTo("54427.50");
    }
}
