import { supabase } from '../lib/supabase'
import { normalizeProfileRow } from '../lib/profileUtils'

/**
 * Creates a Supabase-backed entity with standard CRUD methods.
 * Each entity maps to a Supabase table.
 */
function createEntity(tableName, opts = {}) {
  const norm = opts.normalizeRow
  const mapRow = (row) => (row && norm ? norm(row) : row)
  const mapData = (data) => {
    if (data == null) return data
    if (Array.isArray(data)) return data.map(mapRow)
    return mapRow(data)
  }
  return {
    /**
     * Filter rows by query object (key-value pairs for exact match).
     * Usage: Entity.filter({ status: 'active' })
     * Pass no args or empty object to fetch all rows.
     */
    async filter(query = {}) {
      let q = supabase.from(tableName).select('*')
      if (query && Object.keys(query).length > 0) {
        q = q.match(query)
      }
      const { data, error } = await q
      if (error) throw error
      return mapData(data)
    },

    /**
     * Get a single row by id.
     */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return mapData(data)
    },

    /**
     * Create a new row. Returns the created row.
     */
    async create(rowData) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(rowData)
        .select()
        .single()
      if (error) throw error
      return mapData(data)
    },

    /**
     * Update a row by id. Returns the updated row.
     */
    async update(id, rowData) {
      const { data, error } = await supabase
        .from(tableName)
        .update(rowData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return mapData(data)
    },

    /**
     * Delete a row by id.
     */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
  }
}

// Entity exports matching the database tables
export const Profile = createEntity('profiles', { normalizeRow: normalizeProfileRow })
export const Court = createEntity('courts')
export const CourtSlot = createEntity('court_slots')
export const Match = createEntity('matches')
export const MatchResult = createEntity('match_results')
export const EloHistory = createEntity('elo_history')
export const Message = createEntity('messages')
export const Booking = createEntity('bookings')

// Also export a convenience object for dynamic access by table name
export const db = {
  profiles: Profile,
  courts: Court,
  court_slots: CourtSlot,
  matches: Match,
  match_results: MatchResult,
  elo_history: EloHistory,
  messages: Message,
  bookings: Booking,
}
