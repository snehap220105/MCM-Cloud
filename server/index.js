import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { validatePolicy, MEDIA, QUEUES } from './policy.js';
import { validateCalibration, derive, FORMS, ROSTER, STATUSES } from './calibration.js';
import { validateManagementUnit } from './managementUnit.js';
import { validateForm, validateEvaluationSubmit, scoreForm, INTERACTIONS } from './evaluationForm.js';
import { validatePlanningGroup, validateServiceGoal, synthesizeForecastEntry, currentWeekLabel, QUEUES as FC_QUEUES, SKILLS, LANGS } from './forecast.js';
import { validateWorkPlan, validateActivityCode, validateTimeOffRequest, validateShiftTrade, generateScheduleEntries, DAYS, CATEGORIES } from './schedule.js';
import { validateMetricProfile, LEADERBOARD_STATES, STATUSES as GAM_STATUSES } from './gamification.js';

const PORT = process.env.PORT || 4000;
const ROW_ID = 'default'; // single-tenant prototype — no org/auth concept yet

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mcm_wfm',
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS wfm_setup (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS recording_policies (
    id             BIGSERIAL PRIMARY KEY,
    name           TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
    media          TEXT[] NOT NULL CHECK (cardinality(media) > 0 AND media <@ ARRAY['Voice','Screen']),
    queues         TEXT[] NOT NULL DEFAULT '{}',
    pct            INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
    retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS recording_policies_name_key ON recording_policies (lower(btrim(name)))`);

// Queue mappings live in their own join table so a policy can be re-synced to a new queue
// set (delete + insert) inside one transaction, instead of overwriting an array column.
await pool.query(`
  CREATE TABLE IF NOT EXISTS recording_policy_queues (
    id         BIGSERIAL PRIMARY KEY,
    policy_id  BIGINT NOT NULL REFERENCES recording_policies(id) ON DELETE CASCADE,
    queue_name TEXT NOT NULL CHECK (queue_name IN ('Retail_Billing_L1','Retail_Complaints','Digital_Messaging','Collections_Arrears')),
    UNIQUE (policy_id, queue_name)
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS recording_policy_queues_policy_idx ON recording_policy_queues (policy_id)`);
// One-time backfill from the legacy queues[] column for rows created before this table existed.
await pool.query(`
  INSERT INTO recording_policy_queues (policy_id, queue_name)
  SELECT id, unnest(queues) FROM recording_policies WHERE array_length(queues, 1) > 0
  ON CONFLICT (policy_id, queue_name) DO NOTHING
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS calibrations (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
    interaction_ref TEXT NOT NULL CHECK (interaction_ref ~ '^CONV-[0-9]{5,10}$'),
    form            TEXT NOT NULL CHECK (char_length(btrim(form)) > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS calibrations_name_key ON calibrations (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS calibration_evaluators (
    id             BIGSERIAL PRIMARY KEY,
    calibration_id BIGINT NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    evaluator      TEXT NOT NULL,
    score          NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
    scored_at      TIMESTAMPTZ,
    UNIQUE (calibration_id, evaluator),
    CHECK ((score IS NULL) = (scored_at IS NULL))
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS calibration_evaluators_cal_idx ON calibration_evaluators (calibration_id)`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS management_units (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS management_units_name_key ON management_units (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS agents (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    management_unit_id  INTEGER REFERENCES management_units(id) ON DELETE SET NULL
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS evaluation_forms (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
    published  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS evaluation_forms_name_key ON evaluation_forms (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS evaluation_form_groups (
    id         BIGSERIAL PRIMARY KEY,
    form_id    BIGINT NOT NULL REFERENCES evaluation_forms(id) ON DELETE CASCADE,
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 50),
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS evaluation_form_groups_form_idx ON evaluation_form_groups (form_id)`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS evaluation_form_questions (
    id         BIGSERIAL PRIMARY KEY,
    group_id   BIGINT NOT NULL REFERENCES evaluation_form_groups(id) ON DELETE CASCADE,
    text       TEXT NOT NULL CHECK (char_length(btrim(text)) BETWEEN 3 AND 200),
    weight     INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 100),
    critical   BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS evaluation_form_questions_group_idx ON evaluation_form_questions (group_id)`);

// form_id is nullable (ON DELETE SET NULL) and form_name/question_text/weight/critical are
// snapshotted at scoring time — deleting or editing a form must never rewrite history.
await pool.query(`
  CREATE TABLE IF NOT EXISTS evaluations (
    id             BIGSERIAL PRIMARY KEY,
    form_id        BIGINT REFERENCES evaluation_forms(id) ON DELETE SET NULL,
    form_name      TEXT NOT NULL,
    agent_name     TEXT NOT NULL,
    interaction_ref TEXT NOT NULL,
    earned         INTEGER NOT NULL,
    possible       INTEGER NOT NULL,
    pct            INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
    critical_fail  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS evaluations_form_idx ON evaluations (form_id)`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS evaluation_answers (
    id            BIGSERIAL PRIMARY KEY,
    evaluation_id BIGINT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    question_id   BIGINT REFERENCES evaluation_form_questions(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    weight        INTEGER NOT NULL,
    critical      BOOLEAN NOT NULL,
    answer        TEXT NOT NULL CHECK (answer IN ('yes','no','na'))
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS evaluation_answers_eval_idx ON evaluation_answers (evaluation_id)`);

// Seed rows matching the WFM Setup Guide mock-up (safe to re-run).
await pool.query(`
  INSERT INTO agents (name) VALUES
    ('Sofia Petrova'), ('James Okafor'), ('Priya Nair'), ('Marco Rossi'),
    ('Rajan Patel'), ('Aisha Rahman'), ('Carlos Mendez')
  ON CONFLICT (name) DO NOTHING
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS planning_groups (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
    queues     TEXT[] NOT NULL CHECK (cardinality(queues) > 0 AND queues <@ ARRAY['Retail_Billing_L1','Retail_Complaints','Digital_Messaging','Collections_Arrears']),
    skills     TEXT[] NOT NULL DEFAULT '{}' CHECK (skills <@ ARRAY['Billing','Retention','Collections','Technical','Sales']),
    langs      TEXT[] NOT NULL DEFAULT '{}' CHECK (langs <@ ARRAY['English','Hindi']),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS planning_groups_name_key ON planning_groups (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS service_goals (
    id                 BIGSERIAL PRIMARY KEY,
    name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
    service_level_pct  INTEGER NOT NULL CHECK (service_level_pct BETWEEN 1 AND 100),
    service_level_secs INTEGER NOT NULL CHECK (service_level_secs BETWEEN 1 AND 3600),
    asa_target_secs    INTEGER NOT NULL CHECK (asa_target_secs BETWEEN 1 AND 3600),
    max_abandon_pct    INTEGER NOT NULL DEFAULT 0 CHECK (max_abandon_pct BETWEEN 0 AND 100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS service_goals_name_key ON service_goals (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS service_goal_planning_groups (
    id                 BIGSERIAL PRIMARY KEY,
    service_goal_id    BIGINT NOT NULL REFERENCES service_goals(id) ON DELETE CASCADE,
    planning_group_id  BIGINT NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
    UNIQUE (service_goal_id, planning_group_id)
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS sgpg_goal_idx ON service_goal_planning_groups (service_goal_id)`);
await pool.query(`CREATE INDEX IF NOT EXISTS sgpg_group_idx ON service_goal_planning_groups (planning_group_id)`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS forecasts (
    id           BIGSERIAL PRIMARY KEY,
    week_label   TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'Generated (ABM)',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

// planning_group_id cascades — deleting a planning group removes its forecast history too,
// matching the original client behaviour (deleting a PG stripped it out of every forecast).
await pool.query(`
  CREATE TABLE IF NOT EXISTS forecast_entries (
    id                 BIGSERIAL PRIMARY KEY,
    forecast_id        BIGINT NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
    planning_group_id  BIGINT NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
    volume             INTEGER NOT NULL,
    aht_seconds        INTEGER NOT NULL,
    day_volumes        JSONB NOT NULL,
    UNIQUE (forecast_id, planning_group_id)
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS forecast_entries_forecast_idx ON forecast_entries (forecast_id)`);

await pool.query(`
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
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS work_plans_name_key ON work_plans (lower(btrim(name)))`);

// An agent sits on at most one work plan — enforced by UNIQUE(agent_id), not a composite key.
await pool.query(`
  CREATE TABLE IF NOT EXISTS work_plan_agents (
    id            BIGSERIAL PRIMARY KEY,
    work_plan_id  BIGINT NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
    agent_id      INTEGER NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS work_plan_agents_wp_idx ON work_plan_agents (work_plan_id)`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS activity_codes (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
    category   TEXT NOT NULL CHECK (category IN ('On Queue','Off Queue','Break','Meal','Meeting','Training','Time Off')),
    paid       BOOLEAN NOT NULL DEFAULT TRUE,
    adherence_note TEXT NOT NULL DEFAULT 'Adherent when scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS activity_codes_name_key ON activity_codes (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS time_off_requests (
    id         BIGSERIAL PRIMARY KEY,
    agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    day        TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
    status     TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Denied')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS shift_trades (
    id            BIGSERIAL PRIMARY KEY,
    from_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id   INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    day           TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
    status        TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_agent_id <> to_agent_id)
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS schedules (
    id           BIGSERIAL PRIMARY KEY,
    week_label   TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
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
  )
`);
await pool.query(`CREATE INDEX IF NOT EXISTS schedule_entries_schedule_idx ON schedule_entries (schedule_id)`);

// Seed the mock-up's work plans, activity codes, time off & trade rows once, if empty.
{
  const { rows: existing } = await pool.query('SELECT id FROM work_plans LIMIT 1');
  if (!existing.length) {
    const { rows: agentRows } = await pool.query('SELECT id, name FROM agents');
    const agentId = (name) => agentRows.find((a) => a.name === name)?.id;

    const { rows: wpRows } = await pool.query(`
      INSERT INTO work_plans (name, days, shift_hours, flex_from, flex_to, paid_hours) VALUES
        ('UK Full Time', ARRAY['Mon','Tue','Wed','Thu','Fri'], 8, '08:00', '10:00', 37.5),
        ('UK Part Time', ARRAY['Mon','Tue','Wed','Thu'], 5, '09:00', '12:00', 20)
      RETURNING id, name
    `);
    const wpId = (name) => wpRows.find((r) => r.name === name).id;
    const fullTimeAgents = ['Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi', 'Rajan Patel'];
    const partTimeAgents = ['Aisha Rahman'];
    for (const name of fullTimeAgents) {
      const aid = agentId(name);
      if (aid) await pool.query('INSERT INTO work_plan_agents (work_plan_id, agent_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [wpId('UK Full Time'), aid]);
    }
    for (const name of partTimeAgents) {
      const aid = agentId(name);
      if (aid) await pool.query('INSERT INTO work_plan_agents (work_plan_id, agent_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [wpId('UK Part Time'), aid]);
    }

    await pool.query(`
      INSERT INTO activity_codes (name, category, paid, adherence_note) VALUES
        ('On Queue', 'On Queue', TRUE, 'Adherent when On Queue'),
        ('Break', 'Break', TRUE, 'Adherent during scheduled break'),
        ('Lunch', 'Meal', FALSE, 'Adherent during scheduled meal'),
        ('Team Meeting', 'Meeting', TRUE, 'Adherent when scheduled'),
        ('Training', 'Training', TRUE, 'Adherent when scheduled'),
        ('Time Off', 'Time Off', FALSE, 'Excused')
    `);

    const sofiaId = agentId('Sofia Petrova');
    if (sofiaId) await pool.query('INSERT INTO time_off_requests (agent_id, day, status) VALUES ($1, $2, $3)', [sofiaId, 'Wed', 'Pending']);
    const jamesId = agentId('James Okafor'), priyaId = agentId('Priya Nair');
    if (jamesId && priyaId) await pool.query('INSERT INTO shift_trades (from_agent_id, to_agent_id, day, status) VALUES ($1,$2,$3,$4)', [jamesId, priyaId, 'Fri', 'Pending']);
  }
}

// Seed the mock-up's planning groups + service goals once, if the tables are empty.
{
  const { rows: existing } = await pool.query('SELECT id FROM planning_groups LIMIT 1');
  if (!existing.length) {
    const { rows: pgRows } = await pool.query(`
      INSERT INTO planning_groups (name, queues, skills, langs) VALUES
        ('Retail Voice', ARRAY['Retail_Billing_L1','Retail_Complaints'], ARRAY['Billing','Retention'], ARRAY['English']),
        ('Collections', ARRAY['Collections_Arrears'], ARRAY['Collections'], ARRAY['English','Hindi']),
        ('Digital Messaging', ARRAY['Digital_Messaging'], ARRAY['Technical','Sales'], ARRAY['English'])
      RETURNING id, name
    `);
    const pgId = (name) => pgRows.find((r) => r.name === name).id;
    const { rows: sgRows } = await pool.query(`
      INSERT INTO service_goals (name, service_level_pct, service_level_secs, asa_target_secs, max_abandon_pct) VALUES
        ('Voice Standard', 80, 20, 30, 5),
        ('Digital Standard', 85, 40, 60, 0)
      RETURNING id, name
    `);
    await pool.query(
      `INSERT INTO service_goal_planning_groups (service_goal_id, planning_group_id) VALUES ($1,$2),($1,$3),($4,$5)`,
      [sgRows.find((r) => r.name === 'Voice Standard').id, pgId('Retail Voice'), pgId('Collections'),
       sgRows.find((r) => r.name === 'Digital Standard').id, pgId('Digital Messaging')]
    );
  }
}

// Seed the mock-up's evaluation form once, if the table is empty. Renamed from the mock's
// "Standard Call QA v2" to "Standard Call QA" — the current name rule is letters/spaces only.
{
  const { rows: existing } = await pool.query('SELECT id FROM evaluation_forms LIMIT 1');
  if (!existing.length) {
    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      const { rows: formRows } = await seedClient.query(
        `INSERT INTO evaluation_forms (name, published) VALUES ('Standard Call QA', TRUE) RETURNING id`
      );
      const formId = formRows[0].id;
      const seedGroups = [
        { name: 'Greeting & Compliance', questions: [
          { text: 'Used approved greeting and identified themselves', weight: 10, critical: false },
          { text: 'Completed DPA/identity verification before account discussion', weight: 20, critical: true },
        ] },
        { name: 'Handling', questions: [
          { text: 'Actively listened and acknowledged the issue', weight: 15, critical: false },
          { text: 'Provided a correct and complete resolution', weight: 25, critical: false },
          { text: 'Offered additional help before closing', weight: 10, critical: false },
        ] },
        { name: 'Wrap-up', questions: [
          { text: 'Selected the correct wrap-up code', weight: 10, critical: false },
          { text: 'Notes are clear and complete', weight: 10, critical: false },
        ] },
      ];
      for (let gi = 0; gi < seedGroups.length; gi++) {
        const g = seedGroups[gi];
        const { rows: groupRows } = await seedClient.query(
          `INSERT INTO evaluation_form_groups (form_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
          [formId, g.name, gi]
        );
        const groupId = groupRows[0].id;
        for (let qi = 0; qi < g.questions.length; qi++) {
          const q = g.questions[qi];
          await seedClient.query(
            `INSERT INTO evaluation_form_questions (group_id, text, weight, critical, sort_order) VALUES ($1, $2, $3, $4, $5)`,
            [groupId, q.text, q.weight, q.critical, qi]
          );
        }
      }
      await seedClient.query('COMMIT');
    } catch (e) {
      await seedClient.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      seedClient.release();
    }
  }
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS metric_profiles (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
    applies_to   TEXT NOT NULL CHECK (char_length(btrim(applies_to)) BETWEEN 2 AND 200),
    target       TEXT NOT NULL DEFAULT '—' CHECK (char_length(target) <= 200),
    metrics_count INTEGER NOT NULL CHECK (metrics_count BETWEEN 1 AND 20),
    points       INTEGER NOT NULL CHECK (points BETWEEN 0 AND 100000),
    leaderboard  TEXT NOT NULL DEFAULT 'Enabled' CHECK (leaderboard IN ('Enabled','Hidden')),
    status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pilot')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS metric_profiles_name_key ON metric_profiles (lower(btrim(name)))`);

// profile_name is a snapshot — a leaderboard must still display sensibly if its profile is
// later renamed or deleted (profile_id goes NULL, the name it had stays put).
await pool.query(`
  CREATE TABLE IF NOT EXISTS leaderboards (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    profile_id   BIGINT REFERENCES metric_profiles(id) ON DELETE SET NULL,
    profile_name TEXT NOT NULL,
    period       TEXT NOT NULL CHECK (period IN ('Weekly','Monthly')),
    participants INTEGER NOT NULL DEFAULT 0 CHECK (participants >= 0),
    status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused'))
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS leaderboards_name_key ON leaderboards (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS badges (
    id       BIGSERIAL PRIMARY KEY,
    name     TEXT NOT NULL,
    criteria TEXT NOT NULL,
    points   INTEGER NOT NULL CHECK (points >= 0),
    awarded  INTEGER NOT NULL DEFAULT 0 CHECK (awarded >= 0)
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS badges_name_key ON badges (lower(btrim(name)))`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS challenges (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    metric        TEXT NOT NULL,
    goal          TEXT NOT NULL,
    duration_label TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Running','Scheduled','Ended'))
  )
`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS challenges_name_key ON challenges (lower(btrim(name)))`);

// Seed the mock-up's gamification data once, if the profiles table is empty.
{
  const { rows: existing } = await pool.query('SELECT id FROM metric_profiles LIMIT 1');
  if (!existing.length) {
    const { rows: profileRows } = await pool.query(`
      INSERT INTO metric_profiles (name, applies_to, target, metrics_count, points, leaderboard, status) VALUES
        ('Retail Agent Standard', 'Retail Billing, Retail Technical', 'SL 85%, QA 90%, AHT 6:30', 5, 1000, 'Enabled', 'Active'),
        ('Digital Agent', 'Digital Chat, Digital Email', 'CSAT 4.5, Concurrency 3', 4, 1000, 'Enabled', 'Active'),
        ('Collections Specialist', 'Collections', 'PTP rate 22%, QA 88%', 4, 1200, 'Enabled', 'Active'),
        ('New Starter days', 'Onboarding group', 'Adherence 95%, QA 80%', 3, 600, 'Enabled', 'Active'),
        ('Team Leader', 'Team Leaders', 'Evaluations 20/wk, Coaching 8/wk', 4, 800, 'Hidden', 'Active'),
        ('Partner Manila', 'Partner — Manila', 'SL 80%, QA 85%', 5, 1000, 'Enabled', 'Pilot')
      RETURNING id, name
    `);
    const profileId = (name) => profileRows.find((r) => r.name === name).id;
    await pool.query(
      `INSERT INTO leaderboards (name, profile_id, profile_name, period, participants, status) VALUES
        ($1,$2,$3,'Weekly',42,'Active'), ($4,$5,$6,'Monthly',11,'Active')`,
      ['Retail Weekly', profileId('Retail Agent Standard'), 'Retail Agent Standard',
       'Collections Monthly', profileId('Collections Specialist'), 'Collections Specialist']
    );
    await pool.query(
      `INSERT INTO badges (name, criteria, points, awarded) VALUES
        ('QA Champion', 'QA score ≥ 95% for 4 weeks', 200, 18),
        ('Perfect Adherence', 'Adherence ≥ 98% for a week', 100, 63)`
    );
    await pool.query(
      `INSERT INTO challenges (name, metric, goal, duration_label, status) VALUES
        ('August Sales Sprint', 'Conversions', '+15% vs July', '01-31 Aug', 'Running'),
        ('Zero Complaints Week', 'Complaint rate', '0 escalations', '18-24 Aug', 'Scheduled')`
    );
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// Express 4 does not catch rejected promises — every async route goes through this.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/wfm-setup', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT data FROM wfm_setup WHERE id = $1', [ROW_ID]);
  res.json({ data: rows[0]?.data ?? null });
}));

app.put('/api/wfm-setup', wrap(async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data object is required' });
  await pool.query(
    `INSERT INTO wfm_setup (id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()`,
    [ROW_ID, data]
  );
  res.json({ data });
}));

/* ---------------- Recording policies ---------------- */

// Legacy queues[] column stays in sync as a read-model convenience (some older code paths
// still select it) but recording_policy_queues is the source of truth for writes.
const POLICY_SELECT = `
  SELECT p.id, p.name, p.media, p.pct, p.retention_days, p.active, p.updated_at,
         COALESCE(array_agg(q.queue_name ORDER BY q.queue_name) FILTER (WHERE q.queue_name IS NOT NULL), '{}') AS queues
    FROM recording_policies p
    LEFT JOIN recording_policy_queues q ON q.policy_id = p.id`;

const toApi = (r) => ({
  id: Number(r.id), // pg returns BIGSERIAL as a string; the UI compares ids strictly
  name: r.name,
  media: r.media,
  queues: r.queues,
  pct: r.pct,
  retention: r.retention_days,
  on: r.active,
  updatedAt: r.updated_at,
});

// Options the drawer renders — keeps the UI list and server whitelist from drifting.
app.get('/api/recording-policies/options', (req, res) => res.json({ media: MEDIA, queues: QUEUES }));

app.get('/api/recording-policies', wrap(async (req, res) => {
  const { rows } = await pool.query(`${POLICY_SELECT} GROUP BY p.id ORDER BY p.id`);
  res.json({ success: true, data: rows.map(toApi) });
}));

// Writes the policy row and re-syncs its queue mappings (delete + insert) inside one
// transaction, so a policy can never end up with a queue set that doesn't match what was
// actually saved.
async function writePolicy(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let policyId = id;
    if (id) {
      const { rowCount } = await client.query(
        `UPDATE recording_policies SET name = $1, media = $2, pct = $3, retention_days = $4, active = $5, updated_at = now()
          WHERE id = $6`,
        [value.name, value.media, value.pct, value.retention, value.on, id]
      );
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM recording_policy_queues WHERE policy_id = $1', [id]);
    } else {
      const { rows } = await client.query(
        `INSERT INTO recording_policies (name, media, queues, pct, retention_days, active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [value.name, value.media, value.queues, value.pct, value.retention, value.on]
      );
      policyId = rows[0].id;
    }
    if (value.queues.length) {
      await client.query(
        `INSERT INTO recording_policy_queues (policy_id, queue_name) SELECT $1, unnest($2::text[])`,
        [policyId, value.queues]
      );
    }
    if (id) {
      // keep the legacy array column in sync for any reader still using it directly
      await client.query('UPDATE recording_policies SET queues = $1 WHERE id = $2', [value.queues, policyId]);
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(`${POLICY_SELECT} WHERE p.id = $1 GROUP BY p.id`, [policyId]);
    return toApi(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/recording-policies', wrap(async (req, res) => {
  const { fields, value } = validatePolicy(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  res.status(201).json({ success: true, data: await writePolicy(null, value) });
}));

app.put('/api/recording-policies/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid policy id' });
  const { fields, value } = validatePolicy(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const data = await writePolicy(id, value);
  if (!data) return res.status(404).json({ success: false, error: 'Policy not found' });
  res.json({ success: true, data });
}));

app.delete('/api/recording-policies/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid policy id' });
  const { rowCount } = await pool.query('DELETE FROM recording_policies WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Policy not found' });
  res.status(204).end();
}));

/* ---------------- Calibrations ---------------- */

// evaluator_count / completed / spread are aggregated here so status and variance can never
// drift from the scores they describe.
const CALIB_SELECT = `
  SELECT c.id, c.name, c.interaction_ref, c.form, c.updated_at,
         COALESCE(
           json_agg(json_build_object('evaluator', e.evaluator, 'score', e.score) ORDER BY e.evaluator)
           FILTER (WHERE e.id IS NOT NULL), '[]'
         ) AS evaluators,
         COUNT(e.id)::int AS evaluator_count,
         COUNT(e.score)::int AS completed,
         CASE WHEN COUNT(e.score) > 0 THEN MAX(e.score) - MIN(e.score) END AS spread
    FROM calibrations c
    LEFT JOIN calibration_evaluators e ON e.calibration_id = c.id`;

function toCalibApi(r) {
  const total = r.evaluator_count;
  const { variance, status } = derive({ total, completed: r.completed, spread: r.spread });
  return {
    id: Number(r.id),
    name: r.name,
    interaction: r.interaction_ref,
    form: r.form,
    evaluators: total,
    completed: r.completed,
    variance,
    status,
    assignments: r.evaluators.map((a) => ({ evaluator: a.evaluator, score: a.score == null ? null : Number(a.score) })),
    updatedAt: r.updated_at,
  };
}

// Replaces the whole assignment set in one transaction — a half-written roster would
// corrupt the derived status/variance for the row.
// ponytail: delete+reinsert restamps scored_at on every save; switch to an upsert keyed on
// (calibration_id, evaluator) if scored_at is ever surfaced as "when they actually scored".
async function writeCalibration(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let calibId = id;
    if (id) {
      const { rowCount } = await client.query(
        `UPDATE calibrations SET name = $1, interaction_ref = $2, form = $3, updated_at = now() WHERE id = $4`,
        [value.name, value.interaction, value.form, id]
      );
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM calibration_evaluators WHERE calibration_id = $1', [id]);
    } else {
      const { rows } = await client.query(
        `INSERT INTO calibrations (name, interaction_ref, form) VALUES ($1, $2, $3) RETURNING id`,
        [value.name, value.interaction, value.form]
      );
      calibId = rows[0].id;
    }
    for (const a of value.evaluators) {
      await client.query(
        `INSERT INTO calibration_evaluators (calibration_id, evaluator, score, scored_at)
         VALUES ($1, $2, $3, CASE WHEN $3::numeric IS NULL THEN NULL ELSE now() END)`,
        [calibId, a.evaluator, a.score]
      );
    }
    await client.query('COMMIT');
    const { rows } = await client.query(`${CALIB_SELECT} WHERE c.id = $1 GROUP BY c.id`, [calibId]);
    return toCalibApi(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.get('/api/calibrations/options', (req, res) => res.json({ forms: FORMS, roster: ROSTER, statuses: STATUSES }));

app.get('/api/calibrations', wrap(async (req, res) => {
  const { rows } = await pool.query(`${CALIB_SELECT} GROUP BY c.id ORDER BY c.id`);
  res.json({ data: rows.map(toCalibApi) });
}));

// Per-calibration score spread — the Results tab.
app.get('/api/calibrations/results', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.name, c.interaction_ref, c.form,
           COUNT(e.score)::int AS evaluators,
           array_agg(e.score ORDER BY e.score DESC) FILTER (WHERE e.score IS NOT NULL) AS scores,
           MAX(e.score) - MIN(e.score) AS spread
      FROM calibrations c
      JOIN calibration_evaluators e ON e.calibration_id = c.id
     GROUP BY c.id HAVING COUNT(e.score) > 0
     ORDER BY c.id`);
  res.json({
    data: rows.map((r) => ({
      calib: r.name,
      interaction: `${r.interaction_ref} · ${r.form}`,
      evaluators: r.evaluators,
      spread: `${r.scores.map((s) => `${Number(s)}%`).join(' / ')} — within ${Number(r.spread)} pts`,
    })),
  });
}));

// Average score each evaluator gives vs the team average — the Evaluator Consistency tab.
app.get('/api/calibrations/evaluator-consistency', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT evaluator,
           ROUND(AVG(score), 1) AS avg_score,
           COUNT(*)::int AS scored,
           ROUND(AVG(score) - (SELECT AVG(score) FROM calibration_evaluators WHERE score IS NOT NULL), 1) AS vs_team
      FROM calibration_evaluators
     WHERE score IS NOT NULL
     GROUP BY evaluator
     ORDER BY AVG(score) DESC`);
  res.json({
    data: rows.map((r) => ({
      evaluator: r.evaluator,
      avg: `${Number(r.avg_score)}%`,
      scored: r.scored,
      vs: (Number(r.vs_team) > 0 ? '+' : Number(r.vs_team) < 0 ? '−' : '') + Math.abs(Number(r.vs_team)).toFixed(1),
    })),
  });
}));

app.post('/api/calibrations', wrap(async (req, res) => {
  const { fields, value } = validateCalibration(req.body);
  if (fields) return res.status(400).json({ error: 'Validation failed', fields });
  res.status(201).json({ data: await writeCalibration(null, value) });
}));

app.put('/api/calibrations/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid calibration id' });
  const { fields, value } = validateCalibration(req.body);
  if (fields) return res.status(400).json({ error: 'Validation failed', fields });
  const data = await writeCalibration(id, value);
  if (!data) return res.status(404).json({ error: 'Calibration not found' });
  res.json({ data });
}));

// Bulk delete for the row checkboxes — one statement, so it is all-or-nothing.
app.post('/api/calibrations/bulk-delete', wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null;
  if (!ids || !ids.length || ids.some((n) => !Number.isInteger(n) || n < 1)) {
    return res.status(400).json({ error: 'Select at least one calibration to delete.' });
  }
  const { rowCount } = await pool.query('DELETE FROM calibrations WHERE id = ANY($1::bigint[])', [ids]);
  res.json({ deleted: rowCount });
}));

app.delete('/api/calibrations/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid calibration id' });
  const { rowCount } = await pool.query('DELETE FROM calibrations WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Calibration not found' });
  res.status(204).end();
}));

/* ---------------- Management units ---------------- */

app.get('/api/agents', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.management_unit_id, m.name AS management_unit_name
      FROM agents a
      LEFT JOIN management_units m ON m.id = a.management_unit_id
     ORDER BY a.name`);
  res.json({
    success: true,
    data: rows.map((r) => ({ id: r.id, name: r.name, managementUnitId: r.management_unit_id, managementUnitName: r.management_unit_name })),
  });
}));

app.get('/api/management-units', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.id, m.name, m.updated_at,
           COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '[]') AS agents
      FROM management_units m
      LEFT JOIN agents a ON a.management_unit_id = m.id
     GROUP BY m.id ORDER BY m.id`);
  res.json({ success: true, data: rows.map((r) => ({ id: r.id, name: r.name, agents: r.agents, updatedAt: r.updated_at })) });
}));

// Creates the MU and (re)assigns the selected agents to it in one transaction — an agent
// belongs to at most one MU, so a half-applied reassignment would leave the roster inconsistent.
async function writeManagementUnit(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (value.agentIds.length) {
      const { rows: found } = await client.query('SELECT id FROM agents WHERE id = ANY($1::int[])', [value.agentIds]);
      if (found.length !== value.agentIds.length) {
        await client.query('ROLLBACK');
        return { fields: { agentIds: 'One or more selected agents do not exist.' } };
      }
    }

    let muId = id;
    if (id) {
      const { rowCount } = await client.query('UPDATE management_units SET name = $1, updated_at = now() WHERE id = $2', [value.name, id]);
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('UPDATE agents SET management_unit_id = NULL WHERE management_unit_id = $1', [id]);
    } else {
      const { rows } = await client.query('INSERT INTO management_units (name) VALUES ($1) RETURNING id', [value.name]);
      muId = rows[0].id;
    }
    if (value.agentIds.length) {
      await client.query('UPDATE agents SET management_unit_id = $1 WHERE id = ANY($2::int[])', [muId, value.agentIds]);
    }

    await client.query('COMMIT');
    const { rows } = await pool.query(`
      SELECT m.id, m.name, m.updated_at,
             COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '[]') AS agents
        FROM management_units m LEFT JOIN agents a ON a.management_unit_id = m.id
       WHERE m.id = $1 GROUP BY m.id`, [muId]);
    return { value: { id: rows[0].id, name: rows[0].name, agents: rows[0].agents, updatedAt: rows[0].updated_at } };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/management-units', wrap(async (req, res) => {
  const { fields, value } = validateManagementUnit(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const result = await writeManagementUnit(null, value);
  if (result.fields) return res.status(400).json({ success: false, error: 'Validation failed', fields: result.fields });
  res.status(201).json({ success: true, data: result.value });
}));

app.put('/api/management-units/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid management unit id' });
  const { fields, value } = validateManagementUnit(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const result = await writeManagementUnit(id, value);
  if (!result) return res.status(404).json({ success: false, error: 'Management unit not found' });
  if (result.fields) return res.status(400).json({ success: false, error: 'Validation failed', fields: result.fields });
  res.json({ success: true, data: result.value });
}));

app.delete('/api/management-units/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid management unit id' });
  const { rowCount } = await pool.query('DELETE FROM management_units WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Management unit not found' });
  res.status(204).end();
}));

/* ---------------- Evaluation forms ---------------- */

// Batch-fetches groups+questions for a set of form ids in 2 queries (not N+1) and assembles
// them in JS — simpler and just as fast as nested json_agg SQL at this table's size.
async function attachGroups(forms) {
  if (!forms.length) return forms;
  const formIds = forms.map((f) => f.id);
  const { rows: groupRows } = await pool.query('SELECT * FROM evaluation_form_groups WHERE form_id = ANY($1) ORDER BY sort_order, id', [formIds]);
  const groupIds = groupRows.map((g) => g.id);
  const { rows: questionRows } = groupIds.length
    ? await pool.query('SELECT * FROM evaluation_form_questions WHERE group_id = ANY($1) ORDER BY sort_order, id', [groupIds])
    : { rows: [] };
  // pg returns BIGINT/BIGSERIAL as strings — coerce to Number so id comparisons (Set.has,
  // strict ===) work the same way they do for every other table in this API.
  return forms.map((f) => ({
    ...f,
    groups: groupRows.filter((g) => g.form_id === f.id).map((g) => ({
      id: Number(g.id),
      name: g.name,
      questions: questionRows.filter((q) => q.group_id === g.id).map((q) => ({ id: Number(q.id), text: q.text, weight: q.weight, critical: q.critical })),
    })),
  }));
}

const toFormApi = (r) => ({ id: Number(r.id), name: r.name, published: r.published, groups: r.groups, updatedAt: r.updated_at });

app.get('/api/evaluation-forms/options', (req, res) => res.json({
  success: true,
  interactions: INTERACTIONS.map((i, index) => ({ index, ...i })),
}));

app.get('/api/evaluation-forms', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT f.id, f.name, f.published, f.updated_at, COUNT(e.id)::int AS evaluation_count
      FROM evaluation_forms f
      LEFT JOIN evaluations e ON e.form_id = f.id
     GROUP BY f.id ORDER BY f.id`);
  const withGroups = await attachGroups(rows);
  res.json({ success: true, data: withGroups.map((r, i) => ({ ...toFormApi(r), evaluationCount: rows[i].evaluation_count })) });
}));

