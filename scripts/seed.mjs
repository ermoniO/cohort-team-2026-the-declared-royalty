#!/usr/bin/env node
// Seeds the local dev stack with the demo bills in seed_data/.
//
//   node scripts/seed.mjs              vendors, each linked to its bill's property (the business named on
//                                      the bill, at the service address printed on it),
//                                      and the PDFs uploaded as INGESTED invoices
//   node scripts/seed.mjs --processed  also moves those PDF bills into a mix of workflow states (awaiting
//                                      approval, past due, approved, rejected, information requested)
//                                      with audit history (seed_data/demo.json)
//
// Only the PDFs in seed_data/ are seeded: no bills without a file.
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
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 16).join("\n"));
  process.exit(0);
}

const processed = args.includes("--processed");
const apiUrl = (argValue("--api-url") ?? process.env.SEED_API_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 8080}`).replace(/\/$/, "");
const { serviceAddress, uploaders, bills } = JSON.parse(readFileSync(join(SEED_DIR, "bills.json"), "utf8"));

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

// The service address printed on a bill (the property is the business named on it at this address)
const addressOf = (bill) => {
  const a = bill.serviceAddress ?? serviceAddress;
  return `${a.streetAddress}, ${a.city}, ${a.state} ${a.zipCode}`;
};

const mappingRef = (bill) =>
  `(SELECT mapping_uuid FROM property_vendor_mapping WHERE vendor_uuid = ${vendorRef(bill)} AND property_uuid = ${sql(bill.propertyUuid)}
     ORDER BY (mapping_uuid = ${sql(bill.mappingUuid)}) DESC LIMIT 1)`;

async function api(method, path, body) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    fail(`couldn't reach the backend at ${apiUrl} (${error.cause?.code ?? error.message}). Is it running?`);
  }
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  return { status: response.status, json, text };
}

// 1. Demo users and vendors (SQL: there's no API for creating users with a fixed id)
console.log("Seeding users and vendors...");
psql(`
${uploaders
  .map(
    (user) => `
INSERT INTO users (user_uuid, user_name, email, role, status)
VALUES (${sql(user.userUuid)}, ${sql(user.userName)}, ${sql(user.email)}, 'ADMIN', 'ACTIVE')
ON CONFLICT (user_uuid) DO NOTHING;`,
  )
  .join("\n")}
${bills
  .map(
    (bill) => `
INSERT INTO vendors (vendor_uuid, vendor_name, payment_url, payment_method)
SELECT ${sql(bill.vendor.vendorUuid)}, ${sql(bill.vendor.name)}, ${sql(bill.vendor.paymentUrl)}, ${sql(bill.vendor.paymentMethod)}
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_uuid = ${sql(bill.vendor.vendorUuid)} OR lower(vendor_name) = lower(${sql(bill.vendor.name)}));`,
  )
  .join("\n")}
`);
console.log(`  ${uploaders.map((user) => user.userName).join(", ")} as uploaders, ${bills.length} vendors`);

// Each bill's property is the business named on it at the service address printed on it (e.g.
// "Alder Creek Workshop, 125 Industrial Way"), matched by the backend against the properties already
// in the database, unless bills.json names one with propertyUuid. No match: the property is created.
// Several matches: the bill is left without a property.
console.log("Finding each bill's property by its name and service address...");
for (const bill of bills) {
  if (bill.propertyUuid) {
    bill.propertyGiven = true;
    console.log(`  ${bill.file}: property ${bill.propertyUuid} (given in bills.json)`);
    continue;
  }
  const address = addressOf(bill);
  const name = bill.customerName;
  const match = await api(
    "GET",
    `/api/v1/properties/match?address=${encodeURIComponent(address)}&name=${encodeURIComponent(name)}`,
  );
  if (match.status !== 200) fail(`matching '${name}, ${address}' returned ${match.status}: ${match.text}`);

  if (match.json.length === 1) {
    bill.propertyUuid = match.json[0].propertyId;
    console.log(`  ${bill.file}: ${match.json[0].name}, ${address} (matched)`);
  } else if (match.json.length === 0) {
    const a = bill.serviceAddress ?? serviceAddress;
    const made = await api("POST", "/api/v1/properties", {
      name, streetAddress: a.streetAddress, city: a.city, state: a.state, zipCode: a.zipCode,
    });
    if (made.status !== 201) fail(`creating ${name} at '${address}' returned ${made.status}: ${made.text}`);
    bill.propertyUuid = made.json.propertyId;
    console.log(`  ${bill.file}: ${name}, ${address} (created: no property matched)`);
  } else {
    bill.unmatchedReason = `${name}, ${address} matches ${match.json.length} properties: ${match.json
      .map((p) => `${p.name} (${p.propertyId})`)
      .join(", ")}`;
    console.warn(`  ${bill.file}: NOT MATCHED. ${bill.unmatchedReason}. Set propertyUuid in bills.json to choose one.`);
  }
}

