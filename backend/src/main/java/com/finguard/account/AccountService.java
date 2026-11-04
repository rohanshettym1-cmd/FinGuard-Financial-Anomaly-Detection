package com.finguard.account;

import com.finguard.common.ApiException;
import com.finguard.customer.CustomerService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import static com.finguard.account.AccountDtos.*;

@Service
@Transactional(readOnly = true)
public class AccountService {
    private final AccountRepository accounts;
    private final CustomerService customers;

    public AccountService(AccountRepository accounts, CustomerService customers) {
        this.accounts = accounts;
        this.customers = customers;
    }

    @Transactional
    public AccountResponse create(CreateAccount request) {
        var customer = customers.requireCustomer(request.customerId());
        var status = request.status() == null ? AccountStatus.ACTIVE : request.status();
        return AccountResponse.from(accounts.saveAndFlush(new Account(customer, status)));
    }

    public Account requireAccount(long id) {
        return accounts.findById(id).orElseThrow(() -> ApiException.notFound("Account"));
    }

    public AccountResponse get(long id) { return AccountResponse.from(requireAccount(id)); }

    public BalanceResponse balance(long id) {
        var account = requireAccount(id);
        return new BalanceResponse(account.getId(), account.getBalance());
    }

    public List<AccountResponse> listByCustomer(long customerId) {
        customers.requireCustomer(customerId);
        return accounts.findByCustomerIdOrderByIdAsc(customerId).stream().map(AccountResponse::from).toList();
    }
}