// Writes the form and fully re-syncs its groups/questions (delete + reinsert, in sort order)
// inside one transaction — a half-written form could publish with a corrupted question set.
async function writeForm(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let formId = id;
    if (id) {
      const { rowCount } = await client.query('UPDATE evaluation_forms SET name = $1, published = $2, updated_at = now() WHERE id = $3', [value.name, value.published, id]);
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM evaluation_form_groups WHERE form_id = $1', [id]); // cascades to questions
    } else {
      const { rows } = await client.query('INSERT INTO evaluation_forms (name, published) VALUES ($1, $2) RETURNING id', [value.name, value.published]);
      formId = rows[0].id;
    }
    for (let gi = 0; gi < value.groups.length; gi++) {
      const g = value.groups[gi];
      const { rows: groupRows } = await client.query(
        'INSERT INTO evaluation_form_groups (form_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
        [formId, g.name, gi]
      );
      const groupId = groupRows[0].id;
      for (let qi = 0; qi < g.questions.length; qi++) {
        const q = g.questions[qi];
        await client.query(
          'INSERT INTO evaluation_form_questions (group_id, text, weight, critical, sort_order) VALUES ($1, $2, $3, $4, $5)',
          [groupId, q.text, q.weight, q.critical, qi]
        );
      }
    }
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT id, name, published, updated_at FROM evaluation_forms WHERE id = $1', [formId]);
    const [withGroups] = await attachGroups(rows);
    return toFormApi(withGroups);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/evaluation-forms', wrap(async (req, res) => {
  const { fields, value } = validateForm(req.body, !!req.body?.published);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  res.status(201).json({ success: true, data: await writeForm(null, value) });
}));

