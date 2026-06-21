import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { theme, font, btn, inputStyle, heading, labelStyle } from '../lib/platformTheme';
import { Search, User, Swords, Trash2, ShieldAlert, ShieldCheck, Edit2, X, ChevronUp, ChevronDown, AlertTriangle, CheckCircle2, RefreshCw, Flag, MessageCircle, AlertCircle, Smartphone, LayoutDashboard, Trophy, ChevronRight } from 'lucide-react';
import {
  dismissAdminUserReportNotificationsIfQueueEmpty,
  fetchAdminSubTabBadges,
  notifyAdminsNewConsoleFlags,
  reportReasonLabel,
} from '../lib/userModeration';
import {
  resultErrorReasonLabel,
  resultErrorSourceLabel,
} from '../lib/resultErrorReports';
import { AvatarCircle } from '../components/AvatarCircle';
import { PillTabs } from '../components/PillTabs';
import { AppModal } from '../components/AppModal';
import { AdminReportDmViewer } from '../components/AdminReportDmViewer';
import { AdminMatchResultEditor } from '../components/AdminMatchResultEditor';
import { AdminAmericanoResultEditor } from '../components/AdminAmericanoResultEditor';
import { AdminLeagueResultEditor } from '../components/AdminLeagueResultEditor';
import { AdminUserEditModal } from './AdminUserEditModal';
import { fetchEloStatsBatchByUserIds, formatEloHistoryDate } from '../lib/eloHistoryUtils';
import { eloOf } from '../lib/matchDisplayUtils';
import { normalizeProfileRow } from '../lib/profileUtils';
import { explainRatingAdminFlag } from '../lib/ratingAdminFlagExplain';
import { fetchAdminAuditLogRecent, adminAuditActionLabel } from '../lib/adminAuditLog';
import {
  buildRatingFlagStatusUpdate,
  computeAdminConsoleStats,
  filterRatingAdminFlags,
} from '../lib/adminConsoleUtils';

function adminDisplayName(user) {
  const fullName = String(user?.full_name || '').trim();
  if (fullName) return fullName;
  const name = String(user?.name || '').trim();
  if (name) return name;
  const email = String(user?.email || '').trim();
  if (email) {
    const emailPrefix = email.split('@')[0]?.trim();
    if (emailPrefix) return emailPrefix;
  }
  return 'Spiller';
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function isSixDigitPin(value) {
  return /^\d{6}$/.test(String(value || ''));
}

const ADMIN_MATCH_STATUS_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'open', label: 'Åbne' },
  { id: 'in_progress', label: 'I gang' },
  { id: 'completed', label: 'Afsluttet' },
];

function adminMatchSortMs(row, kind) {
  if (kind === '2v2') {
    return new Date(row.completed_at || row.date || row.created_at || 0).getTime() || 0;
  }
  if (kind === 'americano') {
    return new Date(row.updated_at || row.tournament_date || row.created_at || 0).getTime() || 0;
  }
  return new Date(row.updated_at || row.created_at || row.start_date || 0).getTime() || 0;
}

function adminMatchStatusBucket(status, kind) {
  const s = String(status || '').toLowerCase();
  if (kind === '2v2') {
    if (s === 'completed') return 'completed';
    if (s === 'in_progress') return 'in_progress';
    return 'open';
  }
  if (kind === 'americano') {
    if (s === 'completed') return 'completed';
    if (s === 'playing' || s === 'active') return 'in_progress';
    return 'open';
  }
  if (s === 'completed') return 'completed';
  if (s === 'active') return 'in_progress';
  return 'open';
}

function sortAndFilterAdminMatches(rows, kind, statusFilter) {
  const sorted = [...rows].sort((a, b) => adminMatchSortMs(b, kind) - adminMatchSortMs(a, kind));
  if (statusFilter === 'all') return sorted;
  return sorted.filter((row) => adminMatchStatusBucket(row.status, kind) === statusFilter);
}

