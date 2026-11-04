package com.finguard;

import org.springframework.test.context.ActiveProfilesResolver;

/** Default tests cannot accidentally connect to the normal application's MySQL database. */
public class TestDatabaseProfiles implements ActiveProfilesResolver {
    @Override
    public String[] resolve(Class<?> testClass) {
        String database = System.getProperty("test.database", "test");
        if (!database.equals("test") && !database.equals("mysql-test")) {
            throw new IllegalArgumentException("test.database must be test or mysql-test");
        }
        return new String[] {database};
    }
}
