/**
 * "Tilmeld dit hold" i H-stil (prototypen "H · Tilmeld dit hold", ejeren 17. nov. 2026).
 *
 * Fuld skærm: holdkort øverst, forslag til makker (dem du har spillet flest kampe
 * med), søgning efter en anden, holdnavn og en lime knap i bunden. Makkeren får en
 * besked og skal sige ja, før holdet er tilmeldt (samme flow som før).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Check, Info, Search } from 'lucide-react';
import { DateTime } from 'luxon';
import { supabase } from '../lib/supabase';
import { buildProfileNameSearchOrFilter } from '../lib/postgrestFilterUtils';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import '../styles/liga-h.css';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function firstName(p) {
  return String(p?.full_name || p?.name || '').trim().split(/\s+/)[0] || '';
}

function fmtStart(value) {
  if (!value) return '';
  const d = DateTime.fromISO(String(value).slice(0, 10), { locale: 'da' });
  return d.isValid ? d.toFormat('d. LLL') : '';
}

function levelNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function usePartnerOptions(userId, query) {
  const [suggested, setSuggested] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(true);

  // Forslag: dem du har spillet flest 2v2-kampe med.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: mine } = await supabase.from('match_players').select('match_id').eq('user_id', userId);
        const matchIds = [...new Set((mine || []).map((r) => r.match_id).filter(Boolean))];
        if (matchIds.length === 0) return;
        const { data: co } = await supabase.from('match_players').select('user_id').in('match_id', matchIds).neq('user_id', userId);
        const counts = {};
        (co || []).forEach((r) => { if (r.user_id) counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
        const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
        if (topIds.length === 0) return;
        const { data: profs } = await supabase.from('profiles').select('id, full_name, name, avatar, elo_rating, level').in('id', topIds);
        const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        const list = topIds.map((id) => ({ ...(byId[id] || { id }), gamesTogether: counts[id] })).filter((p) => p.full_name || p.name);
        if (!cancelled) setSuggested(list);
      } catch {
        /* forslag er en hjaelp; uden dem kan man stadig soege */
      } finally {
        if (!cancelled) setLoadingSuggested(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(async () => {
      const orFilter = buildProfileNameSearchOrFilter(query);
      if (!orFilter) { setResults([]); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar, elo_rating, level')
        .or(orFilter)
        .neq('id', userId)
        .limit(6);
      setResults(data || []);
    }, 280);
    return () => clearTimeout(t);
  }, [query, userId]);

  return { suggested, results, loadingSuggested };
}

function PartnerOption({ p, selected, onSelect, gamesById }) {
  const name = p.full_name || p.name || 'Spiller';
  const lvl = levelNum(p.level);
  const games = p.gamesTogether ?? gamesById[p.id] ?? 0;
  const info = [lvl ? `Niveau ${formatPlaytomicLevel(lvl)}` : null, games ? `${games} ${games === 1 ? 'kamp' : 'kampe'} sammen` : null]
    .filter(Boolean).join(' · ');
  return (
    <button type="button" role="radio" aria-checked={selected} className={selected ? 'pm-lt-opt is-on' : 'pm-lt-opt'} onClick={() => onSelect(p)}>
      <span className="pm-lt-opt-av" aria-hidden>{initials(name)}</span>
      <span className="pm-lt-opt-text">
        <span className="pm-lt-opt-name">{name}</span>
        {info ? <span className="pm-lt-opt-info">{info}</span> : null}
      </span>
      <span className="pm-lt-opt-radio" aria-hidden>{selected ? <Check size={15} strokeWidth={3} /> : null}</span>
    </button>
  );
}

/**
 * @param {{
 *   league: any, user: any,
 *   teamName: string, setTeamName: (v: string) => void,
 *   selectedPartner: any, setSelectedPartner: (p: any) => void,
 *   busy: boolean, onSubmit: () => void, onCancel: () => void,
 * }} props
 */
