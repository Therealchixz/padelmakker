import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDashboardTab,
  parseKampeDetailRoute,
  isKampeDetailRoute,
  buildKampe2v2DetailPath,
  buildKampeLigaDetailPath,
  buildKampeLigaSchedulePath,
  buildKampeLigaTeamPath,
  buildKampeDetailPathFromFormat,
  resolveLegacyKampeFocusRedirect,
  buildKampeListPath,
} from '../../src/lib/kampeDetailRoutes.js';

describe('kampeDetailRoutes', () => {
  it('parseDashboardTab treats nested kampe paths as kampe tab', () => {
    assert.equal(parseDashboardTab('/dashboard/kampe/2v2/abc'), 'kampe');
    assert.equal(parseDashboardTab('/dashboard/hjem'), 'hjem');
    assert.equal(parseDashboardTab('/dashboard/unknown'), 'hjem');
  });

  it('parseKampeDetailRoute reads 2v2, americano and liga ids', () => {
    assert.deepEqual(parseKampeDetailRoute('/dashboard/kampe/2v2/m1'), {
      kind: '2v2',
      format: 'padel',
      id: 'm1',
    });
    assert.deepEqual(parseKampeDetailRoute('/dashboard/kampe/americano/t1'), {
      kind: 'americano',
      format: 'americano',
      id: 't1',
    });
    assert.deepEqual(parseKampeDetailRoute('/dashboard/kampe/liga/l1'), {
      kind: 'liga',
      format: 'liga',
      id: 'l1',
    });
    assert.deepEqual(parseKampeDetailRoute('/dashboard/kampe/liga/l1/schedule'), {
      kind: 'liga',
      format: 'liga',
      id: 'l1',
      sub: 'schedule',
    });
    assert.deepEqual(parseKampeDetailRoute('/dashboard/kampe/liga/l1/hold/t9'), {
      kind: 'liga',
      format: 'liga',
      id: 'l1',
      sub: { team: 't9' },
    });
    assert.equal(parseKampeDetailRoute('/dashboard/kampe'), null);
  });

  it('buildKampeDetailPathFromFormat maps formats', () => {
    assert.equal(buildKampeDetailPathFromFormat('padel', 'x'), '/dashboard/kampe/2v2/x');
    assert.equal(
      buildKampeDetailPathFromFormat('americano', 't', { openChat: true }),
      '/dashboard/kampe/americano/t?chat=1',
    );
    assert.equal(buildKampeLigaDetailPath('l'), '/dashboard/kampe/liga/l');
    assert.equal(buildKampeLigaSchedulePath('l'), '/dashboard/kampe/liga/l/schedule');
    assert.equal(buildKampeLigaTeamPath('l', 't1'), '/dashboard/kampe/liga/l/hold/t1');
  });

  it('resolveLegacyKampeFocusRedirect upgrades old links', () => {
    assert.equal(
      resolveLegacyKampeFocusRedirect('/dashboard/kampe', '?focus=abc', ''),
      '/dashboard/kampe/2v2/abc',
    );
    assert.equal(
      resolveLegacyKampeFocusRedirect('/dashboard/kampe', '?format=americano&focus=t1', ''),
      '/dashboard/kampe/americano/t1',
    );
    assert.equal(
      resolveLegacyKampeFocusRedirect('/dashboard/kampe', '', '#pm-match-xyz'),
      '/dashboard/kampe/2v2/xyz',
    );
    assert.equal(
      resolveLegacyKampeFocusRedirect('/dashboard/kampe', '', '#pm-americano-t9'),
      '/dashboard/kampe/americano/t9',
    );
    assert.equal(
      resolveLegacyKampeFocusRedirect('/dashboard/kampe/2v2/abc', '?focus=other', ''),
      null,
    );
  });

  it('isKampeDetailRoute and buildKampeListPath', () => {
    assert.equal(isKampeDetailRoute('/dashboard/kampe/liga/x'), true);
    assert.equal(isKampeDetailRoute('/dashboard/kampe/liga/x/schedule'), true);
    assert.equal(isKampeDetailRoute('/dashboard/kampe/liga/x/hold/t1'), true);
    assert.equal(isKampeDetailRoute('/dashboard/kampe'), false);
    assert.equal(buildKampeListPath('liga'), '/dashboard/kampe?format=liga');
    assert.equal(buildKampe2v2DetailPath('m'), '/dashboard/kampe/2v2/m');
  });
});
