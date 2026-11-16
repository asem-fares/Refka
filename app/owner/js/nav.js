// Tiny hash router. Screens register cleanup with onLeave (timers, camera).
let renderFn = () => {};
let leaves = [];
export const setRenderer = f => { renderFn = f; };
export const onLeave = fn => { leaves.push(fn); };
export function render() {
  const l = leaves; leaves = [];
  l.forEach(f => { try { f(); } catch (e) { console.warn('[owner]', e); } });
  document.querySelectorAll('#layer .sheet').forEach(x => x.remove());
  renderFn();
  window.scrollTo(0, 0);
}
export function go(path, replace) {
  const target = '#/' + path;
  if (location.hash === target) return render();
  if (replace) history.replaceState(null, '', target), render(); else location.hash = target;
}
export const route = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
window.addEventListener('hashchange', render);
