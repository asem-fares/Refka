// Editors shared by the setup wizard and Settings. Each returns { el, save }.
// save() checks the form, calls the RPC, and throws a friendly error when something is wrong.
import { t, lang } from './i18n.js';
import { h, fill, field, toggle, friendly, errText, sheet, confirmSheet, run, toast, today, addMonths, fmtDate, money, latinDigits, nameOf, initial, debounce, icon } from './ui.js';
import { S, rpc, loadGym, setGym, brandOf, payOf, linkPrefix, activePackages } from './state.js';

const rf = window.rf;
const num = v => { const n = parseInt(latinDigits(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };

// ---------------------------------------------------------------- gym name + link
export const slugify = s => latinDigits(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const slugOk = s => /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(s) && !s.includes('--');

export function gymEditor() {
  const g = S.gym;
  const name = h('input', { class: 'input ltr', dir: 'ltr', maxlength: 60, autocomplete: 'organization', value: g ? g.name || '' : '', placeholder: 'Atlas Gym' });
  const nameAr = h('input', { class: 'input', dir: 'rtl', lang: 'ar', maxlength: 60, value: g ? g.name_ar || '' : '', placeholder: 'أطلس جيم' });
  const fName = field(t('gym_name_en'), name);
  const fNameAr = field(t('gym_name_ar'), nameAr);
  const kids = [fName, fNameAr];
  let slug, fSlug, slugTouched = false, known = {};

  if (!g) {
    slug = h('input', { class: 'input', dir: 'ltr', maxlength: 30, autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', inputmode: 'url', placeholder: 'atlas' });
    const box = h('div', { class: 'slugbox' }, h('span', { class: 'ltr' }, linkPrefix()), slug);
    const state = h('div', { class: 'okmsg' });
    const sugg = h('div', { class: 'chips' });
    fSlug = field(t('slug_label'), slug, { wrap: box, hint: t('slug_hint') });
    fSlug.append(state, sugg);
    const suggest = base => {
      const b = base.slice(0, 24).replace(/-+$/, '');
      fill(sugg, [b + '-gym', b + '-eg', b + '2'].filter(slugOk).map(v =>
        h('button', { type: 'button', class: 'chip ltr', onclick: () => { slug.value = v; slugTouched = true; fill(sugg); check(); } }, v)));
    };
    const show = (kind, msg) => {
      box.classList.toggle('bad', kind === 'bad'); box.classList.toggle('good', kind === 'good');
      fSlug.err.textContent = kind === 'bad' ? msg : ''; state.textContent = kind === 'good' ? msg : '';
    };
    // Live check: the format is checked here; a link used by a live gym is found through gym_public.
    const remote = debounce(async v => {
      if (known[v] === undefined) { try { known[v] = !!(await rf.rpc('gym_public', { p_slug: v })); } catch (e) { return; } }
      if (slug.value !== v) return;
      if (known[v]) { show('bad', t('err_slug_taken')); suggest(v); } else show('good', t('slug_ok'));
    }, 450);
    const check = () => {
      const v = slug.value; fill(sugg);
      if (!v) return show('', '');
      if (!slugOk(v)) return show('bad', t('err_slug_bad'));
      show('', ''); remote(v);
    };
    slug.addEventListener('input', () => {
      slug.value = latinDigits(slug.value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').replace(/-{2,}/g, '-').slice(0, 30);
      slugTouched = true; check();
    });
    name.addEventListener('input', () => { if (!slugTouched) { slug.value = slugify(name.value).replace(/-gym$|-fitness$/, '') || slugify(name.value); check(); } });
    fSlug.markTaken = v => { known[v] = true; show('bad', t('err_slug_taken')); suggest(v); };
    fSlug.markBad = () => show('bad', t('err_slug_bad'));
    kids.push(fSlug);
  } else {
    kids.push(h('div', { class: 'field' }, h('div', { class: 'label' }, t('slug_label')),
      h('div', { class: 'copy-line' }, h('code', null, linkPrefix() + g.slug)), h('div', { class: 'hint' }, t('slug_fixed'))));
  }

  async function save() {
    const n = name.value.trim(), na = nameAr.value.trim();
    let bad = false;
    if (n.length < 2) { fName.setErr(t('e_gname')); bad = true; }
    if (na.length < 2) { fNameAr.setErr(t('e_gname_ar')); bad = true; }
    if (!S.gym) {
      const v = slug.value.replace(/-+$/, ''); slug.value = v;
      if (!slugOk(v)) { fSlug.markBad(); bad = true; }
      if (bad) throw friendly(t('e_fix'));
      try {
        setGym(await rpc('owner_create_gym', { p_name: n, p_name_ar: na, p_slug: v }));
        if (!S.gym) await loadGym();
      } catch (e) {
        if (e.code === 'slug_taken') { fSlug.markTaken(v); throw friendly(t('e_fix')); }
        if (e.code === 'slug_bad') { fSlug.markBad(); throw friendly(t('e_fix')); }
        throw e;
      }
    } else {
      if (bad) throw friendly(t('e_fix'));
      if (n !== S.gym.name || na !== S.gym.name_ar) setGym(await rpc('owner_update_gym', { p_patch: { name: n, name_ar: na } }));
    }
  }
  return { el: h('div', { class: 'list' }, kids), save };
}

// ---------------------------------------------------------------- brand
export const COLORS = [['teal', '#0D6B6E'], ['gold', '#B07A1F'], ['red', '#B3261E'], ['orange', '#C2410C'], ['green', '#2E7D32'], ['blue', '#1D4ED8'],
  ['navy', '#1E3A5F'], ['purple', '#6D28D9'], ['magenta', '#A21CAF'], ['charcoal', '#2B2F33'], ['olive', '#5B6B1F'], ['brown', '#7C4A2D']];
const ACCENTS = [['gold', '#B07A1F'], ['amber', '#D97706'], ['lime', '#65A30D'], ['sky', '#0284C7'], ['rose', '#E11D48'], ['silver', '#8A9499']];
const safeColor = c => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#0D6B6E');
/** Only data URLs of images may be shown as a logo. */
export const safeLogo = u => (typeof u === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);

/** Shrink a picked image to a small square data URL (about 10 to 25 KB). */
function shrinkLogo(file) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(friendly(t('e_logo_type')));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = 192, cv = document.createElement('canvas'); cv.width = cv.height = side;
      const x = cv.getContext('2d'), s = Math.max(side / img.width, side / img.height), w = img.width * s, hh = img.height * s;
      x.fillStyle = '#fff'; x.fillRect(0, 0, side, side);
      x.drawImage(img, (side - w) / 2, (side - hh) / 2, w, hh);
      let out = cv.toDataURL('image/jpeg', 0.82);
      if (out.length > 40000) out = cv.toDataURL('image/jpeg', 0.6);
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(friendly(t('e_logo_type'))); };
    img.src = url;
  });
}

export function brandEditor() {
  const b = brandOf(S.gym);
  let primary = safeColor(b.primary), accent = safeColor(b.accent), logo = safeLogo(b.logo);
  const lz = h('div', { class: 'lz' }), prev = h('div', { class: 'mprev' });
  const logoErr = h('div', { class: 'err', role: 'alert' });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
  const removeBtn = h('button', { type: 'button', class: 'btn link', onclick: () => { logo = null; paint(); } }, t('logo_remove'));
  const pickBtn = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => file.click() });
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = ''; if (!f) return;
    const r = await run(pickBtn, logoErr, () => shrinkLogo(f));
    if (r.ok) { logo = r.data; paint(); }
  });
  const sw = (list, get, set, label) => h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label }, list.map(([n, hex]) => {
    const btn = h('button', { type: 'button', class: 'sw', role: 'radio', 'aria-label': n, 'data-c': hex, style: { background: hex }, onclick: () => { set(hex); paint(); } });
    btn._get = get; return btn;
  }));
  const prim = sw(COLORS, () => primary, v => { primary = v; }, t('color_primary'));
  const acc = sw(ACCENTS, () => accent, v => { accent = v; }, t('color_accent'));
  function paint() {
    for (const grp of [prim, acc]) for (const x of grp.children) { const on = x.dataset.c.toLowerCase() === x._get().toLowerCase(); x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }
    const gname = nameOf(S.gym) || 'Gym';
    const mark = () => (logo ? h('img', { src: logo, alt: '' }) : initial(gname));
    fill(lz, mark()); lz.style.background = logo ? '#fff' : primary;
    fill(pickBtn, logo ? t('logo_change') : t('logo_add'));
    removeBtn.hidden = !logo;
    const p = activePackages()[0];
    fill(prev,
      h('div', { class: 'cov', style: { background: primary } }),
      h('div', { class: 'bd' },
        h('div', { class: 'lg', style: { background: logo ? '#fff' : primary } }, mark()),
        h('div', { class: 'nm' }, gname),
        h('div', { class: 'pr', style: { color: accent } }, p ? nameOf(p) + ' · ' + money(p.price) : t('prev_price')),
        h('div', { class: 'mb', style: { background: primary } }, t('prev_btn'))));
  }
  paint();
  const el = h('div', { class: 'list' },
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('color_primary')), h('div', { class: 'hint' }, t('color_primary_h')), prim),
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('color_accent')), h('div', { class: 'hint' }, t('color_accent_h')), acc),
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('logo'), h('span', { class: 'optl' }, ' ' + t('optional'))),
      h('div', { class: 'logo-zone' }, lz, h('div', { class: 'col' }, pickBtn, removeBtn, file)), logoErr,
      h('div', { class: 'hint' }, t('logo_h'))),
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('prev_title')), prev));
  async function save() {
    const cur = brandOf(S.gym);
    if (cur.primary === primary && cur.accent === accent && (cur.logo || null) === logo && S.gym.brand && S.gym.brand.primary) return;
    setGym(await rpc('owner_update_gym', { p_patch: { brand: { primary, accent, logo } } }));
  }
  return { el, save };
}

