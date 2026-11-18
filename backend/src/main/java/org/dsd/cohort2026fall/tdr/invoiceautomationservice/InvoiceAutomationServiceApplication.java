package org.dsd.cohort2026fall.tdr.invoiceautomationservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InvoiceAutomationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(InvoiceAutomationServiceApplication.class, args);
    }

}
