// src/features/matches/MatchCard.jsx
import React from 'react';
import { Clock, MapPin, Users, Trash2, UserMinus, Swords } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

const MatchCard = ({ 
  match, 
  matchPlayers = [], 
  matchResult = null, 
  onJoin, 
  onLeave, 
  onStart, 
  onSubmitResult, 
  onDelete,
  busy 
}) => {
  const { user } = useAuth();
  const isCreator = String(match.creator_id) === String(user?.id);
  const isJoined = matchPlayers.some(p => String(p.user_id) === String(user?.id));
  const t1 = matchPlayers.filter(p => p.team === 1);
  const t2 = matchPlayers.filter(p => p.team === 2);
  const isFull = t1.length >= 2 && t2.length >= 2;

  const status = match.status || 'open';
  const leftSpots = 4 - matchPlayers.length;

  const statusInfo = {
    open: { text: leftSpots > 0 ? `${leftSpots} ledige` : 'Fuld', color: 'text-emerald-600' },
    full: { text: 'Klar til start', color: 'text-blue-600' },
    in_progress: { text: 'I gang', color: 'text-amber-600' },
    completed: { text: 'Afsluttet', color: 'text-slate-500' },
  }[status] || { text: status, color: 'text-slate-500' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock size={16} />
            <span>{match.date} • {match.time}–{match.time_end}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
            <MapPin size={15} />
            <span>{match.court_name}</span>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.color.replace('text-', 'bg-').replace('600', '100')}`}>
          {statusInfo.text}
        </span>
      </div>

      {/* Teams */}
      <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4 mb-5">
        {/* Hold 1 */}
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-emerald-700 mb-2">HOLD 1</p>
          <div className="flex justify-center gap-3">
            {t1.map(p => (
              <div key={p.id} className="text-center">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-xl mx-auto">
                  {p.user_emoji || '🎾'}
                </div>
                <p className="text-xs mt-1 truncate max-w-[60px]">{p.user_name?.split(' ')[0]}</p>
              </div>
            ))}
            {Array.from({ length: 2 - t1.length }).map((_, i) => (
              <div key={i} className="w-9 h-9 border-2 border-dashed border-slate-300 rounded-full" />
            ))}
          </div>
        </div>

        <div className="text-2xl font-light text-slate-300">VS</div>

        {/* Hold 2 */}
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-blue-700 mb-2">HOLD 2</p>
          <div className="flex justify-center gap-3">
            {t2.map(p => (
              <div key={p.id} className="text-center">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-xl mx-auto">
                  {p.user_emoji || '🎾'}
                </div>
                <p className="text-xs mt-1 truncate max-w-[60px]">{p.user_name?.split(' ')[0]}</p>
              </div>
            ))}
            {Array.from({ length: 2 - t2.length }).map((_, i) => (
              <div key={i} className="w-9 h-9 border-2 border-dashed border-slate-300 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {!isJoined && status === 'open' && leftSpots > 0 && (
          <button 
            onClick={() => onJoin(match.id)} 
            disabled={busy === match.id}
            className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold"
          >
            Tilmeld mig
          </button>
        )}

        {isJoined && status !== 'completed' && (
          <button 
            onClick={() => onLeave(match.id)} 
            disabled={busy === match.id}
            className="border border-red-300 text-red-600 hover:bg-red-50 py-3 rounded-xl font-medium"
          >
            <UserMinus size={18} className="inline mr-2" /> Afmeld mig
          </button>
        )}

        {isCreator && (status === 'full' || (status === 'open' && isFull)) && (
          <button 
            onClick={() => onStart(match.id)} 
            disabled={busy === match.id}
            className="bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold"
          >
            🎾 Start kampen
          </button>
        )}

        {status === 'in_progress' && isJoined && !matchResult && (
          <button 
            onClick={() => onSubmitResult(match.id)} 
            disabled={busy === match.id}
            className="bg-slate-800 hover:bg-black text-white py-3 rounded-xl font-semibold"
          >
            📊 Indsend resultat
          </button>
        )}

        {isCreator && status !== 'completed' && (
          <button 
            onClick={() => onDelete(match.id)} 
            disabled={busy === match.id}
            className="text-red-600 hover:text-red-700 py-2 text-sm"
          >
            <Trash2 size={16} className="inline mr-1" /> Slet kamp
          </button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
