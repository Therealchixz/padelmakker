// src/features/matches/TeamSelectModal.jsx
import React from 'react';

const TeamSelectModal = ({ matchId, matchPlayers = [], onSelect, onClose }) => {
  const t1 = matchPlayers.filter(p => p.team === 1);
  const t2 = matchPlayers.filter(p => p.team === 2);

  const team1Full = t1.length >= 2;
  const team2Full = t2.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6">
        <h3 className="text-xl font-semibold mb-1">Vælg hold</h3>
        <p className="text-slate-600 text-sm mb-6">
          Hvilket hold vil du spille på?
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onSelect(1)}
            disabled={team1Full}
            className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
              team1Full 
                ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed' 
                : 'border-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <div className="font-semibold text-emerald-700">Hold 1</div>
            <div className="text-sm text-slate-500 mt-1">
              {t1.length}/2 spillere
            </div>
            {t1.length > 0 && (
              <div className="text-xs text-slate-400 mt-2">
                {t1.map(p => p.user_name?.split(' ')[0]).join(', ')}
              </div>
            )}
          </button>

          <button
            onClick={() => onSelect(2)}
            disabled={team2Full}
            className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
              team2Full 
                ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed' 
                : 'border-blue-600 hover:bg-blue-50'
            }`}
          >
            <div className="font-semibold text-blue-700">Hold 2</div>
            <div className="text-sm text-slate-500 mt-1">
              {t2.length}/2 spillere
            </div>
            {t2.length > 0 && (
              <div className="text-xs text-slate-400 mt-2">
                {t2.map(p => p.user_name?.split(' ')[0]).join(', ')}
              </div>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 text-slate-500 hover:text-slate-700 font-medium"
        >
          Annuller
        </button>
      </div>
    </div>
  );
};

export default TeamSelectModal;
