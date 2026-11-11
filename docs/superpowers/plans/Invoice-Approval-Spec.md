# Commercial Real Estate Property Management: Invoice Processing Architecture & Design Specs

This document serves as the complete, cohesive, single source of truth for the property, vendor, and multi-level financial approval architecture. It aggregates all database schemas, visual wireframes, business criteria, and code configurations agreed upon for Phase 1.

---

## 1. Architectural & Workflow Decisions

### Many-to-Many Relationships
Properties and Vendors operate as completely independent master lists linked via a many-to-many junction table (`property_vendors`). A single vendor can serve dozens of properties in a portfolio, and a single property utilizes dozens of specialized vendors.

### Configuration vs. Execution Decoupling
To keep code paths lean and modular, the system design splits the logic into two separate engineering phases:
*   **Phase 1 (Current Focus):** Setting up the structural metadata configurations—Property definitions, Custom Property Types, Vendor assignments, Roles, and Financial Policy Tiers.
*   **Phase 2 (Future Extension):** Executing authorization sequences on active transactional items (OCR data payloads, PDF views, multi-line invoice splits, and manual/automated router status changes).

### Global Base Roles + Local Policy Overrides
To resolve the multi-tenant "ghost user" catch-22, users always possess exactly one **Global Base Role** to establish system identity, base UI routing, and access permissions even when no properties exist in the database. When assigned to a specific property, the user inherits a **Corporate Financial Policy Tier**. These policies dynamically alter a user's local clearing limit depending on the risk tier of the property context they are actively working inside.

### Fiduciary Database Enforcements (The Single Source of Truth)
To eliminate code drift or mismatch between front-end UI selections and backend validation logic, all rule constraints are strictly bound using **Composite Foreign Keys** directly at the PostgreSQL database level. A user cannot be assigned a policy tier unaligned with their global corporate clearance.

### Soft Deletes via Uniform Status Strategy
Every table incorporates a `status` column enforcing an `('ACTIVE', 'INACTIVE')` check constraint. Deletions are executed as logical soft deletes (`UPDATE ... SET status = 'INACTIVE'`), which completely preserves critical multi-year financial audit trails and historical reporting data.

---

## 2. Business Logic & Constraints Matrix

### Real-World Commercial Real Estate Roles
1.  **ADMIN:** Full global configuration authority over users, lookups, and corporate policy definitions.
2.  **ACCOUNTANT:** General ledger monitoring, batch runs, bank reconciliation, and exports to accounting systems (Yardi, RealPage, or MRI). Has zero transactional approval authority.
3.  **PROPERTY_MANAGER (PM):** Day-to-day building custodian. Evaluates smaller routine operational maintenance bills.
4.  **SENIOR_PROPERTY_MANAGER (SPM):** Manages a team of PMs or handles larger high-asset-value structures with expanded baseline financial limits.
5.  **REGIONAL_DIRECTOR (RD):** Portfolio overseer. Reviews medium-scale capital expenses and handles structural overages or escalations.
6.  **VICE_PRESIDENT (VP):** Executive corporate tier. Signs off on large-scale infrastructure projects, extensive multi-property allocations, and portfolio capital expenditure allocations.

### Financial Policy Execution Rules
Financial policies check both invoice thresholds and vendor billing configurations (`cost_type` living on the mapping bridge):
*   **FIXED_MONTHLY (Contracts/Utilities):** Predictable recurring costs (e.g., flat trash or elevator testing contracts). The backend can route these through an automated engine using the policy's `fixed_auto_max` limit to trigger instant hands-free approval loops.
*   **VARIABLE (Time & Materials):** On-call maintenance or repair bills (e.g., emergency roof fixes or specialized electrical dispatches). These always bypass automated tracks and require physical sign-offs up to the user's `variable_max` limit.

### Multi-Level Routing Progression
The backend dynamically builds the human routing chain by loading all active user rows mapped to the target property. It calculates the necessary validation steps by ordering paths sequentially from lowest clearance threshold to highest. Invoices exceeding lower-tier thresholds require initial reviewer sign-offs before unlocking the next tier's queue.

---

## 3. Final Production Database Schema (PostgreSQL)

