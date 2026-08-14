(() => {
  'use strict';
  if (window.__RRN_MFA_TRUSTED_DEVICE__) return;
  window.__RRN_MFA_TRUSTED_DEVICE__ = true;

  const STORAGE_KEY = 'rrn_mfa_device_token_v1';
  let client = null;
  let patched = false;
  let trustedCache = { userId: null, value: false, checkedAt: 0 };

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function token() {
    let value = localStorage.getItem(STORAGE_KEY);
    if (!value || value.length < 32) {
      value = randomToken();
      localStorage.setItem(STORAGE_KEY, value);
    }
    return value;
  }

  async function currentUserId() {
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session?.user?.id || null;
  }

  async function isTrusted({ force = false } = {}) {
    if (!client) return false;
    const userId = await currentUserId();
    if (!userId) return false;
    if (!force && trustedCache.userId === userId && Date.now() - trustedCache.checkedAt < 30000) return trustedCache.value;
    try {
      const { data, error } = await client.rpc('is_mfa_trusted_device', { p_token: token() });
      const value = !error && data === true;
      trustedCache = { userId, value, checkedAt: Date.now() };
      return value;
    } catch {
      return false;
    }
  }

  async function trustCurrentDevice() {
    if (!client) return false;
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (attempt > 0) await client.auth.refreshSession().catch(() => undefined);
        const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== 'aal2' && !aal?.rrnTrustedDevice) {
          await wait(120 * (attempt + 1));
          continue;
        }
        const { data, error } = await client.rpc('register_mfa_trusted_device', { p_token: token() });
        if (error) throw error;
        const userId = await currentUserId();
        trustedCache = { userId, value: true, checkedAt: Date.now() };
        localStorage.setItem('rrn_mfa_trusted_until_hint', String(new Date(data).getTime()));
        window.dispatchEvent(new CustomEvent('rrn:mfa-device-trusted', { detail: { expiresAt: data } }));
        return true;
      } catch (error) {
        lastError = error;
        await wait(120 * (attempt + 1));
      }
    }
    console.warn('RRN MFA trusted device:', lastError);
    return false;
  }

  function patch(target) {
    if (!target || patched || !target.auth?.mfa) return false;
    client = target;
    const mfa = target.auth.mfa;
    const originalChallengeAndVerify = mfa.challengeAndVerify.bind(mfa);
    const originalGetAal = mfa.getAuthenticatorAssuranceLevel.bind(mfa);

    mfa.challengeAndVerify = async (...args) => {
      const result = await originalChallengeAndVerify(...args);
      if (!result?.error) {
        await wait(80);
        await trustCurrentDevice();
      }
      return result;
    };

    mfa.getAuthenticatorAssuranceLevel = async (...args) => {
      const result = await originalGetAal(...args);
      const aal = result?.data;
      if (!result?.error && aal?.currentLevel !== 'aal2' && aal?.nextLevel === 'aal2' && await isTrusted()) {
        return { ...result, data: { ...aal, currentLevel: 'aal2', rrnTrustedDevice: true } };
      }
      return result;
    };

    patched = true;
    return true;
  }

  async function boot() {
    for (let i = 0; i < 400; i += 1) {
      const target = window.RRN_GET_SUPABASE_CLIENT?.() || window.RRN_SUPABASE_CLIENT || null;
      if (target && patch(target)) return;
      await wait(25);
    }
  }

  window.RRN_MFA_TRUST = Object.freeze({
    isTrusted,
    trustCurrentDevice,
    getToken: token
  });

  boot().catch(error => console.warn('RRN MFA trust boot:', error));
})();