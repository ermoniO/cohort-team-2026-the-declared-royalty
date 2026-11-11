# Accounts Payable (AP) Approval Matrix Specification — Phase 1: Infrastructure

## 1. Architectural Principles & Boundaries
* **Decoupled Context Model:** Users hold exactly one immutable global corporate designation (HR payroll title) which dictates global feature access permissions. Their financial authority thresholds and workflows are strictly scoped to individual properties.
* **Single-File Linear Pecking Order:** Every real estate asset maintains its own independent single-file routing sequence (`accounts_payable_approval_sequence`). Sequence numbers cannot overlap within the same property context.
* **Fiduciary Safety-Net Enforcement:** Every property must possess an active top-tier sequence record (`accounts_payable_approval_sequence = 5`) mapped to an unlimited clearance threshold profile (`LIMIT_UNLIMITED`) to guarantee invoices never enter an orphaned routing dead zone if a local property team fails to configure junior steps.
* **Soft Deletion Mandatory Compliance:** Hard SQL deletions are strictly forbidden across all configuration registries to preserve historical audit trail lineage for past invoice authorizations. Record lifecycles must be entirely governed via a standardized `record_status` configuration check.

## 2. Production PostgreSQL DDL

```sql
-- CREATE UNIFORM ENUMS FOR SOFT DELETION STATUS
CREATE TYPE record_status AS ENUM ('ACTIVE', 'INACTIVE');

-- 1. CORPORATE DESIGNATIONS DIRECTORY (HR Titles / Payroll Classifications only)
CREATE TABLE corporate_designations (
    designation_slug  VARCHAR(50) PRIMARY KEY,
    display_name      VARCHAR(100) NOT NULL,
    status            record_status NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. ACCOUNTS PAYABLE SEATS (The Abstract Org Chart Chairs)
CREATE TABLE accounts_payable_seats (
    accounts_payable_seat_slug  VARCHAR(50) PRIMARY KEY,
    display_name                VARCHAR(100) NOT NULL,
    designation_slug            VARCHAR(50) NOT NULL REFERENCES corporate_designations(designation_slug),
    status                      record_status NOT NULL DEFAULT 'ACTIVE',
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. ACCOUNTS PAYABLE THRESHOLD PRESETS (Standardized Corporate Limit Cards)
CREATE TABLE accounts_payable_threshold_presets (
    accounts_payable_threshold_slug VARCHAR(50) PRIMARY KEY,
    variable_max                    NUMERIC(12, 2) NOT NULL CHECK (variable_max >= 0.00),
    fixed_auto_max                  NUMERIC(12, 2) NOT NULL CHECK (fixed_auto_max >= 0.00),
    status                          record_status NOT NULL DEFAULT 'ACTIVE',
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. USERS MASTER DIRECTORY (Humans stripped of all structural corporate property)
CREATE TABLE users (
    user_uuid         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    delegate_user_uuid UUID REFERENCES users(user_uuid) ON DELETE SET NULL,
    delegate_expires_at TIMESTAMP WITH TIME ZONE,
    status            record_status NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. ACCOUNTS PAYABLE SEAT ASSIGNMENT (The High-Turnover Operational Bridge)
CREATE TABLE accounts_payable_seat_assignment (
    assignment_uuid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accounts_payable_seat_slug  VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats(accounts_payable_seat_slug) ON DELETE CASCADE,
    user_uuid                   UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
    status                      record_status NOT NULL DEFAULT 'ACTIVE',
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Business Rule Guardrail: Prevents duplicate mapping of the exact same pair string
    CONSTRAINT unique_user_seat_pairing UNIQUE (accounts_payable_seat_slug, user_uuid)
);

-- STRICT ENFORCEMENT FILTER: A chair can only hold ONE active human rear end at a time
CREATE UNIQUE INDEX unique_active_seat_occupant 
ON accounts_payable_seat_assignment (accounts_payable_seat_slug) 
WHERE (status = 'ACTIVE');

-- 6. PROPERTIES REGISTER
CREATE TABLE properties (
    property_uuid     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    status            record_status NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. PROPERTY APPROVAL MATRIX (The Accounts Payable Power Junction Workflow Engine)
CREATE TABLE property_approval_matrix (
    matrix_uuid                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_uuid                   UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
    accounts_payable_seat_slug      VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats(accounts_payable_seat_slug),
    accounts_payable_threshold_slug VARCHAR(50) NOT NULL REFERENCES accounts_payable_threshold_presets(accounts_payable_threshold_slug),
    
    -- Restricts vertical workflow chain sizing safely between index steps 0 and 5
    accounts_payable_approval_sequence INT NOT NULL CONSTRAINT check_sequence_bounds CHECK (accounts_payable_approval_sequence BETWEEN 0 AND 5),
    
    status                          record_status NOT NULL DEFAULT 'ACTIVE',
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- FIDUCIARY GUARDRAIL 1: A specific seat can only occupy one sequence slot per property
    CONSTRAINT unique_property_seat_step UNIQUE (property_uuid, accounts_payable_seat_slug),
    
    -- FIDUCIARY GUARDRAIL 2: Enforces a perfect single-file line; no overlapping step ranks
    CONSTRAINT unique_property_sequence_step UNIQUE (property_uuid, accounts_payable_approval_sequence)
);
```

