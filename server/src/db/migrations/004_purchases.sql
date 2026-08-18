CREATE TABLE purchase_orders (
  id            TEXT PRIMARY KEY,           -- e.g. 'ORD-4471'
  item          TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL CHECK (status IN ('provisioned', 'pending', 'cancelled')),
  requested_by  TEXT NOT NULL,
  division      TEXT NOT NULL,
  order_date    TEXT NOT NULL,               -- kept as display text, matches frontend format ('02 Aug 2026')
  cost_centre   TEXT,
  approver      TEXT,
  auto_assign   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_addons (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  category  TEXT NOT NULL,
  price     TEXT NOT NULL
);

CREATE TABLE active_addons (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  since   TEXT NOT NULL,
  monthly TEXT NOT NULL
);
