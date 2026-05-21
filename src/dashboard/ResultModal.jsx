import { AppModal } from '../components/AppModal';
import PadelMatchResultInput from '../components/PadelMatchResultInput';

export function ResultModal({ team1Names, team2Names, onSubmit, onClose }) {
  return (
    <AppModal open onClose={onClose} ariaLabel="Indtast kampresultat" maxWidthPreset="md">
      <div className="pm-modal-body pm-modal-body--compact">
        <PadelMatchResultInput
          playersEditable={false}
          initialData={{ team1: team1Names, team2: team2Names, sets: [], winner: null, completed: false }}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </AppModal>
  );
}
