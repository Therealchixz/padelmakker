export async function fetchRowsInChunks(
  supabaseClient,
  table,
  column,
  ids,
  select = '*',
  chunkSize = 100,
) {
  if (!ids?.length) return [];

  const rows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await supabaseClient.from(table).select(select).in(column, slice);
    if (error) throw error;
    rows.push(...(data || []));
  }

  return rows;
}
