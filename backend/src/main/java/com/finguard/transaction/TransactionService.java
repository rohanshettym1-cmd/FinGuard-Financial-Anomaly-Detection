package com.finguard.transaction;

import com.finguard.account.AccountRepository;
import com.finguard.common.ApiException;
import com.finguard.anomaly.DetectionJob;
import com.finguard.anomaly.DetectionJobRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.finguard.transaction.TransactionDtos.*;

@Service
@Transactional(readOnly = true)
public class TransactionService {
    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final DetectionJobRepository jobs;

    public TransactionService(AccountRepository accounts, TransactionRepository transactions, DetectionJobRepository jobs) {
        this.accounts = accounts;
        this.transactions = transactions;
        this.jobs = jobs;
    }

    @Transactional
    public TransactionResponse create(CreateTransaction request) {
        var account = accounts.findByIdForUpdate(request.accountId())
                .orElseThrow(() -> ApiException.notFound("Account"));
        account.post(request.type(), request.amount());
        // JPA dirty checking persists the locked account's new balance.
        // The insert and balance update share one transaction: either both succeed or neither does.
        var transaction = new Transaction(account, request.type(), request.amount(), request.description());
        transactions.saveAndFlush(transaction);
        // Durable queue only: no analytics or network calls inside the balance transaction.
        jobs.save(new DetectionJob(transaction.getId()));
        return TransactionResponse.from(transaction);
    }

    public TransactionResponse get(long id) {
        return transactions.findById(id).map(TransactionResponse::from)
                .orElseThrow(() -> ApiException.notFound("Transaction"));
    }

    public TransactionPage listByAccount(long accountId, int page, int size) {
        if (!accounts.existsById(accountId)) { throw ApiException.notFound("Account"); }
        return TransactionPage.from(transactions.findByAccountId(accountId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))));
    }
}
