package com.finguard.customer;

import com.finguard.common.ApiException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;
import static com.finguard.customer.CustomerDtos.*;

@Service
@Transactional(readOnly = true)
public class CustomerService {
    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) { this.customers = customers; }

    @Transactional
    public CustomerResponse create(CreateCustomer request) {
        var customer = new Customer(request.name().strip(), request.email().strip().toLowerCase(Locale.ROOT));
        return CustomerResponse.from(customers.saveAndFlush(customer));
    }

    public CustomerResponse get(long id) { return CustomerResponse.from(requireCustomer(id)); }

    public Customer requireCustomer(long id) {
        return customers.findById(id).orElseThrow(() -> ApiException.notFound("Customer"));
    }

    public List<CustomerResponse> list() {
        return customers.findAll(Sort.by("id")).stream().map(CustomerResponse::from).toList();
    }
}