// Link each vendor to its bill's property (SQL: there's no API for mappings yet)
psql(
  bills
    .filter((bill) => bill.propertyUuid)
    .map(
      (bill) => `
INSERT INTO property_vendor_mapping (mapping_uuid, vendor_uuid, property_uuid, vendor_account_number)
SELECT ${sql(bill.mappingUuid)}, ${vendorRef(bill)}, ${sql(bill.propertyUuid)}, ${sql(bill.accountNumber)}
WHERE NOT EXISTS (SELECT 1 FROM property_vendor_mapping WHERE vendor_uuid = ${vendorRef(bill)} AND property_uuid = ${sql(bill.propertyUuid)})
ON CONFLICT DO NOTHING;`,
    )
    .join("\n") || "SELECT 1;",
);

// 2. Upload the PDFs through the real endpoint, so they land in MinIO with a hash and an audit entry.
// Each is uploaded as its demo user, who becomes the bill's submitter.
console.log(`Uploading bills to ${apiUrl}...`);
const results = [];
for (const bill of bills) {
  bill.bytes = readFileSync(join(SEED_DIR, bill.file));
  bill.sha256 = createHash("sha256").update(bill.bytes).digest("hex");
}

// Skip files the backend already has: re-uploading one is rejected, and each rejection adds a
// "Duplicate upload rejected" entry to that bill's audit history
let stored = new Set();
try {
  const check = await fetch(`${apiUrl}/api/v1/invoices/upload/check-duplicates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: bills.map((bill) => bill.sha256) }),
  });
  if (check.ok) stored = new Set((await check.json()).duplicates);
} catch (error) {
  fail(`couldn't reach the backend at ${apiUrl} (${error.cause?.code ?? error.message}). Is it running?`);
}

for (const bill of bills) {
  if (stored.has(bill.sha256)) {
    results.push([bill.file, "already uploaded, skipped"]);
    continue;
  }
  const bytes = bill.bytes;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), bill.file);
  form.append("uploadedBy", bill.uploadedBy);

  let response;
  try {
    response = await fetch(`${apiUrl}/api/v1/invoices/upload`, { method: "POST", body: form });
  } catch (error) {
    fail(`couldn't reach the backend at ${apiUrl} (${error.cause?.code ?? error.message}). Is it running?`);
  }

  if (response.status === 201) results.push([bill.file, "uploaded"]);
  else if (response.status === 409) results.push([bill.file, "already uploaded, skipped"]);
  else fail(`uploading ${bill.file} returned ${response.status}: ${await response.text()}`);
}
for (const [file, outcome] of results) console.log(`  ${file}: ${outcome}`);

// Bills uploaded before uploads recorded a real user were credited to the System user: hand them
// (and their upload audit entry) to their demo uploader. Bills someone else uploaded are left alone.
psql(
  bills
    .map(
      (bill) => `
UPDATE audit_logs SET user_uuid = ${sql(bill.uploadedBy)}, action_type = 'USER_INGESTED'
WHERE action_taken = 'File uploaded and stored' AND user_uuid = '00000000-0000-0000-0000-000000000001'
  AND invoice_uuid IN (SELECT invoice_uuid FROM invoices WHERE blob_file_sha256 = ${sql(bill.sha256)}
                         AND (uploaded_by IS NULL OR uploaded_by = '00000000-0000-0000-0000-000000000001'));
UPDATE invoices SET uploaded_by = ${sql(bill.uploadedBy)}
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND (uploaded_by IS NULL OR uploaded_by = '00000000-0000-0000-0000-000000000001');`,
    )
    .join("\n"),
);

