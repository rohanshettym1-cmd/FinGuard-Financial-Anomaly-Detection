package com.finguard.transaction;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    Page<Transaction> findByAccountId(long accountId, Pageable pageable);

    @Query("select t from Transaction t where t.account.customer.id = :customerId "
            + "and t.id < :id and t.createdAt <= :time order by t.id asc")
    List<Transaction> customerHistory(@Param("customerId") long customerId, @Param("id") long id,
                                     @Param("time") LocalDateTime time);
}
