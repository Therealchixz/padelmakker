import test from "node:test";
import assert from "node:assert/strict";
import { resolveNotificationPushPolicy } from "../../src/lib/notificationPolicy.js";

test("critical notification types stay loud and high priority", () => {
  const policy = resolveNotificationPushPolicy("match_invite");
  assert.equal(policy.type, "match_invite");
  assert.equal(policy.level, "critical");
  assert.equal(policy.sendPush, true);
  assert.equal(policy.silent, false);
  assert.equal(policy.urgency, "high");
});

test("quiet notification types are in-app only", () => {
  const policy = resolveNotificationPushPolicy("elo_change");
  assert.equal(policy.level, "quiet");
  assert.equal(policy.sendPush, false);
  assert.equal(policy.silent, true);
  assert.equal(policy.cooldownSeconds, 0);
});

test("chat notifications are grouped and throttled", () => {
  const policy = resolveNotificationPushPolicy("match_chat");
  assert.equal(policy.channel, "chat");
  assert.equal(policy.aggregate, true);
  assert.equal(policy.cooldownSeconds, 90);
  assert.equal(policy.silent, true);
});

test("unknown notification type falls back to safe defaults", () => {
  const policy = resolveNotificationPushPolicy("something_new");
  assert.equal(policy.level, "normal");
  assert.equal(policy.sendPush, true);
  assert.equal(policy.silent, true);
  assert.equal(policy.channel, "system");
});

test("override can disable push and cooldown is clamped", () => {
  const policy = resolveNotificationPushPolicy("match_join", {
    sendPush: false,
    cooldownSeconds: 99999,
  });
  assert.equal(policy.sendPush, false);
  assert.equal(policy.silent, true);
  assert.equal(policy.cooldownSeconds, 3600);
});
