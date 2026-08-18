CREATE TABLE authorized_organizations (
  org_id            TEXT PRIMARY KEY,        -- truncated org identifier shown in the UI, e.g. 'a19c...44f'
  org               TEXT NOT NULL,
  relationship      TEXT NOT NULL CHECK (relationship IN ('Trustee', 'Trustor')),
  scope             TEXT,
  divisions         TEXT,
  expires           TEXT,                    -- display text ('31 Dec 2026' or '—')
  status            TEXT NOT NULL CHECK (status IN ('active', 'owner', 'expiring', 'revoked')),
  allow_cloning     BOOLEAN NOT NULL DEFAULT false,
  notify_on_signin  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
