package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.InvoiceUploadService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Seeds sample invoice PDFs from {@code seed_data/bills} on startup when missing from the database.
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.seed.demo-invoices", havingValue = "true")
public class DemoInvoiceSeeder implements ApplicationRunner {

    private final InvoiceUploadService invoiceUploadService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            Path billsDir = resolveBillsDirectory();
            if (billsDir == null) {
                log.info("Demo bills directory not found (checked seed_data/bills and ../seed_data/bills); skipping demo PDF seeding.");
                return;
            }

            List<SeedPdf> seedPdfs = loadSortedPdfs(billsDir);
            if (seedPdfs.isEmpty()) {
                log.info("No demo PDFs found in {}; skipping demo PDF seeding.", billsDir.toAbsolutePath());
                return;
            }

            List<String> allHashes = seedPdfs.stream().map(SeedPdf::sha256).toList();
            Set<String> existingHashes = new HashSet<>(invoiceUploadService.findExistingHashes(allHashes));

            int uploadedCount = 0;
            for (SeedPdf pdf : seedPdfs) {
                if (existingHashes.contains(pdf.sha256())) {
                    continue;
                }
                try {
                    invoiceUploadService.upload(new InMemoryMultipartFile(pdf.filename(), pdf.bytes()));
                    uploadedCount++;
                } catch (Exception ex) {
                    log.warn("Failed to seed demo invoice {}: {}", pdf.filename(), ex.getMessage());
                }
            }

            log.info("Demo invoice startup check complete ({} existing, {} newly uploaded from {}).",
                    existingHashes.size(), uploadedCount, billsDir.toAbsolutePath());
        } catch (Exception ex) {
            log.warn("Skipping demo invoice startup seeding due to environment error: {}", ex.getMessage());
        }
    }

    private Path resolveBillsDirectory() {
        List<Path> candidates = List.of(
                Path.of("seed_data"),
                Path.of("..", "seed_data")
        );
        for (Path candidate : candidates) {
            if (Files.isDirectory(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private List<SeedPdf> loadSortedPdfs(Path billsDir) throws IOException, NoSuchAlgorithmException {
        List<Path> paths;
        try (Stream<Path> stream = Files.list(billsDir)) {
            paths = stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".pdf"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        List<SeedPdf> result = new ArrayList<>(paths.size());
        for (Path path : paths) {
            byte[] bytes = Files.readAllBytes(path);
            String sha256 = HexFormat.of().formatHex(digest.digest(bytes));
            digest.reset();
            result.add(new SeedPdf(path.getFileName().toString(), bytes, sha256));
        }
        return result;
    }

    private record SeedPdf(String filename, byte[] bytes, String sha256) {
    }

    private static final class InMemoryMultipartFile implements MultipartFile {

        private final String filename;
        private final byte[] content;

        private InMemoryMultipartFile(String filename, byte[] content) {
            this.filename = filename;
            this.content = content;
        }

        @Override
        public String getName() {
            return "files";
        }

        @Override
        public String getOriginalFilename() {
            return filename;
        }

        @Override
        public String getContentType() {
            return "application/pdf";
        }

        @Override
        public boolean isEmpty() {
            return content.length == 0;
        }

        @Override
        public long getSize() {
            return content.length;
        }

        @Override
        public byte[] getBytes() {
            return content.clone();
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(content);
        }

        @Override
        public void transferTo(File dest) throws IOException {
            Files.write(dest.toPath(), content);
        }
    }
}

