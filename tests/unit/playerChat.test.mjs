import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  playerChatPath,
  playerChatSearch,
  playerChatState,
  getCachedChatPartner,
} from '../../src/lib/playerChat.js';

test('playerChatPath og state giver partner-snapshot uden at lukke profil først', () => {
  assert.equal(playerChatSearch('abc'), 'med=abc');
  assert.equal(playerChatPath('abc'), '/dashboard/beskeder?med=abc');
  const state = playerChatState({ id: 'abc', full_name: 'Kevin Jensen', avatar: '🎾' });
  assert.equal(state.chatPartner.full_name, 'Kevin Jensen');
  assert.equal(getCachedChatPartner('abc').full_name, 'Kevin Jensen');
});

test('Send besked fra profil lukker ikke arket før chatten er klar', () => {
  const makkere = readFileSync('src/dashboard/MakkereTab.jsx', 'utf8');
  assert.match(makkere, /openPlayerChat\(navigate, viewPlayer\)/);
  assert.doesNotMatch(makkere, /setViewPlayer\(null\);\s*navigate\(`\/dashboard\/beskeder/);

  const home = readFileSync('src/dashboard/HomeTab.jsx', 'utf8');
  assert.doesNotMatch(home, /setViewPlayer\(null\);\s*setTab\("beskeder"/);

  const kampe = readFileSync('src/dashboard/KampeTab.jsx', 'utf8');
  assert.match(kampe, /openPlayerChat\(navigate, viewPlayer\)/);
  assert.doesNotMatch(kampe, /setViewPlayer\(null\);\s*navigate\(`\/dashboard\/beskeder/);

  const liga = readFileSync('src/dashboard/LigaTab.jsx', 'utf8');
  assert.match(liga, /openPlayerChat\(navigate, viewPlayer\)/);

  const play = readFileSync('src/components/PlayIntentPanel.jsx', 'utf8');
  assert.doesNotMatch(play, /setViewPlayer\(null\);\s*onMessagePlayer/);

  const chatList = readFileSync('src/components/chat/ChatMessageList.jsx', 'utf8');
  assert.match(chatList, /loading && messages\.length === 0/);

  const besked = readFileSync('src/dashboard/BeskedTab.jsx', 'utf8');
  assert.match(besked, /cachedDmMessages/);
  assert.match(besked, /if \(!hasCachedThread\)/);
  assert.doesNotMatch(besked, /setPartnerProfile\(null\)/);
});
