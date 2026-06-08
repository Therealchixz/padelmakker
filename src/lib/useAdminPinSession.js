import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Om admin har en aktiv PIN-session (samme som under Admin-fanen).
 */
export function useAdminPinSession(enabled = true) {
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled));

  const refreshAdminPinSession = useCallback(async () => {
    if (!enabled) {
      setVerified(false);
      setLoading(false);
      return false;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_pin_status');
      if (error) throw error;
      const ok = data?.is_verified === true;
      setVerified(ok);
      return ok;
    } catch {
      setVerified(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshAdminPinSession();
  }, [refreshAdminPinSession]);

  return { adminPinVerified: verified, adminPinLoading: loading, refreshAdminPinSession };
}