app.put('/api/evaluation-forms/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid form id' });
  const { fields, value } = validateForm(req.body, !!req.body?.published);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const data = await writeForm(id, value);
  if (!data) return res.status(404).json({ success: false, error: 'Form not found' });
  res.json({ success: true, data });
}));

app.delete('/api/evaluation-forms/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid form id' });
  const { rowCount } = await pool.query('DELETE FROM evaluation_forms WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Form not found' });
  res.status(204).end();
}));

/* ---------------- Evaluations (Perform Evaluation) ---------------- */

const toEvalApi = (r) => ({
  id: Number(r.id),
  form: r.form_id == null ? null : Number(r.form_id),
  formName: r.form_name,
  agent: r.agent_name,
  interaction: r.interaction_ref,
  pct: r.pct,
  earned: r.earned,
  possible: r.possible,
  criticalFail: r.critical_fail,
  t: r.created_at,
});

app.get('/api/evaluations', wrap(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const { rows } = await pool.query('SELECT * FROM evaluations ORDER BY created_at DESC LIMIT $1', [limit]);
  res.json({ success: true, data: rows.map(toEvalApi) });
}));

// Scores server-side from the form's live question set — the client only supplies which
// interaction/form were picked and yes/no/na per question id, never a score or weight, so a
// tampered request cannot inflate a result.
app.post('/api/evaluations', wrap(async (req, res) => {
  const formId = Number(req.body?.formId);
  if (!Number.isInteger(formId) || formId < 1) return res.status(400).json({ success: false, error: 'Validation failed', fields: { formId: 'A form must be selected.' } });

  const { rows: formRows } = await pool.query('SELECT id, name, published FROM evaluation_forms WHERE id = $1', [formId]);
  if (!formRows.length) return res.status(404).json({ success: false, error: 'Form not found' });
  if (!formRows[0].published) return res.status(400).json({ success: false, error: 'Validation failed', fields: { formId: 'Only published forms can be evaluated.' } });

  const [form] = await attachGroups(formRows);
  const validQuestionIds = new Set(form.groups.flatMap((g) => g.questions.map((q) => q.id)));

  const { fields, value } = validateEvaluationSubmit(req.body, validQuestionIds);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });

  const { earned, possible, pct, criticalFail } = scoreForm(form.groups, value.answersByQuestionId);
  const interactionRef = `${value.interaction.customer} · ${value.interaction.queue}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: evalRows } = await client.query(
      `INSERT INTO evaluations (form_id, form_name, agent_name, interaction_ref, earned, possible, pct, critical_fail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [form.id, form.name, value.interaction.agent, interactionRef, earned, possible, pct, criticalFail]
    );
    const evaluation = evalRows[0];
    for (const g of form.groups) {
      for (const q of g.questions) {
        const answer = value.answersByQuestionId.get(q.id) || 'yes';
        await client.query(
          `INSERT INTO evaluation_answers (evaluation_id, question_id, question_text, weight, critical, answer) VALUES ($1, $2, $3, $4, $5, $6)`,
          [evaluation.id, q.id, q.text, q.weight, q.critical, answer]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: toEvalApi(evaluation) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

/* ---------------- Forecasts / Planning Groups / Service Goals ---------------- */

const toPgApi = (r) => ({ id: Number(r.id), name: r.name, queues: r.queues, skills: r.skills, langs: r.langs, updatedAt: r.updated_at });

app.get('/api/planning-groups/options', (req, res) => res.json({ success: true, queues: FC_QUEUES, skills: SKILLS, langs: LANGS }));

app.get('/api/planning-groups', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM planning_groups ORDER BY id');
  res.json({ success: true, data: rows.map(toPgApi) });
}));

app.post('/api/planning-groups', wrap(async (req, res) => {
  const { fields, value } = validatePlanningGroup(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    'INSERT INTO planning_groups (name, queues, skills, langs) VALUES ($1,$2,$3,$4) RETURNING *',
    [value.name, value.queues, value.skills, value.langs]
  );
  res.status(201).json({ success: true, data: toPgApi(rows[0]) });
}));

app.put('/api/planning-groups/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid planning group id' });
  const { fields, value } = validatePlanningGroup(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    'UPDATE planning_groups SET name=$1, queues=$2, skills=$3, langs=$4, updated_at=now() WHERE id=$5 RETURNING *',
    [value.name, value.queues, value.skills, value.langs, id]
  );
  if (!rows.length) return res.status(404).json({ success: false, error: 'Planning group not found' });
  res.json({ success: true, data: toPgApi(rows[0]) });
}));

