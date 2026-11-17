import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Trophy, MapPin, Swords, Users, CalendarDays, ChevronRight, Moon, Compass,
  ExternalLink, Bell, UserRound, Bug, LifeBuoy, Info, Shield, BookOpen, Smartphone, CircleHelp,
  Gift, ShieldCheck, LogOut,
} from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { EloGraph } from '../components/EloGraph';
import { supabase } from '../lib/supabase';
import { statsFromEloHistoryRows, useProfileEloBundle, winStreaksFromEloHistory, usePartnerOpponentStats } from '../lib/eloHistoryUtils';
import '../styles/mere.css';

/** Et felt i gitteret oeverst (genvej til en side der ikke har sin egen plads i bundmenuen). */
function MereTile({ icon, label, badge = 0, onClick, to }) {
  const content = (
    <>
      <span className="pm-mere-tile-icon" aria-hidden>{icon}</span>
      <span className="pm-mere-tile-label">{label}</span>
      {badge > 0 ? (
        <span className="pm-mere-tile-badge" aria-label={`${badge} ulæste`}>{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </>
  );
  if (to) return <Link className="pm-mere-tile" to={to}>{content}</Link>;
  return <button type="button" className="pm-mere-tile" onClick={onClick}>{content}</button>;
}

/** En linje i en gruppe. `value` vises til hoejre (fx "Til"/"Fra"). */
function MereRow({ icon, label, value, onClick, to, pressed, danger = false }) {
  const content = (
    <>
      <span className="pm-mere-row-main">
        <span className="pm-mere-row-icon" aria-hidden>{icon}</span>
        {label}
      </span>
      <span className="pm-mere-row-end">
        {value ? <span className="pm-mere-row-value">{value}</span> : null}
        {pressed === undefined ? <ChevronRight size={16} aria-hidden /> : null}
      </span>
    </>
  );
  const cls = 'pm-mere-row' + (danger ? ' pm-mere-row--danger' : '');
  if (to) return <li><Link className={cls} to={to}>{content}</Link></li>;
  return (
    <li>
      <button type="button" className={cls} onClick={onClick} aria-pressed={pressed}>
        {content}
      </button>
    </li>
  );
}

function MereGroup({ title, children }) {
  const id = `pm-mere-${title.toLowerCase().replace(/[^a-zæøå]+/g, '-')}`;
  return (
    <section className="pm-mere-group" aria-labelledby={id}>
      <h2 id={id} className="pm-mere-group-title">{title}</h2>
      <ul className="pm-mere-list">{children}</ul>
    </section>
  );
}

/**
 * "Mere" (redesign v4): profil, genveje og indstillinger, der ikke har plads i bundmenuen.
 * Erstatter den gamle Mere-skuffe paa mobil og fanerne Baner, Rangliste og Beskeder paa computer.
 */
export function MereTab({
  user,
  displayName,
  email,
  unreadMessages = 0,
  isAdmin = false,
  adminAttentionCount = 0,
  dark,
  onToggleDark,
  setTab,
  onStartTour,
  onOpenFeedback,
  onOpenAdmin,
  onShowLanding,
  onLogout,
}) {
  const hasLevel = user?.level != null && user.level !== '';

  // Samme tal som paa "Min statistik": hentes fra ELO-historikken, saa graf og tal passer sammen.
  const eloSyncKey = `${user?.elo_rating}|${user?.games_played}|${user?.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user?.id, eloSyncKey);
  const pStats = profileFresh || user || {};
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(pStats.elo_rating) || 1000);
  const games = histStats?.games ?? (Number(pStats.games_played) || 0);
  const wins = histStats?.wins ?? (Number(pStats.games_won) || 0);
  const winPct = games > 0 ? Math.round((wins / games) * 100) : null;
  const { currentStreak } = useMemo(() => winStreaksFromEloHistory(ratedRows), [ratedRows]);
  // ELO-aendring i denne kalendermaaned (kun rigtige kampe fra historikken).
  const monthDelta = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sum = 0;
    let any = false;
    for (const r of ratedRows || []) {
      if (!String(r.date || '').startsWith(key)) continue;
      const ch = r.change != null && Number.isFinite(Number(r.change))
        ? Number(r.change)
        : Math.round(Number(r.new_rating || 0) - Number(r.old_rating || 0));
      sum += ch;
      any = true;
    }
    return any ? Math.round(sum) : null;
  }, [ratedRows]);

  // "Dine baner": hvor de spillede kampe laa (banens navn paa kampen).
  const matchIdsKey = useMemo(
    () => [...new Set((ratedRows || []).map((r) => r.match_id).filter(Boolean))].sort().join(','),
    [ratedRows],
  );
  const [venueCounts, setVenueCounts] = useState([]);
  useEffect(() => {
    if (!matchIdsKey) {
      setVenueCounts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('id, court_name')
          .in('id', matchIdsKey.split(',').slice(0, 300));
        if (cancelled || error) return;
        const counts = new Map();
        for (const m of data || []) {
          const name = String(m.court_name || '').trim();
          if (!name || /ikke valgt/i.test(name)) continue;
          counts.set(name, (counts.get(name) || 0) + 1);
        }
        setVenueCounts([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })));
      } catch {
        /* Baner er pynt paa profilen; uden dem vises resten stadig. */
      }
    })();
    return () => { cancelled = true; };
  }, [matchIdsKey]);
  const maxVenue = venueCounts[0]?.count || 1;

  const { partnerOpponentStats } = usePartnerOpponentStats(user?.id, ratedRows);
  const bestPartner = partnerOpponentStats?.partners?.[0] || null;
  const whereLine = [user?.city || user?.area || null, user?.court_side ? `spiller ${String(user.court_side).toLowerCase()}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="pm-mere">
      <ScreenHeader title="Profil" />

      {/* H-designet: hvem du er, dit ELO med graf, fire tal, dine baner og din bedste makker. */}
      <div className="pm-prof-head">
        <AvatarCircle avatar={user?.avatar} size={56} emojiSize="24px" style={{ background: 'var(--pm-accent-bg)', flexShrink: 0 }} />
        <div className="pm-prof-head-text">
          <h2 className="pm-prof-name">{displayName}</h2>
          {whereLine ? <span className="pm-prof-where">{whereLine}</span> : (email ? <span className="pm-prof-where">{email}</span> : null)}
        </div>
        <button type="button" className="pm-prof-edit" onClick={() => setTab('profil', { state: { edit: true } })}>Rediger</button>
      </div>

      <section className="pm-prof-elo" aria-label="Din ELO">
        <div className="pm-prof-elo-top">
          <span className="pm-prof-elo-label">ELO</span>
          <span className="pm-prof-elo-num">{elo}</span>
        </div>
        {bundleLoading ? null : ratedRows.length >= 2 ? (
          <EloGraph data={ratedRows} valueLabel="2v2-ELO" emptyText="" dark />
        ) : (
          <p className="pm-prof-elo-empty">Spil mindst 2 kampe for at se din ELO-graf.</p>
        )}
        <div className="pm-prof-elo-facts">
          {hasLevel ? <span><b>Niveau {formatPlaytomicLevel(user.level)}</b><small>af 7</small></span> : null}
          <button type="button" onClick={() => setTab('ranking')}><b>Rangliste</b><small>se din plads</small></button>
          {monthDelta != null ? (
            <span><b className="pm-prof-lime">{monthDelta > 0 ? `+${monthDelta}` : monthDelta}</b><small>denne måned</small></span>
          ) : null}
        </div>
      </section>

      <div className="pm-prof-tiles">
        <div><b>{games}</b><span>Kampe</span></div>
        <div><b>{wins}</b><span>Sejre</span></div>
        <div><b>{winPct != null ? `${winPct} %` : '–'}</b><span>Vundet</span></div>
        <div><b>{currentStreak || 0}</b><span>I træk nu</span></div>
      </div>
      <button type="button" className="pm-prof-more" onClick={() => setTab('profil')}>
        <span>Al statistik og mærker</span>
        <ChevronRight size={18} aria-hidden />
      </button>

      {venueCounts.length > 0 ? (
        <section className="pm-prof-card" aria-labelledby="pm-prof-baner">
          <h3 id="pm-prof-baner">Dine baner</h3>
          {venueCounts.map((v) => (
            <div key={v.name} className="pm-prof-bar">
              <span className="pm-prof-bar-name">{v.name}</span>
              <span className="pm-prof-bar-track" aria-hidden><span style={{ width: `${Math.max(8, Math.round((v.count / maxVenue) * 100))}%` }} /></span>
              <span className="pm-prof-bar-count">{v.count} {v.count === 1 ? 'kamp' : 'kampe'}</span>
            </div>
          ))}
        </section>
      ) : null}

      {bestPartner ? (
        <button type="button" className="pm-prof-partner" onClick={() => setTab('makkere')}>
          <span className="pm-prof-partner-text">
            <small>Din bedste makker</small>
            <b>{bestPartner.name} · {bestPartner.asPartner.wins} {bestPartner.asPartner.wins === 1 ? 'sejr' : 'sejre'} sammen</b>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
      ) : null}

      <nav className="pm-mere-tiles" aria-label="Genveje">
        <MereTile icon={<MessageCircle size={22} />} label="Beskeder" badge={unreadMessages} onClick={() => setTab('beskeder')} />
        <MereTile icon={<Trophy size={22} />} label="Rangliste" onClick={() => setTab('ranking')} />
        <MereTile icon={<MapPin size={22} />} label="Baner" onClick={() => setTab('baner')} />
        <MereTile icon={<Swords size={22} />} label="Liga" onClick={() => setTab('kampe', { search: 'format=liga' })} />
        <MereTile icon={<Users size={22} />} label="Americano" onClick={() => setTab('kampe', { search: 'format=americano' })} />
        <MereTile icon={<CalendarDays size={22} />} label="Events" to="/events" />
      </nav>

      <MereGroup title="App">
        <MereRow icon={<Moon size={18} />} label="Mørk tilstand" value={dark ? 'Til' : 'Fra'} pressed={dark} onClick={onToggleDark} />
        <MereRow icon={<Compass size={18} />} label="Start guide" onClick={onStartTour} />
        <MereRow icon={<ExternalLink size={18} />} label="Se forsiden" onClick={onShowLanding} />
      </MereGroup>

      <MereGroup title="Konto">
        <MereRow icon={<UserRound size={18} />} label="Rediger profil" onClick={() => setTab('profil', { state: { edit: true } })} />
        <MereRow icon={<Bell size={18} />} label="Notifikationer" onClick={() => setTab('notifikationer')} />
      </MereGroup>

      <MereGroup title="PadelMakker">
        <MereRow icon={<BookOpen size={18} />} label="Sådan virker ELO" to="/elo" />
        <MereRow icon={<Gift size={18} />} label="Første 200: regler" to="/kampagne/forste-200" />
        <MereRow icon={<Smartphone size={18} />} label="Installér appen" to="/app" />
        <MereRow icon={<CircleHelp size={18} />} label="FAQ" to="/faq" />
      </MereGroup>

      <MereGroup title="Hjælp">
        <MereRow icon={<LifeBuoy size={18} />} label="Hjælp og kontakt" to="/hjaelp" />
        <MereRow icon={<Bug size={18} />} label="Rapportér fejl" onClick={onOpenFeedback} />
        <MereRow icon={<Info size={18} />} label="Om PadelMakker" to="/om" />
        <MereRow icon={<Shield size={18} />} label="Privatliv, vilkår og cookies" to="/privatlivspolitik" />
      </MereGroup>

      {isAdmin ? (
        <MereGroup title="Admin">
          <MereRow
            icon={<ShieldCheck size={18} />}
            label="Admin"
            value={adminAttentionCount > 0 ? `${adminAttentionCount} opgave${adminAttentionCount === 1 ? '' : 'r'}` : null}
            onClick={onOpenAdmin}
          />
        </MereGroup>
      ) : null}

      <button type="button" className="pm-mere-logout" onClick={onLogout}>
        <LogOut size={18} aria-hidden />
        Log ud
      </button>
    </div>
  );
}