```sql
-- Enforce UUID generation extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. PROPERTY TYPES LOOKUP TABLE
-- ==========================================
CREATE TABLE property_types (
    slug             VARCHAR(50) PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_property_type_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_property_type_slug CHECK (slug IN ('COMMERCIAL_OFFICE', 'RETAIL_PLAZA', 'INDUSTRIAL_PARK', 'MEDICAL_CENTER', 'MULTI_FAMILY', 'SELF_STORAGE'))
);

-- ==========================================
-- 2. PROPERTIES MASTER TABLE
-- ==========================================
CREATE TABLE properties (
    property_uuid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    property_type    VARCHAR(50) NOT NULL,
    address          JSONB NOT NULL, -- Format: { street: str, city: str, state: str, zip: str }
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_property_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT fk_property_type_lookup FOREIGN KEY (property_type) REFERENCES property_types(slug)
);

-- ==========================================
-- 3. PROPERTY MASTER CHART OF ACCOUNTS (GL CODES)
-- ==========================================
CREATE TABLE property_gl_codes (
    gl_code          VARCHAR(50) NOT NULL,
    property_uuid    UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
    account_name     VARCHAR(100) NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    PRIMARY KEY (gl_code, property_uuid),
    CONSTRAINT check_gl_code_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ==========================================
-- 4. VENDORS MASTER TABLE
-- ==========================================
CREATE TABLE vendors (
    vendor_uuid      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    trade_category   VARCHAR(100) NOT NULL, -- e.g., 'PLUMBING', 'HVAC', 'JANITORIAL', 'WASTE'
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_vendor_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ==========================================
-- 5. PROPERTY TO VENDOR JUNCTION TABLE
-- ==========================================
CREATE TABLE property_vendors (
    property_uuid    UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
    vendor_uuid      UUID NOT NULL REFERENCES vendors(vendor_uuid) ON DELETE CASCADE,
    cost_type        VARCHAR(20) NOT NULL DEFAULT 'VARIABLE',
    default_gl_code  VARCHAR(50),
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    PRIMARY KEY (property_uuid, vendor_uuid),
    CONSTRAINT check_prop_vendor_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_prop_vendor_cost_type CHECK (cost_type IN ('FIXED_MONTHLY', 'VARIABLE')),
    
    -- Structural Guardrail: Ensure default GL code mapped actually exists inside the specific property's chart of accounts
    CONSTRAINT fk_property_vendor_gl 
        FOREIGN KEY (default_gl_code, property_uuid) 
        REFERENCES property_gl_codes(gl_code, property_uuid)
);

-- ==========================================
-- 6. GLOBAL SYSTEM ROLES LOOKUP
-- ==========================================
CREATE TABLE roles (
    role_slug        VARCHAR(50) PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    description      TEXT,
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_role_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_role_slug CHECK (role_slug IN ('ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER', 'SENIOR_PROPERTY_MANAGER', 'REGIONAL_DIRECTOR', 'VICE_PRESIDENT'))
);

-- ==========================================
-- 7. USERS MASTER TABLE
-- ==========================================
CREATE TABLE users (
    user_uuid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name       VARCHAR(100) NOT NULL,
    last_name        VARCHAR(100) NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    global_role      VARCHAR(50) NOT NULL REFERENCES roles(role_slug),
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_user_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    -- Composite unique constraint crucial for validation references down the chain
    CONSTRAINT unique_user_role_bridge UNIQUE (user_uuid, global_role)
);

-- ==========================================
-- 8. CORPORATE STANDARD POLICY TIERS
-- ==========================================
CREATE TABLE corporate_policy_tiers (
    tier_slug         VARCHAR(50) PRIMARY KEY,
    display_name      VARCHAR(100) NOT NULL,
    allowed_role      VARCHAR(50) NOT NULL REFERENCES roles(role_slug),
    variable_max      NUMERIC(12, 2) NOT NULL,
    fixed_auto_max    NUMERIC(12, 2) NOT NULL,
    status            VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT check_policy_tier_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_policy_tier_slug CHECK (tier_slug IN ('TIER_NONE_ACCT', 'TIER_1_LOW_PM', 'TIER_2_MID_SPM', 'TIER_3_HIGH_RD', 'TIER_4_UNLIMITED_VP')),
    -- Composite unique constraint to bridge validation down to the link table
    CONSTRAINT unique_tier_role_bridge UNIQUE (tier_slug, allowed_role)
);

-- ==========================================
-- 9. UNBREACHABLE PROPERTY-USER POLICY LINK TABLE
-- ==========================================
CREATE TABLE property_user_policies (
    property_uuid     UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
    user_uuid         UUID NOT NULL,
    user_role         VARCHAR(50) NOT NULL,
    tier_slug         VARCHAR(50) NOT NULL,
    status            VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    PRIMARY KEY (property_uuid, user_uuid),
    CONSTRAINT check_prop_user_policy_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    
    -- COMPOSITE GUARDRAIL 1: Guarantees user_role matches their real global user account identity
    CONSTRAINT fk_enforce_user_identity_match
        FOREIGN KEY (user_uuid, user_role)
        REFERENCES users(user_uuid, global_role) ON DELETE CASCADE,
        
    -- COMPOSITE GUARDRAIL 2: Guarantees tier_slug chosen is legally allowed for their system role
    CONSTRAINT fk_enforce_policy_role_legality
        FOREIGN KEY (tier_slug, user_role)
        REFERENCES corporate_policy_tiers(tier_slug, allowed_role)
);
```

