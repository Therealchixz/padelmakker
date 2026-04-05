import { supabase } from '../lib/supabase'

/**
 * Creates a Supabase-backed entity with standard CRUD methods.
 * All methods include error handling and input validation.
 */
function createEntity(tableName) {
  return {
    /**
     * Fetch rows, optionally filtered by key-value query.
     * Returns empty array on error (never throws for list operations).
     */
    async filter(query = {}) {
      try {
        let q = supabase.from(tableName).select('*')
        if (query && Object.keys(query).length > 0) {
          q = q.match(query)
        }
        const { data, error } = await q
        if (error) {
          console.error(`[DB] ${tableName}.filter error:`, error.message)
          return []
        }
        return data || []
      } catch (e) {
        console.error(`[DB] ${tableName}.filter exception:`, e.message)
        return []
      }
    },

    /**
     * Get a single row by id.
     * Returns null on error.
     */
    async get(id) {
      if (!id) {
        console.warn(`[DB] ${tableName}.get called without id`)
        return null
      }
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error) {
          console.error(`[DB] ${tableName}.get error:`, error.message)
          return null
        }
        return data
      } catch (e) {
        console.error(`[DB] ${tableName}.get exception:`, e.message)
        return null
      }
    },

    /**
     * Create a new row. Returns the created row.
     * Throws on error (callers should catch and show user-facing message).
     */
    async create(rowData) {
      if (!rowData || typeof rowData !== 'object') {
        throw new Error('Ugyldig data')
      }
      // Remove undefined values to prevent Supabase errors
      const cleanData = Object.fromEntries(
        Object.entries(rowData).filter(([, v]) => v !== undefined)
      )
      const { data, error } = await supabase
        .from(tableName)
        .insert(cleanData)
        .select()
        .single()
      if (error) {
        console.error(`[DB] ${tableName}.create error:`, error.message, error.details)
        throw new Error(error.message)
      }
      return data
    },

    /**
     * Update a row by id. Returns the updated row.
     * Throws on error.
     */
    async update(id, rowData) {
      if (!id) throw new Error('Mangler id til opdatering')
      if (!rowData || typeof rowData !== 'object') {
        throw new Error('Ugyldig data')
      }
      // Remove undefined values and prevent overwriting id
      const { id: _, ...rest } = rowData
      const cleanData = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      )
      const { data, error } = await supabase
        .from(tableName)
        .update(cleanData)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        console.error(`[DB] ${tableName}.update error:`, error.message)
        throw new Error(error.message)
      }
      return data
    },

    /**
     * Delete a row by id.
     * Throws on error.
     */
    async delete(id) {
      if (!id) throw new Error('Mangler id til sletning')
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
      if (error) {
        console.error(`[DB] ${tableName}.delete error:`, error.message)
        throw new Error(error.message)
      }
    },
  }
}

// Entity exports matching the database tables
export const Profile = createEntity('profiles')
export const Court = createEntity('courts')
export const CourtSlot = createEntity('court_slots')
export const Match = createEntity('matches')
export const MatchResult = createEntity('match_results')
export const EloHistory = createEntity('elo_history')
export const Message = createEntity('messages')
export const Booking = createEntity('bookings')

// Convenience object for dynamic access
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
