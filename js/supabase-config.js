(() => {
  'use strict';

  if (!window.RRN_SUPABASE) {
    window.RRN_SUPABASE = Object.freeze({
      url: 'https://tvfiicmwkddpswgbjyok.supabase.co',
      anonKey: 'sb_publishable_eSgCaCymJo0c2MIuPN1_fw_9bnI-pN9'
    });
  }

  function ensureClient() {
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;

    const cfg = window.RRN_SUPABASE || {};
    if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return null;

    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    window.dispatchEvent(new CustomEvent('rrn:supabase-client-ready', {
      detail: { client: window.RRN_SUPABASE_CLIENT }
    }));

    return window.RRN_SUPABASE_CLIENT;
  }

  window.RRN_GET_SUPABASE_CLIENT = ensureClient;

  if (!ensureClient()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (ensureClient() || attempts >= 200) clearInterval(timer);
    }, 25);
  }
})();
