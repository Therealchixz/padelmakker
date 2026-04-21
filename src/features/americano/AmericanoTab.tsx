import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Court } from '../../api/base44Client'
import { CreateAmericanoTournamentForm } from './CreateAmericanoTournamentForm'
import { AmericanoCompletedSummary } from './AmericanoCompletedSummary'
import { AmericanoResultsPanel } from './AmericanoResultsPanel'
import { buildAmericano578MatchRows, canStartAmericano5767 } from './schedule578'
import { buildAmericano8MatchRows } from './schedule8'
import type { AmericanoTournament, AmericanoParticipant } from './types'
import { formatMatchDateDa, formatTimeSlotDa } from '../../lib/matchDisplayUtils'
import { PillTabs } from '../../components/PillTabs'
import { btn, theme } from '../../lib/platformTheme'

import { isAvatarUrl } from '../../lib/avatarUpload'
import { PlayerStatsModal } from '../../components/PlayerStatsModal'

const font = 'var(--pm-font)'

/** Renderer emoji eller profilbillede-URL korrekt i en cirkel */
function AvatarInCircle({ av, size = 36, fontSize = 18, bg = 'var(--pm-border)' }: { av: string; size?: number; fontSize?: number; bg?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {isAvatarUrl(av)
        ? <img src={av} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : av}
    </div>
  )
}

