#!/usr/bin/env node
// Seeds the local dev stack with the demo bills in seed_data/.
//
//   node scripts/seed.mjs              vendors + property mappings, PDFs uploaded as INGESTED invoices
//   node scripts/seed.mjs --processed  also fills each invoice from seed_data/bills.json and moves it
//                                      to PENDING_APPROVAL, as if extraction and matching had run
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

const processed = args.includes("--processed");
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

// The vendor a bill belongs to: the seeded one, or an existing vendor with the same name
const vendorRef = (bill) =>
  `(SELECT vendor_uuid FROM vendors WHERE vendor_uuid = ${sql(bill.vendor.vendorUuid)} OR lower(vendor_name) = lower(${sql(bill.vendor.name)})
     ORDER BY (vendor_uuid = ${sql(bill.vendor.vendorUuid)}) DESC LIMIT 1)`;

const mappingRef = (bill) =>
  `(SELECT mapping_uuid FROM property_vendor_mapping WHERE vendor_uuid = ${vendorRef(bill)} AND property_uuid = ${sql(property.propertyUuid)})`;

// 1. Property, vendors and property-vendor mappings (there's no API for mappings yet, so this is SQL)
console.log("Seeding property, vendors and mappings...");
psql(`
INSERT INTO properties (property_uuid, name, street_address, city, state, zip_code)
VALUES (${sql(property.propertyUuid)}, ${sql(property.name)}, ${sql(property.streetAddress)}, ${sql(property.city)}, ${sql(property.state)}, ${sql(property.zipCode)})
ON CONFLICT (property_uuid) DO NOTHING;
${bills
  .map(
    (bill) => `
INSERT INTO vendors (vendor_uuid, vendor_name, payment_url, payment_method)
SELECT ${sql(bill.vendor.vendorUuid)}, ${sql(bill.vendor.name)}, ${sql(bill.vendor.paymentUrl)}, ${sql(bill.vendor.paymentMethod)}
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_uuid = ${sql(bill.vendor.vendorUuid)} OR lower(vendor_name) = lower(${sql(bill.vendor.name)}));

INSERT INTO property_vendor_mapping (mapping_uuid, vendor_uuid, property_uuid, vendor_account_number)
VALUES (${sql(bill.mappingUuid)}, ${vendorRef(bill)}, ${sql(property.propertyUuid)}, ${sql(bill.accountNumber)})
ON CONFLICT DO NOTHING;`,
  )
  .join("\n")}
`);
console.log(`  ${property.name} + ${bills.length} vendors mapped to it`);

// 2. Upload the PDFs through the real endpoint, so they land in MinIO with a hash and an audit entry
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

// 3. Optionally fill in what extraction and matching would have found
if (processed) {
  console.log("Filling invoice details (--processed)...");
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
    invoice_status = 'PENDING_APPROVAL',
    updated_at = CURRENT_TIMESTAMP
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND mapping_uuid IS NULL
RETURNING original_filename;`,
      )
      .join("\n"),
  );
  const count = updated ? updated.split("\n").length : 0;
  console.log(`  ${count} invoice(s) updated${count < bills.length ? " (the rest were already filled in)" : ""}`);
}

console.log("\nDone.");
