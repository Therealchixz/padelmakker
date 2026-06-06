const PUSH_LEVELS = new Set(["critical", "normal", "quiet"]);
const PUSH_URGENCIES = new Set(["high", "normal", "low", "very-low"]);

const DEFAULT_POLICY = Object.freeze({
  channel: "system",
  level: "normal",
  sendPush: true,
  silent: true,
  urgency: "normal",
  cooldownSeconds: 30,
  aggregate: false,
  renotify: false,
});

const TYPE_POLICIES = Object.freeze({
  match_reminder: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 300,
  },
  tournament_reminder: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 300,
  },
  result_nudge: {
    channel: "resultat",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "low",
    cooldownSeconds: 300,
  },
  match_cancelled: {
    channel: "kampe",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 20,
    renotify: true,
  },
  result_submitted: {
    channel: "resultat",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 20,
    renotify: true,
  },
  match_invite: {
    channel: "invitation",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 30,
    renotify: true,
  },
  americano_invite: {
    channel: "invitation",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 30,
    renotify: true,
  },
  result_confirmed: {
    channel: "resultat",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 45,
  },
  match_join: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 45,
  },
  match_full: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  match_chat: {
    channel: "chat",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 90,
    aggregate: true,
  },
  seeking_player: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "low",
    cooldownSeconds: 300,
  },
  match_watch_match: {
    channel: "opdagelse",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "low",
    cooldownSeconds: 7200,
  },
  makker_suggestion: {
    channel: "opdagelse",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "low",
    cooldownSeconds: 7200,
  },
  team_invite: {
    channel: "liga",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 60,
    renotify: true,
  },
  team_invite_accepted: {
    channel: "liga",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 90,
  },
  team_invite_declined: {
    channel: "liga",
    level: "normal",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 120,
  },
  americano_started: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 120,
  },
  league_started: {
    channel: "liga",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 120,
  },
  americano_spot_open: {
    channel: "kampe",
    level: "normal",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 300,
  },
  americano_full: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  americano_completed: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  league_full: {
    channel: "liga",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  league_completed: {
    channel: "liga",
    level: "normal",
    sendPush: true,
    silent: false,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  elo_change: {
    channel: "elo",
    level: "quiet",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 0,
  },
  welcome: {
    channel: "system",
    level: "quiet",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 0,
  },
  system_flag: {
    channel: "admin",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 45,
    renotify: true,
  },
  result_error_report: {
    channel: "admin",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 30,
    renotify: true,
  },
  user_report: {
    channel: "admin",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 30,
    renotify: true,
  },
});

function normalizeType(type) {
  return String(type || "").trim().toLowerCase();
}

function sanitizeCooldownSeconds(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(3600, Math.round(n)));
}

export function resolveNotificationPushPolicy(type, override = null) {
  const normalizedType = normalizeType(type);
  const base = TYPE_POLICIES[normalizedType] || {};
  const merged = {
    ...DEFAULT_POLICY,
    ...base,
    ...(override && typeof override === "object" ? override : {}),
  };

  const level = PUSH_LEVELS.has(merged.level) ? merged.level : DEFAULT_POLICY.level;
  const urgency = PUSH_URGENCIES.has(merged.urgency) ? merged.urgency : DEFAULT_POLICY.urgency;
  const sendPush = Boolean(merged.sendPush);
  const silent = sendPush ? Boolean(merged.silent) : true;

  return {
    type: normalizedType || "unknown",
    channel: String(merged.channel || DEFAULT_POLICY.channel),
    level,
    sendPush,
    silent,
    urgency,
    cooldownSeconds: sanitizeCooldownSeconds(merged.cooldownSeconds, DEFAULT_POLICY.cooldownSeconds),
    aggregate: Boolean(merged.aggregate),
    renotify: Boolean(merged.renotify),
  };
}
