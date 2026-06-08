import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindMobileChatViewportSync,
  captureMobileChatViewportSnapshot,
  clearMobileChatViewportCssVars,
  MOBILE_CHAT_KEYBOARD_VV_HEIGHT,
  nudgeMobileChatViewportAfterKeyboard,
  restoreMobileChatViewportSnapshot,
  syncMobileChatViewportVars,
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

test('syncMobileChatViewportVars sætter --vvh og --vvs efter ios-chat-mønster', () => {
  const root = {
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
  };
  const vv = { height: 800, offsetTop: 12 };

  syncMobileChatViewportVars(root, vv);

  assert.equal(root.style['--vvh'], '800px');
  assert.equal(root.style['--vv-top'], '12px');
  assert.equal(root.style['--vvs'], 'env(safe-area-inset-bottom)');

  syncMobileChatViewportVars(root, { height: MOBILE_CHAT_KEYBOARD_VV_HEIGHT - 1, offsetTop: 44 });
  assert.equal(root.style['--vvs'], '0px');
});

test('bindMobileChatViewportSync opdaterer variabler og kan frigives', () => {
  const listeners = new Map();
  const root = {
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      },
    },
  };
  const vv = {
    height: 700,
    offsetTop: 0,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  globalThis.window = {
    visualViewport: vv,
    scrollTo: () => {},
  };

  const unbind = bindMobileChatViewportSync(root);
  assert.equal(root.style['--vvh'], '700px');

  vv.height = 500;
  listeners.get('resize')?.();
  assert.equal(root.style['--vvs'], '0px');

  unbind();
  assert.equal(root.style['--vvh'], undefined);

  delete globalThis.window;
});

test('bindMobileChatViewportSync bruger reference-tælling ved hurtig genåbning', () => {
  const listeners = new Map();
  const root = {
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      },
    },
  };
  const vv = {
    height: 700,
    offsetTop: 0,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  globalThis.window = {
    visualViewport: vv,
    scrollTo: () => {},
  };

  const unbindA = bindMobileChatViewportSync(root);
  const unbindB = bindMobileChatViewportSync(root);
  assert.equal(listeners.has('resize'), true);

  unbindA();
  assert.equal(root.style['--vvh'], '700px');

  unbindB();
  assert.equal(root.style['--vvh'], undefined);

  delete globalThis.window;
});

test('nudgeMobileChatViewportAfterKeyboard gensynkroniserer efter tastatur lukkes', () => {
  const root = {
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
  };
  const scrollCalls = [];
  globalThis.requestAnimationFrame = (fn) => fn();
  globalThis.window = {
    scrollTo: (...args) => scrollCalls.push(args),
    visualViewport: { height: 820, offsetTop: 0 },
    setTimeout: (fn) => fn(),
  };

  nudgeMobileChatViewportAfterKeyboard(root);
  assert.equal(root.style['--vvh'], '820px');
  assert.ok(scrollCalls.length >= 1);

  delete globalThis.window;
});
