import { Link } from 'react-router-dom';
import {
  MessageCircle, Trophy, MapPin, Swords, Users, CalendarDays, ChevronRight, Moon, Compass,
  ExternalLink, Bell, UserRound, Bug, LifeBuoy, Info, Shield, BookOpen, Smartphone, CircleHelp,
  Gift, ShieldCheck, LogOut,
} from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
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
  const elo = Math.round(Number(user?.elo_rating) || 1000);
  const hasLevel = user?.level != null && user.level !== '';

  return (
    <div className="pm-mere">
      <ScreenHeader title="Mere" />

      <button type="button" className="pm-mere-profile" onClick={() => setTab('profil')}>
        <AvatarCircle avatar={user?.avatar} size={56} emojiSize="24px" style={{ background: 'var(--pm-accent-bg)', flexShrink: 0 }} />
        <span className="pm-mere-profile-text">
          <span className="pm-mere-profile-name">{displayName}</span>
          {email ? <span className="pm-mere-profile-email">{email}</span> : null}
          <span className="pm-mere-profile-stats">
            ELO {elo}
            {hasLevel ? ` · Niveau ${formatPlaytomicLevel(user.level)}` : ''}
          </span>
        </span>
        <span className="pm-mere-profile-go">
          Min profil <ChevronRight size={16} aria-hidden />
        </span>
      </button>

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
        <MereRow icon={<UserRound size={18} />} label="Min profil" onClick={() => setTab('profil')} />
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