// 3. Optionally turn the bills into a mix of workflow states, with matching audit history.
// Reject and Request information map onto existing statuses, as on the Approvals page.
const FINAL_STATUS = {
  awaiting: "PENDING_APPROVAL",
  approved: "APPROVED",
  rejected: "VOID",
  infoRequested: "PENDING_MAPPING",
  processing: "PROCESSING_PAYMENT",
  paid: "PAID",
  failed: "FAILED",
};

if (processed) {
  console.log("Building the demo mix (--processed)...");
  const demo = JSON.parse(readFileSync(join(SEED_DIR, "demo.json"), "utf8"));
  const statements = [];

  // Link each bill that has no property yet through the backend, the same way the app would: by the
  // address on the bill (or by its mapping, when bills.json names the property). A bill the backend
  // can't match goes to Needs review instead of its scenario.
  for (const bill of bills) {
    const [invoiceUuid, linked, vendorUuid] = psql(
      `SELECT invoice_uuid || '|' || coalesce(mapping_uuid::text, '') || '|' || coalesce(${vendorRef(bill)}::text, '')
       FROM invoices WHERE blob_file_sha256 = ${sql(bill.sha256)};`,
    ).split("|");
    if (!invoiceUuid || linked) continue;

    const body = bill.propertyGiven
      ? { mappingUuid: psql(`SELECT ${mappingRef(bill)};`) }
      : { propertyAddress: addressOf(bill), propertyName: bill.customerName, vendorUuid };
    const result = await api("PATCH", `/api/v1/invoices/${invoiceUuid}`, body);
    if (result.status === 200) {
      console.log(`  ${bill.file}: linked to ${result.json.propertyName}`);
    } else if (result.status === 422 || result.status === 400) {
      bill.unmatchedReason = result.json?.message ?? result.text;
      console.warn(`  ${bill.file}: left in Needs review. ${bill.unmatchedReason}`);
    } else {
      fail(`linking ${bill.file} returned ${result.status}: ${result.text}`);
    }
  }

  // PDF bills: fill in the printed details, then move each to its scenario's state. Guarded by the
  // scenario's first audit entry, so it applies once and later decisions made in the UI are kept.
  for (const bill of bills) {
    const scenario = demo.pdfBills[bill.file];
    if (!scenario) continue;

    if (bill.unmatchedReason) {
      const note = { id: seedUuid("audit", bill.file, "unmatched"), actionType: "SYSTEM_MATCHED", actionTaken: "Property not matched",
        fromState: "INGESTED", toState: "PENDING_MAPPING", at: new Date().toISOString(), notes: bill.unmatchedReason };
      statements.push(`
UPDATE invoices SET invoice_status = 'PENDING_MAPPING', updated_at = now()
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND mapping_uuid IS NULL AND invoice_status = 'INGESTED';
UPDATE invoices SET description = ${sql(bill.description)}
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND description IS NULL;`);
      statements.push(auditInsert(note, `(SELECT invoice_uuid FROM invoices WHERE blob_file_sha256 = ${sql(bill.sha256)})`));
      continue;
    }

    // Only bills that have a property get a scenario
    const ref = `(SELECT invoice_uuid FROM invoices WHERE blob_file_sha256 = ${sql(bill.sha256)} AND mapping_uuid IS NOT NULL)`;
    const history = scenarioHistory(bill.file, scenario);
    const notYetApplied = `NOT EXISTS (SELECT 1 FROM audit_logs WHERE audit_uuid = ${sql(history[0].id)})`;
    statements.push(`
UPDATE invoices
SET vendor_supplied_invoice_id = ${sql(bill.invoiceNumber)},
    invoice_creation_date = ${sql(dateIn(-scenario.receivedDaysAgo - 2))},
    due_date = ${sql(dateIn(scenario.dueInDays))},
    amount = ${bill.amount},
    invoice_status = ${sql(FINAL_STATUS[scenario.outcome])},
    failure_reason = NULL,
    created_at = ${sql(at(scenario.receivedDaysAgo))},
    updated_at = ${sql(history[history.length - 1].at)}
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND mapping_uuid IS NOT NULL AND ${notYetApplied};

-- Its own step, so data seeded before descriptions existed gets one too
UPDATE invoices SET description = ${sql(bill.description)}
WHERE blob_file_sha256 = ${sql(bill.sha256)} AND description IS NULL;

-- Move the real upload entry back to the bill's received time, so the history reads in order
UPDATE audit_logs SET created_at = ${sql(at(scenario.receivedDaysAgo))}, updated_at = ${sql(at(scenario.receivedDaysAgo))}
WHERE invoice_uuid = ${ref} AND action_taken = 'File uploaded and stored' AND ${notYetApplied};`);
    statements.push(...history.map((entry) => auditInsert(entry, ref)));
  }

  psql(statements.join("\n"));
  const counts = psql(`SELECT invoice_status || ': ' || count(*) FROM invoices GROUP BY invoice_status ORDER BY invoice_status;`);
  console.log(`  Invoices by status now:\n${counts.split("\n").map((line) => `    ${line}`).join("\n")}`);
}

