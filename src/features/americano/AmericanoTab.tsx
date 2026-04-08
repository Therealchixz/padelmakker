import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Court } from '../../api/base44Client'
import { CreateAmericanoTournamentForm } from './CreateAmericanoTournamentForm'
import { AmericanoCompletedSummary } from './AmericanoCompletedSummary'
import { AmericanoResultsPanel } from './AmericanoResultsPanel'
import { buildAmericano578MatchRows, canStartAmericano5767 } from './schedule578'
import { buildAmericano8MatchRows } from './schedule8'
import type { AmericanoTournament, AmericanoParticipant } from './types'
import { americanoOutcomeColors } from './americanoOutcomeColors'
import { formatMatchDateDa, formatTimeSlotDa } from '../../lib/matchDisplayUtils'

const font = "'Inter', sans-serif"

type ProfileLike = {
  id: string
  full_name?: string | null
  name?: string | null
  email?: string | null
}

type AmericanoSubTab = 'open' | 'playing' | 'completed'

type Props = {
  profile?: ProfileLike | null
  showToast: (msg: string) => void
  /** Gendan underfane efter tab/fokus/genindlæsning i samme session */
  initialSubTab?: AmericanoSubTab
  onAmericanoSubTabChange?: (tab: AmericanoSubTab) => void
  /** Indlejret under Kampe — skjul egen top-række; "Opret turnering" styres udefra */
  embedInKampe?: boolean
  /** Styret opret-formular (sammen med onCreateOpenChange) */
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
}

type ParticipantListRow = {
  id: string
  tournament_id: string
  user_id: string
  display_name: string
  joined_at: string
}

type ProfileSnippet = {
  avatar?: string | null
  full_name?: string | null
  name?: string | null
}