// ---------------------------------------------------------------- packages
export function autoName(m, l) {
  m = Number(m) || 1;
  if (l === 'ar') return m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m === 12 ? 'سنة' : m <= 10 ? m + ' شهور' : m + ' شهر';
  return m === 1 ? '1 month' : m === 12 ? '1 year' : m + ' months';
}
const pkgPayload = d => {
  const o = { name: d.name.trim() || autoName(d.months, 'en'), name_ar: d.name_ar.trim() || autoName(d.months, 'ar'), months: d.months, price: d.price,
    before_price: d.offer ? d.before : null, until: d.offer ? d.until || null : null, active: d.active, sort: d.months };
  if (d.id) o.id = d.id;
  return o;
};

/** requireOne: at least one saved package is needed to move on. suggest: start with 1, 3, 6, 12 months. */
export function packagesEditor({ suggest = false, showActive = false } = {}) {
  const listEl = h('div', { class: 'list' });
  const draftOf = p => ({ id: p.id || null, months: p.months, price: p.price ?? null, name: p.name || '', name_ar: p.name_ar || '', before: p.before_price ?? null,
    until: p.until || '', offer: p.before_price != null, active: p.active !== false, autoNames: !p.id || (p.name === autoName(p.months, 'en') && p.name_ar === autoName(p.months, 'ar')) });
  let cards = [];
  const start = S.packages.length ? S.packages.map(draftOf) : (suggest ? [1, 3, 6, 12].map(m => draftOf({ months: m })) : []);
  start.forEach(d => addCard(d));
  const empty = h('div', { class: 'empty' }, h('b', null, t('pk_empty')), t('pk_empty_h'));
  const sync = () => { empty.hidden = cards.length > 0; };
  sync();

  function addCard(d, focus) {
    const orig = d.id ? JSON.stringify(pkgPayload(d)) : null;
    const months = h('input', { class: 'input', inputmode: 'numeric', maxlength: 2, value: d.months, 'data-k': 'months' });
    const price = h('input', { class: 'input', inputmode: 'numeric', maxlength: 7, value: d.price ?? '', placeholder: '0', 'data-k': 'price' });
    const before = h('input', { class: 'input', inputmode: 'numeric', maxlength: 7, value: d.before ?? '', 'data-k': 'before' });
    const until = h('input', { class: 'input', type: 'date', min: today(), value: d.until || '', 'data-k': 'until' });
    const nm = h('input', { class: 'input ltr', dir: 'ltr', maxlength: 40, value: d.name || autoName(d.months, 'en') });
    const nmAr = h('input', { class: 'input', dir: 'rtl', lang: 'ar', maxlength: 40, value: d.name_ar || autoName(d.months, 'ar') });
    const title = h('b');
    const fM = field(t('pk_months'), months), fP = field(t('pk_price'), price);
    const fB = field(t('pk_before'), before, { hint: t('pk_before_h') }), fU = field(t('pk_until'), until);
    const fN = field(t('pk_name_en'), nm), fNa = field(t('pk_name_ar'), nmAr);
    const offerBox = h('div', { class: 'grid2' }, fB, fU);
    const offerBtn = h('button', { type: 'button', class: 'btn link' });
    const namesBox = h('div', { class: 'grid2', hidden: true }, fN, fNa);
    const namesBtn = h('button', { type: 'button', class: 'btn link', onclick: () => { namesBox.hidden = !namesBox.hidden; } }, t('pk_rename'));
    const err = h('div', { class: 'err', role: 'alert' });
    const del = h('button', { type: 'button', class: 'iconbtn', 'aria-label': t('pk_delete') }, '✕');
    const card = h('div', { class: 'card pkg', 'data-months': d.months },
      h('div', { class: 'hd' }, title, del),
      h('div', { class: 'grid2' }, fM, fP),
      offerBox, h('div', { class: 'row tight' }, offerBtn, namesBtn), namesBox,
      showActive && d.id ? h('div', { class: 'trow' }, h('div', { class: 'tx' }, h('b', null, t('pk_active')), h('small', null, t('pk_active_h'))),
        toggle(d.active, v => { d.active = v; }, t('pk_active'))) : null,
      err);
    const paint = () => {
      title.textContent = lang() === 'ar' ? nmAr.value || autoName(d.months, 'ar') : nm.value || autoName(d.months, 'en');
      offerBox.hidden = !d.offer; offerBtn.textContent = d.offer ? t('pk_offer_off') : t('pk_offer_on');
    };
    months.addEventListener('input', () => {
      const m = num(months.value); if (m) { d.months = m; if (d.autoNames) { nm.value = autoName(m, 'en'); nmAr.value = autoName(m, 'ar'); } paint(); }
    });
    [nm, nmAr].forEach(x => x.addEventListener('input', () => { d.autoNames = false; paint(); }));
    offerBtn.addEventListener('click', () => { d.offer = !d.offer; paint(); if (d.offer) before.focus(); });
    const c = { d, card, err,
      read() {
        d.months = num(months.value); d.price = num(price.value); d.before = num(before.value); d.until = until.value; d.name = nm.value; d.name_ar = nmAr.value;
      },
      blank() { this.read(); return !d.id && d.price == null; },
      check() {
        this.read(); let ok = true;
        if (!d.months || d.months < 1 || d.months > 36) { fM.setErr(t('e_months')); ok = false; }
        if (d.price == null || d.price <= 0) { fP.setErr(t('e_price')); ok = false; }
        if (d.offer) {
          if (d.before == null || d.before <= (d.price || 0)) { fB.setErr(t('e_before')); ok = false; }
          if (!d.until) { fU.setErr(t('err_before_needs_until')); ok = false; }
          else if (d.until < today()) { fU.setErr(t('e_until_past')); ok = false; }
        }
        return ok;
      },
      dirty() { return !d.id || JSON.stringify(pkgPayload(d)) !== this.orig; },
      orig,
    };
    del.addEventListener('click', async () => {
      if (d.id) {
        if (!await confirmSheet(t('pk_del_q', { n: title.textContent }), t('pk_del_h'), t('pk_delete'), true)) return;
        const r = await run(del, err, () => rpc('owner_delete_package', { p_id: d.id }));
        if (!r.ok) return;
        S.packages = S.packages.filter(p => p.id !== d.id);
        toast(t('deleted'));
      }
      card.remove(); cards = cards.filter(x => x !== c); sync();
    });
    paint();
    cards.push(c); listEl.appendChild(card);
    if (focus) { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); months.focus({ preventScroll: true }); }
    return c;
  }

  const addBtn = h('button', { type: 'button', class: 'btn ghost full', onclick: () => { addCard(draftOf({ months: 1 }), true); sync(); } }, '+ ' + t('pk_add'));
  const el = h('div', { class: 'list' }, listEl, empty, addBtn);

  async function save({ requireOne = true } = {}) {
    // Suggested cards he left without a price are simply not created.
    const live = cards.filter(c => !c.blank());
    if (!live.every(c => c.check()) ) { const b = live.find(c => c.card.querySelector('.bad')); if (b) b.card.scrollIntoView({ block: 'center', behavior: 'smooth' }); throw friendly(t('e_fix')); }
    if (requireOne && !live.some(c => c.d.active)) throw friendly(t('err_need_package'));
    for (const c of live) {
      if (!c.dirty()) continue;
      c.err.textContent = '';
      try {
        const p = await rpc('owner_upsert_package', { p: pkgPayload(c.d) });
        if (p && p.id) c.d.id = p.id;
        c.orig = JSON.stringify(pkgPayload(c.d));
      } catch (e) { c.err.textContent = errText(e); c.card.scrollIntoView({ block: 'center', behavior: 'smooth' }); throw friendly(t('e_fix')); }
    }
    await loadGym();
  }
  return { el, save };
}

