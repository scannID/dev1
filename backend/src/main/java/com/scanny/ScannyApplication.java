package com.scanny;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EntityScan(basePackages = {
    "com.scanny.entity",
    "com.scanny.accounting.entity",
    "com.scanny.efris"
})
@EnableJpaRepositories(basePackages = {
    "com.scanny.repository",
    "com.scanny.accounting.repository",
    "com.scanny.efris"
})
public class ScannyApplication {

    public static void main(String[] args) {
        SpringApplication.run(ScannyApplication.class, args);
    }
}