// Deleting a planning group cascades to its service-goal links and forecast history (FK
// ON DELETE CASCADE) — matches the original client, which stripped the id out of everything.
app.delete('/api/planning-groups/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid planning group id' });
  const { rowCount } = await pool.query('DELETE FROM planning_groups WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Planning group not found' });
  res.status(204).end();
}));

const SG_SELECT = `
  SELECT g.id, g.name, g.service_level_pct, g.service_level_secs, g.asa_target_secs, g.max_abandon_pct, g.updated_at,
         COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '[]') AS planning_groups
    FROM service_goals g
    LEFT JOIN service_goal_planning_groups link ON link.service_goal_id = g.id
    LEFT JOIN planning_groups p ON p.id = link.planning_group_id`;

const toSgApi = (r) => ({
  id: Number(r.id), name: r.name, sl: r.service_level_pct, sls: r.service_level_secs, asa: r.asa_target_secs, abn: r.max_abandon_pct,
  pgs: r.planning_groups.map((p) => p.id), planningGroups: r.planning_groups, updatedAt: r.updated_at,
});

app.get('/api/service-goals', wrap(async (req, res) => {
  const { rows } = await pool.query(`${SG_SELECT} GROUP BY g.id ORDER BY g.id`);
  res.json({ success: true, data: rows.map(toSgApi) });
}));

