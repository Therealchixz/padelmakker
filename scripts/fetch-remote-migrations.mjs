/**
 * Print remote schema_migrations as JSON for updating sync-remote-migration-stubs.mjs
 *   SUPABASE_ACCESS_TOKEN=... node scripts/fetch-remote-migrations.mjs
 */
const projectRef = process.env.SUPABASE_PROJECT_REF || 'hzmrsqrerkoftcppfklu';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);

if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const rows = Array.isArray(data) ? data : data.migrations || [];
console.log(JSON.stringify(rows, null, 2));