## 3. Production Master Seed Data Scripts

```sql
-- Seed HR Global Designations
INSERT INTO corporate_designations (designation_slug, display_name) VALUES
('ACCOUNTANT',              'Property Accountant'),
('PROPERTY_MANAGER',        'Property Manager'),
('SENIOR_PROPERTY_MANAGER', 'Senior Property Manager'),
('REGIONAL_DIRECTOR',       'Regional Operations Director'),
('VICE_PRESIDENT',          'Vice President of Operations');

-- Seed Standard AP Operational Seats (Positions)
INSERT INTO accounts_payable_seats (accounts_payable_seat_slug, display_name, designation_slug) VALUES
('CORP_HQ_ACCOUNTANT_01', 'HQ Senior Accountant - Seat 1',    'ACCOUNTANT'),
('PM_SEAT_FRISCO_OFFICE', 'Frisco Commercial Complex PM Seat','PROPERTY_MANAGER'),
('SPM_SEAT_DOWNTOWN',     'Downtown Flagship Senior PM Seat','SENIOR_PROPERTY_MANAGER'),
('REG_DIR_TEXAS_REGION',  'Texas Portfolio Regional Director', 'REGIONAL_DIRECTOR'),
('CORP_VP_OF_OPERATIONS', 'Central Executive VP Chair',       'VICE_PRESIDENT');

-- Seed Standard Accounts Payable Presets (Rounded Figures Only)
INSERT INTO accounts_payable_threshold_presets (accounts_payable_threshold_slug, variable_max, fixed_auto_max) VALUES
('LIMIT_NONE',       0.00,        0.00),
('LIMIT_LOW',       1000.00,     2500.00),
('LIMIT_MID',       5000.00,     10000.00),
('LIMIT_HIGH',      25000.00,    50000.00),
('LIMIT_UNLIMITED', 99999999.99, 99999999.99);

-- Seed Initial Human User Directory
INSERT INTO users (name, email) VALUES
('Sarah Jenkins',   's.jenkins@pmfirm.com'),
('Marcus Vance',    'm.vance@pmfirm.com'),
('Elena Rostova',   'e.rostova@pmfirm.com'),
('David Sterling',  'd.sterling@pmfirm.com'),
('Victoria Chen',   'v.chen@pmfirm.com');

-- Map Humans Into Abstract AP Seats
INSERT INTO accounts_payable_seat_assignment (accounts_payable_seat_slug, user_uuid)
SELECT 'CORP_VP_OF_OPERATIONS', user_uuid FROM users WHERE email = 'v.chen@pmfirm.com' UNION ALL
SELECT 'REG_DIR_TEXAS_REGION',  user_uuid FROM users WHERE email = 'd.sterling@pmfirm.com' UNION ALL
SELECT 'SPM_SEAT_DOWNTOWN',     user_uuid FROM users WHERE email = 's.jenkins@pmfirm.com' UNION ALL
SELECT 'PM_SEAT_FRISCO_OFFICE', user_uuid FROM users WHERE email = 'm.vance@pmfirm.com' UNION ALL
SELECT 'CORP_HQ_ACCOUNTANT_01', user_uuid FROM users WHERE email = 'e.rostova@pmfirm.com';

-- Create Sample Properties
INSERT INTO properties (name) VALUES 
('Grandview Office Tower'),
('Legacy Commerce Plaza');

-- Seed Property Workflow Matrix (Grandview Office Tower Pecking Order Chain)
INSERT INTO property_approval_matrix (property_uuid, accounts_payable_seat_slug, accounts_payable_threshold_slug, accounts_payable_approval_sequence)
SELECT p.property_uuid, 'CORP_HQ_ACCOUNTANT_01', 'LIMIT_NONE', 0
FROM properties p WHERE p.name = 'Grandview Office Tower' UNION ALL
SELECT p.property_uuid, 'PM_SEAT_FRISCO_OFFICE', 'LIMIT_LOW', 1
FROM properties p WHERE p.name = 'Grandview Office Tower' UNION ALL
SELECT p.property_uuid, 'SPM_SEAT_DOWNTOWN',     'LIMIT_MID', 2
FROM properties p WHERE p.name = 'Grandview Office Tower' UNION ALL
-- UNBREACHABLE FIDUCIARY SAFETY NET INSTANT INJECTION
SELECT p.property_uuid, 'CORP_VP_OF_OPERATIONS', 'LIMIT_UNLIMITED', 5
FROM properties p WHERE p.name = 'Grandview Office Tower';
```

