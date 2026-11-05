package com.finguard.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "demo.enabled", havingValue = "true")
public class DemoDataInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);
    private final DemoDataSeeder seeder;
    public DemoDataInitializer(DemoDataSeeder seeder) { this.seeder = seeder; }
    @Override
    public void run(ApplicationArguments args) {
        log.info("Opt-in synthetic demo initialization: {}", seeder.seed());
    }
}
