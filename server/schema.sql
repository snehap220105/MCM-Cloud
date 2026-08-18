-- Run once against your Postgres database (createdb mcm_wfm; psql mcm_wfm -f schema.sql)
SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS wfm_setup (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin › Quality & WEM › Recording Policies
CREATE TABLE IF NOT EXISTS recording_policies (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  media          TEXT[] NOT NULL CHECK (cardinality(media) > 0 AND media <@ ARRAY['Voice','Screen']),
  queues         TEXT[] NOT NULL DEFAULT '{}',   -- empty = applies to all queues
  pct            INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
  retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique policy name.
CREATE UNIQUE INDEX IF NOT EXISTS recording_policies_name_key
  ON recording_policies (lower(btrim(name)));

-- Seed rows shown in the original mock-up (safe to re-run).
-- Note: these two names are longer than 20 characters — the current app validation
-- (server/policy.js) caps new/edited names at 3-20 chars, so rename them before re-saving.
INSERT INTO recording_policies (name, media, queues, pct, retention_days, active)
VALUES
  ('Record all Collections voice', ARRAY['Voice'], ARRAY['Collections_Arrears'], 100, 365, TRUE),
  ('Retail 50% sample + screen', ARRAY['Voice','Screen'], ARRAY['Retail_Billing_L1','Retail_Complaints'], 50, 90, TRUE)
ON CONFLICT DO NOTHING;

-- Queue mappings live in their own join table so a policy's queue set can be re-synced
-- (delete + insert) inside one transaction, instead of overwriting an array column.
CREATE TABLE IF NOT EXISTS recording_policy_queues (
  id         BIGSERIAL PRIMARY KEY,
  policy_id  BIGINT NOT NULL REFERENCES recording_policies(id) ON DELETE CASCADE,
  queue_name TEXT NOT NULL CHECK (queue_name IN ('Retail_Billing_L1','Retail_Complaints','Digital_Messaging','Collections_Arrears')),
  UNIQUE (policy_id, queue_name)
);

CREATE INDEX IF NOT EXISTS recording_policy_queues_policy_idx ON recording_policy_queues (policy_id);

-- Backfill from the legacy queues[] column (safe to re-run).
INSERT INTO recording_policy_queues (policy_id, queue_name)
SELECT id, unnest(queues) FROM recording_policies WHERE array_length(queues, 1) > 0
ON CONFLICT (policy_id, queue_name) DO NOTHING;

-- Admin › Quality & WEM › Calibrations
CREATE TABLE IF NOT EXISTS calibrations (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  interaction_ref TEXT NOT NULL CHECK (interaction_ref ~ '^CONV-[0-9]{5,10}$'),
  form            TEXT NOT NULL CHECK (char_length(btrim(form)) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calibrations_name_key ON calibrations (lower(btrim(name)));

-- One row per assigned evaluator. score IS NULL = assigned but has not scored yet.
-- Evaluator count, completion, variance and status are all derived from these rows.
CREATE TABLE IF NOT EXISTS calibration_evaluators (
  id             BIGSERIAL PRIMARY KEY,
  calibration_id BIGINT NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
  evaluator      TEXT NOT NULL,
  score          NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  scored_at      TIMESTAMPTZ,
  UNIQUE (calibration_id, evaluator),
  CHECK ((score IS NULL) = (scored_at IS NULL))
);

CREATE INDEX IF NOT EXISTS calibration_evaluators_cal_idx ON calibration_evaluators (calibration_id);

-- Seed rows shown in the original mock-up (safe to re-run). Names use spaces instead of the
-- original " — " separator: the name rule is letters/spaces only (server/calibration.js).
INSERT INTO calibrations (name, interaction_ref, form) VALUES
  ('Aug Billing Tone Check',     'CONV-8841204', 'Retail Quality v4'),
  ('Aug Complaint Handling',     'CONV-8839117', 'Complaints v2'),
  ('Jul Technical Accuracy',     'CONV-8790442', 'Technical v3'),
  ('Jul Chat Quality',           'CONV-8788013', 'Digital v2'),
  ('Jun Collections Compliance', 'CONV-8712880', 'Compliance v1'),
  ('Sep New Starters',           'CONV-8850019', 'Retail Quality v4')
ON CONFLICT DO NOTHING;

INSERT INTO calibration_evaluators (calibration_id, evaluator, score, scored_at)
SELECT c.id, v.evaluator, v.score, CASE WHEN v.score IS NULL THEN NULL ELSE now() END
FROM (VALUES
  -- 6/6 scored, spread 8.4 -> ± 4.2% -> Complete
  ('Aug Billing Tone Check', 'Grace Adeyemi', 78.8), ('Aug Billing Tone Check', 'Marco Rossi', 82.0),
  ('Aug Billing Tone Check', 'Faisal Khan', 84.0),   ('Aug Billing Tone Check', 'Liam Walsh', 85.0),
  ('Aug Billing Tone Check', 'Priya Nair', 86.0),    ('Aug Billing Tone Check', 'Aisha Rahman', 87.2),
  -- 3/5 scored -> In progress, variance withheld until everyone submits
  ('Aug Complaint Handling', 'Grace Adeyemi', 88.0), ('Aug Complaint Handling', 'Marco Rossi', 84.5),
  ('Aug Complaint Handling', 'Faisal Khan', 86.0),   ('Aug Complaint Handling', 'Liam Walsh', NULL::numeric),
  ('Aug Complaint Handling', 'Priya Nair', NULL::numeric),
  -- 4/4 scored, spread 19.6 -> ± 9.8% -> over threshold -> Review variance
  ('Jul Technical Accuracy', 'Grace Adeyemi', 70.2), ('Jul Technical Accuracy', 'Marco Rossi', 78.0),
  ('Jul Technical Accuracy', 'Aisha Rahman', 84.0),  ('Jul Technical Accuracy', 'Adnan Shaikh', 89.8),
  -- 5/5 scored, spread 6.2 -> ± 3.1% -> Complete
  ('Jul Chat Quality', 'Grace Adeyemi', 79.0),  ('Jul Chat Quality', 'Marco Rossi', 81.4),
  ('Jul Chat Quality', 'Aisha Rahman', 82.0),   ('Jul Chat Quality', 'Carlos Mendez', 84.0),
  ('Jul Chat Quality', 'Priya Nair', 85.2),
  -- 7/7 scored, spread 4.8 -> ± 2.4% -> Complete
  ('Jun Collections Compliance', 'Grace Adeyemi', 88.0), ('Jun Collections Compliance', 'Marco Rossi', 89.2),
  ('Jun Collections Compliance', 'Faisal Khan', 90.0),   ('Jun Collections Compliance', 'Liam Walsh', 90.5),
  ('Jun Collections Compliance', 'Priya Nair', 91.0),    ('Jun Collections Compliance', 'Adnan Shaikh', 92.0),
  ('Jun Collections Compliance', 'Sofia Petrova', 92.8),
  -- 8 assigned, none scored -> Scheduled
  ('Sep New Starters', 'Grace Adeyemi', NULL::numeric), ('Sep New Starters', 'Marco Rossi', NULL::numeric),
  ('Sep New Starters', 'Faisal Khan', NULL::numeric),   ('Sep New Starters', 'Liam Walsh', NULL::numeric),
  ('Sep New Starters', 'Priya Nair', NULL::numeric),    ('Sep New Starters', 'Aisha Rahman', NULL::numeric),
  ('Sep New Starters', 'Adnan Shaikh', NULL::numeric),  ('Sep New Starters', 'Sofia Petrova', NULL::numeric)
) AS v(calib, evaluator, score)
JOIN calibrations c ON c.name = v.calib
ON CONFLICT DO NOTHING;

-- Admin › Quality & WEM › WFM Setup Guide → "Add Management Unit"
CREATE TABLE IF NOT EXISTS management_units (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_units_name_key ON management_units (lower(btrim(name)));

-- An agent belongs to at most one MU; NULL = unassigned.
CREATE TABLE IF NOT EXISTS agents (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  management_unit_id  INTEGER REFERENCES management_units(id) ON DELETE SET NULL
);

INSERT INTO agents (name) VALUES
  ('Sofia Petrova'), ('James Okafor'), ('Priya Nair'), ('Marco Rossi'),
  ('Rajan Patel'), ('Aisha Rahman'), ('Carlos Mendez')
ON CONFLICT (name) DO NOTHING;

-- Seed MUs matching the mock-up, then assign agents to them.
INSERT INTO management_units (name) VALUES
  ('UK Retail MU'), ('Collections MU'), ('Digital MU')
ON CONFLICT DO NOTHING;

UPDATE agents SET management_unit_id = (SELECT id FROM management_units WHERE name = 'UK Retail MU')
 WHERE name IN ('Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi');
UPDATE agents SET management_unit_id = (SELECT id FROM management_units WHERE name = 'Collections MU')
 WHERE name IN ('Rajan Patel');
UPDATE agents SET management_unit_id = (SELECT id FROM management_units WHERE name = 'Digital MU')
 WHERE name IN ('Aisha Rahman', 'Carlos Mendez');

-- Admin › Quality & WEM › Evaluation Forms
CREATE TABLE IF NOT EXISTS evaluation_forms (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evaluation_forms_name_key ON evaluation_forms (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS evaluation_form_groups (
  id         BIGSERIAL PRIMARY KEY,
  form_id    BIGINT NOT NULL REFERENCES evaluation_forms(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 50),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS evaluation_form_groups_form_idx ON evaluation_form_groups (form_id);

CREATE TABLE IF NOT EXISTS evaluation_form_questions (
  id         BIGSERIAL PRIMARY KEY,
  group_id   BIGINT NOT NULL REFERENCES evaluation_form_groups(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (char_length(btrim(text)) BETWEEN 3 AND 200),
  weight     INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 100),
  critical   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS evaluation_form_questions_group_idx ON evaluation_form_questions (group_id);

-- form_id is nullable (ON DELETE SET NULL) and form_name is snapshotted — deleting a form
-- must never rewrite the evaluations that were already scored against it.
CREATE TABLE IF NOT EXISTS evaluations (
  id              BIGSERIAL PRIMARY KEY,
  form_id         BIGINT REFERENCES evaluation_forms(id) ON DELETE SET NULL,
  form_name       TEXT NOT NULL,
  agent_name      TEXT NOT NULL,
  interaction_ref TEXT NOT NULL,
  earned          INTEGER NOT NULL,
  possible        INTEGER NOT NULL,
  pct             INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
  critical_fail   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evaluations_form_idx ON evaluations (form_id);

-- question_id is nullable (ON DELETE SET NULL) and question_text/weight/critical are
-- snapshotted — editing or deleting a question later must not alter a past evaluation's answers.
CREATE TABLE IF NOT EXISTS evaluation_answers (
  id            BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  question_id   BIGINT REFERENCES evaluation_form_questions(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  weight        INTEGER NOT NULL,
  critical      BOOLEAN NOT NULL,
  answer        TEXT NOT NULL CHECK (answer IN ('yes','no','na'))
);

CREATE INDEX IF NOT EXISTS evaluation_answers_eval_idx ON evaluation_answers (evaluation_id);

-- Seed the mock-up's form (safe to re-run — skipped once any evaluation_forms row exists).
-- Renamed from "Standard Call QA v2" to "Standard Call QA": the name rule is letters/spaces only.
DO $$
DECLARE v_form_id BIGINT; v_group_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM evaluation_forms) THEN
    INSERT INTO evaluation_forms (name, published) VALUES ('Standard Call QA', TRUE) RETURNING id INTO v_form_id;

    INSERT INTO evaluation_form_groups (form_id, name, sort_order) VALUES (v_form_id, 'Greeting & Compliance', 0) RETURNING id INTO v_group_id;
    INSERT INTO evaluation_form_questions (group_id, text, weight, critical, sort_order) VALUES
      (v_group_id, 'Used approved greeting and identified themselves', 10, FALSE, 0),
      (v_group_id, 'Completed DPA/identity verification before account discussion', 20, TRUE, 1);

    INSERT INTO evaluation_form_groups (form_id, name, sort_order) VALUES (v_form_id, 'Handling', 1) RETURNING id INTO v_group_id;
    INSERT INTO evaluation_form_questions (group_id, text, weight, critical, sort_order) VALUES
      (v_group_id, 'Actively listened and acknowledged the issue', 15, FALSE, 0),
      (v_group_id, 'Provided a correct and complete resolution', 25, FALSE, 1),
      (v_group_id, 'Offered additional help before closing', 10, FALSE, 2);

    INSERT INTO evaluation_form_groups (form_id, name, sort_order) VALUES (v_form_id, 'Wrap-up', 2) RETURNING id INTO v_group_id;
    INSERT INTO evaluation_form_questions (group_id, text, weight, critical, sort_order) VALUES
      (v_group_id, 'Selected the correct wrap-up code', 10, FALSE, 0),
      (v_group_id, 'Notes are clear and complete', 10, FALSE, 1);
  END IF;
END $$;

-- Admin › Quality & WEM › Forecasts (Forecasts / Planning Groups / Service Goals)
CREATE TABLE IF NOT EXISTS planning_groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  queues     TEXT[] NOT NULL CHECK (cardinality(queues) > 0 AND queues <@ ARRAY['Retail_Billing_L1','Retail_Complaints','Digital_Messaging','Collections_Arrears']),
  skills     TEXT[] NOT NULL DEFAULT '{}' CHECK (skills <@ ARRAY['Billing','Retention','Collections','Technical','Sales']),
  langs      TEXT[] NOT NULL DEFAULT '{}' CHECK (langs <@ ARRAY['English','Hindi']),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS planning_groups_name_key ON planning_groups (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS service_goals (
  id                 BIGSERIAL PRIMARY KEY,
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  service_level_pct  INTEGER NOT NULL CHECK (service_level_pct BETWEEN 1 AND 100),
  service_level_secs INTEGER NOT NULL CHECK (service_level_secs BETWEEN 1 AND 3600),
  asa_target_secs    INTEGER NOT NULL CHECK (asa_target_secs BETWEEN 1 AND 3600),
  max_abandon_pct    INTEGER NOT NULL DEFAULT 0 CHECK (max_abandon_pct BETWEEN 0 AND 100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_goals_name_key ON service_goals (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS service_goal_planning_groups (
  id                 BIGSERIAL PRIMARY KEY,
  service_goal_id    BIGINT NOT NULL REFERENCES service_goals(id) ON DELETE CASCADE,
  planning_group_id  BIGINT NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
  UNIQUE (service_goal_id, planning_group_id)
);

CREATE INDEX IF NOT EXISTS sgpg_goal_idx ON service_goal_planning_groups (service_goal_id);
CREATE INDEX IF NOT EXISTS sgpg_group_idx ON service_goal_planning_groups (planning_group_id);

CREATE TABLE IF NOT EXISTS forecasts (
  id           BIGSERIAL PRIMARY KEY,
  week_label   TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'Generated (ABM)',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- planning_group_id cascades — deleting a planning group removes its forecast history too.
CREATE TABLE IF NOT EXISTS forecast_entries (
  id                 BIGSERIAL PRIMARY KEY,
  forecast_id        BIGINT NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  planning_group_id  BIGINT NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
  volume             INTEGER NOT NULL,
  aht_seconds        INTEGER NOT NULL,
  day_volumes        JSONB NOT NULL,
  UNIQUE (forecast_id, planning_group_id)
);

CREATE INDEX IF NOT EXISTS forecast_entries_forecast_idx ON forecast_entries (forecast_id);

-- Seed the mock-up's planning groups + service goals (safe to re-run).
DO $$
DECLARE v_pg1 BIGINT; v_pg2 BIGINT; v_pg3 BIGINT; v_sg1 BIGINT; v_sg2 BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM planning_groups) THEN
    INSERT INTO planning_groups (name, queues, skills, langs)
      VALUES ('Retail Voice', ARRAY['Retail_Billing_L1','Retail_Complaints'], ARRAY['Billing','Retention'], ARRAY['English'])
      RETURNING id INTO v_pg1;
    INSERT INTO planning_groups (name, queues, skills, langs)
      VALUES ('Collections', ARRAY['Collections_Arrears'], ARRAY['Collections'], ARRAY['English','Hindi'])
      RETURNING id INTO v_pg2;
    INSERT INTO planning_groups (name, queues, skills, langs)
      VALUES ('Digital Messaging', ARRAY['Digital_Messaging'], ARRAY['Technical','Sales'], ARRAY['English'])
      RETURNING id INTO v_pg3;

    INSERT INTO service_goals (name, service_level_pct, service_level_secs, asa_target_secs, max_abandon_pct)
      VALUES ('Voice Standard', 80, 20, 30, 5) RETURNING id INTO v_sg1;
    INSERT INTO service_goals (name, service_level_pct, service_level_secs, asa_target_secs, max_abandon_pct)
      VALUES ('Digital Standard', 85, 40, 60, 0) RETURNING id INTO v_sg2;

    INSERT INTO service_goal_planning_groups (service_goal_id, planning_group_id) VALUES
      (v_sg1, v_pg1), (v_sg1, v_pg2), (v_sg2, v_pg3);
  END IF;
END $$;

-- Admin › Quality & WEM › Schedules (WFM): Work Plans, Activity Codes, Time Off, Shift Trades, Schedules
CREATE TABLE IF NOT EXISTS work_plans (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  days         TEXT[] NOT NULL CHECK (cardinality(days) > 0 AND days <@ ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']),
  shift_hours  INTEGER NOT NULL CHECK (shift_hours BETWEEN 2 AND 12),
  flex_from    TEXT NOT NULL CHECK (flex_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  flex_to      TEXT NOT NULL CHECK (flex_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  paid_hours   NUMERIC(4,1) NOT NULL CHECK (paid_hours BETWEEN 1 AND 80),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_plans_name_key ON work_plans (lower(btrim(name)));

-- An agent sits on at most one work plan — enforced by UNIQUE(agent_id), not a composite key.
CREATE TABLE IF NOT EXISTS work_plan_agents (
  id            BIGSERIAL PRIMARY KEY,
  work_plan_id  BIGINT NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  agent_id      INTEGER NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS work_plan_agents_wp_idx ON work_plan_agents (work_plan_id);

CREATE TABLE IF NOT EXISTS activity_codes (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  category       TEXT NOT NULL CHECK (category IN ('On Queue','Off Queue','Break','Meal','Meeting','Training','Time Off')),
  paid           BOOLEAN NOT NULL DEFAULT TRUE,
  adherence_note TEXT NOT NULL DEFAULT 'Adherent when scheduled',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_codes_name_key ON activity_codes (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS time_off_requests (
  id         BIGSERIAL PRIMARY KEY,
  agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day        TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  status     TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_trades (
  id            BIGSERIAL PRIMARY KEY,
  from_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day           TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  status        TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_agent_id <> to_agent_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id           BIGSERIAL PRIMARY KEY,
  week_label   TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id           BIGSERIAL PRIMARY KEY,
  schedule_id  BIGINT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  agent_id     INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day          TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  is_off       BOOLEAN NOT NULL DEFAULT FALSE,
  start_time   TEXT,
  end_time     TEXT,
  breaks_note  TEXT,
  UNIQUE (schedule_id, agent_id, day)
);

CREATE INDEX IF NOT EXISTS schedule_entries_schedule_idx ON schedule_entries (schedule_id);

-- Seed the mock-up's work plans, activity codes, time off & trade rows (safe to re-run).
DO $$
DECLARE v_wp1 BIGINT; v_wp2 BIGINT; v_sofia INT; v_james INT; v_priya INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM work_plans) THEN
    INSERT INTO work_plans (name, days, shift_hours, flex_from, flex_to, paid_hours)
      VALUES ('UK Full Time', ARRAY['Mon','Tue','Wed','Thu','Fri'], 8, '08:00', '10:00', 37.5) RETURNING id INTO v_wp1;
    INSERT INTO work_plans (name, days, shift_hours, flex_from, flex_to, paid_hours)
      VALUES ('UK Part Time', ARRAY['Mon','Tue','Wed','Thu'], 5, '09:00', '12:00', 20) RETURNING id INTO v_wp2;

    INSERT INTO work_plan_agents (work_plan_id, agent_id)
      SELECT v_wp1, id FROM agents WHERE name IN ('Sofia Petrova','James Okafor','Priya Nair','Marco Rossi','Rajan Patel')
      ON CONFLICT DO NOTHING;
    INSERT INTO work_plan_agents (work_plan_id, agent_id)
      SELECT v_wp2, id FROM agents WHERE name = 'Aisha Rahman'
      ON CONFLICT DO NOTHING;

    INSERT INTO activity_codes (name, category, paid, adherence_note) VALUES
      ('On Queue', 'On Queue', TRUE, 'Adherent when On Queue'),
      ('Break', 'Break', TRUE, 'Adherent during scheduled break'),
      ('Lunch', 'Meal', FALSE, 'Adherent during scheduled meal'),
      ('Team Meeting', 'Meeting', TRUE, 'Adherent when scheduled'),
      ('Training', 'Training', TRUE, 'Adherent when scheduled'),
      ('Time Off', 'Time Off', FALSE, 'Excused');

    SELECT id INTO v_sofia FROM agents WHERE name = 'Sofia Petrova';
    IF v_sofia IS NOT NULL THEN
      INSERT INTO time_off_requests (agent_id, day, status) VALUES (v_sofia, 'Wed', 'Pending');
    END IF;

    SELECT id INTO v_james FROM agents WHERE name = 'James Okafor';
    SELECT id INTO v_priya FROM agents WHERE name = 'Priya Nair';
    IF v_james IS NOT NULL AND v_priya IS NOT NULL THEN
      INSERT INTO shift_trades (from_agent_id, to_agent_id, day, status) VALUES (v_james, v_priya, 'Fri', 'Pending');
    END IF;
  END IF;
END $$;

-- Admin › Quality & WEM › Gamification
CREATE TABLE IF NOT EXISTS metric_profiles (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  applies_to    TEXT NOT NULL CHECK (char_length(btrim(applies_to)) BETWEEN 2 AND 200),
  target        TEXT NOT NULL DEFAULT '—' CHECK (char_length(target) <= 200),
  metrics_count INTEGER NOT NULL CHECK (metrics_count BETWEEN 1 AND 20),
  points        INTEGER NOT NULL CHECK (points BETWEEN 0 AND 100000),
  leaderboard   TEXT NOT NULL DEFAULT 'Enabled' CHECK (leaderboard IN ('Enabled','Hidden')),
  status        TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pilot')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS metric_profiles_name_key ON metric_profiles (lower(btrim(name)));

-- profile_name is a snapshot — a leaderboard must still display sensibly if its profile is
-- later renamed or deleted (profile_id goes NULL, the name it had stays put).
CREATE TABLE IF NOT EXISTS leaderboards (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  profile_id   BIGINT REFERENCES metric_profiles(id) ON DELETE SET NULL,
  profile_name TEXT NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('Weekly','Monthly')),
  participants INTEGER NOT NULL DEFAULT 0 CHECK (participants >= 0),
  status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS leaderboards_name_key ON leaderboards (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS badges (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  criteria TEXT NOT NULL,
  points   INTEGER NOT NULL CHECK (points >= 0),
  awarded  INTEGER NOT NULL DEFAULT 0 CHECK (awarded >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS badges_name_key ON badges (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS challenges (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  metric         TEXT NOT NULL,
  goal           TEXT NOT NULL,
  duration_label TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Running','Scheduled','Ended'))
);

CREATE UNIQUE INDEX IF NOT EXISTS challenges_name_key ON challenges (lower(btrim(name)));

-- Seed the mock-up's gamification data (safe to re-run).
DO $$
DECLARE v_retail BIGINT; v_collections BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM metric_profiles) THEN
    INSERT INTO metric_profiles (name, applies_to, target, metrics_count, points, leaderboard, status) VALUES
      ('Retail Agent Standard', 'Retail Billing, Retail Technical', 'SL 85%, QA 90%, AHT 6:30', 5, 1000, 'Enabled', 'Active'),
      ('Digital Agent', 'Digital Chat, Digital Email', 'CSAT 4.5, Concurrency 3', 4, 1000, 'Enabled', 'Active'),
      ('Collections Specialist', 'Collections', 'PTP rate 22%, QA 88%', 4, 1200, 'Enabled', 'Active'),
      ('New Starter days', 'Onboarding group', 'Adherence 95%, QA 80%', 3, 600, 'Enabled', 'Active'),
      ('Team Leader', 'Team Leaders', 'Evaluations 20/wk, Coaching 8/wk', 4, 800, 'Hidden', 'Active'),
      ('Partner Manila', 'Partner — Manila', 'SL 80%, QA 85%', 5, 1000, 'Enabled', 'Pilot');

    SELECT id INTO v_retail FROM metric_profiles WHERE name = 'Retail Agent Standard';
    SELECT id INTO v_collections FROM metric_profiles WHERE name = 'Collections Specialist';

    INSERT INTO leaderboards (name, profile_id, profile_name, period, participants, status) VALUES
      ('Retail Weekly', v_retail, 'Retail Agent Standard', 'Weekly', 42, 'Active'),
      ('Collections Monthly', v_collections, 'Collections Specialist', 'Monthly', 11, 'Active');

    INSERT INTO badges (name, criteria, points, awarded) VALUES
      ('QA Champion', 'QA score ≥ 95% for 4 weeks', 200, 18),
      ('Perfect Adherence', 'Adherence ≥ 98% for a week', 100, 63);

    INSERT INTO challenges (name, metric, goal, duration_label, status) VALUES
      ('August Sales Sprint', 'Conversions', '+15% vs July', '01-31 Aug', 'Running'),
      ('Zero Complaints Week', 'Complaint rate', '0 escalations', '18-24 Aug', 'Scheduled');
  END IF;
END $$;