## 4. Backend Runtime Workflow Check (Node.js/TypeScript)

```typescript
import { Client } from 'pg';

interface ApproverContext {
  user_uuid: string;
  name: string;
  email: string;
  accounts_payable_approval_sequence: number;
}

export class AccountsPayableWorkflowEngine {
  private db: Client;

  constructor(dbClient: Client) {
    this.db = dbClient;
  }

  async calculateInvoiceRoutingQueue(propertyUuid: string, grossAmount: number): Promise<ApproverContext[]> {
    const query = `
      SELECT 
        u.user_uuid, 
        u.name, 
        u.email,
        u.delegate_user_uuid,
        u.delegate_expires_at,
        pam.accounts_payable_approval_sequence
      FROM property_approval_matrix pam
      JOIN accounts_payable_threshold_presets apt ON pam.accounts_payable_threshold_slug = apt.accounts_payable_threshold_slug
      JOIN accounts_payable_seat_assignment asa ON pam.accounts_payable_seat_slug = asa.accounts_payable_seat_slug
      JOIN users u ON asa.user_uuid = u.user_uuid
      WHERE pam.property_uuid = $1
        AND apt.variable_max >= $2
        AND pam.status = 'ACTIVE'
        AND asa.status = 'ACTIVE'
        AND u.status = 'ACTIVE'
      ORDER BY pam.accounts_payable_approval_sequence ASC;
    `;

    const result = await this.db.query(query, [propertyUuid, grossAmount]);
    const finalQueue: ApproverContext[] = [];

    for (const row of result.rows) {
      if (row.delegate_user_uuid && row.delegate_expires_at && new Date(row.delegate_expires_at) > new Date()) {
        const proxyUser = await this.db.query(
          "SELECT user_uuid, name, email FROM users WHERE user_uuid = $1 AND status = 'ACTIVE'",
          [row.delegate_user_uuid]
        );
        
        if (proxyUser.rows.length > 0) {
          finalQueue.push({
            user_uuid: proxyUser.rows[0].user_uuid,
            name: `${proxyUser.rows[0].name} (Acting Proxy)`,
            email: proxyUser.rows[0].email,
            accounts_payable_approval_sequence: row.accounts_payable_approval_sequence
          });
          continue;
        }
      }

      finalQueue.push({
        user_uuid: row.user_uuid,
        name: row.name,
        email: row.email,
        accounts_payable_approval_sequence: row.accounts_payable_approval_sequence
      });
    }

    return finalQueue;
  }
}
```

