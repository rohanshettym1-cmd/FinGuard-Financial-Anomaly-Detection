package com.finguard.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.net.URI;
import java.util.Arrays;

/** Exact origins only. CORS permits browser access; it is not authentication. */
@Configuration
public class CorsConfiguration implements WebMvcConfigurer {
    private final String[] origins;

    public CorsConfiguration(@Value("${frontend.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String configured) {
        origins = Arrays.stream(configured.split(",")).map(String::strip).filter(value -> !value.isEmpty()).toArray(String[]::new);
        for (String origin : origins) {
            URI uri = URI.create(origin);
            if ((!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) || uri.getHost() == null
                    || uri.getUserInfo() != null || !uri.getPath().isEmpty() || uri.getQuery() != null
                    || uri.getFragment() != null || origin.contains("*")) {
                throw new IllegalArgumentException("Frontend CORS origins must be exact HTTP(S) origins without paths");
            }
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Content-Type").exposedHeaders("Location").allowCredentials(false).maxAge(3600);
    }
}