// Writes the goal and re-syncs its planning-group links (delete + insert) in one transaction.
async function writeServiceGoal(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let goalId = id;
    if (id) {
      const { rowCount } = await client.query(
        'UPDATE service_goals SET name=$1, service_level_pct=$2, service_level_secs=$3, asa_target_secs=$4, max_abandon_pct=$5, updated_at=now() WHERE id=$6',
        [value.name, value.sl, value.sls, value.asa, value.abn, id]
      );
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM service_goal_planning_groups WHERE service_goal_id = $1', [id]);
    } else {
      const { rows } = await client.query(
        'INSERT INTO service_goals (name, service_level_pct, service_level_secs, asa_target_secs, max_abandon_pct) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [value.name, value.sl, value.sls, value.asa, value.abn]
      );
      goalId = rows[0].id;
    }
    if (value.pgIds.length) {
      await client.query(
        'INSERT INTO service_goal_planning_groups (service_goal_id, planning_group_id) SELECT $1, unnest($2::bigint[])',
        [goalId, value.pgIds]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(`${SG_SELECT} WHERE g.id = $1 GROUP BY g.id`, [goalId]);
    return toSgApi(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/service-goals', wrap(async (req, res) => {
  const { rows: pgRows } = await pool.query('SELECT id FROM planning_groups');
  const { fields, value } = validateServiceGoal(req.body, new Set(pgRows.map((r) => Number(r.id))));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  res.status(201).json({ success: true, data: await writeServiceGoal(null, value) });
}));

app.put('/api/service-goals/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid service goal id' });
  const { rows: pgRows } = await pool.query('SELECT id FROM planning_groups');
  const { fields, value } = validateServiceGoal(req.body, new Set(pgRows.map((r) => Number(r.id))));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const data = await writeServiceGoal(id, value);
  if (!data) return res.status(404).json({ success: false, error: 'Service goal not found' });
  res.json({ success: true, data });
}));

