import { ChevronLeft } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { LigaSwissBracket } from './LigaSwissBracket';

export function LigaScheduleSheet({
  open,
  onClose,
  league,
  teams,
  matches,
  myTeam,
  currentRound,
  totalRounds,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !league) return null;

  const isCompleted = league.status === 'completed';

  return (
    <>
      <button type="button" className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked" aria-label="Luk kampplan" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-liga-v2-schedule-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={isCompleted ? 'Sæsonoversigt' : 'Kampplan og resultater'}
      >
        <div {...dragZoneProps} className="pm-kampe-v2-sheet-drag-header">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <button type="button" className="pm-liga-v2-sheet-back" onClick={onClose}>
            <ChevronLeft size={16} aria-hidden />
            Tilbage
          </button>
          <div className="pm-liga-v2-schedule-head">
            <div className="pm-liga-v2-schedule-kicker">{isCompleted ? 'SÆSONOVERSIGT' : 'KAMPPLAN & RESULTATER'}</div>
            <h2 className="pm-liga-v2-schedule-title">{league.name}</h2>
          </div>
        </div>
        <div className="pm-liga-v2-schedule-body">
          <LigaSwissBracket
            teams={teams}
            matches={matches}
            currentRound={currentRound}
            totalRounds={totalRounds}
            myTeam={myTeam}
            defaultOpen
            hideToggle
          />
        </div>
      </div>
    </>
  );
}
