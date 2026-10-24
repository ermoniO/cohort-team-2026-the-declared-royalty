CREATE TABLE "utility_vendors" (
                                   "provider_id" integer PRIMARY KEY,
                                   "provider_name" varchar,
                                   "billing_phone" varchar,
                                   "website" varchar
);

CREATE TABLE "utility_services" (
                                    "account_id" integer PRIMARY KEY,
                                    "property_id" uuid NOT NULL,
                                    "provider_id" integer NOT NULL,
                                    "service_address" text,
                                    "service_type" varchar,
                                    "is_active" boolean,
                                    "created_at" timestamp
);

CREATE TABLE "invoices" (
                            "invoice_id" integer PRIMARY KEY,
                            "account_id" integer NOT NULL,
                            "billing_period" varchar,
                            "statement_date" date,
                            "service_start_date" date,
                            "service_end_date" date,
                            "amount" decimal,
                            "due_date" date,
                            "payment_status" varchar,
                            "match_status" text,
                            "confidence_score" float,
                            "raw_ai_payload" jsonb,
                            "created_at" timestamp
);

CREATE TABLE "users" (
                         "user_id" integer PRIMARY KEY,
                         "name" varchar NOT NULL,
                         "email" varchar NOT NULL,
                         "role" varchar NOT NULL,
                         "approval_limit" decimal
);

CREATE TABLE "activity_logs" (
                                 "log_id" uuid PRIMARY KEY,
                                 "invoice_id" integer NOT NULL,
                                 "actor_id" integer,
                                 "action_type" text,
                                 "action_taken" text,
                                 "previous_state" varchar,
                                 "new_state" varchar,
                                 "notes" text,
                                 "created_at" timestamp
);

ALTER TABLE "utility_services" ADD FOREIGN KEY ("provider_id") REFERENCES "utility_vendors" ("provider_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invoices" ADD FOREIGN KEY ("account_id") REFERENCES "utility_services" ("account_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activity_logs" ADD FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("invoice_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activity_logs" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;
