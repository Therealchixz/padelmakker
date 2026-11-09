import { ChevronRight, Swords, Shuffle, Trophy } from 'lucide-react';
import { AppModal } from './AppModal';
import { useCloseOnBack } from '../lib/useCloseOnBack';

const OPTIONS = [
  {
    id: '2v2',
    title: '2v2-kamp',
    text: 'Fire spillere på én bane. Inviter makkere eller lad andre melde sig til.',
    icon: Swords,
    search: 'create=1',
  },
  {
    id: 'americano',
    title: 'Americano / Mexicano',
    text: 'Turnering, hvor makkerne skifter fra runde til runde.',
    icon: Shuffle,
    search: 'format=americano&create=1',
  },
  {
    id: 'liga',
    title: 'Liga',
    text: 'Hold på to spiller mod andre hold over flere runder.',
    textNoAdmin: 'Ligaer oprettes af PadelMakker. Se dem og tilmeld dit hold.',
    icon: Trophy,
    search: 'format=liga&create=1',
    searchNoAdmin: 'format=liga',
  },
];

/**
 * Valget bag Spil-knappen: brugeren bestemmer selv, hvilken slags kamp der oprettes.
 * Paa telefonen glider det op nedefra som et ark; paa computer er det en lille dialog.
 */
export function SpilChooser({ open, onClose, onPick, asSheet = false, canCreateLiga = false }) {
  useCloseOnBack(open, onClose, 'spil');
  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabel="Hvad vil du oprette?"
      maxWidthPreset="sm"
      backdropStyle={asSheet ? { alignItems: 'flex-end', padding: 0 } : undefined}
      contentStyle={asSheet
        ? {
          width: '100%',
          maxWidth: '100%',
          margin: 0,
          borderRadius: '24px 24px 0 0',
          borderBottom: 0,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        }
        : undefined}
    >
      <div className={'pm-spil-sheet' + (asSheet ? ' pm-spil-sheet--sheet' : '')}>
        {asSheet ? <div className="pm-spil-sheet-grip" aria-hidden /> : null}
        <h2 className="pm-spil-sheet-title">Hvad vil du oprette?</h2>
        <ul className="pm-spil-sheet-list">
          {OPTIONS.map(({ id, title, text, textNoAdmin, icon: Icon, search, searchNoAdmin }) => {
            const limited = !canCreateLiga && Boolean(searchNoAdmin);
            return (
            <li key={id}>
              <button type="button" className="pm-spil-option" data-spil-option={id} onClick={() => onPick(limited ? searchNoAdmin : search)}>
                <span className="pm-spil-option-icon" aria-hidden><Icon size={22} /></span>
                <span className="pm-spil-option-text">
                  <span className="pm-spil-option-title">{title}</span>
                  <span className="pm-spil-option-desc">{limited ? textNoAdmin : text}</span>
                </span>
                <ChevronRight size={18} aria-hidden className="pm-spil-option-chev" />
              </button>
            </li>
            );
          })}
        </ul>
        <button type="button" className="pm-spil-sheet-cancel" onClick={onClose}>Annullér</button>
      </div>
    </AppModal>
  );
}
