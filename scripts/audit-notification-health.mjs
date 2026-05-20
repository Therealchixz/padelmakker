#!/usr/bin/env node
/**
 * Statisk sundhedstjek for notifikationer / RPC / push.
 * Kør: node scripts/audit-notification-health.mjs
 * Exit 1 ved fund (egnet til CI).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.sql')) acc.push(p);
  }
  return acc;
}

function extractCreateFunctions(sql, file) {
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)\s*\(([^)]*)\)/gi;
  const out = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    const args = m[2]
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    out.push({ name: m[1], args, file });
  }
  return out;
}

// 1) Duplicate RPC signatures in supabase/
const byName = new Map();
for (const file of walk(join(root, 'supabase'))) {
  const rel = file.slice(root.length + 1);
  for (const fn of extractCreateFunctions(read(rel), rel)) {
    const key = fn.name;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(fn);
  }
}

function isLegacyNotificationSig(args) {
  return !args.includes('p_entity_type') && !args.includes('p_entity_id');
}

for (const [name, defs] of byName) {
  if (!name.startsWith('create_notification')) continue;
  const legacy = defs.filter((d) => isLegacyNotificationSig(d.args));
  const modern = defs.filter((d) => !isLegacyNotificationSig(d.args));
  if (legacy.length > 0 && modern.length > 0) {
    issues.push({
      severity: 'high',
      code: 'RPC_OVERLOAD',
      message: `${name}: legacy 5-param SQL coexists with 7-param migrations (risk if old scripts re-run)`,
      detail: [
        'Legacy:',
        ...legacy.map((d) => `  - ${d.file}`),
        'Modern:',
        ...modern.slice(0, 4).map((d) => `  - ${d.file}`),
        modern.length > 4 ? `  - … +${modern.length - 4} more` : '',
      ].join('\n'),
    });
  }
}

// 2) DROP migration present
const dropMigration = read('supabase/migrations/20260521130000_drop_duplicate_notification_rpc_overloads.sql');
if (!dropMigration.includes('DROP FUNCTION IF EXISTS public.create_notification_for_user')) {
  issues.push({
    severity: 'high',
    code: 'MISSING_DROP_MIGRATION',
    message: 'Migration to drop duplicate notification RPC overloads is missing or incomplete',
  });
}

// 3) Client always sends entity RPC args
const notifJs = read('src/lib/notifications.js');
if (notifJs.includes('if (!entityType || !entityId) return {}')) {
  issues.push({
    severity: 'high',
    code: 'ENTITY_ARGS_OMITTED',
    message: 'notifications.js may omit p_entity_type/p_entity_id (Postgres overload ambiguity)',
  });
}
if (!notifJs.includes('p_entity_type: entityType')) {
  issues.push({
    severity: 'high',
    code: 'ENTITY_ARGS_MISSING',
    message: 'notifications.js does not always pass p_entity_type',
  });
}

// 4) Policy parity client vs send-push
function policyKeys(src, blockName) {
  const start = src.indexOf(blockName);
  if (start < 0) return [];
  const slice = src.slice(start, start + 12000);
  return [...slice.matchAll(/^\s+([a-z_]+):\s*\{/gm)].map((m) => m[1]);
}

const clientKeys = new Set(policyKeys(read('src/lib/notificationPolicy.js'), 'const TYPE_POLICIES'));
const serverKeys = new Set(policyKeys(read('supabase/functions/send-push/index.ts'), 'PUSH_POLICY_BY_TYPE'));
const critical = [
  'match_invite', 'americano_invite', 'seeking_player', 'result_error_report', 'user_report', 'system_flag',
];
for (const t of critical) {
  if (!clientKeys.has(t)) {
    issues.push({ severity: 'medium', code: 'POLICY_CLIENT', message: `Client policy missing type: ${t}` });
  }
  if (!serverKeys.has(t)) {
    issues.push({ severity: 'medium', code: 'POLICY_SERVER', message: `send-push policy missing type: ${t}` });
  }
}
for (const k of clientKeys) {
  if (!serverKeys.has(k)) {
    issues.push({ severity: 'low', code: 'POLICY_DRIFT', message: `Type only in client policy: ${k}` });
  }
}
for (const k of serverKeys) {
  if (!clientKeys.has(k)) {
    issues.push({ severity: 'low', code: 'POLICY_DRIFT', message: `Type only in send-push policy: ${k}` });
  }
}

// 5) KampeTab known footguns
const kampe = read('src/dashboard/KampeTab.jsx');
const kickBlock = kampe.slice(kampe.indexOf('const kickPlayer'), kampe.indexOf('const startMatch'));
const kickNotifyAt = kickBlock.indexOf('createNotification');
const kickDeleteAt = kickBlock.indexOf('.from("match_players").delete');
if (kickNotifyAt >= 0 && kickDeleteAt >= 0 && kickNotifyAt > kickDeleteAt) {
  issues.push({
    severity: 'high',
    code: 'KICK_NOTIFY_ORDER',
    message: 'kickPlayer notifies after DELETE (RPC may fail)',
  });
}
if (kampe.includes('Anmodning afvist') && kampe.includes("'match_cancelled'")) {
  const rejectBlock = kampe.slice(kampe.indexOf('rejectJoinRequest'));
  if (rejectBlock.slice(0, 800).includes('match_cancelled')) {
    issues.push({
      severity: 'medium',
      code: 'REJECT_WRONG_TYPE',
      message: 'rejectJoinRequest uses match_cancelled for user not in match (RPC may fail)',
    });
  }
}
const unawaited = (kampe.match(/createNotification\(/g) || []).length;
const awaited = (kampe.match(/await createNotification\(/g) || []).length;
if (unawaited > awaited) {
  issues.push({
    severity: 'medium',
    code: 'UNAWAITED_NOTIFY',
    message: `KampeTab has ${unawaited - awaited} createNotification call(s) without await`,
  });
}

// 6) Deprecated SQL scripts without warning
for (const rel of [
  'supabase/sql/create_notification_rpc.sql',
  'supabase/sql/create_notifications_batch_rpc.sql',
  'supabase/sql/liga_invite_notification_rpc.sql',
]) {
  try {
    const body = read(rel);
    if (!body.includes('DEPRECATED') && !body.includes('DO NOT RUN')) {
      issues.push({
        severity: 'medium',
        code: 'DEPRECATED_SQL',
        message: `${rel} has no DEPRECATED warning (risk of re-creating overloads)`,
      });
    }
  } catch {
    /* ignore */
  }
}

// Report
console.log('# Notification health audit\n');
if (issues.length === 0) {
  console.log('No issues found.\n');
  process.exit(0);
}

const order = { high: 0, medium: 1, low: 2 };
issues.sort((a, b) => order[a.severity] - order[b.severity]);

for (const i of issues) {
  console.log(`## [${i.severity.toUpperCase()}] ${i.code}`);
  console.log(i.message);
  if (i.detail) console.log(i.detail);
  console.log('');
}

console.log(`Total: ${issues.length} issue(s)\n`);
process.exit(issues.some((x) => x.severity === 'high') ? 1 : 0);
