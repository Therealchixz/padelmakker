// src/features/matches/KampeTab.jsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMatches } from './useMatches';
import MatchCard from './MatchCard';
import TeamSelectModal from './TeamSelectModal';
import ResultModal from './ResultModal';
import { useAuth } from '../../lib/AuthContext';

export default function KampeTab() {
  const { user, profile } = useAuth();
  const {
    matches,
    matchPlayers,
    matchResults,
    courts,
    loading,
    busyId,
    createMatch,
    joinMatch,
    leaveMatch,
    startMatch,
  } = useMatches();

  const [showCreate, setShowCreate] = useState(false);
  const [teamSelectMatchId, setTeamSelectMatchId] = useState(null);
  const [resultMatchId, setResultMatchId] = useState(null);
  const [viewTab, setViewTab] = useState('open'); // 'open' | 'active' | 'completed'

  const [newMatch, setNewMatch] = useState({
    court_id: courts[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    time: '20:00',
    time_end: '22:00',
    description: '',
  });

  // Filtrerede kampe
  const openMatches = matches.filter(m => ['open', 'full'].includes(m.status || 'open'));
  const activeMatches = matches.filter(m => m.status === 'in_progress');
  const completedMatches = matches.filter(m => m.status === 'completed');

  const currentMatches = viewTab === 'open' ? openMatches 
                       : viewTab === 'active' ? activeMatches 
                       : completedMatches;

  const handleCreateMatch = async () => {
    try {
      await createMatch(newMatch);
      setShowCreate(false);
      setNewMatch({
        court_id: courts[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        time_end: '22:00',
        description: '',
      });
    } catch (err) {
      alert('Kunne ikke oprette kamp: ' + err.message);
    }
  };

  const handleJoin = (matchId) => {
    setTeamSelectMatchId(matchId);
  };

  const handleSubmitResult = (matchId) => {
    setResultMatchId(matchId);
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Indlæser kampe...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Kampe</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition"
        >
          <Plus size={20} />
          Opret kamp
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'open', label: `Åbne (${openMatches.length})` },
          { id: 'active', label: `I gang (${activeMatches.length})` },
          { id: 'completed', label: `Afsluttede (${completedMatches.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
              viewTab === tab.id 
                ? 'border-emerald-600 text-emerald-700' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create Match Form */}
      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Opret ny kamp</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bane</label>
              <select
                value={newMatch.court_id}
                onChange={(e) => setNewMatch({ ...newMatch, court_id: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
              >
                {courts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dato</label>
              <input
                type="date"
                value={newMatch.date}
                onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fra kl.</label>
              <input
                type="time"
                value={newMatch.time}
                onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Til kl.</label>
              <input
                type="time"
                value={newMatch.time_end}
                onChange={(e) => setNewMatch({ ...newMatch, time_end: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Beskrivelse (valgfrit)</label>
            <textarea
              value={newMatch.description}
              onChange={(e) => setNewMatch({ ...newMatch, description: e.target.value })}
              placeholder="F.eks. 'Søger venstreside spiller' eller 'Begyndervenlig kamp'"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 h-20"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 py-3 border border-slate-300 rounded-xl font-medium"
            >
              Annuller
            </button>
            <button
              onClick={handleCreateMatch}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold"
            >
              Opret kamp
            </button>
          </div>
        </div>
      )}

      {/* Match List */}
      <div className="space-y-4">
        {currentMatches.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {viewTab === 'open' && "Ingen åbne kampe lige nu. Opret den første!"}
            {viewTab === 'active' && "Ingen kampe i gang"}
            {viewTab === 'completed' && "Ingen afsluttede kampe endnu"}
          </div>
        ) : (
          currentMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              matchPlayers={matchPlayers[match.id] || []}
              matchResult={matchResults[match.id]}
              onJoin={handleJoin}
              onLeave={leaveMatch}
              onStart={startMatch}
              onSubmitResult={handleSubmitResult}
              onDelete={async (id) => {
                if (window.confirm('Slet denne kamp?')) {
                  // Her kan du tilføje delete logik senere
                  console.log('Slet kamp:', id);
                }
              }}
              busy={busyId}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {teamSelectMatchId && (
        <TeamSelectModal
          matchId={teamSelectMatchId}
          matchPlayers={matchPlayers[teamSelectMatchId] || []}
          onSelect={(teamNum) => {
            joinMatch(teamSelectMatchId, teamNum);
            setTeamSelectMatchId(null);
          }}
          onClose={() => setTeamSelectMatchId(null)}
        />
      )}

      {resultMatchId && (
        <ResultModal
          matchId={resultMatchId}
          onClose={() => setResultMatchId(null)}
        />
      )}
    </div>
  );
}