// ---------------------------------------------------------------- how members pay
export function payEditor() {
  const p = payOf(S.gym);
  let cash = !!p.cash;
  const insta = h('input', { class: 'input ltr', dir: 'ltr', maxlength: 60, autocapitalize: 'none', spellcheck: 'false', value: p.instapay || '', placeholder: 'name@instapay' });
  const wallet = h('input', { class: 'input ltr', dir: 'ltr', inputmode: 'tel', maxlength: 16, value: p.wallet || '', placeholder: '01012345678' });
  const fI = field(t('pay_insta'), insta, { optional: true, hint: t('pay_insta_h') });
  const fW = field(t('pay_wallet'), wallet, { optional: true, hint: t('pay_wallet_h') });
  const el = h('div', { class: 'list' },
    h('div', { class: 'notice' }, t('pay_note')),
    fI, fW,
    h('div', { class: 'card soft' }, h('div', { class: 'trow' },
      h('div', { class: 'tx' }, h('b', null, t('pay_cash')), h('small', null, t('pay_cash_h'))),
      toggle(cash, v => { cash = v; }, t('pay_cash')))));
  async function save() {
    const i = insta.value.trim(), w = latinDigits(wallet.value).replace(/[^\d]/g, '');
    let bad = false;
    if (i && i.length < 4) { fI.setErr(t('e_insta')); bad = true; }
    if (w && !/^01[0125]\d{8}$/.test(w)) { fW.setErr(t('e_wallet')); bad = true; }
    if (bad) throw friendly(t('e_fix'));
    if (!i && !w && !cash) throw friendly(t('err_need_pay'));
    const pay = { cash };
    if (i) pay.instapay = i;
    if (w) pay.wallet = w;
    setGym(await rpc('owner_update_gym', { p_patch: { pay } }));
  }
  return { el, save };
}

