import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export const migration = `
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tokens (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), hash text UNIQUE NOT NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS exercises (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS programmes (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS programme_versions (programme_id uuid NOT NULL REFERENCES programmes(id), version integer NOT NULL, effective_date date NOT NULL, data jsonb NOT NULL, PRIMARY KEY(programme_id, version));
ALTER TABLE programme_versions DROP CONSTRAINT IF EXISTS programme_versions_programme_id_effective_date_key;
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), programme_id uuid NOT NULL REFERENCES programmes(id), programme_version integer NOT NULL, template_id uuid NOT NULL, day date NOT NULL, scheduled_at timestamptz NOT NULL, snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','skipped')), exercise_ids jsonb NOT NULL DEFAULT '[]', completed_at timestamptz, reminder_at timestamptz, UNIQUE(programme_id,template_id,day));
CREATE INDEX IF NOT EXISTS sessions_user_day ON sessions(user_id,day);
CREATE TABLE IF NOT EXISTS completion_events (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), session_id uuid NOT NULL REFERENCES sessions(id), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS assessments (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), programme_id uuid NOT NULL REFERENCES programmes(id));
CREATE TABLE IF NOT EXISTS assessment_versions (assessment_id uuid NOT NULL REFERENCES assessments(id), version integer NOT NULL, data jsonb NOT NULL, PRIMARY KEY(assessment_id,version));
CREATE TABLE IF NOT EXISTS assessment_responses (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), assessment_id uuid NOT NULL REFERENCES assessments(id), day date NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS responses_user_day ON assessment_responses(user_id,day);
`;
export async function migrate() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(8263840)');
    await c.query(migration);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
