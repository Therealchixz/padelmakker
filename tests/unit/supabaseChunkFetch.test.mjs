import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchRowsInChunks } from '../../src/lib/supabaseChunkFetch.js';

function createSupabaseMock(rowsByChunk = []) {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        return {
          select(select) {
            return {
              async in(column, ids) {
                calls.push({ table, select, column, ids });
                const result = rowsByChunk[calls.length - 1] || { data: [], error: null };
                return result;
              },
            };
          },
        };
      },
    },
  };
}

test('fetchRowsInChunks returns no rows without querying when ids are empty', async () => {
  const mock = createSupabaseMock();
  const rows = await fetchRowsInChunks(mock.client, 'matches', 'id', []);

  assert.deepEqual(rows, []);
  assert.deepEqual(mock.calls, []);
});

test('fetchRowsInChunks splits ids and preserves returned row order', async () => {
  const mock = createSupabaseMock([
    { data: [{ id: 1 }, { id: 2 }], error: null },
    { data: [{ id: 3 }], error: null },
  ]);

  const rows = await fetchRowsInChunks(mock.client, 'matches', 'id', ['a', 'b', 'c'], 'id,status', 2);

  assert.deepEqual(rows, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(mock.calls, [
    { table: 'matches', select: 'id,status', column: 'id', ids: ['a', 'b'] },
    { table: 'matches', select: 'id,status', column: 'id', ids: ['c'] },
  ]);
});

test('fetchRowsInChunks throws the Supabase error from the failing chunk', async () => {
  const error = new Error('database said no');
  const mock = createSupabaseMock([{ data: null, error }]);

  await assert.rejects(
    () => fetchRowsInChunks(mock.client, 'match_players', 'match_id', ['m1']),
    /database said no/,
  );
});