function formatDateTimeDa(value) {
  if (!value) return 'Ukendt';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Ukendt';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function AdminTab({ initialSubTab = null }) {
  const { user } = useAuth();
  const ask = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState(
    initialSubTab === 'reports'
      ? 'reports'
      : initialSubTab === 'result_errors'
        ? 'result_errors'
        : 'oversigt'
  ); // 'oversigt' | 'users' | 'matches' | 'console' | 'reports' | 'result_errors'
  const [matchSubTab, setMatchSubTab] = useState('2v2'); // '2v2' | 'americano' | 'liga'
  const [matchStatusFilter, setMatchStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [americanoTournaments, setAmericanoTournaments] = useState([]);
  const [ligaLeagues, setLigaLeagues] = useState([]);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editingUserOverview, setEditingUserOverview] = useState(null);
  const [editingUserLoading, setEditingUserLoading] = useState(false);
  const [editingUserSaving, setEditingUserSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'asc' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [deletePinOpen, setDeletePinOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deletePin, setDeletePin] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [deletePinBusy, setDeletePinBusy] = useState(false);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState('');
  const [ratingFlags, setRatingFlags] = useState([]);
  const [flagSearch, setFlagSearch] = useState('');
  const [flagStatusFilter, setFlagStatusFilter] = useState('open');
  const [flagSourceFilter, setFlagSourceFilter] = useState('all');
  const [flagSeverityFilter, setFlagSeverityFilter] = useState('all');
  const [expandedFlags, setExpandedFlags] = useState({});
  const [flagNotes, setFlagNotes] = useState({});
  const [flagBusyId, setFlagBusyId] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('open');
  const [reportBusyId, setReportBusyId] = useState(null);
  const [dmViewerReport, setDmViewerReport] = useState(null);
  const [resultErrorReports, setResultErrorReports] = useState([]);
  const [resultErrorsLoading, setResultErrorsLoading] = useState(false);
  const [resultErrorsError, setResultErrorsError] = useState('');
  const [resultErrorStatusFilter, setResultErrorStatusFilter] = useState('open');
  const [resultErrorBusyId, setResultErrorBusyId] = useState(null);
  const [editMatchTarget, setEditMatchTarget] = useState(null);
  const [editMatchLoading, setEditMatchLoading] = useState(false);
  const [editAmericanoTarget, setEditAmericanoTarget] = useState(null);
  const [editLigaTarget, setEditLigaTarget] = useState(null);
  const usersLoadSeqRef = useRef(0);
  const matchesLoadSeqRef = useRef(0);
  const [subTabBadges, setSubTabBadges] = useState({
    users: 0,
    matches: 0,
    reports: 0,
    console: 0,
    resultErrors: 0,
  });
  const [reviewerMap, setReviewerMap] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [auditLogError, setAuditLogError] = useState('');
  const [consoleStats, setConsoleStats] = useState({
    totalPlayers: 0,
    bannedPlayers: 0,
    pendingResults: 0,
    openMatches: 0,
    inProgressMatches: 0,
    completedMatches24h: 0,
    americanoOpen: 0,
    americanoActive: 0,
    americanoCompleted7d: 0,
    openFlags: 0,
    highFlags: 0,
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const prevSubTabBadgesRef = useRef(null);
  const badgesSyncedRef = useRef(false);

  const refreshSubTabBadges = useCallback(async () => {
    try {
      let next = await fetchAdminSubTabBadges(user?.id);
      if (next.reports === 0) {
        await dismissAdminUserReportNotificationsIfQueueEmpty(user?.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pm-notifications-sync'));
        }
      }
      const prev = prevSubTabBadgesRef.current;
      if (
        badgesSyncedRef.current
        && prev
        && next.console > prev.console
      ) {
        void notifyAdminsNewConsoleFlags(next.console - prev.console);
      }
      prevSubTabBadgesRef.current = next;
      badgesSyncedRef.current = true;
      setSubTabBadges(next);
    } catch (e) {
      console.warn('admin sub-tab badges:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    void refreshSubTabBadges();

    const channel = supabase
      .channel('admin-subtab-badges-' + user.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_reports' },
        () => { void refreshSubTabBadges(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rating_admin_flags' },
        () => { void refreshSubTabBadges(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results' },
        () => { void refreshSubTabBadges(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'result_error_reports' },
        () => { void refreshSubTabBadges(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + user.id },
        () => { void refreshSubTabBadges(); },
      )
      .subscribe();

    const interval = setInterval(() => {
      void refreshSubTabBadges();
    }, 20000);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshSubTabBadges]);

  const fetchUsers = useCallback(async () => {
    const seq = ++usersLoadSeqRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_profiles_with_email');
      if (error) throw error;
      let rows = data || [];
      const ids = rows.map((u) => u.id).filter(Boolean);
      if (ids.length > 0) {
        const eloMap = await fetchEloStatsBatchByUserIds(ids);
        if (seq !== usersLoadSeqRef.current) return;
        rows = rows.map((u) => {
          const snap = eloMap[String(u.id)];
          const elo =
            snap != null && Number.isFinite(Number(snap.elo))
              ? Math.round(Number(snap.elo))
              : Number(u.elo_rating) || 1000;
          return { ...u, elo_rating: elo };
        });
      }
      if (seq !== usersLoadSeqRef.current) return;
      setUsers(rows);
    } catch (err) {
      if (seq !== usersLoadSeqRef.current) return;
      console.warn('AdminTab fetchUsers:', err?.message || err);
      setUsers([]);
    } finally {
      if (seq === usersLoadSeqRef.current) setLoading(false);
    }
  }, []);

  const closeUserEditor = useCallback(() => {
    setEditingUser(null);
    setEditingUserOverview(null);
    setEditingUserLoading(false);
  }, []);

  /** Hent frisk profil + ELO — ikke snapshot fra listen. */
  const openUserEditor = useCallback(async (userRow) => {
    if (!userRow?.id) return;
    setEditingUserLoading(true);
    try {
      const uid = String(userRow.id);
      const [profileRes, eloBatch] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        fetchEloStatsBatchByUserIds([uid]),
      ]);
      if (profileRes.error) throw profileRes.error;
      const fresh = normalizeProfileRow(profileRes.data || userRow);
      const stats = eloBatch[uid];
      const eloFromHistory =
        stats != null && Number.isFinite(Number(stats.elo))
          ? Math.round(Number(stats.elo))
          : eloOf(fresh);
      const americanoEloDisplay = Math.round(Number(fresh.americano_elo_rating) || 1000);
      const editorState = {
        ...fresh,
        full_name: fresh.full_name || fresh.name || userRow.full_name || userRow.name || '',
        email: userRow.email ?? fresh.email ?? '',
        elo_rating: eloFromHistory,
        americano_elo_rating: americanoEloDisplay,
        games_played: stats?.games ?? fresh.games_played,
        games_won: stats?.wins ?? fresh.games_won,
      };
      setEditingUser(editorState);
      setEditingUserOverview(editorState);
    } catch (err) {
      console.warn('AdminTab openUserEditor:', err?.message || err);
      await ask({ message: 'Kunne ikke hente opdateret profil. Prøv igen.', notice: true });
      setEditingUser(null);
    } finally {
      setEditingUserLoading(false);
    }
  }, [ask]);

  const fetchMatches = useCallback(async () => {
    const seq = ++matchesLoadSeqRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, match_results(*), match_players(*, profiles(full_name, name))')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (seq !== matchesLoadSeqRef.current) return;
      setMatches(data || []);
    } catch (err) {
      if (seq !== matchesLoadSeqRef.current) return;
      console.warn('AdminTab fetchMatches:', err?.message || err);
      setMatches([]);
    } finally {
      if (seq === matchesLoadSeqRef.current) setLoading(false);
    }
  }, []);

  const fetchAmericano = useCallback(async () => {
    const seq = ++matchesLoadSeqRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('americano_tournaments')
        .select('id, name, status, tournament_date, updated_at, created_at, points_per_match')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (seq !== matchesLoadSeqRef.current) return;
      setAmericanoTournaments(data || []);
    } catch (err) {
      if (seq !== matchesLoadSeqRef.current) return;
      console.warn('AdminTab fetchAmericano:', err?.message || err);
      setAmericanoTournaments([]);
    } finally {
      if (seq === matchesLoadSeqRef.current) setLoading(false);
    }
  }, []);

  const fetchLiga = useCallback(async () => {
    const seq = ++matchesLoadSeqRef.current;
    setLoading(true);
    try {
      const { data: leagues, error } = await supabase
        .from('leagues')
        .select('id, name, status, season_type, start_date, end_date, current_round, total_rounds, created_at, updated_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const lIds = (leagues || []).map((l) => l.id);
      let teamCounts = {};
      if (lIds.length) {
        const { data: teams } = await supabase.from('league_teams').select('league_id').in('league_id', lIds);
        for (const t of teams || []) {
          teamCounts[t.league_id] = (teamCounts[t.league_id] || 0) + 1;
        }
      }
      if (seq !== matchesLoadSeqRef.current) return;
      setLigaLeagues((leagues || []).map((l) => ({ ...l, team_count: teamCounts[l.id] || 0 })));
    } catch (err) {
      if (seq !== matchesLoadSeqRef.current) return;
      console.warn('AdminTab fetchLiga:', err?.message || err);
      setLigaLeagues([]);
    } finally {
      if (seq === matchesLoadSeqRef.current) setLoading(false);
    }
  }, []);

  const openMatchResultEditor = useCallback(
    async (matchId) => {
      setEditMatchLoading(true);
      try {
        const { data: m, error } = await supabase
          .from('matches')
          .select('*, match_results(*), match_players(*, profiles(full_name, name))')
          .eq('id', matchId)
          .maybeSingle();
        if (error) throw error;
        if (!m) throw new Error('Kamp ikke fundet');
        const confirmedResult = (m.match_results || []).find((r) => r.confirmed) || null;
        if (!confirmedResult) {
          await ask({ message: 'Ingen bekræftet resultat at rette på denne kamp.', notice: true });
          return;
        }
        setEditMatchTarget({
          match: m,
          matchResult: confirmedResult,
          players: m.match_players || [],
        });
      } catch (err) {
        await ask({ message: err?.message || 'Kunne ikke hente kampdata', notice: true });
      } finally {
        setEditMatchLoading(false);
      }
    },
    [ask],
  );

  const fetchAdminConsole = async () => {
    setConsoleLoading(true);
    setConsoleError('');
    try {
      const [
        flagsRes,
        profilesRes,
        matchesRes,
        resultsRes,
        americanoRes,
      ] = await Promise.all([
        supabase
          .from('rating_admin_flags')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('profiles')
          .select('id, is_banned'),
        supabase
          .from('matches')
          .select('id, status, completed_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('match_results')
          .select('id, confirmed')
          .eq('confirmed', false),
        supabase
          .from('americano_tournaments')
          .select('id, status, updated_at')
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      if (flagsRes.error) {
        const msg = String(flagsRes.error.message || '');
        if (msg.toLowerCase().includes('rating_admin_flags')) {
          setConsoleError('Flag-tabellen mangler i DB. Kør SQL-scriptet supabase/sql/elo_guardrails_admin_flags.sql i Supabase SQL Editor.');
          setRatingFlags([]);
        } else {
          setConsoleError('Kunne ikke hente flags: ' + msg);
          setRatingFlags([]);
        }
      } else {
        setRatingFlags(flagsRes.data || []);
      }

      const flagRows = flagsRes.error ? [] : flagsRes.data || [];
      const profiles = profilesRes.data || [];
      const matchesRows = matchesRes.data || [];
      const pendingResults = resultsRes.data || [];
      const americanoRows = americanoRes.data || [];

      setConsoleStats(
        computeAdminConsoleStats({
          profiles,
          matchesRows,
          pendingResults,
          americanoRows,
          flags: flagRows,
        }),
      );
      void refreshSubTabBadges();

      const reviewerIds = [...new Set(flagRows.map((f) => f.reviewed_by).filter(Boolean))];
      if (reviewerIds.length > 0) {
        const { data: reviewerRows } = await supabase
          .from('profiles')
          .select('id, full_name, name, email')
          .in('id', reviewerIds);
        const nextReviewerMap = {};
        for (const row of (reviewerRows || [])) {
          nextReviewerMap[row.id] = adminDisplayName(row);
        }
        setReviewerMap(nextReviewerMap);
      } else {
        setReviewerMap({});
      }

      const { data: auditRows, error: auditErr } = await fetchAdminAuditLogRecent(50);
      if (auditErr) {
        setAuditLogError(auditErr.message || 'Kunne ikke hente admin-log');
        setAuditLog([]);
      } else {
        setAuditLogError('');
        setAuditLog(auditRows || []);
      }
    } catch (err) {
      setConsoleError('Admin-konsol fejl: ' + (err?.message || 'ukendt fejl'));
    } finally {
      setConsoleLoading(false);
    }
  };

  const deleteAmericano = async (id, name) => {
    const ok = await ask({
      message: `Slet Americano/Mexicano "${name}"? Dette kan ikke fortrydes.`,
      confirmLabel: 'Ja, slet',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('americano_tournaments').delete().eq('id', id);
    if (error) await ask({ message: 'Fejl: ' + error.message, notice: true });
    else fetchAmericano();
  };

  const deleteLiga = async (id, name) => {
    const ok = await ask({
      message: `Slet ligaen "${name}"? Hold og kampe slettes også. Dette kan ikke fortrydes.`,
      confirmLabel: 'Ja, slet',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) await ask({ message: 'Fejl: ' + error.message, notice: true });
    else fetchLiga();
  };

  const fetchUserReports = async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      let query = supabase
        .from('user_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (reportStatusFilter !== 'all') {
        query = query.eq('status', reportStatusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const ids = [
        ...new Set(
          rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean)
        ),
      ];
      let profileMap = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, name, email')
          .in('id', ids);
        profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }
      setUserReports(
        rows.map((r) => ({
          ...r,
          reporter: profileMap[r.reporter_id],
          reported: profileMap[r.reported_id],
        }))
      );
    } catch (err) {
      setReportsError(err?.message || 'Kunne ikke hente anmeldelser');
      setUserReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const updateUserReportStatus = async (report, nextStatus) => {
    setReportBusyId(report.id);
    try {
      const { error } = await supabase
        .from('user_reports')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
          resolved_at: nextStatus === 'open' ? null : new Date().toISOString(),
          resolved_by: nextStatus === 'open' ? null : user.id,
        })
        .eq('id', report.id);
      if (error) throw error;
      await fetchUserReports();
      if (nextStatus !== 'open') {
        await dismissAdminUserReportNotificationsIfQueueEmpty(user.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pm-notifications-sync'));
        }
      }
      await refreshSubTabBadges();
    } catch (err) {
      await ask({ message: 'Fejl: ' + (err?.message || 'ukendt'), notice: true });
    } finally {
      setReportBusyId(null);
    }
  };

  const fetchResultErrorReports = async () => {
    setResultErrorsLoading(true);
    setResultErrorsError('');
    try {
      let query = supabase
        .from('result_error_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (resultErrorStatusFilter !== 'all') {
        query = query.eq('status', resultErrorStatusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const reporterIds = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))];
      let profileMap = {};
      if (reporterIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, name, email')
          .in('id', reporterIds);
        profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }
      const matchIds = rows.filter((r) => r.source_type === 'match_2v2').map((r) => r.entity_id);
      const tournamentIds = rows.filter((r) => r.source_type === 'americano').map((r) => r.entity_id);
      const leagueIds = rows.filter((r) => r.source_type === 'league').map((r) => r.entity_id);
      const [matchesRes, tournamentsRes, leaguesRes] = await Promise.all([
        matchIds.length
          ? supabase.from('matches').select('id, date, court_name').in('id', matchIds)
          : Promise.resolve({ data: [] }),
        tournamentIds.length
          ? supabase.from('americano_tournaments').select('id, name').in('id', tournamentIds)
          : Promise.resolve({ data: [] }),
        leagueIds.length
          ? supabase.from('leagues').select('id, name').in('id', leagueIds)
          : Promise.resolve({ data: [] }),
      ]);
      const matchMap = Object.fromEntries((matchesRes.data || []).map((m) => [m.id, m]));
      const tournamentMap = Object.fromEntries((tournamentsRes.data || []).map((t) => [t.id, t]));
      const leagueMap = Object.fromEntries((leaguesRes.data || []).map((l) => [l.id, l]));
      setResultErrorReports(
        rows.map((r) => {
          let entityLabel = r.entity_id;
          if (r.source_type === 'match_2v2') {
            const m = matchMap[r.entity_id];
            entityLabel = m
              ? `2v2 · ${formatEloHistoryDate(m.date)}${m.court_name ? ` · ${m.court_name}` : ''}`
              : `2v2 · ${r.entity_id}`;
          } else if (r.source_type === 'americano') {
            entityLabel = tournamentMap[r.entity_id]?.name || `Americano · ${r.entity_id}`;
          } else if (r.source_type === 'league') {
            entityLabel = leagueMap[r.entity_id]?.name || `Liga · ${r.entity_id}`;
          }
          return {
            ...r,
            reporter: profileMap[r.reporter_id],
            entityLabel,
          };
        }),
      );
    } catch (err) {
      setResultErrorsError(err?.message || 'Kunne ikke hente fejlindberetninger');
      setResultErrorReports([]);
    } finally {
      setResultErrorsLoading(false);
    }
  };

  const refreshActiveAdminTab = useCallback(() => {
    if (activeSubTab === 'users') return fetchUsers();
    if (activeSubTab === 'matches') {
      if (matchSubTab === '2v2') return fetchMatches();
      if (matchSubTab === 'americano') return fetchAmericano();
      return fetchLiga();
    }
    if (activeSubTab === 'reports') return fetchUserReports();
    if (activeSubTab === 'result_errors') return fetchResultErrorReports();
    if (activeSubTab === 'console' || activeSubTab === 'oversigt') return fetchAdminConsole();
    return Promise.resolve();
  }, [activeSubTab, matchSubTab, fetchUsers, fetchMatches, fetchAmericano, fetchLiga]);

  const updateResultErrorReportStatus = async (report, nextStatus) => {
    setResultErrorBusyId(report.id);
    try {
      const { error } = await supabase
        .from('result_error_reports')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
          resolved_at: nextStatus === 'open' ? null : new Date().toISOString(),
          resolved_by: nextStatus === 'open' ? null : user.id,
        })
        .eq('id', report.id);
      if (error) throw error;
      await fetchResultErrorReports();
      await refreshSubTabBadges();
    } catch (err) {
      await ask({ message: 'Fejl: ' + (err?.message || 'ukendt'), notice: true });
    } finally {
      setResultErrorBusyId(null);
    }
  };

  useEffect(() => {
    if (initialSubTab === 'reports') {
      setActiveSubTab('reports');
    } else if (initialSubTab === 'result_errors') {
      setActiveSubTab('result_errors');
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (activeSubTab === 'users') void fetchUsers();
    else if (activeSubTab === 'matches') {
      if (matchSubTab === '2v2') void fetchMatches();
      else if (matchSubTab === 'americano') void fetchAmericano();
      else void fetchLiga();
    } else if (activeSubTab === 'reports') {
      void fetchUserReports();
    } else if (activeSubTab === 'result_errors') {
      void fetchResultErrorReports();
    } else if (activeSubTab === 'console' || activeSubTab === 'oversigt') {
      void fetchAdminConsole();
    }
  }, [
    activeSubTab,
    matchSubTab,
    reportStatusFilter,
    resultErrorStatusFilter,
    fetchUsers,
    fetchMatches,
    fetchAmericano,
    fetchLiga,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshActiveAdminTab();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshActiveAdminTab]);

  const toggleAdmin = async (user) => {
    const newRole = user.role === 'admin' ? 'player' : 'admin';
    const displayName = adminDisplayName(user);
    const confirmMsg = user.role === 'admin' 
        ? `Er du sikker på, at du vil fjerne admin-rettigheder fra ${displayName}?`
        : `Vil du give admin-rettigheder til ${displayName}?`;
    
    const ok = await ask({
      message: confirmMsg,
      confirmLabel: user.role === 'admin' ? 'Ja, fjern admin' : 'Ja, gør til admin',
      danger: user.role === 'admin',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (error) {
      await ask({ notice: true, title: 'Kunne ikke ændre rolle', message: error.message });
      return;
    }
    fetchUsers();
  };

  const togglePhoneExempt = async (targetUser) => {
    if (!targetUser?.id) return;
    const next = !targetUser.phone_verification_exempt;
    const displayName = adminDisplayName(targetUser);
    const ok = await ask({
      message: next
        ? `Slå telefon-krav fra for ${displayName}? (fx testkonto — kan logge ind uden SMS-bekræftet nummer.)`
        : `Kræv telefon-SMS igen for ${displayName}?`,
      confirmLabel: next ? 'Ja, undtag' : 'Ja, kræv telefon',
    });
    if (!ok) return;

    const { data, error } = await supabase.rpc('admin_set_phone_verification_exempt', {
      p_user_id: targetUser.id,
      p_exempt: next,
    });

    if (error) {
      const msg = String(error.message || '');
      await ask({
        message: msg.includes('admin_set_phone_verification_exempt')
          ? 'DB-funktion mangler: kør supabase/sql/phone_verification_exempt.sql og admin_security_phase3_rpc.sql i Supabase.'
          : `Kunne ikke opdatere: ${msg || 'ukendt fejl'}`,
        notice: true,
      });
      return;
    }
    if (data?.error) {
      await ask({ message: String(data.error), notice: true });
      return;
    }
    fetchUsers();
  };

  const deleteUser = async (targetUser) => {
    if (!targetUser?.id) return;
    const displayName = adminDisplayName(targetUser);

    const ok = await ask({
      message:
        `Slet spilleren "${displayName}" permanent?\n\n` +
        'Dette sletter også login, profil og tilknyttede kampdata for spilleren.',
      confirmLabel: 'Ja, slet spiller',
      danger: true,
    });
    if (!ok) return;
    setDeleteTargetUser(targetUser);
    setDeletePin('');
    setDeletePinError('');
    setDeletePinOpen(true);
  };

  const closeDeletePinModal = (force = false) => {
    if (deletePinBusy && !force) return;
    setDeletePinOpen(false);
    setDeleteTargetUser(null);
    setDeletePin('');
    setDeletePinError('');
  };

  const confirmDeleteWithPin = async () => {
    if (!deleteTargetUser?.id) return;
    const pin = digitsOnly(deletePin);
    if (!isSixDigitPin(pin)) {
      setDeletePinError('Indtast din 6-cifrede admin-kode.');
      return;
    }

    setDeletePinBusy(true);
    setDeletePinError('');
    try {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        p_user_id: deleteTargetUser.id,
        p_pin: pin,
      });

      if (error) {
        const msg = String(error?.message || '');
        const fnMissing = msg.includes('Could not find the function public.admin_delete_user');
        await ask({
          message: fnMissing
            ? 'DB-funktion mangler eller er for gammel: kør SQL-scriptet "supabase/sql/admin_delete_user.sql" i Supabase SQL Editor først.'
            : `Kunne ikke slette spilleren: ${msg || 'ukendt fejl'}`,
          notice: true,
        });
        return;
      }

      if (data?.error) {
        setDeletePinError(String(data.error));
        return;
      }

      const displayName = adminDisplayName(deleteTargetUser);
      if (editingUser?.id === deleteTargetUser.id) closeUserEditor();
      closeDeletePinModal(true);
      await ask({ message: `Spiller slettet: ${displayName}`, notice: true });
      fetchUsers();
    } finally {
      setDeletePinBusy(false);
    }
  };

  const deleteMatch = async (matchId) => {
    const ok = await ask({
      message: 'Er du helt sikker på at du vil slette denne kamp? Dette kan ikke fortrydes og vil påvirke ELO.',
      confirmLabel: 'Ja, slet kamp',
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);

    if (error) {
      console.error('Delete error:', error);
      await ask({ message: 'Kunne ikke slette kampen: ' + error.message, notice: true });
    } else {
      fetchMatches();
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser || editingUserSaving) return;

    try {
      setEditingUserSaving(true);
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          name: editingUser.full_name,
          level: Number(editingUser.level),
          play_style: editingUser.play_style,
          area: editingUser.area,
          bio: editingUser.bio,
          court_side: editingUser.court_side,
          is_banned: editingUser.is_banned,
          ban_reason: editingUser.ban_reason
        })
        .eq('id', editingUser.id);

      if (profErr) throw profErr;

      const { error: eloErr } = await supabase
        .rpc('admin_adjust_elo', { 
          p_user_id: editingUser.id, 
          p_new_elo: Number(editingUser.elo_rating) 
        });

      if (eloErr) throw eloErr;

      const { error: americanoEloErr } = await supabase
        .rpc('admin_adjust_americano_elo', {
          p_user_id: editingUser.id,
          p_new_elo: Number(editingUser.americano_elo_rating),
        });

      if (americanoEloErr) throw americanoEloErr;

      const { data: exemptData, error: exemptRpcErr } = await supabase.rpc(
        'admin_set_phone_verification_exempt',
        {
          p_user_id: editingUser.id,
          p_exempt: editingUser.phone_verification_exempt === true,
        },
      );
      if (exemptRpcErr && !String(exemptRpcErr.message || '').includes('admin_set_phone_verification_exempt')) {
        throw exemptRpcErr;
      }
      if (exemptData?.error) throw new Error(String(exemptData.error));
      
      closeUserEditor();
      setTimeout(() => fetchUsers(), 300);
      await ask({ message: 'Bruger blev opdateret.', notice: true });
    } catch (err) {
      await ask({ message: 'Fejl ved opdatering: ' + (err.message || 'Ukendt fejl'), notice: true });
    } finally {
      setEditingUserSaving(false);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig.key) {
      sortableUsers.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Special håndtering af roller (Admin > Player)
        if (sortConfig.key === 'role') {
          const priority = { admin: 1, player: 2 };
          aValue = priority[aValue] || 3;
          bValue = priority[bValue] || 3;
        } else if (sortConfig.key === 'full_name') {
          aValue = adminDisplayName(a).toLowerCase();
          bValue = adminDisplayName(b).toLowerCase();
        } else {
          aValue = aValue == null ? '' : aValue;
          bValue = bValue == null ? '' : bValue;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const filteredUsers = sortedUsers.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      adminDisplayName(u).toLowerCase().includes(q) ||
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q)
    );
  });

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} style={{ marginLeft: '4px', color: theme.accent }} /> 
      : <ChevronDown size={12} style={{ marginLeft: '4px', color: theme.accent }} />;
  };

  const filteredFlags = useMemo(
    () =>
      filterRatingAdminFlags(ratingFlags, {
        flagSearch,
        flagStatusFilter,
        flagSourceFilter,
        flagSeverityFilter,
      }),
    [ratingFlags, flagSearch, flagStatusFilter, flagSourceFilter, flagSeverityFilter],
  );

  const flagStatusBadgeColor = (status) => {
    if (status === 'open') return { text: theme.red, bg: theme.redBg };
    if (status === 'reviewed') return { text: theme.warm, bg: theme.warmBg };
    return { text: theme.accent, bg: theme.accentBg };
  };

  const flagSeverityBadgeColor = (severity) => {
    if (severity === 'high') return { text: theme.red, bg: theme.redBg };
    if (severity === 'medium') return { text: theme.warm, bg: theme.warmBg };
    return { text: theme.textMid, bg: theme.surfaceAlt };
  };

  const statusLabelDa = (status) => {
    if (status === 'open') return 'Åben';
    if (status === 'reviewed') return 'Gennemgået';
    if (status === 'closed') return 'Lukket';
    return status || 'Ukendt';
  };

  const severityLabelDa = (severity) => {
    if (severity === 'high') return 'Høj';
    if (severity === 'medium') return 'Mellem';
    if (severity === 'low') return 'Lav';
    return severity || 'Ukendt';
  };

  const updateFlag = async (flag, nextStatus) => {
    if (!flag?.id) return;
    const note = String(flagNotes[flag.id] || '').trim();
    setFlagBusyId(flag.id);
    try {
      const updates = buildRatingFlagStatusUpdate(nextStatus, {
        userId: user?.id || null,
        note,
      });

      const { error } = await supabase
        .from('rating_admin_flags')
        .update(updates)
        .eq('id', flag.id);
      if (error) {
        await ask({ message: 'Kunne ikke opdatere flag: ' + error.message, notice: true });
        return;
      }
      await fetchAdminConsole();
      await refreshSubTabBadges();
      if (nextStatus !== 'open') {
        setExpandedFlags((prev) => ({ ...prev, [flag.id]: false }));
      }
    } finally {
      setFlagBusyId(null);
    }
  };

  const filteredMatches = useMemo(
    () => sortAndFilterAdminMatches(matches, '2v2', matchStatusFilter),
    [matches, matchStatusFilter],
  );
  const filteredAmericano = useMemo(
    () => sortAndFilterAdminMatches(americanoTournaments, 'americano', matchStatusFilter),
    [americanoTournaments, matchStatusFilter],
  );
  const filteredLiga = useMemo(
    () => sortAndFilterAdminMatches(ligaLeagues, 'liga', matchStatusFilter),
    [ligaLeagues, matchStatusFilter],
  );

  const adminSubTabs = [
    { id: 'oversigt', label: 'Oversigt', shortLabel: 'Oversigt', icon: LayoutDashboard, badgeKey: null },
    { id: 'users', label: 'Brugere', shortLabel: 'Brugere', icon: User, badgeKey: 'users' },
    { id: 'matches', label: 'Kampe', shortLabel: 'Kampe', icon: Swords, badgeKey: 'matches' },
    { id: 'reports', label: 'Anmeldelser', shortLabel: 'Anmeld.', icon: Flag, badgeKey: 'reports' },
    { id: 'result_errors', label: 'Fejl', shortLabel: 'Fejl', icon: AlertCircle, badgeKey: 'resultErrors' },
    { id: 'console', label: 'Konsol', shortLabel: 'Konsol', icon: AlertTriangle, badgeKey: 'console' },
  ];

  const adminSubTabPills = useMemo(
    () =>
      adminSubTabs.map((t) => {
        const Icon = t.icon;
        const badgeCount = subTabBadges[t.badgeKey] || 0;
        return {
          id: t.id,
          label: (
            <span className="pm-admin-subtab-label">
              <span className="pm-admin-subtab-main">
                <Icon size={14} aria-hidden />
                {isMobile ? t.shortLabel : t.label}
              </span>
              {badgeCount > 0 ? (
                <span className="pm-admin-subtab-badge" aria-hidden>
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              ) : null}
            </span>
          ),
        };
      }),
    [isMobile, subTabBadges],
  );

  const matchTypePills = [
    { id: '2v2', label: '2v2-kampe' },
    { id: 'americano', label: 'Americano/Mexicano' },
    { id: 'liga', label: '🏆 Liga' },
  ];

  const matchStatusPills = ADMIN_MATCH_STATUS_FILTERS.map((f) => ({
    id: f.id,
    label: f.label,
  }));

  const reportStatusPills = [
    { id: 'open', label: 'Åbne' },
    { id: 'reviewed', label: 'Gennemgået' },
    { id: 'dismissed', label: 'Afvist' },
    { id: 'all', label: 'Alle' },
  ];

  const resultErrorStatusPills = [
    { id: 'open', label: 'Åbne' },
    { id: 'resolved', label: 'Løst' },
    { id: 'dismissed', label: 'Afvist' },
    { id: 'all', label: 'Alle' },
  ];

  return (
    <div className="pm-admin-page">
      <div className="pm-admin-header">
        <h2 style={{ ...heading('20px') }}>Admin Panel</h2>
        <PillTabs
          tabs={adminSubTabPills}
          value={activeSubTab}
          onChange={setActiveSubTab}
          ariaLabel="Admin sektion"
          size="sm"
          className="pm-admin-subtabs"
        />
      </div>

      {activeSubTab === 'oversigt' ? (
        <div className="pm-admin-overview">
          <div className="pm-admin-toolbar">
            <h3 className="pm-admin-section-title">Oversigt</h3>
            <button
              type="button"
              onClick={() => { void fetchAdminConsole(); }}
              className="pm-admin-refresh-btn"
              style={btn(false)}
              disabled={consoleLoading}
            >
              <RefreshCw size={13} style={{ marginRight: '6px', opacity: consoleLoading ? 0.6 : 1 }} />
              Opdater
            </button>
          </div>

          <div className="pm-admin-kpi-grid">
            {[
              {
                key: 'players',
                label: 'Spillere',
                value: consoleStats.totalPlayers,
                footer: `${consoleStats.bannedPlayers} bannet`,
                accent: theme.accent,
                target: 'users',
              },
              {
                key: 'matches',
                label: 'Kampe i gang',
                value: consoleStats.inProgressMatches,
                footer: `${consoleStats.openMatches} åbne · ${consoleStats.completedMatches24h} afsl. (24t)`,
                accent: theme.text,
                target: 'matches',
              },
              {
                key: 'tournaments',
                label: 'Aktive turneringer',
                value: consoleStats.americanoActive,
                footer: `${consoleStats.americanoOpen} åbne · ${consoleStats.americanoCompleted7d} afsl. (7d)`,
                accent: theme.accent,
                target: 'matches',
              },
              {
                key: 'reports',
                label: 'Anmeldelser',
                value: subTabBadges.reports || 0,
                footer: 'Brugeranmeldelser',
                accent: (subTabBadges.reports || 0) > 0 ? theme.red : theme.textMid,
                target: 'reports',
              },
              {
                key: 'resultErrors',
                label: 'Resultat-fejl',
                value: subTabBadges.resultErrors || 0,
                footer: `${consoleStats.pendingResults} afventer bekræft.`,
                accent: (subTabBadges.resultErrors || 0) > 0 ? theme.warm : theme.textMid,
                target: 'result_errors',
              },
              {
                key: 'flags',
                label: 'Flags',
                value: consoleStats.openFlags,
                footer: `${consoleStats.highFlags} høj risiko`,
                accent: consoleStats.openFlags > 0 ? theme.red : theme.textMid,
                target: 'console',
              },
            ].map((card) => {
              const tabExists = adminSubTabPills.some((t) => t.id === card.target);
              return (
                <button
                  key={card.key}
                  type="button"
                  className="pm-ui-card pm-admin-kpi-card"
                  onClick={() => { if (tabExists) setActiveSubTab(card.target); }}
                  disabled={!tabExists}
                  style={{ borderLeft: `3px solid ${card.accent}` }}
                >
                  <div className="pm-admin-kpi-top">
                    <span className="pm-admin-kpi-label">{card.label}</span>
                    {tabExists ? <ChevronRight size={16} className="pm-admin-kpi-chevron" aria-hidden /> : null}
                  </div>
                  <div className="pm-admin-kpi-value" style={{ color: card.accent }}>
                    {card.value}
                  </div>
                  <div className="pm-admin-kpi-footer">{card.footer}</div>
                </button>
              );
            })}
          </div>

          <div className="pm-ui-card pm-admin-console-panel">
            <div className="pm-admin-console-panel-head">
              <div className="pm-admin-console-panel-title">Seneste aktivitet</div>
              <div className="pm-admin-console-panel-meta">
                {consoleLoading ? 'Indlæser...' : `${auditLog.length} poster`}
              </div>
            </div>
            {auditLogError ? <div className="pm-admin-error-msg">{auditLogError}</div> : null}
            {!auditLogError && auditLog.length === 0 && !consoleLoading ? (
              <div className="pm-admin-empty">Ingen aktivitet endnu.</div>
            ) : null}
            {auditLog.length > 0 ? (
              <div className="pm-admin-audit-list">
                {auditLog.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="pm-admin-audit-entry">
                    <div className="pm-admin-audit-entry-head">
                      <span className="pm-admin-audit-action">{adminAuditActionLabel(entry.action)}</span>
                      <span className="pm-admin-audit-time">{formatDateTimeDa(entry.created_at)}</span>
                    </div>
                    {entry.target_user_id ? (
                      <div className="pm-admin-audit-target">
                        Bruger: {String(entry.target_user_id).slice(0, 8)}…
                      </div>
                    ) : null}
                  </div>
                ))}
                {auditLog.length > 8 ? (
                  <button
                    type="button"
                    className="pm-admin-audit-more"
                    onClick={() => setActiveSubTab('console')}
                    style={btn(false)}
                  >
                    Se hele admin-loggen
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : activeSubTab === 'users' ? (
        <>
          <div className="pm-admin-search" style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} className="pm-admin-search-icon" aria-hidden />
              <input
                type="text"
                className="pm-admin-search-input"
                placeholder="Søg..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => { void fetchUsers(); }}
              disabled={loading}
              className="pm-admin-refresh-btn"
              style={{ ...btn(false), flexShrink: 0, alignSelf: 'center' }}
              title="Hent seneste brugerdata"
            >
              <RefreshCw size={14} style={{ marginRight: 4, opacity: loading ? 0.5 : 1 }} aria-hidden />
              Opdater
            </button>
          </div>

          <div className="pm-admin-sort-row">
            <span className="pm-admin-sort-label">Sortér:</span>
            <button
              type="button"
              onClick={() => requestSort('full_name')}
              className="pm-admin-sort-btn"
              style={btn(sortConfig.key === 'full_name', { size: 'sm', radius: 'pill' })}
            >
              Navn <SortIcon columnKey="full_name" />
            </button>
            <button
              type="button"
              onClick={() => requestSort('elo_rating')}
              className="pm-admin-sort-btn"
              style={btn(sortConfig.key === 'elo_rating', { size: 'sm', radius: 'pill' })}
            >
              ELO <SortIcon columnKey="elo_rating" />
            </button>
            <button
              type="button"
              onClick={() => requestSort('role')}
              className="pm-admin-sort-btn"
              style={btn(sortConfig.key === 'role', { size: 'sm', radius: 'pill' })}
            >
              Rolle <SortIcon columnKey="role" />
            </button>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="pm-ui-card pm-admin-empty">Ingen spillere matcher søgningen.</div>
          ) : (
            <div className="pm-admin-card-list pm-admin-card-list--grid">
              {filteredUsers.map((u) => (
                <div key={u.id} className="pm-ui-card pm-admin-card">
                  <div className="pm-admin-card-top">
                    <div className="pm-admin-card-user">
                      <AvatarCircle avatar={u.avatar || '🎾'} size={40} />
                      <div>
                        <div className="pm-admin-user-name" style={{ fontSize: '15px' }}>{adminDisplayName(u)}</div>
                        <div className="pm-admin-user-email" style={{ fontSize: '12px' }}>{u.email}</div>
                      </div>
                    </div>
                    <div className="pm-admin-card-elo">
                      <div className="pm-admin-card-elo-value">{u.elo_rating || 1000}</div>
                      <div className="pm-admin-card-elo-label">ELO</div>
                    </div>
                  </div>
                  <div className="pm-admin-card-footer">
                    <div className="pm-admin-badge-row">
                      <span className={u.role === 'admin' ? 'pm-admin-badge pm-admin-badge--admin pm-admin-badge--sm' : 'pm-admin-badge pm-admin-badge--sm'}>
                        {u.role}
                      </span>
                      {u.is_banned && <span className="pm-admin-badge pm-admin-badge--danger pm-admin-badge--sm">Bannet</span>}
                      {u.phone_verification_exempt && (
                        <span className="pm-admin-badge pm-admin-badge--muted pm-admin-badge--sm">Ingen SMS</span>
                      )}
                    </div>
                    <div className="pm-admin-actions pm-admin-actions--tight">
                      <button
                        type="button"
                        onClick={() => togglePhoneExempt(u)}
                        className={`pm-admin-mobile-action pm-admin-mobile-action--neutral ${u.phone_verification_exempt ? 'pm-admin-mobile-action--accent' : ''}`}
                        title={u.phone_verification_exempt ? 'Kræv telefon-SMS' : 'Undtag telefon-SMS (testkonto)'}
                      >
                        <Smartphone size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(u)}
                        className="pm-admin-mobile-action pm-admin-mobile-action--danger"
                        title="Slet spiller"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAdmin(u)}
                        className={u.role === 'admin' ? 'pm-admin-mobile-action pm-admin-mobile-action--admin-off' : 'pm-admin-mobile-action pm-admin-mobile-action--accent'}
                        title={u.role === 'admin' ? 'Fjern admin' : 'Gør til admin'}
                      >
                        {u.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                      </button>
                      <button type="button" onClick={() => { void openUserEditor(u); }} className="pm-admin-mobile-edit">
                        <Edit2 size={16} /> Rediger
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeSubTab === 'matches' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => { void refreshActiveAdminTab(); }}
              disabled={loading || editMatchLoading}
              className="pm-admin-refresh-btn"
              style={btn(false)}
              title="Hent seneste kampdata"
            >
              <RefreshCw size={14} style={{ marginRight: 4, opacity: loading || editMatchLoading ? 0.5 : 1 }} aria-hidden />
              Opdater
            </button>
          </div>
          <PillTabs
            tabs={matchTypePills}
            value={matchSubTab}
            onChange={(id) => {
              setMatchSubTab(id);
              setMatchStatusFilter('all');
            }}
            ariaLabel="Kamp-type"
            size="sm"
            className="pm-admin-filter-tabs"
            style={{ marginBottom: '10px' }}
          />

          <PillTabs
            tabs={matchStatusPills}
            value={matchStatusFilter}
            onChange={setMatchStatusFilter}
            ariaLabel="Kamp-status"
            size="sm"
            className="pm-admin-filter-tabs"
          />

          {/* ── Americano ── */}
          {matchSubTab === 'americano' && (
            <div className="pm-admin-list">
              <h3 className="pm-admin-section-title">Americano/Mexicano</h3>
              {americanoTournaments.length === 0 && <div className="pm-admin-empty">Ingen Americano/Mexicano fundet.</div>}
              {americanoTournaments.length > 0 && filteredAmericano.length === 0 && (
                <div className="pm-admin-empty">Ingen Americano/Mexicano i denne kategori.</div>
              )}
              {filteredAmericano.map(t => {
                const statusLabel = t.status === 'completed' ? 'Afsluttet' : t.status === 'playing' || t.status === 'active' ? 'I gang' : 'Åben';
                const statusColor = t.status === 'completed' ? theme.accent : t.status === 'playing' || t.status === 'active' ? theme.green : theme.textMid;
                const canEditResults = t.status === 'completed';
                return (
                  <div key={t.id} className="pm-ui-card pm-admin-row-card">
                    <div className="pm-admin-row-card-body">
                      <div className="pm-admin-row-card-title">{t.name}</div>
                      <div className="pm-admin-row-card-meta">
                        <span>{t.tournament_date || formatEloHistoryDate(t.created_at)}</span>
                        <span className="pm-admin-status-pill" style={{ color: statusColor, background: `${statusColor}15` }}>{statusLabel}</span>
                      </div>
                    </div>
                    <div className="pm-admin-row-actions">
                      {canEditResults ? (
                        <button
                          type="button"
                          onClick={() => setEditAmericanoTarget(t)}
                          className="pm-admin-action-btn pm-admin-action-btn--edit"
                          title="Ret resultater og genberegn Americano/Mexicano ELO"
                        >
                          <Edit2 size={16} />
                          Ret resultater
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteAmericano(t.id, t.name)}
                        className="pm-admin-action-btn pm-admin-action-btn--delete"
                        title="Slet Americano/Mexicano"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Liga ── */}
          {matchSubTab === 'liga' && (
            <div className="pm-admin-list">
              <h3 className="pm-admin-section-title">Ligaer</h3>
              {ligaLeagues.length === 0 && <div className="pm-admin-empty">Ingen ligaer fundet.</div>}
              {ligaLeagues.length > 0 && filteredLiga.length === 0 && (
                <div className="pm-admin-empty">Ingen ligaer i denne kategori.</div>
              )}
              {filteredLiga.map(l => {
                const statusLabel = l.status === 'completed' ? 'Afsluttet' : l.status === 'active' ? 'I gang' : 'Åben';
                const statusColor = l.status === 'completed' ? theme.textMid : l.status === 'active' ? theme.green : theme.warm;
                const canEditLigaResults = l.status === 'active' || l.status === 'completed';
                return (
                  <div key={l.id} className="pm-ui-card pm-admin-row-card">
                    <div className="pm-admin-row-card-body">
                      <div className="pm-admin-row-card-title">{l.name}</div>
                      <div className="pm-admin-row-card-meta">
                        <span className="pm-admin-status-pill" style={{ color: statusColor, background: `${statusColor}18` }}>{statusLabel}</span>
                        <span>{l.team_count} hold</span>
                        {l.status === 'active' && <span>Runde {l.current_round}{l.total_rounds ? `/${l.total_rounds}` : ''}</span>}
                        <span>{formatEloHistoryDate(l.start_date)} – {formatEloHistoryDate(l.end_date)}</span>
                      </div>
                    </div>
                    <div className="pm-admin-row-actions">
                      {canEditLigaResults ? (
                        <button
                          type="button"
                          onClick={() => setEditLigaTarget(l)}
                          className="pm-admin-action-btn pm-admin-action-btn--edit"
                          title="Ret rapporterede kampresultater"
                        >
                          <Edit2 size={16} />
                          Ret resultater
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteLiga(l.id, l.name)}
                        className="pm-admin-action-btn pm-admin-action-btn--delete"
                        title="Slet liga"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 2v2 kampe ── */}
          {matchSubTab === '2v2' && (
            <div className="pm-admin-list">
              <h3 className="pm-admin-section-title">Admin: Detaljeret Kamp-overblik</h3>
              {subTabBadges.matches > 0 ? (
                <p className="pm-admin-help-copy">
                  Badge på Kampe = {subTabBadges.matches} kampresultat{subTabBadges.matches > 1 ? 'er' : ''} afventer spillernes bekræftelse (markeret «Afventer bekræftelse» nedenfor).
                </p>
              ) : null}
              {matches.length === 0 && <div className="pm-admin-empty">Ingen kampe fundet.</div>}
              {matches.length > 0 && filteredMatches.length === 0 && (
                <div className="pm-admin-empty">Ingen kampe i denne kategori.</div>
              )}
              {filteredMatches.map((m) => {
                const t1 = (m.match_players || []).filter((p) => p.team === 1);
                const t2 = (m.match_players || []).filter((p) => p.team === 2);
                const status = m.status;
                const statusColor = status === 'completed' ? theme.accent : status === 'in_progress' ? theme.warm : theme.textMid;
                const statusLabel = status === 'completed' ? 'Afsluttet' : status === 'in_progress' ? 'I gang' : status === 'full' ? 'Fuld' : 'Åben';
                const confirmedResult = (m.match_results || []).find((r) => r.confirmed) || null;
                const pendingResult = (m.match_results || []).find((r) => !r.confirmed) || null;
                const canEditResult = status === 'completed' && confirmedResult;

                return (
                  <div key={m.id} className="pm-ui-card pm-admin-match-card">
                    <div className="pm-admin-match-card-head">
                      <div>
                        <div className="pm-admin-match-dates">
                          <div>
                            <strong>Oprettet:</strong> {formatEloHistoryDate(m.created_at)}
                          </div>
                          {m.completed_at ? (
                            <div className="pm-admin-match-played">
                              Spillet: {formatEloHistoryDate(m.completed_at)} • {m.court_name || 'Ukendt bane'}
                            </div>
                          ) : (
                            <div style={{ marginTop: '2px' }}>{m.court_name || 'Ukendt bane'}</div>
                          )}
                        </div>
                        <div className="pm-admin-match-score-row">
                          <span className="pm-admin-status-pill" style={{ color: statusColor, background: `${statusColor}15` }}>
                            {statusLabel}
                          </span>
                          {pendingResult ? (
                            <span className="pm-admin-status-pill" style={{ color: theme.red, background: theme.redBg }}>
                              Afventer bekræftelse
                            </span>
                          ) : null}
                          <div className="pm-admin-match-score">
                            {m.match_results?.[0]?.score_display || 'Ingen score'}
                          </div>
                        </div>
                      </div>
                      <div className="pm-admin-row-actions">
                        {canEditResult ? (
                          <button
                            type="button"
                            onClick={() => { void openMatchResultEditor(m.id); }}
                            disabled={editMatchLoading}
                            className="pm-admin-action-btn pm-admin-action-btn--edit"
                            title="Ret resultat og genberegn ELO"
                          >
                            <Edit2 size={16} />
                            Ret resultat
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => deleteMatch(m.id)}
                          className="pm-admin-action-btn pm-admin-action-btn--delete"
                          title="Slet kamp"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className={`pm-admin-match-teams ${isMobile ? 'pm-admin-match-teams--stack' : ''}`}>
                      <div className={`pm-admin-match-team ${isMobile ? 'pm-admin-match-team--center' : 'pm-admin-match-team--right'}`}>
                        {t1.length > 0 ? (
                          t1.map((p) => (
                            <div key={p.user_id}>{p.profiles?.full_name || 'Ukendt'}</div>
                          ))
                        ) : (
                          <div className="pm-admin-match-empty-team">Ingen spillere</div>
                        )}
                      </div>
                      <div className="pm-admin-match-vs">VS</div>
                      <div className={`pm-admin-match-team ${isMobile ? 'pm-admin-match-team--center' : 'pm-admin-match-team--left'}`}>
                        {t2.length > 0 ? (
                          t2.map((p) => (
                            <div key={p.user_id}>{p.profiles?.full_name || 'Ukendt'}</div>
                          ))
                        ) : (
                          <div className="pm-admin-match-empty-team">Ingen spillere</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {editMatchTarget ? (
            <AdminMatchResultEditor
              match={editMatchTarget.match}
              matchResult={editMatchTarget.matchResult}
              players={editMatchTarget.players}
              onClose={() => setEditMatchTarget(null)}
              onSaved={() => {
                setEditMatchTarget(null);
                void fetchMatches();
                void refreshSubTabBadges();
              }}
            />
          ) : null}
          {editAmericanoTarget ? (
            <AdminAmericanoResultEditor
              tournament={editAmericanoTarget}
              onClose={() => setEditAmericanoTarget(null)}
              onSaved={() => {
                setEditAmericanoTarget(null);
                void fetchAmericano();
                void refreshSubTabBadges();
              }}
            />
          ) : null}
          {editLigaTarget ? (
            <AdminLeagueResultEditor
              league={editLigaTarget}
              onClose={() => setEditLigaTarget(null)}
              onSaved={() => {
                void fetchLiga();
                void refreshSubTabBadges();
              }}
            />
          ) : null}
        </div>
      ) : activeSubTab === 'reports' ? (
        <div className="pm-admin-list">
          <div className="pm-admin-toolbar">
            <h3 className="pm-admin-section-title">Spilleranmeldelser</h3>
            <div className="pm-admin-toolbar-actions">
              <PillTabs
                tabs={reportStatusPills}
                value={reportStatusFilter}
                onChange={setReportStatusFilter}
                ariaLabel="Anmeldelsesstatus"
                size="sm"
                className="pm-admin-filter-tabs"
              />
              <button
                type="button"
                onClick={() => { void fetchUserReports(); }}
                className="pm-admin-refresh-btn"
                style={btn(false)}
                disabled={reportsLoading}
              >
                <RefreshCw size={13} style={{ marginRight: 4, opacity: reportsLoading ? 0.6 : 1 }} />
                Opdater
              </button>
            </div>
          </div>

          {reportsError ? <div className="pm-admin-error-msg">{reportsError}</div> : null}
          {reportsLoading ? (
            <div className="pm-admin-loading">Indlæser anmeldelser…</div>
          ) : userReports.length === 0 ? (
            <div className="pm-state-card pm-state-card--empty">Ingen anmeldelser i denne visning.</div>
          ) : (
            <div className="pm-admin-list">
              {userReports.map((report) => {
                const reporterName = adminDisplayName(report.reporter);
                const reportedName = adminDisplayName(report.reported);
                const statusColors =
                  report.status === 'open'
                    ? { text: theme.red, bg: theme.redBg }
                    : report.status === 'reviewed'
                      ? { text: theme.green, bg: theme.greenBg }
                      : { text: theme.textMid, bg: theme.surfaceAlt };
                return (
                  <div key={report.id} className="pm-ui-card pm-admin-report-card">
                    <div className="pm-admin-report-head">
                      <div className="pm-admin-report-title">
                        {reporterName} → {reportedName}
                      </div>
                      <span
                        className="pm-admin-status-pill"
                        style={{ color: statusColors.text, background: statusColors.bg, borderRadius: 999 }}
                      >
                        {report.status === 'open'
                          ? 'Åben'
                          : report.status === 'reviewed'
                            ? 'Gennemgået'
                            : 'Afvist'}
                      </span>
                    </div>
                    <div className="pm-admin-report-meta">
                      {formatDateTimeDa(report.created_at)} · {reportReasonLabel(report.reason)} ·{' '}
                      {report.context || 'dm'}
                    </div>
                    {report.details ? <div className="pm-admin-report-body">{report.details}</div> : null}
                    <div className="pm-admin-report-actions">
                      {report.status !== 'reviewed' && (
                        <button
                          type="button"
                          disabled={reportBusyId === report.id}
                          onClick={() => { void updateUserReportStatus(report, 'reviewed'); }}
                          className="pm-admin-action-chip"
                          style={btn(true)}
                        >
                          <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                          Marker gennemgået
                        </button>
                      )}
                      {report.status !== 'dismissed' && (
                        <button
                          type="button"
                          disabled={reportBusyId === report.id}
                          onClick={() => { void updateUserReportStatus(report, 'dismissed'); }}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          Afvis
                        </button>
                      )}
                      {report.status !== 'open' && (
                        <button
                          type="button"
                          disabled={reportBusyId === report.id}
                          onClick={() => { void updateUserReportStatus(report, 'open'); }}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          Genåbn
                        </button>
                      )}
                      {(report.context === 'dm' || !report.context) && (
                        <button
                          type="button"
                          onClick={() => setDmViewerReport(report)}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          <MessageCircle size={13} style={{ marginRight: 4 }} />
                          Vis DM-samtale
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void openUserEditor({
                            id: report.reported_id,
                            full_name: report.reported?.full_name,
                            name: report.reported?.name,
                            email: report.reported?.email,
                          });
                        }}
                        className="pm-admin-action-chip"
                        style={btn(false)}
                      >
                        Åbn anmeldt profil
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeSubTab === 'result_errors' ? (
        <div className="pm-admin-list">
          <div className="pm-admin-toolbar">
            <h3 className="pm-admin-section-title">Fejl i resultater</h3>
            <div className="pm-admin-toolbar-actions">
              <PillTabs
                tabs={resultErrorStatusPills}
                value={resultErrorStatusFilter}
                onChange={setResultErrorStatusFilter}
                ariaLabel="Fejlindberetningsstatus"
                size="sm"
                className="pm-admin-filter-tabs"
              />
              <button
                type="button"
                onClick={() => { void fetchResultErrorReports(); }}
                className="pm-admin-refresh-btn"
                style={btn(false)}
                disabled={resultErrorsLoading}
              >
                <RefreshCw size={13} style={{ marginRight: 4, opacity: resultErrorsLoading ? 0.6 : 1 }} />
                Opdater
              </button>
            </div>
          </div>
          <p className="pm-admin-help-copy">
            Oprettere kan indberette fejl inden 24 timer efter afslutning. Gå til Kampe for at rette data.
          </p>
          {resultErrorsError ? <div className="pm-admin-error-msg">{resultErrorsError}</div> : null}
          {resultErrorsLoading ? (
            <div className="pm-admin-loading">Indlæser fejlindberetninger…</div>
          ) : resultErrorReports.length === 0 ? (
            <div className="pm-state-card pm-state-card--empty">Ingen fejlindberetninger i denne visning.</div>
          ) : (
            <div className="pm-admin-list">
              {resultErrorReports.map((report) => {
                const reporterName = adminDisplayName(report.reporter);
                const statusColors =
                  report.status === 'open'
                    ? { text: theme.red, bg: theme.redBg }
                    : report.status === 'resolved'
                      ? { text: theme.green, bg: theme.greenBg }
                      : { text: theme.textMid, bg: theme.surfaceAlt };
                return (
                  <div key={report.id} className="pm-ui-card pm-admin-report-card">
                    <div className="pm-admin-report-head">
                      <div className="pm-admin-report-title">
                        {reporterName} · {resultErrorSourceLabel(report.source_type)}
                      </div>
                      <span
                        className="pm-admin-status-pill"
                        style={{ color: statusColors.text, background: statusColors.bg, borderRadius: 999 }}
                      >
                        {report.status === 'open'
                          ? 'Åben'
                          : report.status === 'resolved'
                            ? 'Løst'
                            : 'Afvist'}
                      </span>
                    </div>
                    <div className="pm-admin-report-meta">
                      {formatDateTimeDa(report.created_at)} · {resultErrorReasonLabel(report.reason)}
                    </div>
                    <div className="pm-admin-report-entity">{report.entityLabel}</div>
                    {report.details ? <div className="pm-admin-report-body">{report.details}</div> : null}
                    <div className="pm-admin-report-foot">
                      Afsluttet: {formatDateTimeDa(report.entity_completed_at)} · ID: {report.entity_id}
                    </div>
                    <div className="pm-admin-report-actions">
                      {report.status !== 'resolved' ? (
                        <button
                          type="button"
                          disabled={resultErrorBusyId === report.id}
                          onClick={() => updateResultErrorReportStatus(report, 'resolved')}
                          className="pm-admin-action-chip"
                          style={btn(true)}
                        >
                          <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                          Marker løst
                        </button>
                      ) : null}
                      {report.status !== 'dismissed' ? (
                        <button
                          type="button"
                          disabled={resultErrorBusyId === report.id}
                          onClick={() => updateResultErrorReportStatus(report, 'dismissed')}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          Afvis
                        </button>
                      ) : null}
                      {report.status !== 'open' ? (
                        <button
                          type="button"
                          disabled={resultErrorBusyId === report.id}
                          onClick={() => updateResultErrorReportStatus(report, 'open')}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          Genåbn
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSubTab('matches');
                          if (report.source_type === 'match_2v2') setMatchSubTab('2v2');
                          else if (report.source_type === 'americano') setMatchSubTab('americano');
                          else setMatchSubTab('liga');
                        }}
                        className="pm-admin-action-chip"
                        style={btn(false)}
                      >
                        Åbn i Kampe-værktøjer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="pm-admin-console-stack">
          <div className="pm-admin-toolbar">
            <h3 className="pm-admin-section-title">Admin-konsol</h3>
            <button
              type="button"
              onClick={() => { void fetchAdminConsole(); }}
              className="pm-admin-refresh-btn"
              style={btn(false)}
              disabled={consoleLoading}
            >
              <RefreshCw size={13} style={{ marginRight: '6px', opacity: consoleLoading ? 0.6 : 1 }} />
              Opdater
            </button>
          </div>

          <div className="pm-admin-stat-grid">
            {[
              { key: 'openFlags', label: 'Åbne flags', value: consoleStats.openFlags, color: theme.red },
              { key: 'highFlags', label: 'Høje flags', value: consoleStats.highFlags, color: theme.warm },
              { key: 'pendingResults', label: 'Afventer resultat', value: consoleStats.pendingResults, color: theme.accent },
              { key: 'inProgressMatches', label: 'Kampe i gang', value: consoleStats.inProgressMatches, color: theme.text },
              { key: 'bannedPlayers', label: 'Bannede spillere', value: consoleStats.bannedPlayers, color: theme.textMid },
            ].map((card) => (
              <div key={card.key} className="pm-ui-card pm-admin-stat-card">
                <div className="pm-admin-stat-label">{card.label}</div>
                <div className="pm-admin-stat-value" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div className="pm-admin-info-grid">
            <div className="pm-ui-card pm-admin-info-card">
              <div className="pm-admin-info-label">Spillere</div>
              <div className="pm-admin-info-value">
                {consoleStats.totalPlayers} total, {consoleStats.bannedPlayers} bannet
              </div>
            </div>
            <div className="pm-ui-card pm-admin-info-card">
              <div className="pm-admin-info-label">2v2 matcher</div>
              <div className="pm-admin-info-value">
                {consoleStats.openMatches} åbne, {consoleStats.inProgressMatches} i gang, {consoleStats.completedMatches24h} afsluttet (24t)
              </div>
            </div>
            <div className="pm-ui-card pm-admin-info-card">
              <div className="pm-admin-info-label">Americano</div>
              <div className="pm-admin-info-value">
                {consoleStats.americanoOpen} åbne, {consoleStats.americanoActive} aktive, {consoleStats.americanoCompleted7d} afsluttet (7 dage)
              </div>
            </div>
            <div className="pm-ui-card pm-admin-info-card">
              <div className="pm-admin-info-label">Resultater</div>
              <div className="pm-admin-info-value">{consoleStats.pendingResults} venter på bekræftelse</div>
            </div>
          </div>

          <div className="pm-ui-card pm-admin-console-panel">
            <div className="pm-admin-console-panel-head">
              <div className="pm-admin-console-panel-title">ELO-/Americano-flags</div>
              <div className="pm-admin-console-panel-meta">
                {consoleLoading ? 'Indlæser...' : `${filteredFlags.length} vist / ${ratingFlags.length} i alt`}
              </div>
            </div>

            <div className="pm-admin-flag-filters">
              <input
                type="text"
                placeholder="Søg i årsag, data, kamp-id..."
                value={flagSearch}
                onChange={(e) => setFlagSearch(e.target.value)}
                style={inputStyle}
              />
              <select value={flagStatusFilter} onChange={(e) => setFlagStatusFilter(e.target.value)} style={inputStyle}>
                <option value="open">Kun åbne</option>
                <option value="reviewed">Gennemgået</option>
                <option value="closed">Lukket</option>
                <option value="all">Alle status</option>
              </select>
              <select value={flagSeverityFilter} onChange={(e) => setFlagSeverityFilter(e.target.value)} style={inputStyle}>
                <option value="all">Alle alvorlighedsgrader</option>
                <option value="high">Høj</option>
                <option value="medium">Mellem</option>
                <option value="low">Lav</option>
              </select>
              <select value={flagSourceFilter} onChange={(e) => setFlagSourceFilter(e.target.value)} style={inputStyle}>
                <option value="all">Alle kilder</option>
                <option value="2v2">2v2</option>
                <option value="americano">Americano</option>
              </select>
            </div>

            {consoleError ? <div className="pm-admin-alert-box">{consoleError}</div> : null}

            {!consoleError && filteredFlags.length === 0 ? (
              <div className="pm-admin-empty">Ingen flags med nuværende filter.</div>
            ) : null}

            {!consoleError &&
              filteredFlags.map((flag) => {
                const explanation = explainRatingAdminFlag(flag);
                const statusBadge = flagStatusBadgeColor(flag.status);
                const severityBadge = flagSeverityBadgeColor(flag.severity);
                const expanded = !!expandedFlags[flag.id];
                const hasReviewMeta = flag.reviewed_at || flag.reviewed_by || flag.review_note;
                return (
                  <div key={flag.id} className="pm-admin-flag-card">
                    <div className="pm-admin-flag-card-head">
                      <div>
                        <div className="pm-admin-flag-title">{explanation.title || 'Ukendt årsag'}</div>
                        <div className="pm-admin-flag-desc">{explanation.description}</div>
                        <div className="pm-admin-flag-desc">
                          {formatDateTimeDa(flag.created_at)} · {String(flag.source || '').toUpperCase()}
                        </div>
                      </div>
                      <div className="pm-admin-flag-badges">
                        <span
                          className="pm-admin-status-pill"
                          style={{ color: statusBadge.text, background: statusBadge.bg, borderRadius: 999 }}
                        >
                          {statusLabelDa(flag.status)}
                        </span>
                        <span
                          className="pm-admin-status-pill"
                          style={{ color: severityBadge.text, background: severityBadge.bg, borderRadius: 999 }}
                        >
                          {severityLabelDa(flag.severity)}
                        </span>
                      </div>
                      <div className="pm-admin-flag-actions">
                        <button
                          type="button"
                          onClick={() => setExpandedFlags((prev) => ({ ...prev, [flag.id]: !prev[flag.id] }))}
                          className="pm-admin-action-chip"
                          style={btn(false)}
                        >
                          {expanded ? 'Skjul' : 'Detaljer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateFlag(flag, 'reviewed'); }}
                          disabled={flagBusyId === flag.id}
                          className="pm-admin-action-chip"
                          style={btn(flag.status === 'reviewed')}
                        >
                          <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                          Gennemgået
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateFlag(flag, 'closed'); }}
                          disabled={flagBusyId === flag.id}
                          className="pm-admin-action-chip"
                          style={btn(flag.status === 'closed')}
                        >
                          Luk
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="pm-admin-flag-expand">
                        <div className="pm-admin-panel-box pm-admin-panel-box--accent pm-admin-flag-suggestion">
                          <div className="pm-admin-panel-title pm-admin-panel-title--accent">Forslag til handling</div>
                          <div className="pm-admin-panel-copy">{explanation.suggestion}</div>
                        </div>

                        <div className="pm-admin-flag-detail-grid">
                          <div className="pm-admin-flag-detail-copy">
                            <div>
                              <strong>Kamp:</strong> {flag.match_id || '-'}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <strong>Americano/Mexicano:</strong> {flag.tournament_id || '-'}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <strong>Teknisk kode:</strong> {explanation.technicalReason || '-'}
                            </div>
                          </div>
                          <div className="pm-admin-flag-detail-copy">
                            <div>
                              <strong>Gennemgået af:</strong> {reviewerMap[flag.reviewed_by] || '-'}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <strong>Gennemgået tid:</strong> {formatDateTimeDa(flag.reviewed_at)}
                            </div>
                          </div>
                        </div>

                        <label style={{ ...labelStyle, marginBottom: '6px', display: 'block' }}>Adminnote</label>
                        <textarea
                          value={flagNotes[flag.id] ?? flag.review_note ?? ''}
                          onChange={(e) => setFlagNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                          placeholder="Skriv note om vurdering af flag..."
                          style={{ ...inputStyle, minHeight: '54px', resize: 'vertical', marginBottom: '10px' }}
                        />
                        <div className="pm-admin-report-actions" style={{ marginBottom: '10px' }}>
                          <button
                            type="button"
                            onClick={() => { void updateFlag(flag, flag.status || 'open'); }}
                            disabled={flagBusyId === flag.id}
                            className="pm-admin-action-chip"
                            style={btn(true)}
                          >
                            Gem note
                          </button>
                          {flag.status !== 'open' ? (
                            <button
                              type="button"
                              onClick={() => { void updateFlag(flag, 'open'); }}
                              disabled={flagBusyId === flag.id}
                              className="pm-admin-action-chip"
                              style={btn(false)}
                            >
                              Genåbn
                            </button>
                          ) : null}
                        </div>

                        <div className="pm-admin-flag-detail-copy" style={{ marginBottom: '6px' }}>
                          Datafelt
                        </div>
                        <pre className="pm-admin-flag-pre">{JSON.stringify(flag.payload || {}, null, 2)}</pre>
                        {hasReviewMeta ? (
                          <div className="pm-admin-flag-detail-copy" style={{ marginTop: '8px' }}>
                            Seneste note: {flag.review_note || '(ingen)'}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>

          <div className="pm-ui-card pm-admin-console-panel">
            <div className="pm-admin-console-panel-head">
              <div className="pm-admin-console-panel-title">Admin-log (seneste handlinger)</div>
              <div className="pm-admin-console-panel-meta">
                {consoleLoading ? 'Indlæser...' : `${auditLog.length} poster`}
              </div>
            </div>
            {auditLogError ? <div className="pm-admin-error-msg">{auditLogError}</div> : null}
            {!auditLogError && auditLog.length === 0 && !consoleLoading ? (
              <div className="pm-admin-empty">Ingen logposter endnu.</div>
            ) : null}
            {auditLog.length > 0 ? (
              <div className="pm-admin-audit-list">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="pm-admin-audit-entry">
                    <div className="pm-admin-audit-entry-head">
                      <span className="pm-admin-audit-action">{adminAuditActionLabel(entry.action)}</span>
                      <span className="pm-admin-audit-time">{formatDateTimeDa(entry.created_at)}</span>
                    </div>
                    {entry.target_user_id ? (
                      <div className="pm-admin-audit-target">
                        Bruger: {String(entry.target_user_id).slice(0, 8)}…
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
      <AdminUserEditModal
        open={Boolean(editingUser) || editingUserLoading}
        loading={editingUserLoading}
        saving={editingUserSaving}
        user={editingUser}
        profileOverview={editingUserOverview}
        formatDateTime={formatDateTimeDa}
        onClose={closeUserEditor}
        onChange={setEditingUser}
        onSubmit={handleUpdateUser}
      />
      <AdminReportDmViewer
        open={!!dmViewerReport}
        onClose={() => setDmViewerReport(null)}
        report={dmViewerReport}
        reporterName={dmViewerReport ? adminDisplayName(dmViewerReport.reporter) : ''}
        reportedName={dmViewerReport ? adminDisplayName(dmViewerReport.reported) : ''}
      />
      <AppModal
        open={deletePinOpen}
        onClose={closeDeletePinModal}
        ariaLabel="Bekræft sletning med admin-kode"
        maxWidth="420px"
        zIndex={1001}
      >
        <div className="pm-admin-modal-body">
          <h3 style={{ ...heading('18px'), marginBottom: '8px' }}>Bekræft med admin-kode</h3>
          <div className="pm-admin-panel-copy" style={{ marginBottom: '12px' }}>
            Sletning af <strong style={{ color: theme.text }}>{adminDisplayName(deleteTargetUser)}</strong> kræver din 6-cifrede admin-kode.
          </div>

          <label style={{ ...labelStyle, marginBottom: '6px', display: 'block' }}>Admin-kode (6 tal)</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={deletePin}
            onChange={(e) => {
              setDeletePin(digitsOnly(e.target.value));
              if (deletePinError) setDeletePinError('');
            }}
            style={{
              ...inputStyle,
              letterSpacing: '0.2em',
              fontFamily: font,
            }}
            disabled={deletePinBusy}
          />

          {deletePinError ? <div className="pm-admin-error-msg" style={{ marginTop: '8px' }}>{deletePinError}</div> : null}

          <div className="pm-admin-form-actions">
            <button
              type="button"
              onClick={() => closeDeletePinModal()}
              style={{ ...btn(false), flex: 1 }}
              disabled={deletePinBusy}
            >
              Annuller
            </button>
            <button
              type="button"
              onClick={() => { void confirmDeleteWithPin(); }}
              style={{ ...btn(true), flex: 1, background: theme.red, borderColor: theme.red }}
              disabled={deletePinBusy}
            >
              {deletePinBusy ? 'Sletter...' : 'Slet spiller'}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

