#!/usr/bin/env node
// Seeds the local dev stack with the demo bills in seed_data/.
//
//   node scripts/seed.mjs              PDFs uploaded and populated from seed_data/bills.json
//   node scripts/seed.mjs --raw        upload PDFs as INGESTED invoices without filling details
//
// Needs the Docker stack running (postgres, minio, backend). Safe to re-run: existing rows are left
// alone and PDFs that were already uploaded are skipped (the backend rejects duplicate files).
//
// This is dev/demo data only, which is why it isn't a Flyway migration: migrations run everywhere.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = join(ROOT, "seed_data");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n"));
  process.exit(0);
}

const processed = !args.includes("--raw");
const apiUrl = (argValue("--api-url") ?? process.env.SEED_API_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 8080}`).replace(/\/$/, "");
const { property, bills } = JSON.parse(readFileSync(join(SEED_DIR, "bills.json"), "utf8"));

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function fail(message) {
  console.error(`\nSeed failed: ${message}`);
  process.exit(1);
}

const sql = (value) => (value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`);

// Runs SQL in the postgres container, in one transaction, and returns psql's unaligned output
function psql(statements) {
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -X -q -t -A -1 -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: ROOT, input: statements, encoding: "utf8" },
  );
  if (result.error) fail(`couldn't run docker (${result.error.message}). Is Docker installed and on your PATH?`);
  if (result.status !== 0) fail(`database step failed. Is the postgres container running?\n${result.stderr.trim()}`);
  return result.stdout.trim();
}

// Look up existing DB-generated mapping_uuid by property name and vendor name (from R__seed_test_data.sql)
const mappingRef = (bill) => `
  (SELECT m.mapping_uuid
   FROM property_vendor_mapping m
   JOIN properties p ON m.property_uuid = p.property_uuid
   JOIN vendors v ON m.vendor_uuid = v.vendor_uuid
   WHERE lower(p.name) = lower(${sql(property.name)})
     AND lower(v.vendor_name) = lower(${sql(bill.vendor.name)})
   LIMIT 1)`;

// 1. Upload the PDFs through the real endpoint, so they land in MinIO with a hash and an audit entry
console.log(`Uploading bills to ${apiUrl}...`);
const results = [];
for (const bill of bills) {
  const bytes = readFileSync(join(SEED_DIR, bill.file));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), bill.file);

  let response;
  try {
    response = await fetch(`${apiUrl}/api/v1/invoices/upload`, { method: "POST", body: form });
  } catch (error) {
    fail(`couldn't reach the backend at ${apiUrl} (${error.cause?.code ?? error.message}). Is it running?`);
  }

  if (response.status === 201) results.push([bill.file, "uploaded"]);
  else if (response.status === 409) results.push([bill.file, "already uploaded, skipped"]);
  else fail(`uploading ${bill.file} returned ${response.status}: ${await response.text()}`);

  bill.sha256 = createHash("sha256").update(bytes).digest("hex");
}
for (const [file, outcome] of results) console.log(`  ${file}: ${outcome}`);

// 3. Fill in what extraction and matching would have found (unless --raw is passed)
if (processed) {
  console.log("Filling invoice details...");
  const updated = psql(
    bills
      .map(
        (bill) => `
UPDATE invoices
SET mapping_uuid = ${mappingRef(bill)},
    vendor_supplied_invoice_id = ${sql(bill.invoiceNumber)},
    invoice_creation_date = ${sql(bill.invoiceDate)},
    due_date = ${sql(bill.dueDate)},
    amount = ${bill.amount},
    invoice_status = CASE WHEN (${mappingRef(bill)}) IS NOT NULL THEN 'PENDING_APPROVAL' ELSE 'PENDING_MAPPING' END,
    updated_at = CURRENT_TIMESTAMP
WHERE blob_file_sha256 = ${sql(bill.sha256)}
  AND (mapping_uuid IS NULL OR amount IS NULL OR amount = 0)
RETURNING original_filename;`,
      )
      .join("\n"),
  );
  const count = updated ? updated.split("\n").length : 0;
  console.log(`  ${count} invoice(s) updated${count < bills.length ? " (the rest were already filled in)" : ""}`);
}

console.log("\nDone.");