export function LigaTilmeldScreen({ league, user, teamName, setTeamName, selectedPartner, setSelectedPartner, busy, onSubmit, onCancel }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const nameTouched = useRef(Boolean(teamName));
  const { suggested, results, loadingSuggested } = usePartnerOptions(user.id, query);
  const gamesById = useMemo(() => Object.fromEntries(suggested.map((s) => [s.id, s.gamesTogether])), [suggested]);

  const myName = user.full_name || user.name || 'Dig';
  const partnerFirst = firstName(selectedPartner);
  const autoName = selectedPartner ? `${firstName(user) || 'Mig'} & ${partnerFirst}` : '';

  // Holdnavnet foreslaas ud fra navnene, indtil man selv skriver noget.
  useEffect(() => {
    if (!nameTouched.current) setTeamName(autoName);
  }, [autoName, setTeamName]);

  useEffect(() => {
    if (!loadingSuggested && suggested.length === 0) setSearchOpen(true);
  }, [loadingSuggested, suggested.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onCancel]);

  const myLvl = levelNum(user.level);
  const pLvl = levelNum(selectedPartner?.level);
  const avg = myLvl && pLvl ? (myLvl + pLvl) / 2 : null;
  const teamInfo = selectedPartner
    ? (avg ? `Snit niveau ${formatPlaytomicLevel(Math.round(avg * 100) / 100)}` : `Dig og ${partnerFirst}`)
    : 'Vælg din makker herunder';

  const searchList = query.trim().length >= 2 ? results : [];
  const shownSuggested = suggested.filter((p) => !searchList.some((r) => r.id === p.id));
  const selectedIsListed = selectedPartner && [...shownSuggested, ...searchList].some((p) => p.id === selectedPartner.id);
  const start = fmtStart(league.start_date);
  const canSend = Boolean(selectedPartner) && teamName.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return createPortal(
    <div className="pm-lt" role="dialog" aria-modal="true" aria-labelledby="pm-lt-title">
      <header className="pm-lt-head">
        <button type="button" className="pm-lt-back" onClick={onCancel} aria-label="Tilbage">
          <ChevronLeft size={22} aria-hidden />
        </button>
        <div>
          <h1 id="pm-lt-title">Tilmeld dit hold</h1>
          <span>{league.name}{start ? ` · starter ${start}` : ''}</span>
        </div>
      </header>

      <main className="pm-lt-body">
        <section className="pm-lt-team" aria-label="Jeres hold">
          <div className="pm-lt-team-avs" aria-hidden>
            <span className="is-me">{initials(myName)}</span>
            <span className={selectedPartner ? 'is-partner' : 'is-empty'}>{selectedPartner ? initials(selectedPartner.full_name || selectedPartner.name) : '?'}</span>
          </div>
          <div className="pm-lt-team-text">
            <span className="pm-lt-team-name">{teamName.trim() || 'Dit hold'}</span>
            <span className="pm-lt-team-info">{teamInfo}</span>
          </div>
        </section>

        <section className="pm-lt-section" aria-labelledby="pm-lt-partner-title">
          <div className="pm-lt-section-head">
            <h2 id="pm-lt-partner-title">Hvem er din makker?</h2>
            {suggested.length > 0 && !searchOpen ? (
              <button type="button" className="pm-lt-link" onClick={() => setSearchOpen(true)}>Søg efter en anden</button>
            ) : null}
          </div>
          {searchOpen ? (
            <label className="pm-lt-search">
              <Search size={18} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søg på navn"
                aria-label="Søg efter makker på navn"
                autoComplete="off"
              />
            </label>
          ) : null}
          <div role="radiogroup" aria-labelledby="pm-lt-partner-title" className="pm-lt-opts">
            {selectedPartner && !selectedIsListed ? (
              <PartnerOption p={selectedPartner} selected onSelect={setSelectedPartner} gamesById={gamesById} />
            ) : null}
            {searchList.map((p) => (
              <PartnerOption key={p.id} p={p} selected={selectedPartner?.id === p.id} onSelect={setSelectedPartner} gamesById={gamesById} />
            ))}
            {shownSuggested.map((p) => (
              <PartnerOption key={p.id} p={p} selected={selectedPartner?.id === p.id} onSelect={setSelectedPartner} gamesById={gamesById} />
            ))}
            {query.trim().length >= 2 && searchList.length === 0 ? (
              <p className="pm-lt-hint">Ingen spillere fundet. Prøv et andet navn.</p>
            ) : null}
            {!loadingSuggested && suggested.length === 0 && query.trim().length < 2 ? (
              <p className="pm-lt-hint">Skriv mindst to bogstaver af din makkers navn.</p>
            ) : null}
          </div>
        </section>

        <section className="pm-lt-section">
          <label htmlFor="pm-lt-name" className="pm-lt-label">Holdnavn</label>
          <input
            id="pm-lt-name"
            className="pm-lt-input"
            type="text"
            value={teamName}
            maxLength={40}
            onChange={(e) => { nameTouched.current = true; setTeamName(e.target.value); }}
            placeholder={autoName || 'Fx Mads & Sofie'}
          />
          <span className="pm-lt-hint">Vises i ligaens stilling.</span>
        </section>

        <div className="pm-lt-note">
          <Info size={18} aria-hidden />
          <span>{partnerFirst ? `${partnerFirst} får en besked og skal sige ja, før holdet er tilmeldt.` : 'Din makker får en besked og skal sige ja, før holdet er tilmeldt.'}</span>
        </div>
      </main>

      <footer className="pm-lt-foot">
        <button type="button" className="pm-lt-cta" onClick={submit} aria-disabled={!canSend}>
          {busy ? 'Sender…' : partnerFirst ? `Send til ${partnerFirst} og tilmeld` : 'Vælg en makker'}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