app.delete('/api/service-goals/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid service goal id' });
  const { rowCount } = await pool.query('DELETE FROM service_goals WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Service goal not found' });
  res.status(204).end();
}));

const FORECAST_SELECT = `
  SELECT f.id, f.week_label, f.status, f.generated_at,
         COALESCE(json_agg(json_build_object(
           'planningGroupId', e.planning_group_id, 'name', p.name, 'skills', p.skills,
           'volume', e.volume, 'aht', e.aht_seconds, 'days', e.day_volumes
         ) ORDER BY p.name) FILTER (WHERE e.id IS NOT NULL), '[]') AS entries
    FROM forecasts f
    LEFT JOIN forecast_entries e ON e.forecast_id = f.id
    LEFT JOIN planning_groups p ON p.id = e.planning_group_id`;

const toForecastApi = (r) => ({ id: Number(r.id), week: r.week_label, status: r.status, t: r.generated_at, entries: r.entries });

app.get('/api/forecasts', wrap(async (req, res) => {
  const { rows } = await pool.query(`${FORECAST_SELECT} GROUP BY f.id ORDER BY f.id DESC`);
  res.json({ success: true, data: rows.map(toForecastApi) });
}));

// Generates next week's forecast from every current planning group. The week label is
// computed from the server clock (never the client's), and synthetic volume/AHT per group
// come from a deterministic hash of the group's name — this prototype has no real historical
// interaction feed to derive them from.
app.post('/api/forecasts', wrap(async (req, res) => {
  const week = currentWeekLabel();
  const { rows: pgRows } = await pool.query('SELECT id, name FROM planning_groups ORDER BY id');
  if (!pgRows.length) return res.status(400).json({ success: false, error: 'Create a planning group before generating a forecast.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: fRows } = await client.query(
      "INSERT INTO forecasts (week_label, status) VALUES ($1, 'Generated (ABM)') RETURNING id",
      [week]
    );
    const forecastId = fRows[0].id;
    for (const pg of pgRows) {
      const { vol, aht, days } = synthesizeForecastEntry(pg.name);
      await client.query(
        'INSERT INTO forecast_entries (forecast_id, planning_group_id, volume, aht_seconds, day_volumes) VALUES ($1,$2,$3,$4,$5)',
        [forecastId, pg.id, vol, aht, JSON.stringify(days)]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(`${FORECAST_SELECT} WHERE f.id = $1 GROUP BY f.id`, [forecastId]);
    res.status(201).json({ success: true, data: toForecastApi(rows[0]) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return res.status(409).json({ success: false, error: `A forecast for ${week} already exists — delete it to regenerate.` });
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/api/forecasts/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid forecast id' });
  const { rowCount } = await pool.query('DELETE FROM forecasts WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Forecast not found' });
  res.status(204).end();
}));

/* ---------------- Schedules (WFM): Work Plans, Activity Codes, Time Off, Shift Trades, Schedules ---------------- */

app.get('/api/work-plans/options', (req, res) => res.json({ success: true, days: DAYS, categories: CATEGORIES }));

const WP_SELECT = `
  SELECT w.id, w.name, w.days, w.shift_hours, w.flex_from, w.flex_to, w.paid_hours, w.updated_at,
         COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '[]') AS agents
    FROM work_plans w
    LEFT JOIN work_plan_agents link ON link.work_plan_id = w.id
    LEFT JOIN agents a ON a.id = link.agent_id`;

const toWpApi = (r) => ({
  id: Number(r.id), name: r.name, days: r.days, len: r.shift_hours, flexFrom: r.flex_from, flexTo: r.flex_to,
  paid: Number(r.paid_hours), agents: r.agents, agentIds: r.agents.map((a) => a.id), updatedAt: r.updated_at,
});

app.get('/api/work-plans', wrap(async (req, res) => {
  const { rows } = await pool.query(`${WP_SELECT} GROUP BY w.id ORDER BY w.id`);
  res.json({ success: true, data: rows.map(toWpApi) });
}));

// Re-syncs which agents sit on this plan (delete + insert) in one transaction — an agent
// belongs to at most one plan, so a half-applied move would leave two plans claiming them.
async function writeWorkPlan(id, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let wpId = id;
    if (id) {
      const { rowCount } = await client.query(
        'UPDATE work_plans SET name=$1, days=$2, shift_hours=$3, flex_from=$4, flex_to=$5, paid_hours=$6, updated_at=now() WHERE id=$7',
        [value.name, value.days, value.len, value.flexFrom, value.flexTo, value.paid, id]
      );
      if (!rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM work_plan_agents WHERE work_plan_id = $1', [id]);
    } else {
      const { rows } = await client.query(
        'INSERT INTO work_plans (name, days, shift_hours, flex_from, flex_to, paid_hours) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [value.name, value.days, value.len, value.flexFrom, value.flexTo, value.paid]
      );
      wpId = rows[0].id;
    }
    if (value.agentIds.length) {
      // An agent sits on at most one plan (work_plan_agents.agent_id is UNIQUE) — checking an
      // agent who is "currently on" a different plan must move them, not fail with a unique
      // violation. Clear their old assignment first, wherever it is, then insert the new one.
      await client.query('DELETE FROM work_plan_agents WHERE agent_id = ANY($1::int[])', [value.agentIds]);
      await client.query('INSERT INTO work_plan_agents (work_plan_id, agent_id) SELECT $1, unnest($2::int[])', [wpId, value.agentIds]);
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(`${WP_SELECT} WHERE w.id = $1 GROUP BY w.id`, [wpId]);
    return toWpApi(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/work-plans', wrap(async (req, res) => {
  const { rows: agentRows } = await pool.query('SELECT id FROM agents');
  const { fields, value } = validateWorkPlan(req.body, new Set(agentRows.map((r) => r.id)));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  res.status(201).json({ success: true, data: await writeWorkPlan(null, value) });
}));

app.put('/api/work-plans/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid work plan id' });
  const { rows: agentRows } = await pool.query('SELECT id FROM agents');
  const { fields, value } = validateWorkPlan(req.body, new Set(agentRows.map((r) => r.id)));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const data = await writeWorkPlan(id, value);
  if (!data) return res.status(404).json({ success: false, error: 'Work plan not found' });
  res.json({ success: true, data });
}));

app.delete('/api/work-plans/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid work plan id' });
  const { rowCount } = await pool.query('DELETE FROM work_plans WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Work plan not found' });
  res.status(204).end();
}));

