import { useState } from "react";
import { useAuth } from "./context/AuthProvider";
import {
  validateMatch,
  validateJoinMatch,
  validateResult,
  validateConfirmResult
} from "./utils/validation";

import {
  createMatch,
  joinMatch,
  submitResult,
  confirmResult
} from "./services/matchService";

export default function PadelApp() {
  const { user } = useAuth();

  const [newMatch, setNewMatch] = useState({});
  const [matchPlayers, setMatchPlayers] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function showToast(msg) {
    alert(msg);
  }

  async function handleCreateMatch() {
    try {
      setCreating(true);

      const error = validateMatch(newMatch);
      if (error) {
        showToast(error);
        return;
      }

      const row = {
        court_id: newMatch.court_id,
        date: newMatch.date,
        created_by: user?.id,
      };

      await createMatch(row);

      showToast("Kamp oprettet ✅");
      setNewMatch({});
    } catch (e) {
      console.error(e);
      showToast("Noget gik galt. Prøv igen.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinMatch(matchId, teamNum) {
    try {
      const error = validateJoinMatch(matchPlayers?.[matchId], user?.id, teamNum);
      if (error) {
        showToast(error);
        return;
      }

      await joinMatch(matchId, user.id, teamNum);
      showToast("Tilmeldt kamp 🎾");
    } catch (e) {
      console.error(e);
      showToast("Noget gik galt. Prøv igen.");
    }
  }

  async function handleSubmitResult(matchId, result) {
    try {
      setBusyId(matchId);

      const error = validateResult(result);
      if (error) {
        showToast(error);
        return;
      }

      await submitResult(matchId, result, user?.id);
      showToast("Resultat gemt 🏆");
    } catch (e) {
      console.error(e);
      showToast("Noget gik galt. Prøv igen.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmResult(matchId) {
    try {
      setBusyId(matchId);

      const error = validateConfirmResult(matchResults?.[matchId], user?.id);
      if (error) {
        showToast(error);
        return;
      }

      await confirmResult(matchId);
      showToast("Resultat bekræftet ✅");
    } catch (e) {
      console.error(e);
      showToast("Noget gik galt. Prøv igen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Padel Makker</h1>
      <button onClick={handleCreateMatch} disabled={creating}>
        Opret kamp
      </button>
    </div>
  );
}