type ProfileLike = {
  id: string
  full_name?: string | null
  name?: string | null
  email?: string | null
  role?: string | null
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
  /** Filtrering fra overordnet Kampe-fane */
  scope?: 'mine' | 'alle'
  searchQuery?: string
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
  createOpen,
  onCreateOpenChange,
  scope = 'mine',
  searchQuery = '',
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
  const isAdmin = profile?.role === 'admin'
  const displayName = resolveName(profile, authEmail || null)
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([])
  const [rows, setRows] = useState<AmericanoTournament[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createOpenInternal, setCreateOpenInternal] = useState(false)
  const createControlled = typeof createOpen === 'boolean'
  const showCreate = createControlled ? createOpen : createOpenInternal
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
  /** Under "I gang" + "Afsluttede": deltagerlisten er sammenklappet som standard for at spare plads */
  const [participantListsOpen, setParticipantListsOpen] = useState<Set<string>>(() => new Set())
  const [openManageTools, setOpenManageTools] = useState<Set<string>>(() => new Set())
  const [participantSnippets, setParticipantSnippets] = useState<Record<string, ProfileSnippet>>({})
  const [participantStatsPick, setParticipantStatsPick] = useState<{ userId: string; name: string } | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
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
        supabase.from('americano_tournaments').select('*').order('tournament_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('americano_participants').select('tournament_id').eq('user_id', profileId),
      ])
      setCourts(
        (cd || []).map((c: { id: string; name?: string | null }) => ({
          id: c.id,
          name: c.name || 'Bane',
        }))
      )
      if (trRes.error) throw trRes.error
      const tournamentList: AmericanoTournament[] = (trRes.data || []) as AmericanoTournament[]
      setRows(tournamentList)
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
            grouped[tid].sort((a, b) => {
              const c = a.joined_at.localeCompare(b.joined_at)
              if (c !== 0) return c
              return String(a.id).localeCompare(String(b.id))
            })
          })
          setParticipantsByTournament(grouped)
        }
      }
    } catch (e) {
      console.warn(e)
      setLoadError('Kunne ikke hente Americano-data lige nu.')
      showToast('Kunne ikke hente Americano-data. Tjek din forbindelse og prøv igen.')
      setRows([])
      setParticipantsByTournament({})
    } finally {
      setLoading(false)
    }
  }, [profileId, showToast])

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

  const startTournament = async (t: AmericanoTournament, forceAsAdmin = false) => {
    const isCreatorOrAdmin = String(t.creator_id) === String(profileId) || isAdmin
    if (!isCreatorOrAdmin) {
      showToast('Kun opretteren eller en admin kan starte turneringen.')
      return
    }
    if (forceAsAdmin) {
      if (!window.confirm(`Gennemtving start af "${t.name}" som admin? Turneringen er ikke fyldt endnu.`)) return
    }
    setBusyId(t.id)
    try {
      const { data: parts, error: pErr } = await supabase
        .from('americano_participants')
        .select('id, joined_at')
        .eq('tournament_id', t.id)
        .order('joined_at', { ascending: true })
        .order('id', { ascending: true })
      if (pErr) throw pErr
      const list = (parts || []) as Pick<AmericanoParticipant, 'id' | 'joined_at'>[]
      const slots = Number(t.player_slots)
      const n = list.length
      let matchRows
      if (forceAsAdmin) {
        // Admin: brug faktisk antal spillere som schedule-basis (skal være 5–8)
        if (n >= 5 && n <= 7) {
          const passes = Number(t.opponent_passes) === 2 ? 2 : 1
          matchRows = buildAmericano578MatchRows(t.id, list.map((p) => p.id), passes)
        } else if (n === 8) {
          matchRows = buildAmericano8MatchRows(t.id, list.map((p) => p.id))
        } else {
          showToast(`Kan ikke gennemtvinge: ${n} tilmeldte er ikke gyldigt (kræver 5–8).`)
          return
        }
      } else {
        if (n !== slots) {
          showToast(`Turneringen skal være fyldt før start: ${slots} tilmeldte kræves (nu: ${n}).`)
          return
        }
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

  const kickParticipant = async (tournamentId: string, participantId: string) => {
    setBusyId(tournamentId + '-kick-' + participantId)
    try {
      const { error } = await supabase
        .from('americano_participants')
        .delete()
        .eq('id', participantId)
        .eq('tournament_id', tournamentId)
      if (error) throw error
      showToast('Spiller fjernet.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke fjerne spiller: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  /** Kun under tilmelding — som almindelig kamp (opretter). CASCADE sletter deltagere + kampe. */
  const deleteTournament = async (t: AmericanoTournament) => {
    if (String(t.creator_id) !== String(profileId)) {
      showToast('Kun opretteren kan slette turneringen.')
      return
    }
    if (t.status !== 'registration') {
      showToast('Du kan kun slette turneringer der endnu ikke er startet.')
      return
    }
    if (!window.confirm('Slette denne Americano-turnering? Alle tilmeldinger fjernes.')) return
    setBusyId(t.id)
    try {
      const { error } = await supabase.from('americano_tournaments').delete().eq('id', t.id)
      if (error) throw error
      showToast('Turnering slettet.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke slette: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="pm-state-card pm-state-card--loading" style={{ fontFamily: font }}>
        <div className="pm-spinner pm-state-spinner" />
        <div className="pm-state-title">Indlæser Americano…</div>
        <div className="pm-state-copy">Vi henter turneringer og deltagere.</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="pm-state-card pm-state-card--error" style={{ fontFamily: font }}>
        <div className="pm-state-icon">⚠️</div>
        <div className="pm-state-title">Kunne ikke hente Americano</div>
        <div className="pm-state-copy">{loadError}</div>
        <div className="pm-state-actions">
          <button type="button" onClick={() => void load()} style={{ ...btn(true), fontSize: 13 }}>
            Prøv igen
          </button>
        </div>
      </div>
    )
  }

  if (!profileId) {
    return (
      <div className="pm-state-card pm-state-card--warning" style={{ fontFamily: font }}>
        <div className="pm-state-icon">🔒</div>
        <div className="pm-state-title">Du skal være logget ind</div>
        <div className="pm-state-copy">Log ind for at bruge Americano-modulet.</div>
      </div>
    )
  }

  // Filtering based on scope and search
  const filteredRows = rows.filter(t => {
    // 1. Scope filter
    if (scope === 'mine') {
      if (!joinedIds.has(t.id)) return false
    }

    // 2. Search filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const tName = (t.name || '').toLowerCase()
      if (tName.includes(q)) return true

      const parts = participantsByTournament[t.id] || []
      const hasPartMatch = parts.some(p => (p.display_name || '').toLowerCase().includes(q))
      if (hasPartMatch) return true

      return false
    }

    return true
  })

  // Group by status after filtering
  const openAmericanos = filteredRows.filter((t) => t.status === 'registration')
  const playingAmericanosFiltered = filteredRows.filter((t) => t.status === 'playing')
  const completedAmericanosFiltered = filteredRows.filter((t) => t.status === 'completed')

  const visibleRows =
    americanoView === 'open'
      ? openAmericanos
      : americanoView === 'playing'
        ? playingAmericanosFiltered
        : completedAmericanosFiltered

  const americanoSubTabs = [
    { id: 'open' as const, label: `Åbne (${openAmericanos.length})` },
    { id: 'playing' as const, label: `I gang (${playingAmericanosFiltered.length})` },
    { id: 'completed' as const, label: `Afsluttede (${completedAmericanosFiltered.length})` },
  ]

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
              ...btn(true),
              fontSize: 14,
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

      <div className="pm-help-box" style={{ marginBottom: 16 }}>
        <div className="pm-help-box-copy">
          <strong>Americano bruger ikke ELO.</strong> Kampe tæller kun i separat V/T på profilen (som i apps som Padelboard — turnering og stilling for sig selv).
          Makkere og modstandere roterer hver runde. Valget 16/24/32 er <strong>spilformat på banen</strong> (typisk først til det tal); når kampen er slut, indtastes den{' '}
          <strong>slutstilling</strong> der summerer til formatet (fx 10–6 eller 8–8 ved 16 point) — hvert rally tæller ét point til holdet; det andet hold udfyldes automatisk hvis du kun skriver ét tal.
        </div>
      </div>

      <PillTabs
        tabs={americanoSubTabs}
        value={americanoView}
        onChange={(nextTab) => {
          const nextView = nextTab as AmericanoSubTab
          setAmericanoView(nextView)
          onAmericanoSubTabChange?.(nextView)
        }}
        ariaLabel="Americano status"
        size="sm"
        style={{ marginBottom: 16 }}
      />

      {rows.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty">
          <div className="pm-state-icon">🏟️</div>
          <div className="pm-state-title">Ingen Americano-turneringer endnu</div>
          <div className="pm-state-copy">Opret en turnering for at komme i gang.</div>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty">
          <div className="pm-state-icon">📭</div>
          <div className="pm-state-title">
            {americanoView === 'open' && 'Ingen åbne Americano-turneringer'}
            {americanoView === 'playing' && 'Ingen Americano i gang'}
            {americanoView === 'completed' && 'Ingen afsluttede Americano endnu'}
          </div>
          <div className="pm-state-copy">Prøv en anden statusfane, eller opret en ny turnering.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleRows.map((t) => {
            const isCreator = String(t.creator_id) === String(profileId)
            const joined = joinedIds.has(t.id)
            const partCount = (participantsByTournament[t.id] || []).length
            const slotsConfigured = Number(t.player_slots)
            const tournamentFull = partCount === slotsConfigured
            const canManageTournament = (isCreator || isAdmin) && t.status === 'registration'
            const manageToolsOpen = openManageTools.has(t.id)
            const statusMeta =
              t.status === 'registration'
                ? { label: 'Tilmelding åben', tone: 'warm' }
                : t.status === 'playing'
                  ? { label: 'I gang', tone: 'accent' }
                  : { label: 'Afsluttet', tone: 'neutral' }
            return (
            <div key={t.id} className="pm-ui-card pm-match-surface-card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.name}</div>
              <div className="pm-card-meta-row" style={{ marginBottom: 6 }}>
                <span className={`pm-status-badge pm-status-badge--${statusMeta.tone}`}>{statusMeta.label}</span>
                {t.status !== 'completed' && (
                  <span className="pm-status-badge pm-status-badge--blue">
                    {partCount}/{slotsConfigured} spillere
                  </span>
                )}
                <span className="pm-status-badge">
                  {t.points_per_match} point{Number(t.opponent_passes) === 2 ? ' · lang' : ''}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--pm-text-mid)' }}>
                {formatMatchDateDa(t.tournament_date)} · {formatTimeSlotDa(t.time_slot)}
                {t.status !== 'completed' ? (
                  <>
                    {' · '}
                    {t.player_slots} spillere
                  </>
                ) : null}
              </div>
              {t.description && (
                <div style={{ fontSize: 12, color: 'var(--pm-text-light)', marginTop: 8, fontStyle: 'italic' }}>{t.description}</div>
              )}
              {(() => {
                const parts = participantsByTournament[t.id] || []
                const maxSlots = t.player_slots
                const participantsCollapsible = t.status === 'playing' || t.status === 'completed'
                const listOpen = !participantsCollapsible || participantListsOpen.has(t.id)
                const toggleParticipants = () => {
                  setParticipantListsOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(t.id)) next.delete(t.id)
                    else next.add(t.id)
                    return next
                  })
                }
                return (
                  <div
                      className="pm-card-subpanel"
                      style={{
                        marginTop: 12,
                        padding: participantsCollapsible && !listOpen ? '8px 12px' : '10px 12px',
                      }}
                    >
                    {participantsCollapsible ? (
                      <button
                        type="button"
                        onClick={toggleParticipants}
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pm-text)' }}>
                          Deltagere ({parts.length}/{maxSlots})
                        </span>
                        <ChevronDown
                          size={18}
                          color={theme.textMid}
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pm-text)', marginBottom: 8 }}>
                        Deltagere ({parts.length}/{maxSlots})
                      </div>
                    )}
                    {listOpen &&
                      (parts.length === 0 ? (
                        <div className="pm-data-empty-note" style={{ marginTop: participantsCollapsible ? 10 : 0 }}>
                          Ingen tilmeldt endnu — vær den første.
                        </div>
                      ) : t.status === 'playing' ? (
                        <div
                          style={{
                            marginTop: participantsCollapsible ? 10 : 0,
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
                                className="pm-card-row-item"
                                style={{
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  fontFamily: font,
                                }}
                              >

                                <AvatarInCircle av={av} />

                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--pm-text)',
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {label}
                                  {isMe ? (
                                    <span style={{ color: theme.accent, fontWeight: 600 }}> (dig)</span>
                                  ) : null}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : t.status === 'registration' ? (
                        <div
                          style={{
                            marginTop: participantsCollapsible ? 10 : 0,
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
                            const kickBusy = busyId === t.id + '-kick-' + p.id
                            return (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setParticipantStatsPick({ userId: p.user_id, name: p.display_name })
                                  }
                                  title="Se Americano-statistik"
                                  className="pm-card-row-item"
                                  style={{
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontFamily: font,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <AvatarInCircle av={av} />
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: 'var(--pm-text)',
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                  >
                                    {label}
                                    {isMe ? (
                                      <span style={{ color: theme.accent, fontWeight: 600 }}> (dig)</span>
                                    ) : null}
                                  </span>
                                </button>
                                {canManageTournament && manageToolsOpen && !isMe && (
                                  <button
                                    type="button"
                                    onClick={() => kickParticipant(t.id, p.id)}
                                    disabled={kickBusy}
                                    title="Fjern spiller"
                                    style={{
                                      flexShrink: 0,
                                      padding: '6px 8px',
                                      borderRadius: 8,
                                      border: '1px solid var(--pm-danger-border)',
                                      background: theme.redBg,
                                      color: theme.red,
                                      cursor: kickBusy ? 'wait' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      fontFamily: font,
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <ul
                          style={{
                            margin: participantsCollapsible ? '10px 0 0' : 0,
                            paddingLeft: 18,
                            fontSize: 12,
                            color: 'var(--pm-text-mid)',
                            lineHeight: 1.65,
                          }}
                        >
                          {parts.map((p) => (
                            <li key={p.id}>
                              {p.display_name}
                              {String(p.user_id) === String(profileId) ? (
                                <span style={{ color: theme.accent, fontWeight: 600 }}> (dig)</span>
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
                    className="pm-card-primary-cta"
                    style={{
                      ...btn(true),
                      fontSize: 13,
                      padding: '8px 14px',
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
                    className="pm-card-primary-cta"
                    style={{
                      ...btn(false),
                      fontSize: 13,
                      padding: '8px 14px',
                      cursor: busyId === t.id ? 'wait' : 'pointer',
                    }}
                  >
                    Afmeld
                  </button>
                )}
                {t.status === 'registration' && joined && (
                  <span className="pm-feedback-inline-note pm-feedback-inline-note--info" style={{ alignSelf: 'center' }}>Du er tilmeldt</span>
                )}
              </div>
              {canManageTournament && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {!tournamentFull && (
                    <div className="pm-feedback-inline-note pm-feedback-inline-note--warning">
                      Vent med at starte: {partCount}/{slotsConfigured} tilmeldt — alle {slotsConfigured} skal være med.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    disabled={busyId === t.id || !tournamentFull}
                    title={
                      tournamentFull
                        ? 'Generér runder og start turneringen'
                        : `Kræver ${slotsConfigured} tilmeldte (nu ${partCount})`
                    }
                    onClick={() => startTournament(t)}
                    className="pm-card-primary-cta"
                    style={{
                      ...btn(true),
                      fontSize: 13,
                      padding: '8px 14px',
                      background: tournamentFull ? theme.warm : theme.border,
                      borderColor: tournamentFull ? theme.warm : theme.border,
                      color: tournamentFull ? '#fff' : theme.textLight,
                      cursor: busyId === t.id ? 'wait' : tournamentFull ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {busyId === t.id ? 'Starter…' : 'Start turnering (generér runder)'}
                  </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenManageTools((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }
                    className="pm-accordion-trigger"
                    style={{
                      ...btn(false),
                      padding: '7px 12px',
                      fontSize: '12px',
                      color: theme.warm,
                      borderColor: theme.warm + '55',
                      background: theme.warmBg,
                    }}
                  >
                    <span>{manageToolsOpen ? 'Skjul admin-værktøjer' : 'Vis admin-værktøjer'}</span>
                    {manageToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {manageToolsOpen && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {isAdmin && !tournamentFull && partCount >= 5 && (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => startTournament(t, true)}
                          style={{
                            ...btn(false),
                            fontSize: 13,
                            padding: '8px 14px',
                            borderColor: theme.warm,
                            color: theme.warm,
                            cursor: busyId === t.id ? 'wait' : 'pointer',
                          }}
                        >
                          ⚡ Gennemtving start (Admin)
                        </button>
                      )}
                      {isCreator && (
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => deleteTournament(t)}
                        style={{
                            ...btn(false),
                            fontSize: 13,
                            padding: '8px 14px',
                            border: '1px solid var(--pm-danger-border)',
                            color: theme.red,
                            cursor: busyId === t.id ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Trash2 size={14} aria-hidden />
                        Slet turnering
                      </button>
                      )}
                    </div>
                  )}
                </div>
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
        <PlayerStatsModal
          userId={participantStatsPick.userId}
          fallbackName={participantStatsPick.name}
          onClose={() => setParticipantStatsPick(null)}
        />
      )}
    </div>
  )
}