### Static Core Seed Data
Feed these seed statements directly into your initial database migration scripts:

```sql
INSERT INTO property_types (slug, display_name) VALUES
('COMMERCIAL_OFFICE', 'Commercial Office'),
('RETAIL_PLAZA',      'Retail Plaza'),
('INDUSTRIAL_PARK',   'Industrial Park'),
('MEDICAL_CENTER',    'Medical Center'),
('MULTI_FAMILY',      'Multi-Family Portfolio'),
('SELF_STORAGE',      'Self Storage Facility');

INSERT INTO roles (role_slug, display_name, description) VALUES
('ADMIN',                   'System Administrator',         'Global system controller.'),
('ACCOUNTANT',              'Property Accountant',          'Manages books and general ledgers. No approval rights.'),
('PROPERTY_MANAGER',        'Property Manager (PM)',        'Handles baseline routine operations.'),
('SENIOR_PROPERTY_MANAGER', 'Senior Property Manager (SPM)','Manages flagship assets or regional complexes.'),
('REGIONAL_DIRECTOR',       'Regional Operations Director', 'Portfolio supervisor handling escalation limits.'),
('VICE_PRESIDENT',          'Vice President of Operations', 'Executive officer with portfolio-wide allocation power.');

INSERT INTO corporate_policy_tiers (tier_slug, display_name, allowed_role, variable_max, fixed_auto_max) VALUES
('TIER_NONE_ACCT',        'Accountant Processing Only',   'ACCOUNTANT',              0.00,        0.00),
('TIER_1_LOW_PM',         'Standard PM Operations Limit', 'PROPERTY_MANAGER',        1000.00,     2500.00),
('TIER_2_MID_SPM',        'Senior PM Operational Tier',   'SENIOR_PROPERTY_MANAGER', 5000.00,     10000.00),
('TIER_3_HIGH_RD',        'Regional Director Escalation', 'REGIONAL_DIRECTOR',       25000.00,    50000.00),
('TIER_4_UNLIMITED_VP',   'Executive VP Clearance Tier',  'VICE_PRESIDENT',          99999999.99, 99999999.99);
```

---

## 4. Front-End Architecture & Implementation Examples

### Metadata-Driven Dynamic Mirror Pattern
To maintain absolute sync, the front end must never hardcode role-to-policy constraints or evaluation thresholds. Instead, it reads an initialization payload from the server and configures user visibility dynamically based on the returned data.

