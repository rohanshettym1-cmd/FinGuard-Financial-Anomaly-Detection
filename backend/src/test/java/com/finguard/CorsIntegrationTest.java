package com.finguard;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles(resolver = TestDatabaseProfiles.class)
class CorsIntegrationTest {
    @Autowired MockMvc mvc;
    @Test
    void exactLocalOriginCanReadHealthWithoutCredentials() throws Exception {
        mvc.perform(get("/api/health").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
    @Test
    void jsonPostPreflightIsAllowed() throws Exception {
        mvc.perform(options("/api/transactions").header("Origin", "http://127.0.0.1:5173")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5173"));
    }
    @Test
    void unrelatedOriginAndUnsupportedMethodsAreRejected() throws Exception {
        mvc.perform(get("/api/health").header("Origin", "https://untrusted.example"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(options("/api/accounts/1").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "DELETE")).andExpect(status().isForbidden());
    }
}
