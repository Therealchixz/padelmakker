import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTTOM_SHEET_CLOSE_THRESHOLD,
  BOTTOM_SHEET_MIN_FLICK_DISMISS_FRACTION,
  getBottomSheetCloseDistanceThresholdPx,
  shouldCloseBottomSheetDrag,
} from '../../src/lib/useBottomSheetDragToClose.js';

const SHEET_H = 500;

test('slow drag: closes at 50% of sheet height', () => {
  const slowMs = 600;
  assert.equal(shouldCloseBottomSheetDrag({ dy: 249, sheetHeightPx: SHEET_H, elapsedMs: slowMs }), false);
  assert.equal(shouldCloseBottomSheetDrag({ dy: 250, sheetHeightPx: SHEET_H, elapsedMs: slowMs }), true);
});

test('fast flick needs at least 15% travel, not just velocity', () => {
  const dy = 40;
  const fastMs = 80;
  assert.ok(dy / fastMs > 0.4);
  assert.ok(dy < SHEET_H * BOTTOM_SHEET_MIN_FLICK_DISMISS_FRACTION);
  assert.equal(shouldCloseBottomSheetDrag({ dy, sheetHeightPx: SHEET_H, elapsedMs: fastMs }), false);
});

test('fast flick closes when distance and velocity both met', () => {
  const dy = 80;
  const fastMs = 80;
  assert.equal(shouldCloseBottomSheetDrag({ dy, sheetHeightPx: SHEET_H, elapsedMs: fastMs }), true);
});

test('small slow drag snaps back', () => {
  assert.equal(shouldCloseBottomSheetDrag({ dy: 40, sheetHeightPx: SHEET_H, elapsedMs: 400 }), false);
});

test('close distance threshold is 50%', () => {
  assert.equal(BOTTOM_SHEET_CLOSE_THRESHOLD, 0.5);
  assert.equal(getBottomSheetCloseDistanceThresholdPx(SHEET_H), 250);
});
