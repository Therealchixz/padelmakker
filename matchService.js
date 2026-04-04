import { supabase } from "../supabase";

export async function createMatch(row) {
  const { error } = await supabase.from("matches").insert([row]);
  if (error) throw error;
}

export async function joinMatch(matchId, userId, team) {
  const { error } = await supabase.from("match_players").insert([
    { match_id: matchId, user_id: userId, team }
  ]);
  if (error) throw error;
}

export async function submitResult(matchId, result, userId) {
  const { error } = await supabase.from("match_results").insert([
    { match_id: matchId, result, submitted_by: userId }
  ]);
  if (error) throw error;
}

export async function confirmResult(matchId) {
  const { error } = await supabase
    .from("match_results")
    .update({ confirmed: true })
    .eq("match_id", matchId);
  if (error) throw error;
}