function AmericanoParticipantStatsModal({
  userId,
  fallbackName,
  onClose,
}: {
  userId: string
  fallbackName: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<{
    full_name?: string | null
    name?: string | null
    avatar?: string | null
    americano_wins?: number | null
    americano_losses?: number | null
    americano_draws?: number | null
  } | null>(null)
  const [fetchErr, setFetchErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setFetchErr(false)
      setRow(null)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, name, avatar, americano_wins, americano_losses, americano_draws')
          .eq('id', userId)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        setRow(data)
      } catch {
        if (!cancelled) {
          setFetchErr(true)
          setRow(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const w = Number(row?.americano_wins) || 0
  const l = Number(row?.americano_losses) || 0
  const d = Number(row?.americano_draws) || 0
  const played = w + l + d
  const title = String(row?.full_name || row?.name || fallbackName || 'Spiller').trim() || fallbackName

  const cell = (
    label: string,
    value: string | number,
    opts: { bg: string; border: string; text: string; valueColor?: string }
  ) => {
    const valueColor = opts.valueColor ?? opts.text
    return (
      <div
        key={label}
        style={{
          textAlign: 'center',
          padding: '10px 6px',
          background: opts.bg,
          borderRadius: 8,
          border: `1px solid ${opts.border}`,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: valueColor, fontFamily: font }}>{value}</div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#94A3B8',
            marginTop: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </div>
      </div>
    )
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        fontFamily: font,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="americano-stats-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#DBEAFE',
              border: '2px solid #93C5FD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            {row?.avatar || '🎾'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              id="americano-stats-title"
              style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}
            >
              {loading ? '…' : title}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Americano (alle turneringer)</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#64748B', fontSize: 13 }}>Henter statistik…</div>
        ) : fetchErr ? (
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
            Kunne ikke hente profil — tjek forbindelse eller rettigheder.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {cell('Kampe', played, { ...americanoOutcomeColors.neutral, valueColor: '#1D4ED8' })}
            {cell('Sejre', w, { ...americanoOutcomeColors.win })}
            {cell('Uafgjort', d, { ...americanoOutcomeColors.tie })}
            {cell('Tab', l, { ...americanoOutcomeColors.loss })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #D5DDE8',
            background: '#fff',
            color: '#3E4C63',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: font,
          }}
        >
          Luk
        </button>
      </div>
    </div>
  )
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

export function AmericanoTab({
  profile,
  showToast,
  initialSubTab,
  onAmericanoSubTabChange,
  embedInKampe,
  createOpen: createOpenProp,
  onCreateOpenChange,
}: Props) {
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
  const [createOpenInternal, setCreateOpenInternal] = useState(false)
  const createControlled = typeof createOpenProp === 'boolean'
  const showCreate = createControlled ? createOpenProp : createOpenInternal
  const setShowCreate = (open: boolean) => {
    onCreateOpenChange?.(open)
    if (!createControlled) setCreateOpenInternal(open)
  }
  const [busyId, setBusyId] = useState<string | null>(null)
  const [americanoView, setAmericanoView] = useState<AmericanoSubTab>(() => initialSubTab ?? 'open')
  /** Afsluttede: kun én "Resultater og stilling" åben ad gangen (som Baner-accordion) */
  const [openCompletedSummaryId, setOpenCompletedSummaryId] = useState<string | null>(null)
  const [participantsByTournament, setParticipantsByTournament] = useState<
    Record<string, ParticipantListRow[]>
  >({})
  /** Under "I gang": deltagerlisten er sammenklappet som standard for at spare plads */
  const [playingParticipantsOpen, setPlayingParticipantsOpen] = useState<Set<string>>(() => new Set())
  const [participantSnippets, setParticipantSnippets] = useState<Record<string, ProfileSnippet>>({})
  const [participantStatsPick, setParticipantStatsPick] = useState<{ userId: string; name: string } | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!profileId) {
        setCourts([])
        setRows([])
        setJoinedIds(new Set())
        setParticipantsByTournament({})
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
      let tournamentList: AmericanoTournament[] = []
      if (trRes.error) {
        console.warn('americano_tournaments:', trRes.error.message)
        setRows([])
        setParticipantsByTournament({})
      } else {
        tournamentList = (trRes.data || []) as AmericanoTournament[]
        setRows(tournamentList)
      }
      if (!myRes.error && myRes.data) {
        setJoinedIds(new Set(myRes.data.map((r: { tournament_id: string }) => r.tournament_id)))
      } else {
        setJoinedIds(new Set())
      }

      const tids = tournamentList.map((t) => t.id)
      if (tids.length === 0) {
        setParticipantsByTournament({})
      } else {
        const { data: allParts, error: partErr } = await supabase
          .from('americano_participants')
          .select('id, tournament_id, user_id, display_name, joined_at')
          .in('tournament_id', tids)
        if (partErr) {
          console.warn('americano_participants list:', partErr.message)
          setParticipantsByTournament({})
        } else {
          const grouped: Record<string, ParticipantListRow[]> = {}
          ;(allParts || []).forEach((raw: Record<string, unknown>) => {
            const tid = String(raw.tournament_id)
            const row: ParticipantListRow = {
              id: String(raw.id),
              tournament_id: tid,
              user_id: String(raw.user_id),
              display_name: String(raw.display_name || 'Spiller').trim() || 'Spiller',
              joined_at: String(raw.joined_at || ''),
            }
            if (!grouped[tid]) grouped[tid] = []
            grouped[tid].push(row)
          })
          Object.keys(grouped).forEach((tid) => {
            grouped[tid].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
          })
          setParticipantsByTournament(grouped)
        }
      }
    } catch (e) {
      console.warn(e)
      setRows([])
      setParticipantsByTournament({})
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (initialSubTab === 'open' || initialSubTab === 'playing' || initialSubTab === 'completed') {
      setAmericanoView(initialSubTab)
    }
  }, [initialSubTab])

  useEffect(() => {
    if (americanoView !== 'completed') setOpenCompletedSummaryId(null)
  }, [americanoView])

  useEffect(() => {
    if (!openCompletedSummaryId) return
    if (!rows.some((t) => t.id === openCompletedSummaryId)) setOpenCompletedSummaryId(null)
  }, [rows, openCompletedSummaryId])

  useEffect(() => {
    const uidSet = new Set<string>()
    for (const t of rows) {
      if (t.status !== 'playing' && t.status !== 'registration') continue
      for (const p of participantsByTournament[t.id] || []) {
        uidSet.add(p.user_id)
      }
    }
    if (uidSet.size === 0) {
      setParticipantSnippets({})
      return
    }
    const idList = [...uidSet]
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar, full_name, name')
        .in('id', idList)
      if (cancelled) return
      if (error) {
        console.warn('americano participant profiles:', error.message)
        if (!cancelled) setParticipantSnippets({})
        return
      }
      const next: Record<string, ProfileSnippet> = {}
      ;(data || []).forEach((r: { id: string; avatar?: string | null; full_name?: string | null; name?: string | null }) => {
        next[String(r.id)] = {
          avatar: r.avatar,
          full_name: r.full_name,
          name: r.name,
        }
      })
      setParticipantSnippets(next)
    })()
    return () => {
      cancelled = true
    }
  }, [rows, participantsByTournament])

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
        const passes = Number(t.opponent_passes) === 2 ? 2 : 1
        matchRows = buildAmericano578MatchRows(t.id, list.map((p) => p.id), passes)
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

  const openAmericanos = rows.filter((t) => t.status === 'registration')
  const playingAmericanos = rows.filter((t) => t.status === 'playing')
  const completedAmericanos = rows.filter((t) => t.status === 'completed')
  const visibleRows =
    americanoView === 'open'
      ? openAmericanos
      : americanoView === 'playing'
        ? playingAmericanos
        : completedAmericanos

  const subTabBtn = (active: boolean) =>
    ({
      fontFamily: font,
      fontSize: 12,
      fontWeight: 600,
      padding: '7px 14px',
      borderRadius: 8,
      border: active ? 'none' : '1px solid #D5DDE8',
      background: active ? '#1D4ED8' : '#fff',
      color: active ? '#fff' : '#3E4C63',
      cursor: 'pointer',
    }) as const

  return (
    <div style={{ fontFamily: font }}>
      {!embedInKampe && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 24px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Americano
          </h2>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
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
      )}

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
        <strong>slutstilling</strong> der summerer til formatet (fx 10–6 eller 8–8 ved 16 point) — hvert rally tæller ét point til holdet; det andet hold udfyldes automatisk hvis du kun skriver ét tal.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'open' as const, label: `Åbne (${openAmericanos.length})` },
          { id: 'playing' as const, label: `I gang (${playingAmericanos.length})` },
          { id: 'completed' as const, label: `Afsluttede (${completedAmericanos.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setAmericanoView(tab.id)
              onAmericanoSubTabChange?.(tab.id)
            }}
            style={subTabBtn(americanoView === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8494A7', fontSize: 14 }}>
          Ingen Americano-turneringer endnu.
        </div>
      ) : visibleRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8494A7', fontSize: 14 }}>
          {americanoView === 'open' && 'Ingen åbne Americano-turneringer.'}
          {americanoView === 'playing' && 'Ingen Americano i gang.'}
          {americanoView === 'completed' && 'Ingen afsluttede Americano endnu.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleRows.map((t) => {
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
                {formatMatchDateDa(t.tournament_date)} · {formatTimeSlotDa(t.time_slot)} · {t.player_slots}{' '}
                spillere · {t.points_per_match} point
                {Number(t.opponent_passes) === 2 ? ' · lang (2× runder)' : ''} ·{' '}
                <span style={{ textTransform: 'capitalize' }}>{t.status}</span>
              </div>
              {t.description && (
                <div style={{ fontSize: 12, color: '#8494A7', marginTop: 8, fontStyle: 'italic' }}>{t.description}</div>
              )}
              {(() => {
                const parts = participantsByTournament[t.id] || []
                const maxSlots = t.player_slots
                const playingCollapsed = t.status === 'playing'
                const listOpen = !playingCollapsed || playingParticipantsOpen.has(t.id)
                const togglePlayingParticipants = () => {
                  setPlayingParticipantsOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(t.id)) next.delete(t.id)
                    else next.add(t.id)
                    return next
                  })
                }
                return (
                  <div
                    style={{
                      marginTop: 12,
                      padding: playingCollapsed && !listOpen ? '8px 12px' : '10px 12px',
                      background: '#F8FAFC',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    {playingCollapsed ? (
                      <button
                        type="button"
                        onClick={togglePlayingParticipants}
                        aria-expanded={listOpen}
                        aria-label={listOpen ? 'Skjul deltagerliste' : 'Vis deltagerliste'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          width: '100%',
                          margin: 0,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontFamily: font,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0B1120' }}>
                          Deltagere ({parts.length}/{maxSlots})
                        </span>
                        <ChevronDown
                          size={18}
                          color="#64748B"
                          strokeWidth={2}
                          style={{
                            flexShrink: 0,
                            transform: listOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                          }}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0B1120', marginBottom: 8 }}>
                        Deltagere ({parts.length}/{maxSlots})
                      </div>
                    )}
                    {listOpen &&
                      (parts.length === 0 ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#8494A7',
                            marginTop: playingCollapsed ? 10 : 0,
                          }}
                        >
                          Ingen tilmeldt endnu — vær den første.
                        </div>
                      ) : t.status === 'playing' ? (
                        <div
                          style={{
                            marginTop: playingCollapsed ? 10 : 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {parts.map((p) => {
                            const snap = participantSnippets[p.user_id]
                            const av = snap?.avatar || '🎾'
                            const label = String(snap?.full_name || snap?.name || p.display_name).trim() || p.display_name
                            const isMe = String(p.user_id) === String(profileId)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setParticipantStatsPick({ userId: p.user_id, name: p.display_name })
                                }
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #E2E8F0',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  fontFamily: font,
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: '#E2E8F0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    flexShrink: 0,
                                  }}
                                >
                                  {av}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#0F172A',
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {label}
                                  {isMe ? (
                                    <span style={{ color: '#1D4ED8', fontWeight: 600 }}> (dig)</span>
                                  ) : null}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : t.status === 'registration' ? (
                        <div
                          style={{
                            marginTop: playingCollapsed ? 10 : 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {parts.map((p) => {
                            const snap = participantSnippets[p.user_id]
                            const av = snap?.avatar || '🎾'
                            const label =
                              String(snap?.full_name || snap?.name || p.display_name).trim() || p.display_name
                            const isMe = String(p.user_id) === String(profileId)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setParticipantStatsPick({ userId: p.user_id, name: p.display_name })
                                }
                                title="Se Americano-statistik"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #E2E8F0',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  fontFamily: font,
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: '#E2E8F0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    flexShrink: 0,
                                  }}
                                >
                                  {av}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#0F172A',
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {label}
                                  {isMe ? (
                                    <span style={{ color: '#1D4ED8', fontWeight: 600 }}> (dig)</span>
                                  ) : null}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <ul
                          style={{
                            margin: playingCollapsed ? '10px 0 0' : 0,
                            paddingLeft: 18,
                            fontSize: 12,
                            color: '#3E4C63',
                            lineHeight: 1.65,
                          }}
                        >
                          {parts.map((p) => (
                            <li key={p.id}>
                              {p.display_name}
                              {String(p.user_id) === String(profileId) ? (
                                <span style={{ color: '#1D4ED8', fontWeight: 600 }}> (dig)</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ))}
                  </div>
                )
              })()}
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
              {joined && t.status === 'playing' && (
                <AmericanoResultsPanel
                  tournament={t}
                  currentUserId={profileId}
                  onSaved={load}
                  showToast={showToast}
                  onProfileStatsRefresh={refreshProfileQuiet}
                />
              )}
              {t.status === 'completed' && (
                <AmericanoCompletedSummary
                  tournament={t}
                  participants={participantsByTournament[t.id] || []}
                  currentUserId={profileId}
                  summaryOpen={openCompletedSummaryId === t.id}
                  onSummaryToggle={() =>
                    setOpenCompletedSummaryId((cur) => (cur === t.id ? null : t.id))
                  }
                />
              )}
            </div>
          );})}
        </div>
      )}
      {participantStatsPick && (
        <AmericanoParticipantStatsModal
          userId={participantStatsPick.userId}
          fallbackName={participantStatsPick.name}
          onClose={() => setParticipantStatsPick(null)}
        />
      )}
    </div>
  )
}
