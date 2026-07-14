import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePostgrestIlikePattern, buildProfileNameSearchOrFilter } from '../../src/lib/postgrestFilterUtils.js';
import { safeHttpUrl } from '../../src/lib/safeUrl.js';
import { mapJoinMatchError } from '../../src/lib/matchJoinUtils.js';

test('sanitizePostgrestIlikePattern strips filter-breaking characters', () => {
  assert.equal(sanitizePostgrestIlikePattern('  foo,bar(baz)%  '), 'foo bar baz');
});

test('buildProfileNameSearchOrFilter returns null for short queries', () => {
  assert.equal(buildProfileNameSearchOrFilter('a'), null);
});

test('buildProfileNameSearchOrFilter builds safe ilike or filter', () => {
  assert.equal(
    buildProfileNameSearchOrFilter('Anna'),
    'full_name.ilike.%Anna%,name.ilike.%Anna%',
  );
});

test('safeHttpUrl allows http/https only', () => {
  assert.equal(safeHttpUrl('https://example.com/book'), 'https://example.com/book');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('ftp://files.example.com'), null);
});

test('mapJoinMatchError maps server error codes to Danish messages', () => {
  assert.match(mapJoinMatchError({ success: false, error: 'match_closed' }), /godkendelse/);
  assert.match(mapJoinMatchError({ success: false, error: 'team_full', team: 1 }), /Hold 1/);
});
