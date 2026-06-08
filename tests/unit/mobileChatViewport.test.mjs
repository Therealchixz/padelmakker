import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureMobileChatViewportSnapshot,
  clearMobileChatViewportCssVars,
  restoreMobileChatViewportSnapshot,
} from '../../src/lib/mobileChatViewport.js';

test('captureMobileChatViewportSnapshot and restore round-trip inline styles', () => {
  const root = {
    style: {
      background: 'red',
      removeProperty(name) {
        delete this[name];
      },
    },
  };
  const body = {
    style: {
      position: 'relative',
      top: '12px',
      left: '',
      right: '',
      width: '100%',
      overflow: 'auto',
      background: 'blue',
    },
  };

  const snapshot = captureMobileChatViewportSnapshot(root, body);
  body.style.position = 'fixed';
  body.style.top = '0';
  root.style.background = 'white';

  restoreMobileChatViewportSnapshot(snapshot, root, body);

  assert.equal(body.style.position, 'relative');
  assert.equal(body.style.top, '12px');
  assert.equal(root.style.background, 'red');
  assert.equal(root.style['--vvh'], undefined);
});

test('clearMobileChatViewportCssVars removes chat viewport variables', () => {
  const root = {
    style: {
      '--vvh': '640px',
      '--vv-top': '0px',
      '--vvs': '34px',
      removeProperty(name) {
        delete this[name];
      },
    },
  };

  clearMobileChatViewportCssVars(root);

  assert.equal(root.style['--vvh'], undefined);
  assert.equal(root.style['--vv-top'], undefined);
  assert.equal(root.style['--vvs'], undefined);
});
