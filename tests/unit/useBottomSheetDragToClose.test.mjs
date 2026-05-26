import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTTOM_SHEET_CLOSE_THRESHOLD,
  BOTTOM_SHEET_VELOCITY_THRESHOLD_PX_PER_MS,
  getBottomSheetCloseDistanceThresholdPx,
  shouldCloseBottomSheetDrag,
} from '../../src/lib/useBottomSheetDragToClose.js';

const SHEET_H = 500;

test('uses Vaul defaults (0.25 distance, 0.4 px/ms velocity)', () => {
  assert.equal(BOTTOM_SHEET_CLOSE_THRESHOLD, 0.25);
  assert.equal(BOTTOM_SHEET_VELOCITY_THRESHOLD_PX_PER_MS, 0.4);
  assert.equal(getBottomSheetCloseDistanceThresholdPx(SHEET_H), 125);
});

test('slow drag: closes at 25% of sheet height (Vaul closeThreshold)', () => {
  const slowMs = 600;
  assert.equal(shouldCloseBottomSheetDrag({ dy: 124, sheetHeightPx: SHEET_H, elapsedMs: slowMs }), false);
  assert.equal(shouldCloseBottomSheetDrag({ dy: 125, sheetHeightPx: SHEET_H, elapsedMs: slowMs }), true);
});

test('fast flick: closes below 25% when velocity > 0.4 px/ms (Vaul)', () => {
  const dy = 40;
  const fastMs = 80;
  assert.equal(dy / fastMs, 0.5);
  assert.ok(dy / fastMs > BOTTOM_SHEET_VELOCITY_THRESHOLD_PX_PER_MS);
  assert.equal(shouldCloseBottomSheetDrag({ dy, sheetHeightPx: SHEET_H, elapsedMs: fastMs }), true);
});

test('small slow drag snaps back', () => {
  assert.equal(shouldCloseBottomSheetDrag({ dy: 40, sheetHeightPx: SHEET_H, elapsedMs: 400 }), false);
});
