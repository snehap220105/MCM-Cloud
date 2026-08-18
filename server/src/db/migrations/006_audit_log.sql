CREATE TABLE audit_log (
  id           SERIAL PRIMARY KEY,
  -- The frontend's mock timestamps ('15 Aug 14:58') carry no year, so they
  -- can't be parsed into a real timestamp. `when_display` preserves the
  -- exact string for the UI; `occurred_at` (insertion time) is what's
  -- actually used to order/filter real rows written after seeding.
  when_display TEXT NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  who          TEXT NOT NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN (
                 'sign-in', 'create', 'edit', 'delete', 'alert',
                 'callback', 'coaching', 'monitor', 'copilot', 'export', 'supervisor'
               )),
  action_label TEXT NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_occurred_at_idx ON audit_log (occurred_at DESC);
