CREATE TABLE subscription_licences (
  id         SERIAL PRIMARY KEY,
  licence    TEXT NOT NULL UNIQUE,
  purchased  INTEGER NOT NULL DEFAULT 0,
  assigned   INTEGER NOT NULL DEFAULT 0,
  available  INTEGER NOT NULL DEFAULT 0,
  price      TEXT NOT NULL
);

CREATE TABLE subscription_usage (
  id      SERIAL PRIMARY KEY,
  item    TEXT NOT NULL,
  usage   TEXT NOT NULL,
  charge  TEXT NOT NULL,
  period  DATE NOT NULL DEFAULT date_trunc('month', now())
);

CREATE TABLE subscription_invoices (
  id      SERIAL PRIMARY KEY,
  period  TEXT NOT NULL,
  seats   TEXT NOT NULL,
  total   TEXT NOT NULL,
  status  TEXT NOT NULL CHECK (status IN ('open', 'paid'))
);

-- Single-row table holding the current plan label.
CREATE TABLE subscription_plan (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  plan_label  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