const toAcApi = (r) => ({ id: Number(r.id), name: r.name, cat: r.category, paid: r.paid, adh: r.adherence_note });

app.get('/api/activity-codes', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM activity_codes ORDER BY id');
  res.json({ success: true, data: rows.map(toAcApi) });
}));

app.post('/api/activity-codes', wrap(async (req, res) => {
  const { fields, value } = validateActivityCode(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    "INSERT INTO activity_codes (name, category, paid, adherence_note) VALUES ($1,$2,$3,'Adherent when scheduled') RETURNING *",
    [value.name, value.category, value.paid]
  );
  res.status(201).json({ success: true, data: toAcApi(rows[0]) });
}));

app.delete('/api/activity-codes/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid activity code id' });
  const { rowCount } = await pool.query('DELETE FROM activity_codes WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Activity code not found' });
  res.status(204).end();
}));

const toTimeOffApi = (r) => ({
  id: Number(r.id), agentId: Number(r.agent_id), agent: r.agent_name, code: 'Time Off',
  day: r.day, dates: `${r.day} (this schedule week)`, status: r.status,
});

app.get('/api/time-off', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*, a.name AS agent_name FROM time_off_requests t JOIN agents a ON a.id = t.agent_id ORDER BY t.id`);
  res.json({ success: true, data: rows.map(toTimeOffApi) });
}));

app.post('/api/time-off', wrap(async (req, res) => {
  const { rows: agentRows } = await pool.query('SELECT id FROM agents');
  const { fields, value } = validateTimeOffRequest(req.body, new Set(agentRows.map((r) => r.id)));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    `INSERT INTO time_off_requests (agent_id, day) VALUES ($1,$2)
     RETURNING *, (SELECT name FROM agents WHERE id = $1) AS agent_name`,
    [value.agentId, value.day]
  );
  res.status(201).json({ success: true, data: toTimeOffApi(rows[0]) });
}));

// Approving replaces that agent's shift with Time Off on every schedule that already has an
// entry for them on that day — denying just records the decision. Matches the original client.
app.put('/api/time-off/:id/decide', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid time off request id' });
  if (![true, false].includes(req.body?.approve)) return res.status(400).json({ success: false, error: 'Validation failed', fields: { approve: 'approve must be true or false.' } });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE time_off_requests SET status = $1 WHERE id = $2
       RETURNING *, (SELECT name FROM agents WHERE id = agent_id) AS agent_name`,
      [req.body.approve ? 'Approved' : 'Denied', id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Time off request not found' }); }
    const r = rows[0];
    if (req.body.approve) {
      await client.query(
        `UPDATE schedule_entries SET is_off = TRUE, start_time = NULL, end_time = NULL, breaks_note = NULL
          WHERE agent_id = $1 AND day = $2`,
        [r.agent_id, r.day]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, data: toTimeOffApi(r) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

const toTradeApi = (r) => ({ id: Number(r.id), fromAgentId: Number(r.from_agent_id), toAgentId: Number(r.to_agent_id), from: r.from_name, to: r.to_name, day: r.day, status: r.status });

app.get('/api/shift-trades', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*, fa.name AS from_name, ta.name AS to_name
      FROM shift_trades t JOIN agents fa ON fa.id = t.from_agent_id JOIN agents ta ON ta.id = t.to_agent_id
     ORDER BY t.id`);
  res.json({ success: true, data: rows.map(toTradeApi) });
}));

app.post('/api/shift-trades', wrap(async (req, res) => {
  const { rows: agentRows } = await pool.query('SELECT id FROM agents');
  const { fields, value } = validateShiftTrade(req.body, new Set(agentRows.map((r) => r.id)));
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    `INSERT INTO shift_trades (from_agent_id, to_agent_id, day) VALUES ($1,$2,$3)
     RETURNING *, (SELECT name FROM agents WHERE id = $1) AS from_name, (SELECT name FROM agents WHERE id = $2) AS to_name`,
    [value.fromAgentId, value.toAgentId, value.day]
  );
  res.status(201).json({ success: true, data: toTradeApi(rows[0]) });
}));

// Approving swaps the two agents' shift (or time-off) entries on that day, in every schedule
// where both already have one — matches the original client's cross-schedule swap.
app.put('/api/shift-trades/:id/approve', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid shift trade id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE shift_trades SET status = 'Approved' WHERE id = $1 AND status = 'Pending'
       RETURNING *, (SELECT name FROM agents WHERE id = from_agent_id) AS from_name, (SELECT name FROM agents WHERE id = to_agent_id) AS to_name`,
      [id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Pending shift trade not found' }); }
    const r = rows[0];
    // Snapshot both sides' original values before mutating anything — updating one row and
    // then reading it back to update the other would read already-overwritten data.
    const { rows: pairs } = await client.query(
      `SELECT fe.schedule_id,
              fe.id AS from_entry_id, fe.is_off AS from_is_off, fe.start_time AS from_start, fe.end_time AS from_end, fe.breaks_note AS from_breaks,
              te.id AS to_entry_id, te.is_off AS to_is_off, te.start_time AS to_start, te.end_time AS to_end, te.breaks_note AS to_breaks
         FROM schedule_entries fe
         JOIN schedule_entries te ON te.schedule_id = fe.schedule_id AND te.day = fe.day AND te.agent_id = $2
        WHERE fe.agent_id = $1 AND fe.day = $3`,
      [r.from_agent_id, r.to_agent_id, r.day]
    );
    for (const p of pairs) {
      await client.query(
        'UPDATE schedule_entries SET is_off = $1, start_time = $2, end_time = $3, breaks_note = $4 WHERE id = $5',
        [p.to_is_off, p.to_start, p.to_end, p.to_breaks, p.from_entry_id]
      );
      await client.query(
        'UPDATE schedule_entries SET is_off = $1, start_time = $2, end_time = $3, breaks_note = $4 WHERE id = $5',
        [p.from_is_off, p.from_start, p.from_end, p.from_breaks, p.to_entry_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, data: toTradeApi(r) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

const SCHEDULE_SELECT = `
  SELECT s.id, s.week_label, s.status, s.generated_at,
         COALESCE(json_agg(json_build_object(
           'agentId', e.agent_id, 'agent', a.name, 'day', e.day, 'isOff', e.is_off,
           'start', e.start_time, 'end', e.end_time, 'breaks', e.breaks_note
         ) ORDER BY a.name, e.day) FILTER (WHERE e.id IS NOT NULL), '[]') AS entries
    FROM schedules s
    LEFT JOIN schedule_entries e ON e.schedule_id = s.id
    LEFT JOIN agents a ON a.id = e.agent_id`;

const toScheduleApi = (r) => ({ id: Number(r.id), week: r.week_label, status: r.status, t: r.generated_at, entries: r.entries });

app.get('/api/schedules', wrap(async (req, res) => {
  const { rows } = await pool.query(`${SCHEDULE_SELECT} GROUP BY s.id ORDER BY s.id DESC`);
  res.json({ success: true, data: rows.map(toScheduleApi) });
}));

// Generates next week's schedule from the current work plans + already-approved time off.
// The week label comes from the server clock, matching /api/forecasts.
app.post('/api/schedules', wrap(async (req, res) => {
  const { rows: fRows } = await pool.query('SELECT id FROM forecasts LIMIT 1');
  if (!fRows.length) return res.status(400).json({ success: false, error: 'Generate a forecast first — schedules are built against it.' });

  const week = currentWeekLabel();
  const { rows: wpRows } = await pool.query(`${WP_SELECT} GROUP BY w.id`);
  const workPlans = wpRows.map(toWpApi);
  const { rows: agentRows } = await pool.query('SELECT id FROM agents');
  const { rows: offRows } = await pool.query("SELECT agent_id, day FROM time_off_requests WHERE status = 'Approved'");
  const approvedTimeOffByAgentDay = new Set(offRows.map((r) => `${r.agent_id}_${r.day}`));

  const { entries, scheduledCount } = generateScheduleEntries(workPlans, agentRows.map((r) => r.id), approvedTimeOffByAgentDay);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sRows } = await client.query("INSERT INTO schedules (week_label, status) VALUES ($1, 'Draft') RETURNING id", [week]);
    const scheduleId = sRows[0].id;
    for (const e of entries) {
      await client.query(
        'INSERT INTO schedule_entries (schedule_id, agent_id, day, is_off, start_time, end_time, breaks_note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [scheduleId, e.agentId, e.day, e.isOff, e.start, e.end, e.breaksNote]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(`${SCHEDULE_SELECT} WHERE s.id = $1 GROUP BY s.id`, [scheduleId]);
    res.status(201).json({ success: true, data: toScheduleApi(rows[0]), scheduledCount });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return res.status(409).json({ success: false, error: `Schedule for ${week} exists — delete it to regenerate.` });
    throw e;
  } finally {
    client.release();
  }
}));

app.put('/api/schedules/:id/publish', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid schedule id' });
  const { rows } = await pool.query("UPDATE schedules SET status = 'Published' WHERE id = $1 RETURNING id", [id]);
  if (!rows.length) return res.status(404).json({ success: false, error: 'Schedule not found' });
  res.json({ success: true });
}));

app.delete('/api/schedules/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid schedule id' });
  const { rowCount } = await pool.query('DELETE FROM schedules WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Schedule not found' });
  res.status(204).end();
}));

/* ---------------- Gamification: Metric Profiles, Leaderboards, Badges, Challenges ---------------- */

app.get('/api/gamification/options', (req, res) => res.json({ success: true, leaderboardStates: LEADERBOARD_STATES, statuses: GAM_STATUSES }));

const PROFILE_COLS = 'id, name, applies_to, target, metrics_count, points, leaderboard, status, updated_at';
const toProfileApi = (r) => ({
  id: Number(r.id), name: r.name, applies: r.applies_to, target: r.target, metrics: r.metrics_count,
  points: r.points, leaderboard: r.leaderboard, status: r.status, updatedAt: r.updated_at,
});

app.get('/api/metric-profiles', wrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLS} FROM metric_profiles ORDER BY id`);
  res.json({ success: true, data: rows.map(toProfileApi) });
}));

app.post('/api/metric-profiles', wrap(async (req, res) => {
  const { fields, value } = validateMetricProfile(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    `INSERT INTO metric_profiles (name, applies_to, target, metrics_count, points, leaderboard, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${PROFILE_COLS}`,
    [value.name, value.applies, value.target, value.metrics, value.points, value.leaderboard, value.status]
  );
  res.status(201).json({ success: true, data: toProfileApi(rows[0]) });
}));

app.put('/api/metric-profiles/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid profile id' });
  const { fields, value } = validateMetricProfile(req.body);
  if (fields) return res.status(400).json({ success: false, error: 'Validation failed', fields });
  const { rows } = await pool.query(
    `UPDATE metric_profiles SET name=$1, applies_to=$2, target=$3, metrics_count=$4, points=$5, leaderboard=$6, status=$7, updated_at=now()
      WHERE id=$8 RETURNING ${PROFILE_COLS}`,
    [value.name, value.applies, value.target, value.metrics, value.points, value.leaderboard, value.status, id]
  );
  if (!rows.length) return res.status(404).json({ success: false, error: 'Profile not found' });
  res.json({ success: true, data: toProfileApi(rows[0]) });
}));

app.delete('/api/metric-profiles/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid profile id' });
  const { rowCount } = await pool.query('DELETE FROM metric_profiles WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Profile not found' });
  res.status(204).end();
}));

// Bulk delete for the row checkboxes — one statement, so it is all-or-nothing.
app.post('/api/metric-profiles/bulk-delete', wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null;
  if (!ids || !ids.length || ids.some((n) => !Number.isInteger(n) || n < 1)) {
    return res.status(400).json({ success: false, error: 'Select at least one profile to delete.' });
  }
  const { rowCount } = await pool.query('DELETE FROM metric_profiles WHERE id = ANY($1::bigint[])', [ids]);
  res.json({ success: true, deleted: rowCount });
}));

app.get('/api/leaderboards', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leaderboards ORDER BY id');
  res.json({ success: true, data: rows.map((r) => ({ name: r.name, profile: r.profile_name, period: r.period, participants: r.participants, status: r.status })) });
}));

app.get('/api/badges', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM badges ORDER BY id');
  res.json({ success: true, data: rows.map((r) => ({ name: r.name, criteria: r.criteria, points: r.points, awarded: r.awarded })) });
}));

app.get('/api/challenges', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM challenges ORDER BY id');
  res.json({ success: true, data: rows.map((r) => ({ name: r.name, metric: r.metric, goal: r.goal, duration: r.duration_label, status: r.status })) });
}));

const UNIQUE_NOUN = { recording_policies_name_key: 'policy', calibrations_name_key: 'calibration', management_units_name_key: 'management unit', evaluation_forms_name_key: 'evaluation form', planning_groups_name_key: 'planning group', service_goals_name_key: 'service goal', work_plans_name_key: 'work plan', activity_codes_name_key: 'activity code', metric_profiles_name_key: 'metric profile' };

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === '23505') {
    // Not every unique violation is a duplicate *name* — attaching it to fields.name regardless
    // is what made a "this agent is already on another plan" conflict read as a false name error.
    if (err.constraint === 'work_plan_agents_agent_id_key') {
      return res.status(409).json({ success: false, error: 'Validation failed', fields: { agentIds: 'One of the selected agents was just assigned to another plan — reload and try again.' } });
    }
    const noun = UNIQUE_NOUN[err.constraint] || 'record';
    const article = /^[aeiou]/i.test(noun) ? 'An' : 'A';
    return res.status(409).json({ success: false, error: 'Validation failed', fields: { name: `${article} ${noun} with this name already exists.` } });
  }
  if (err.code === '23514') return res.status(400).json({ success: false, error: 'Validation failed', fields: { name: 'Value rejected by database constraint.' } });
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`WFM setup API listening on http://localhost:${PORT}`));
