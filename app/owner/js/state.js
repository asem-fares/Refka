// Shared state for the owner console. The server is the source of truth; this is only a cache of the last answer.
const rf = window.rf;

export const S = { session: null, gym: null, packages: [], counts: {}, needsCount: 0 };

export async function rpc(name, args) {
  try { return await rf.rpc(name, args); }
  catch (e) { if (e && e.code === 'not_auth') window.dispatchEvent(new Event('rf-owner-signedout')); throw e; }
}

/** Load the owner's gym. Returns the gym or null when he has none yet. */
export async function loadGym() {
  const r = await rf.rpc('owner_get_gym');   // not_auth here is handled by the caller
  if (!r || !r.gym) { S.gym = null; S.packages = []; S.counts = {}; return null; }
  S.gym = r.gym;
  S.packages = (r.packages || []).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.months - b.months);
  S.counts = r.counts || {};
  return S.gym;
}
export function setGym(g) { if (g && g.id) S.gym = Object.assign({}, S.gym, g); return S.gym; }

export const memberLink = () => location.origin + '/app/?g=' + encodeURIComponent(S.gym ? S.gym.slug : '');
export const linkPrefix = () => location.host + '/app/?g=';

export const brandOf = g => Object.assign({ primary: '#0D6B6E', accent: '#B07A1F', logo: null }, (g && g.brand) || {});
export const payOf = g => Object.assign({ cash: false }, (g && g.pay) || {});
export const settingsOf = g => Object.assign({ cross: true, posts: 'all' }, (g && g.settings) || {});
export const hasPay = g => { const p = payOf(g); return !!(p.instapay || p.wallet || p.cash); };
export const activePackages = () => S.packages.filter(p => p.active !== false);

// Small per browser memory (wizard step, language). Never holds gym data.
export const mem = {
  get(k) { try { return localStorage.getItem('rf_owner_' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('rf_owner_' + k, v); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem('rf_owner_' + k); } catch (e) { /* private mode */ } },
};