console.log("\nDone.");

// --- Demo helpers (function declarations are hoisted, so step 3 can use them) ---

function at(daysAgo, hoursLater = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000 + hoursLater * 3_600_000).toISOString();
}

// A calendar date `days` from today, as YYYY-MM-DD in local time; null stays null
function dateIn(days) {
  if (days === null || days === undefined) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The same UUID every run for the same name, so re-running doesn't add duplicates
function seedUuid(...parts) {
  const hex = createHash("md5").update(`seed:${parts.join(":")}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// The audit entries that tell a bill's story. Decisions use the same wording as the Approvals page,
// and the backend's System user (migration V4) records them until there are real users.
function scenarioHistory(key, s) {
  const entries = [];
  const add = (step, actionType, actionTaken, fromState, toState, when, notes = null) =>
    entries.push({ id: seedUuid("audit", key, step), actionType, actionTaken, fromState, toState, at: when, notes });

  if (s.outcome === "failed") {
    add("failed", "SYSTEM_IDENTIFIED", "Extraction failed", "INGESTED", "FAILED", at(s.receivedDaysAgo, 0.1), s.failureReason);
    return entries;
  }
  add("matched", "SYSTEM_MATCHED", "Matched to vendor and property", "INGESTED", "PENDING_APPROVAL", at(s.receivedDaysAgo, 1));

  const decided = at(s.decisionDaysAgo ?? 0);
  if (["approved", "paid", "processing"].includes(s.outcome)) {
    add("decision", "USER_APPROVED", "Approved", "PENDING_APPROVAL", "APPROVED", decided, s.note);
  } else if (s.outcome === "rejected") {
    add("decision", "USER_APPROVED", `Rejected: ${s.reason}`, "PENDING_APPROVAL", "VOID", decided, s.note);
  } else if (s.outcome === "infoRequested") {
    add("decision", "USER_APPROVED", "Information requested", "PENDING_APPROVAL", "PENDING_MAPPING", decided, s.note);
  }
  if (s.outcome === "processing") {
    add("payment", "SYSTEM_PAID", "Payment started", "APPROVED", "PROCESSING_PAYMENT", at(s.decisionDaysAgo, 2));
  }
  if (s.outcome === "paid") add("payment", "SYSTEM_PAID", "Payment recorded", "APPROVED", "PAID", at(s.paidDaysAgo));
  return entries;
}

function auditInsert(entry, invoiceRef) {
  return `
INSERT INTO audit_logs (audit_uuid, invoice_uuid, user_uuid, action_type, action_taken, from_state, to_state, notes, created_at, updated_at)
SELECT ${sql(entry.id)}, ${invoiceRef}, '00000000-0000-0000-0000-000000000001', ${sql(entry.actionType)}, ${sql(entry.actionTaken)},
       ${sql(entry.fromState)}, ${sql(entry.toState)}, ${sql(entry.notes)}, ${sql(entry.at)}, ${sql(entry.at)}
WHERE ${invoiceRef} IS NOT NULL
ON CONFLICT (audit_uuid) DO NOTHING;`;
}

