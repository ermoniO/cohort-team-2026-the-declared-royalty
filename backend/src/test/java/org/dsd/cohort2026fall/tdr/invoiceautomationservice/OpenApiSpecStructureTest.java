package org.dsd.cohort2026fall.tdr.invoiceautomationservice;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Guards the multi-file OpenAPI layout: a small root file and fragments whose $refs all resolve. */
class OpenApiSpecStructureTest {

    private static final Path SPEC_DIR = Path.of("src/main/resources/openapi");
    private static final Path ROOT = SPEC_DIR.resolve("openapi.yaml");
    private static final Pattern FILE_REF = Pattern.compile("\\$ref:\\s*['\"]?([^'\"#\\s][^'\"\\s]*\\.yaml)['\"]?");

    @Test
    void rootSpecOnlyReferencesFragments() throws IOException {
        assertThat(ROOT).exists();
        List<String> lines = Files.readAllLines(ROOT);
        assertThat(lines.size()).isLessThan(180);

        boolean inPaths = false;
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.startsWith("paths:")) {
                inPaths = true;
                continue;
            }
            if (inPaths && !line.isBlank() && !line.startsWith(" ")) {
                inPaths = false;
            }
            if (inPaths && line.matches("^ {2}\\S.*:\\s*$")) {
                assertThat(lines.get(i + 1).trim()).startsWith("$ref:");
            }
        }
        assertThat(resolveAllRefs(ROOT)).isEmpty();
    }

    @Test
    void everyFragmentRefResolves() throws IOException {
        List<String> unresolved = new ArrayList<>();
        try (Stream<Path> files = Files.walk(SPEC_DIR)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".yaml")).toList()) {
                unresolved.addAll(resolveAllRefs(file));
            }
        }
        assertThat(unresolved).isEmpty();
    }

    @Test
    void invoicePatchDocuments409AndActor() throws IOException {
        String patch = Files.readString(SPEC_DIR.resolve("paths/invoices_by_id.yaml"));
        String patchOperation = patch.substring(patch.indexOf("  patch:"));
        assertThat(patchOperation).contains("'409':");
        assertThat(patchOperation).contains("status transition not allowed");

        String update = Files.readString(SPEC_DIR.resolve("components/schemas/InvoiceUpdateRequest.yaml"));
        assertThat(update).containsPattern("actedBy:\\s*\\n\\s+type: string\\s*\\n\\s+format: uuid");

        String audit = Files.readString(SPEC_DIR.resolve("components/schemas/AuditLogCreateRequest.yaml"));
        assertThat(audit).contains("- SYSTEM_FAILED", "- USER_FAILED", "- SYSTEM_VOIDED", "- USER_VOIDED");
    }

    @Test
    void propertyPolicyEvaluationContractExists() throws IOException {
        String root = Files.readString(ROOT);
        assertThat(root).contains("/api/v1/properties/{propertyId}/policy-evaluation:");
        assertThat(root).contains("./paths/property_policy_evaluation.yaml");

        Path pathFile = SPEC_DIR.resolve("paths/property_policy_evaluation.yaml");
        assertThat(pathFile).exists();
        String pathContent = Files.readString(pathFile);
        assertThat(pathContent).contains("operationId: evaluatePropertyPolicy");

        Path reqSchema = SPEC_DIR.resolve("components/schemas/PolicyEvaluationRequest.yaml");
        Path resSchema = SPEC_DIR.resolve("components/schemas/PolicyEvaluationResponse.yaml");
        assertThat(reqSchema).exists();
        assertThat(resSchema).exists();
    }

    @Test
    void invoiceAnalysisContractExists() throws IOException {
        String root = Files.readString(ROOT);
        assertThat(root).contains("InvoiceAnalysisResponse:");
        assertThat(root).contains("./components/schemas/InvoiceAnalysisResponse.yaml");

        Path pathFile = SPEC_DIR.resolve("paths/invoices_by_id.yaml");
        assertThat(pathFile).exists();
        String pathContent = Files.readString(pathFile);
        assertThat(pathContent).contains("operationId: analyzeInvoice");

        Path schema = SPEC_DIR.resolve("components/schemas/InvoiceAnalysisResponse.yaml");
        assertThat(schema).exists();
    }

    @Test
    void propertyVendorMappingsContractExists() throws IOException {
        String root = Files.readString(ROOT);
        assertThat(root).contains("/api/v1/property-vendor-mappings:");
        assertThat(root).contains("/api/v1/property-vendor-mappings/{mappingUuid}:");
        assertThat(root).contains("PropertyVendorMappingResponse:");
        assertThat(root).contains("PropertyVendorMappingCreateRequest:");
        assertThat(root).contains("PropertyVendorMappingUpdateRequest:");

        assertThat(SPEC_DIR.resolve("paths/property_vendor_mappings.yaml")).exists();
        assertThat(SPEC_DIR.resolve("paths/property_vendor_mappings_by_id.yaml")).exists();
        assertThat(SPEC_DIR.resolve("components/schemas/PropertyVendorMappingResponse.yaml")).exists();
        assertThat(SPEC_DIR.resolve("components/schemas/PropertyVendorMappingCreateRequest.yaml")).exists();
        assertThat(SPEC_DIR.resolve("components/schemas/PropertyVendorMappingUpdateRequest.yaml")).exists();
    }

    /** Returns descriptions of file $refs in the given file whose target does not exist. */
    private static List<String> resolveAllRefs(Path file) throws IOException {
        List<String> missing = new ArrayList<>();
        Path parent = file.getParent();
        for (String line : Files.readAllLines(file)) {
            Matcher matcher = FILE_REF.matcher(line);
            while (matcher.find()) {
                String ref = matcher.group(1);
                Path target = (parent == null ? Path.of(ref) : parent.resolve(ref)).normalize();
                if (!Files.exists(target)) {
                    missing.add(file + " references missing " + ref + " (looked at " + target + ")");
                }
            }
        }
        return missing;
    }
}
