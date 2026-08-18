CREATE TABLE organization_settings (
  id             SERIAL PRIMARY KEY,
  tab_name       TEXT NOT NULL,
  setting_label  TEXT NOT NULL,
  hint           TEXT,
  value          TEXT,
  state          TEXT CHECK (state IN ('enabled', 'disabled')),
  status         TEXT NOT NULL CHECK (status IN ('Editable', 'Locked')),
  field_type     TEXT NOT NULL CHECK (field_type IN ('text', 'select', 'checkbox')),
  options        JSONB,
  last_changed   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tab_name, setting_label)
);