### TypeScript / JavaScript Schema-Driven Dropdown Example
```javascript
// 1. Hypothetical API payload fetched on page load from GET /api/assignment-schema
const assignmentSchemaMetadata = {
  rolesAllowedPolicies: {
    "ACCOUNTANT": ["TIER_NONE_ACCT"],
    "PROPERTY_MANAGER": ["TIER_1_LOW_PM"],
    "SENIOR_PROPERTY_MANAGER": ["TIER_1_LOW_PM", "TIER_2_MID_PM"],
    "REGIONAL_DIRECTOR": ["TIER_3_HIGH_RD"],
    "VICE_PRESIDENT": ["TIER_3_HIGH_RD", "TIER_4_UNLIMITED_VP"]
  }
};

// 2. React UI Handling Selection Logic Mirroring the Database Constraints
import React, { useState } from 'react';

export function AssignUserPolicyForm({ selectedUser, availableCorporateTiers, onSave }) {
  const [selectedTier, setSelectedTier] = useState('');

  // Extract valid policy strings matching this user's global corporate role
  const allowedTiers = assignmentSchemaMetadata.rolesAllowedPolicies[selectedUser.global_role] || [];

  // Filter master lookup array to only expose verified rows
  const renderedDropdownOptions = availableCorporateTiers.filter(tier => 
    allowedTiers.includes(tier.tier_slug)
  );

  return (
    <div className="assignment-card">
      <h3>Assign Financial Authority for {selectedUser.name}</h3>
      <p>Corporate Base Role: <strong>{selectedUser.global_role}</strong></p>
      
      <label htmlFor="tier-select">Select Property Rule Policy:</label>
      <select 
        id="tier-select"
        value={selectedTier} 
        onChange={(e) => setSelectedTier(e.target.value)}
      >
        <option value="">-- Choose Authorized Policy --</option>
        {renderedDropdownOptions.map(tier => (
          <option key={tier.tier_slug} value={tier.tier_slug}>
            {tier.display_name} (Max Variable: ${tier.variable_max} | Auto Fixed: ${tier.fixed_auto_max})
          </option>
        ))}
      </select>

      <button 
        disabled={!selectedTier} 
        onClick={() => onSave(selectedTier)}
      >
        Commit Policy Link
      </button>
    </div>
  );
}
```

---

## 5. UI/UX Text-Based Wireframe Concepts

### Wireframe A: Property-First Inline Multi-Select Tagging
```text
====================================================================================================
PROPERTIES  >  [ Edit Property: Grandview Commercial Center ]                      [Cancel] [ Save ]
====================================================================================================

  Property Name: [ Grandview Commercial Center         ]
  Address:       [ 456 Parkway Blvd, Frisco, TX        ]
  Property Type: [ COMMERCIAL_OFFICE                   ] v

  --------------------------------------------------------------------------------------------------
  ASSIGNED VENDORS (Independent Search & Many-to-Many Linking)
  --------------------------------------------------------------------------------------------------
  Link Vendors:  [ Search vendors by name or trade (e.g., plumbing)...                  ] [ + New ]
                 |
                 +--> *Dropdown filters active vendor directory as user types*
                 +--> *Clicking "[ + New ]" triggers inline drawer to spawn brand new vendor records*

  Currently Servicing This Property (Click 'x' to break mapping row without deleting master vendor):
  [ (x) Apex Landscaping ]   [ (x) Titan Elevators ]   [ (x) EcoWaste Solutions ]   [ (x) Metro Plumbing ]
  
====================================================================================================
```

### Wireframe B: Corporate Property-User Policy Link Assignment Screen
```text
====================================================================================================
SETTINGS  >  PORTFOLIO PROPERTY SECURITY ASSIGNMENTS                               [Cancel] [ Save ]
====================================================================================================

 1. CHOOSE TARGET ACCOUNT OPERATIVE
    Select User:      [ Sarah Jenkins (s.jenkins@pmfirm.com)                                   ] v
    Global Base Role: SENIOR_PROPERTY_MANAGER  <-- (Read-Only Identity Diagnostic)

 --------------------------------------------------------------------------------------------------
 2. CHOOSE TARGET PROPERTY CONTEXT
    Select Property:  [ Grandview Commercial Center                                            ] v

 --------------------------------------------------------------------------------------------------
 3. SET ASSIGNED FINANCIAL AUTHORITY POLICY (Dynamically filtered by Server Metadata Schema)
    
    Select Policy:    ( ) TIER_1_LOW_PM   (Max Variable: $1,000 | Auto Fixed Match: $2,500)
                      (o) TIER_2_MID_PM   (Max Variable: $5,000 | Auto Fixed Match: $10,000)
                      [X] TIER_3_HIGH_RD  -- DISABLED (Sarah's global role restricts executive use)

    [x] Activate standard multi-level workflow escalation rules for this property asset.
====================================================================================================
```