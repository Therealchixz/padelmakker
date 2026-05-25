import { supabase } from './supabase';

/**
 * @param {object} payload
 * @param {string} payload.category
 * @param {string} payload.priority
 * @param {string | null} payload.topic
 * @param {string} payload.message
 * @param {string} payload.displayName
 * @param {string | null | undefined} payload.userId
 * @param {string | null | undefined} payload.userEmail
 * @param {string} payload.routePath
 * @param {string | null} payload.pageUrl
 */
export async function submitFeedbackReport(payload) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Fejl: mangler Supabase-konfiguration.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Du skal være logget ind for at sende indberetning.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/report-feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      category: payload.category,
      priority: payload.priority,
      topic: payload.topic,
      message: payload.message,
      pageUrl: payload.pageUrl,
      routePath: payload.routePath,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      displayName: payload.displayName,
      userId: payload.userId || null,
      userEmail: payload.userEmail || null,
      submittedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      /* ignore */
    }
    throw new Error(details || 'Serveren kunne ikke modtage indberetningen.');
  }
}