// ---------------------------------------------------------------- members import
const GENDER = { m: 'm', male: 'm', man: 'm', boy: 'm', 'ذكر': 'm', 'راجل': 'm', 'ولد': 'm', 'رجل': 'm', f: 'f', female: 'f', woman: 'f', girl: 'f', 'أنثى': 'f', 'انثى': 'f', 'ست': 'f', 'بنت': 'f', 'سيدة': 'f' };

/** Egyptian mobile to +2010..., other numbers to +digits. Returns null when it does not look like a phone. */
export function normPhone(v) {
  let d = latinDigits(v).replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^1[0125]\d{8}$/.test(d)) d = '20' + d;           // Excel ate the first zero
  else if (/^01[0125]\d{8}$/.test(d)) d = '2' + d;
  if (d.startsWith('20')) return /^201[0125]\d{8}$/.test(d) ? '+' + d : null;
  return /^\d{10,15}$/.test(d) && /^\s*(\+|00)/.test(latinDigits(v)) ? '+' + d : null;
}
export function parseDate(v) {
  const s = latinDigits(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function matchPackage(cell) {
  const s = latinDigits(cell).trim().toLowerCase(); if (!s) return null;
  const pk = S.packages;
  let p = pk.find(x => (x.name || '').toLowerCase() === s || (x.name_ar || '') === s);
  if (p) return p;
  let months = null;
  const m = s.match(/^(\d{1,2})\s*(m|mo|month|months|شهر|شهور|اشهر|أشهر)?$/);
  if (m) months = +m[1];
  else if (s === 'شهر' || s === 'month') months = 1;
  else if (s === 'شهرين') months = 2;
  else if (s === 'سنة' || s === 'سنه' || s === 'year' || s === '1 year') months = 12;
  else if (s === 'نص سنة' || s === 'نص سنه') months = 6;
  return months ? pk.find(x => x.months === months) || null : null;
}
/** Turn pasted text (Excel, Sheets, WhatsApp list) into rows. Columns can come in any order. */
export function parseMembers(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let cells = line.includes('\t') ? line.split('\t') : line.split(/[,;،]/);
    cells = cells.map(c => c.trim()).filter(Boolean);
    if (cells.length === 1) {                              // "Ahmed Ali 01012345678"
      const m = latinDigits(cells[0]).match(/^(.*?)[\s:-]*((?:\+|00)?[\d\s-]{10,17})$/);
      if (m && m[1].trim()) cells = [m[1].trim(), m[2].trim()];
    }
    const r = { name: '', phoneRaw: '', gender: null, package_id: null, ends: null };
    for (const c of cells) {
      const low = c.toLowerCase();
      if (!r.phoneRaw && normPhone(c)) { r.phoneRaw = c; continue; }
      if (!r.ends && parseDate(c)) { r.ends = parseDate(c); continue; }
      if (!r.gender && GENDER[low]) { r.gender = GENDER[low]; continue; }
      if (!r.package_id) { const p = matchPackage(c); if (p) { r.package_id = p.id; continue; } }
      if (!r.name && /\p{L}/u.test(c)) { r.name = c; continue; }
      if (!r.phoneRaw && /^[\d\s+()-]{6,}$/.test(latinDigits(c))) r.phoneRaw = c;   // looks like a phone but is wrong: keep it so he can fix it
    }
    // A header line has words only and no phone: skip it.
    if (!r.phoneRaw && /^(name|الاسم|اسم|الإسم|member|العضو)$/i.test(r.name)) continue;
    out.push(r);
  }
  return out;
}

/** onDone(result) is called after a successful import with nothing left to fix. */
export function importer({ onDone } = {}) {
  let rows = [];
  const ta = h('textarea', { class: 'input', dir: 'auto', placeholder: t('imp_ph'), 'aria-label': t('imp_paste') });
  const readBtn = h('button', { type: 'button', class: 'btn ghost full', 'data-act': 'imp-read', onclick: () => {
    const got = parseMembers(ta.value);
    if (!got.length) { pasteErr.textContent = t('e_imp_empty'); return; }
    pasteErr.textContent = ''; rows = rows.concat(got); ta.value = ''; paint();
    listEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } }, t('imp_read'));
  const pasteErr = h('div', { class: 'err', role: 'alert' });
  const defPkg = h('select', { class: 'input' });
  const defEnd = h('input', { class: 'input', type: 'date' });
  const defaults = h('div', { class: 'card soft' }, h('small', null, t('imp_def_h')),
    h('div', { class: 'grid2' }, field(t('imp_def_pkg'), defPkg), field(t('imp_def_end'), defEnd)));
  const summary = h('div', { class: 'notice' });
  const listEl = h('div', { class: 'list' });
  const sendErr = h('div', { class: 'err', role: 'alert' });
  const result = h('div', { class: 'notice ok', id: 'imp-result', hidden: true, role: 'status' });
  const sendBtn = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'imp-send' });
  const handBtn = h('button', { type: 'button', class: 'btn ghost full', 'data-act': 'imp-hand', onclick: () => editRow(null) }, '+ ' + t('imp_hand'));
  const previewBox = h('div', { class: 'list' }, h('div', { class: 'section-label' }, t('imp_preview')), summary, defaults, listEl, sendErr, sendBtn);

  const pkgOptions = (sel, cur, none) => fill(sel, h('option', { value: '' }, none),
    activePackages().map(p => h('option', { value: p.id, selected: p.id === cur }, nameOf(p))));
  pkgOptions(defPkg, '', t('imp_none'));
  defPkg.addEventListener('change', () => {
    const p = S.packages.find(x => x.id === defPkg.value);
    if (p && !defEnd.value) defEnd.value = addMonths(today(), p.months);
    paint();
  });
  defEnd.addEventListener('change', () => paint());

  function validate() {
    const seen = new Map();
    rows.forEach(r => {
      r.phone = normPhone(r.phoneRaw); r.err = r.srv || null;
      if (!r.name || r.name.trim().length < 2) r.err = t('e_row_name');
      else if (r.name.trim().length > 60) r.err = t('e_row_long');
      else if (!r.phone) r.err = r.phoneRaw ? t('e_row_phone') : t('e_row_nophone');
      else if (seen.has(r.phone)) r.err = t('e_row_dup');
      if (r.phone && !seen.has(r.phone)) seen.set(r.phone, r);
    });
  }
  function paint() {
    validate();
    const bad = rows.filter(r => r.err).length, good = rows.length - bad;
    previewBox.hidden = !rows.length;
    summary.className = 'notice' + (bad ? ' warn' : ' ok');
    summary.textContent = bad ? t('imp_sum_bad', { ok: good, bad }) : t('imp_sum_ok', { ok: good });
    fill(sendBtn, t('imp_send', { n: good })); sendBtn.disabled = !good;
    fill(listEl, rows.map(r => {
      const pk = S.packages.find(p => p.id === (r.package_id || defPkg.value));
      const ends = r.ends || defEnd.value;
      const bits = [pk ? nameOf(pk) : null, ends ? t('ends_on', { d: fmtDate(ends) }) : null, r.gender ? t(r.gender === 'm' ? 'g_m' : 'g_f') : null].filter(Boolean).join(' · ');
      return h('div', { class: 'irow' + (r.err ? ' bad' : '') },
        h('div', { class: 'tx' }, h('b', null, r.name || t('imp_noname')),
          h('small', { class: 'ltr' }, r.phone ? r.phone.replace(/^\+20/, '0') : r.phoneRaw || ''),
          bits ? h('small', null, bits) : null,
          r.err ? h('span', { class: 'err' }, r.err) : null),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => editRow(r) }, r.err ? t('fix') : t('edit')),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': t('remove'), onclick: () => { rows = rows.filter(x => x !== r); paint(); } }, '✕'));
    }));
  }
  function editRow(r) {
    const isNew = !r; const d = r || { name: '', phoneRaw: '', gender: null, package_id: null, ends: null };
    sheet(close => {
      const nm = h('input', { class: 'input', dir: 'auto', maxlength: 60, value: d.name, autocomplete: 'off' });
      const ph = h('input', { class: 'input ltr', dir: 'ltr', inputmode: 'tel', maxlength: 20, value: d.phone ? d.phone.replace(/^\+20/, '0') : d.phoneRaw, placeholder: '01012345678', autocomplete: 'off' });
      const pk = h('select', { class: 'input' }); pkgOptions(pk, d.package_id, t('imp_none'));
      const en = h('input', { class: 'input', type: 'date', value: d.ends || '' });
      let g = d.gender;
      const seg = h('div', { class: 'seg' });
      const segPaint = () => fill(seg, [['m', t('g_m')], ['f', t('g_f')], [null, t('g_none')]].map(([v, l]) =>
        h('button', { type: 'button', class: g === v ? 'on' : '', onclick: () => { g = v; segPaint(); } }, l)));
      segPaint();
      pk.addEventListener('change', () => { const p = S.packages.find(x => x.id === pk.value); if (p && !en.value) en.value = addMonths(today(), p.months); });
      const fN = field(t('m_name'), nm), fP = field(t('m_phone'), ph);
      const ok = () => {
        let bad = false;
        if (nm.value.trim().length < 2) { fN.setErr(t('e_row_name')); bad = true; }
        if (!normPhone(ph.value)) { fP.setErr(t('e_row_phone')); bad = true; }
        if (bad) return;
        Object.assign(d, { name: nm.value.trim(), phoneRaw: ph.value.trim(), gender: g, package_id: pk.value || null, ends: en.value || null, srv: null });
        if (isNew) rows.push(d);
        close(); paint();
      };
      return [h('h3', null, isNew ? t('imp_hand') : t('imp_edit')), fN, fP,
        h('div', { class: 'field' }, h('div', { class: 'label' }, t('m_gender'), h('span', { class: 'optl' }, ' ' + t('optional'))), seg),
        h('div', { class: 'grid2' }, field(t('m_pkg'), pk), field(t('m_ends'), en)),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', onclick: close }, t('cancel')), h('button', { type: 'button', class: 'btn primary', 'data-act': 'row-ok', onclick: ok }, isNew ? t('add') : t('save')))];
    });
  }
  sendBtn.addEventListener('click', async () => {
    validate();
    const good = rows.filter(r => !r.err);
    if (!good.length) return;
    const payload = good.map(r => {
      const o = { phone: r.phone, name: r.name.trim() };
      if (r.gender) o.gender = r.gender;
      const pk = r.package_id || defPkg.value; if (pk) o.package_id = pk;
      const en = r.ends || defEnd.value; if (en) { o.ends = en; }
      return o;
    });
    const r = await run(sendBtn, sendErr, () => rpc('owner_import_members', { p_rows: payload }));
    if (!r.ok) return;
    const res = r.data || {}, errs = res.errors || [];
    // errors[].row is the 0 based index in the rows we sent.
    const base = 0;
    const failed = new Set();
    errs.forEach(e => { const row = good[e.row - base]; if (row) { row.srv = t('err_row_' + e.code) === 'err_row_' + e.code ? errText(e) : t('err_row_' + e.code); failed.add(row); } });
    rows = rows.filter(x => x.err || failed.has(x));
    result.hidden = false;
    result.textContent = t('imp_done', { a: res.added || 0, u: res.updated || 0 }) + (failed.size ? ' ' + t('imp_done_bad', { n: failed.size }) : '');
    paint();
    try { await loadGym(); } catch (e) { /* counts refresh is best effort */ }
    result.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (onDone) onDone(res, rows.length);
  });

  paint();
  const el = h('div', { class: 'list' },
    result,
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('imp_paste')), h('div', { class: 'hint' }, t('imp_paste_h')), ta, pasteErr),
    readBtn, handBtn, previewBox);
  return { el, pending: () => rows.length };
}

export { icon };