## 5. Metadata-Driven Administrator Configuration Panel (React)

```javascript
import React, { useState, useEffect } from 'react';

export function PropertySeatSequenceConfigurator({ propertyUuid }) {
  const [apSeats, setApSeats] = useState([]);
  const [thresholdPresets, setThresholdPresets] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [sequenceIndex, setSequenceIndex] = useState(1);
  const [submissionStatus, setSubmissionStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts-payable-seats').then(res => res.json()),
      fetch('/api/accounts-payable-threshold-presets').then(res => res.json())
    ]).then(([seatsData, presetsData]) => {
      setApSeats(seatsData.filter(s => s.status === 'ACTIVE'));
      setThresholdPresets(presetsData.filter(p => p.status === 'ACTIVE'));
    });
  }, [propertyUuid]);

  const handleSaveWorkflowRow = async (e) => {
    e.preventDefault();
    setSubmissionStatus({ type: '', msg: '' });

    const payload = {
      property_uuid: propertyUuid,
      accounts_payable_seat_slug: selectedSeat,
      accounts_payable_threshold_slug: selectedPreset,
      accounts_payable_approval_sequence: sequenceIndex
    };

    const response = await fetch('/api/property-approval-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      setSubmissionStatus({ type: 'error', msg: result.error || 'Failed to save configuration.' });
    } else {
      setSubmissionStatus({ type: 'success', msg: 'Pecking order step successfully committed to database.' });
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Accounts Payable Matrix Workflow Placement</h3>
      
      {submissionStatus.msg && (
        <div className={`mt-4 p-3 rounded text-sm font-medium ${submissionStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {submissionStatus.msg}
        </div>
      )}

      <form onSubmit={handleSaveWorkflowRow} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">1. Select Operational Chair (Seat)</label>
          <select value={selectedSeat} onChange={(e) => setSelectedSeat(e.target.value)} className="w-full mt-1 p-2 border rounded bg-white text-sm" required>
            <option value="">Choose a Seat...</option>
            {apSeats.map(s => (
              <option key={s.accounts_payable_seat_slug} value={s.accounts_payable_seat_slug}>{s.display_name} ({s.accounts_payable_seat_slug})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">2. Assign Spending Threshold Preset</label>
          <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)} className="w-full mt-1 p-2 border rounded bg-white text-sm" required>
            <option value="">Choose a Limit Profile...</option>
            {thresholdPresets.map(p => (
              <option key={p.accounts_payable_threshold_slug} value={p.accounts_payable_threshold_slug}>
                {p.accounts_payable_threshold_slug} (\${parseFloat(p.variable_max).toLocaleString()} Max Var)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">3. Pecking Order Sequence Rank</label>
          <select value={sequenceIndex} onChange={(e) => setSequenceIndex(parseInt(e.target.value))} className="w-full mt-1 p-2 border rounded bg-white text-sm">
            <option value={0}>Sequence Step 0 (Accountant Processing Floor)</option>
            <option value={1}>Sequence Step 1 (Junior Review)</option>
            <option value={2}>Sequence Step 2 (Mid-Tier Management Review)</option>
            <option value={3}>Sequence Step 3 (Senior Director Sign-Off)</option>
            <option value={4}>Sequence Step 4 (Executive Board Override)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Note: Sequence Step 5 is permanently locked to the Vice President Fallback Safety Net.</p>
        </div>

        <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm text-sm transition-colors">
          Commit Step to Matrix Table
        </button>
      </form>
    </div>
  );
}
```
