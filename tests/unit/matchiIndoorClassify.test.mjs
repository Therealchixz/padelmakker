import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMatchiPadelFacility,
  matchiPadelIsPrimarilyIndoor,
} from '../../scripts/lib/matchiIndoorClassify.js';

test('classifyMatchiPadelFacility detects indoor/outdoor/both', () => {
  assert.equal(
    classifyMatchiPadelFacility('Padel INDOORS Artificial grass (4 pcs)'),
    'indoor'
  );
  assert.equal(classifyMatchiPadelFacility('Padel OUTDOORS Other (1pcs)'), 'outdoor');
  assert.equal(
    classifyMatchiPadelFacility('Padel INDOORS (4 pcs) Padel OUTDOORS (1pcs)'),
    'both'
  );
});

test('matchiPadelIsPrimarilyIndoor prefers flest indendørs baner', () => {
  const skagen =
    'Padel INDOORS Artificial grass (4 pcs) Padel OUTDOORS Other (1pcs)';
  assert.equal(matchiPadelIsPrimarilyIndoor(skagen), true);
  assert.equal(matchiPadelIsPrimarilyIndoor('Padel OUTDOORS Other (2pcs)'), false);
});
