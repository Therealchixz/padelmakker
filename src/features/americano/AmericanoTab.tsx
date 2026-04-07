import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Court } from '../../api/base44Client'
import { CreateAmericanoTournamentForm } from './CreateAmericanoTournamentForm'
import { AmericanoResultsPanel } from './AmericanoResultsPanel'
import { buildAmericano578MatchRows, canStartAmericano5767 } from './schedule578'
import { buildAmericano8MatchRows } from './schedule8'
import type { AmericanoTournament, AmericanoParticipant } from './types'

const font = "'Inter', sans-serif"

type ProfileLike = {
  id: string
  full_name?: string | null
  name?: string | null
  email?: string | null
}

type Props = {
  profile?: ProfileLike | null
  showToast: (msg: string) => void
}

function resolveName(p: ProfileLike | null | undefined, authEmail?: string | null) {
  if (!p) {
    if (authEmail) return authEmail.split('@')[0]
    return 'Spiller'
  }
  const n = (p.full_name || p.name || '').trim()
  if (n) return n
  if (authEmail) return authEmail.split('@')[0]
  return 'Spiller'
}

export function AmericanoTab({ profile, showToast }: Props) {
  const { user: authUser, refreshProfileQuiet } = useAuth()
  const authEmail =
    authUser && typeof authUser === 'object' && 'email' in authUser
      ? String((authUser as { email?: string }).email || '')
      : ''
  const authUserId =
    authUser && typeof authUser === 'object' && 'id' in authUser
      ? String((authUser as { id?: string }).id || '')
      : ''
  const profileId = profile?.id ?? authUserId
  const displayName = resolveName(profile, authEmail || null)
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([])
  const [rows, setRows] = useState<AmericanoTournament[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!profileId) {
        setCourts([])
        setRows([])
        setJoinedIds(new Set())
        return
      }
      const [cd, trRes, myRes] = await Promise.all([
        Court.filter(),
        supabase.from('americano_tournaments').select('*').order('tournament_date', { ascending: false }).limit(40),
        supabase.from('americano_participants').select('tournament_id').eq('user_id', profileId),
      ])
      setCourts(
        (cd || []).map((c: { id: string; name?: string | null }) => ({
          id: c.id,
          name: c.name || 'Bane',
        }))
      )
      if (trRes.error) {
        console.warn('americano_tournaments:', trRes.error.message)
        setRows([])
      } else {
        setRows((trRes.data || []) as AmericanoTournament[])
      }
      if (!myRes.error && myRes.data) {
        setJoinedIds(new Set(myRes.data.map((r: { tournament_id: string }) => r.tournament_id)))
      } else {
        setJoinedIds(new Set())
      }
    } catch (e) {
      console.warn(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

  const startTournament = async (t: AmericanoTournament) => {
    if (String(t.creator_id) !== String(profileId)) {
      showToast('Kun opretteren kan starte turneringen.')
      return
    }
    setBusyId(t.id)
    try {
      const { data: parts, error: pErr } = await supabase
        .from('americano_participants')
        .select('id, joined_at')
        .eq('tournament_id', t.id)
        .order('joined_at', { ascending: true })
      if (pErr) throw pErr
      const list = (parts || []) as Pick<AmericanoParticipant, 'id' | 'joined_at'>[]
      const slots = Number(t.player_slots)
      const n = list.length
      let matchRows
      if (canStartAmericano5767(n, slots)) {
        matchRows = buildAmericano578MatchRows(t.id, list.map((p) => p.id))
      } else if (slots === 8 && n === 8) {
        // Gamle turneringer oprettet med 8 pladser (før skift til 5–7)
        matchRows = buildAmericano8MatchRows(t.id, list.map((p) => p.id))
      } else {
        showToast(
          slots === 8
            ? `Denne turnering kræver præcis 8 tilmeldte (gammel type). Nu: ${n}.`
            : `Du skal have præcis ${slots} tilmeldte for at starte. Nu: ${n}.`
        )
        return
      }

      await supabase.from('americano_matches').delete().eq('tournament_id', t.id)

      const { error: mErr } = await supabase.from('americano_matches').insert(matchRows)
      if (mErr) throw mErr

      const { error: uErr } = await supabase
        .from('americano_tournaments')
        .update({ status: 'playing', updated_at: new Date().toISOString() })
        .eq('id', t.id)
      if (uErr) throw uErr

      showToast('Turnering startet — runder genereret.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke starte: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  const joinTournament = async (tournamentId: string, maxSlots: number) => {
    setBusyId(tournamentId)
    try {
      const { count, error: cErr } = await supabase
        .from('americano_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
      if (cErr) throw cErr
      if ((count ?? 0) >= maxSlots) {
        showToast('Turneringen er fuld.')
        return
      }
      const { error } = await supabase.from('americano_participants').insert({
        tournament_id: tournamentId,
        user_id: profileId,
        display_name: displayName,
      })
      if (error) throw error
      showToast('Du er tilmeldt!')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke tilmelde: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  const leaveTournament = async (tournamentId: string) => {
    setBusyId(tournamentId)
    try {
      const { error } = await supabase
        .from('americano_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', profileId)
      if (error) throw error
      showToast('Du er afmeldt.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke afmelde: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#8494A7', fontSize: 14, fontFamily: font }}>
        Indlæser Americano…
      </div>
    )
  }

  if (!profileId) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#8494A7', fontSize: 14, fontFamily: font }}>
        Du skal være logget ind for at bruge Americano.
      </div>
    )
  }

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 24px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          Americano
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate((s) => !s)}
          style={{
            fontFamily: font,
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: '#1D4ED8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {showCreate ? 'Annullér' : '+ Opret turnering'}
        </button>
      </div>

      {showCreate && (
        <div style={{ marginBottom: 24 }}>
          <CreateAmericanoTournamentForm
            userId={profileId}
            displayName={displayName}
            courts={courts}
            onCreated={async () => {
              setShowCreate(false)
              showToast('Americano oprettet — del link eller invitér spillere.')
              await load()
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      <p style={{ fontSize: 13, color: '#3E4C63', marginBottom: 16, lineHeight: 1.5 }}>
        <strong>Americano bruger ikke ELO.</strong> Kampe tæller kun i separat V/T på profilen (som i apps som Padelboard — turnering og stilling for sig selv).
        Makkere og modstandere roterer hver runde. Valget 16/24/32 er <strong>spilformat på banen</strong> (typisk først til det tal); når kampen er slut, indtastes den{' '}
        <strong>faktiske stilling</strong> (fx 10–6) — hvert rally tæller ét point til holdet, og hver spiller får sine holdpoint med i turneringssummen.
      </p>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8494A7', fontSize: 14 }}>
          Ingen Americano-turneringer endnu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((t) => {
            const isCreator = String(t.creator_id) === String(profileId)
            const joined = joinedIds.has(t.id)
            return (
            <div
              key={t.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 18,
                border: '1px solid #D5DDE8',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#3E4C63' }}>
                {t.tournament_date} · {t.time_slot} · {t.player_slots} spillere · {t.points_per_match} point ·{' '}
                <span style={{ textTransform: 'capitalize' }}>{t.status}</span>
              </div>
              {t.description && (
                <div style={{ fontSize: 12, color: '#8494A7', marginTop: 8, fontStyle: 'italic' }}>{t.description}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {t.status === 'registration' && !joined && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => joinTournament(t.id, t.player_slots)}
                    style={{
                      fontFamily: font,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#1D4ED8',
                      color: '#fff',
                      cursor: busyId === t.id ? 'wait' : 'pointer',
                    }}
                  >
                    Tilmeld
                  </button>
                )}
                {t.status === 'registration' && joined && !isCreator && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => leaveTournament(t.id)}
                    style={{
                      fontFamily: font,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #D5DDE8',
                      background: '#fff',
                      color: '#3E4C63',
                      cursor: busyId === t.id ? 'wait' : 'pointer',
                    }}
                  >
                    Afmeld
                  </button>
                )}
                {t.status === 'registration' && joined && (
                  <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600, alignSelf: 'center' }}>Du er tilmeldt</span>
                )}
              </div>
              {isCreator && t.status === 'registration' && (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => startTournament(t)}
                  style={{
                    marginTop: 12,
                    fontFamily: font,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#D97706',
                    color: '#fff',
                    cursor: busyId === t.id ? 'wait' : 'pointer',
                  }}
                >
                  {busyId === t.id ? 'Starter…' : 'Start turnering (generér runder)'}
                </button>
              )}
              {isCreator && t.status === 'playing' && (
                <AmericanoResultsPanel
                  tournament={t}
                  onSaved={load}
                  showToast={showToast}
                  onProfileStatsRefresh={refreshProfileQuiet}
                />
              )}
              {t.status === 'completed' && (
                <div style={{ fontSize: 12, color: '#8494A7', marginTop: 10 }}>
                  Afsluttet — Americano V/T er opdateret på deltagernes profiler (påvirker ikke ELO).
                </div>
              )}
            </div>
          );})}
        </div>
      )}
    </div>
  )
}
