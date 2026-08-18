CREATE TABLE organization_contact_phone (
  id                     SERIAL PRIMARY KEY,
  phone_number           TEXT NOT NULL,
  verified               BOOLEAN NOT NULL DEFAULT false,
  verified_at            TIMESTAMPTZ,
  telnyx_verification_id TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
