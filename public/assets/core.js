// ==========================================================================
// Ofouq Al-Maarifa — shared core for every page.
//   i18n, site header/footer, auth state, Firestore content store,
//   story rendering helpers and the motion system.
// Pages only declare <body data-page="..."> (+ data-section for lists);
// assets/pages.js holds the per-page controllers.
// ==========================================================================
import { DICT } from './i18n.js';

export const ISSN = '3119-6691';
const LANGS = ['ar', 'en', 'fr'];

/* ---------------- i18n ---------------- */
export function getLang() {
  const l = localStorage.getItem('lang') || localStorage.getItem('uiLang') || 'ar';
  return LANGS.includes(l) ? l : 'ar';
}

export function t(key, lang = getLang()) {
  return (DICT[lang] && DICT[lang][key]) ?? DICT.ar[key] ?? '';
}

// value of a multilingual field ({ar,en,fr} or plain string), falling back across languages
export function pick(field, lang = getLang()) {
  if (field == null) return '';
  if (typeof field !== 'object') return String(field);
  return field[lang] || field.ar || field.fr || field.en || '';
}

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const langListeners = new Set();
export function onLangChange(fn) { langListeners.add(fn); }

export function setLang(lang) {
  if (!LANGS.includes(lang)) lang = 'ar';
  localStorage.setItem('lang', lang);
  localStorage.setItem('uiLang', lang); // the admin panel reads this key
  applyLang();
  langListeners.forEach((fn) => fn(lang));
}

function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-i-ph]').forEach((el) => { el.placeholder = t(el.dataset.iPh); });
  document.querySelectorAll('[data-i-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.iAria)); });
  document.querySelectorAll('.lang-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const date = document.querySelector('[data-today]');
  if (date) date.textContent = formatDate(Date.now(), { dateStyle: 'full' });
}

export function formatDate(value, opts = { dateStyle: 'long' }) {
  const ms = toMillis(value);
  if (!ms) return pick(value) || '';
  const locale = { ar: 'ar-MA-u-nu-latn', en: 'en-GB', fr: 'fr-FR' }[getLang()];
  try { return new Intl.DateTimeFormat(locale, opts).format(new Date(ms)); } catch { return ''; }
}

function toMillis(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v === 'object') return 0;
  const n = Number(v);
  if (!Number.isNaN(n) && n > 1e11) return n;
  const d = Date.parse(v);
  return Number.isNaN(d) ? 0 : d;
}

/* ---------------- icons (Lucide-style strokes) ---------------- */
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  download: '<path d="M12 3v12M6 11l6 6 6-6M5 21h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  landmark: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  scroll: '<path d="M8 21h11a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 0 0-2-2h12a2 2 0 0 1 2 2v12"/><path d="M10 7h6M10 11h6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  radio: '<circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  hammer: '<path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9M17.6 15 22 10.6M20 8.5l-3.5-3.5a4 4 0 0 0-5.6 0L9.5 6.4 17.6 14.5z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1"/>',
  receipt: '<path d="M5 2v20l3-2 3 2 3-2 3 2 2-1.5V2l-2 1.5-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>'
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------------- sections ---------------- */
export const SECTIONS = {
  'research':              { label: 'nav_research', list: 'research.html',              view: 'research-view.html',          icon: 'book' },
  'articles':              { label: 'nav_articles', list: 'articles.html',              view: 'articles-view.html',          icon: 'file' },
  'files':                 { label: 'nav_files',    list: 'files.html',                 view: 'files-view.html',             icon: 'layers' },
  'articles-foreign':      { label: 'nav_foreign',  list: 'articles-foreign.html',      view: 'articles-foreign-view.html',  icon: 'globe' },
  'general-articles':      { label: 'nav_general',  list: 'general-articles.html',      view: 'general-article-view.html',   icon: 'quote' },
  'editions':              { label: 'nav_editions', list: 'editions.html',              view: 'editions-view.html',          icon: 'book' },
  'activities':            { label: 'nav_activities', list: 'activities.html',          view: 'activities-view.html',        icon: 'calendar' },
  'training':              { label: 'nav_training', list: 'training.html',              view: 'training-view.html',          icon: 'sparkle' },
  'special-politics':      { label: 'sp_politics',  list: 'special-politics.html',      view: 'view.html?type=special-politics&',      icon: 'landmark' },
  'special-ir':            { label: 'sp_ir',        list: 'special-ir.html',            view: 'view.html?type=special-ir&',            icon: 'globe' },
  'special-admin-law':     { label: 'sp_admin_law', list: 'special-admin-law.html',     view: 'view.html?type=special-admin-law&',     icon: 'scale' },
  'special-const-law':     { label: 'sp_const_law', list: 'special-const-law.html',     view: 'view.html?type=special-const-law&',     icon: 'scroll' },
  'special-public-policy': { label: 'sp_public_policy', list: 'special-public-policy.html', view: 'view.html?type=special-public-policy&', icon: 'chart' }
};
export const DISCIPLINES = ['special-politics', 'special-ir', 'special-admin-law', 'special-const-law', 'special-public-policy'];

export function viewHref(item) {
  const meta = SECTIONS[item.section] || SECTIONS.articles;
  const id = encodeURIComponent(item.docId || item.id || '');
  return meta.view.includes('?') ? `${meta.view}id=${id}` : `${meta.view}?id=${id}`;
}

/* ---------------- content store ---------------- */
// Render instantly from the cached copy, then refresh from Firestore
// ("content" collection, where the admin panel writes every section).
let fresh = null;

function readCache() {
  try {
    const list = JSON.parse(localStorage.getItem('contentcache') || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function sortItems(list) {
  return list.slice().sort((a, b) =>
    (toMillis(b.updatedAt) || toMillis(b.createdAt)) - (toMillis(a.updatedAt) || toMillis(a.createdAt)));
}

async function fetchContent() {
  const [{ db }, fs] = await Promise.all([
    import('../firebase-init.js'),
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')
  ]);
  const snap = await fs.getDocs(fs.collection(db, 'content'));
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data(), docId: d.id }))
    .filter((i) => (i.status || 'published') !== 'draft');
  localStorage.setItem('contentcache', JSON.stringify(items));
  return items;
}

// cb(items, { fresh }) runs once with the cache (if any) and again with live data
export function onContent(cb) {
  const cached = readCache();
  if (cached.length) cb(sortItems(cached), { fresh: false });
  if (!fresh) fresh = fetchContent().catch((e) => { console.warn('Content fetch failed:', e.message); return null; });
  fresh.then((items) => { if (items) cb(sortItems(items), { fresh: true }); else if (!cached.length) cb([], { fresh: true, failed: true }); });
}

export function bySection(items, section) {
  return items.filter((i) => i.section === section);
}

/* ---------------- auth state ---------------- */
export function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null'); } catch { return null; }
}

// Same record every page reads for the header; stays in whichever storage "remember me" chose
export function saveUser(user, provider, remember = true, name) {
  const data = JSON.stringify({
    provider, loggedIn: true, uid: user.uid, email: user.email || '',
    name: name || user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
    photoURL: user.photoURL || '', lastLogin: Date.now()
  });
  if (remember) { localStorage.setItem('user', data); sessionStorage.removeItem('user'); }
  else { sessionStorage.setItem('user', data); localStorage.removeItem('user'); }
}

const firestore = () => Promise.all([import('../firebase-init.js'), import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')]);
const utcDay = () => new Date().toISOString().slice(0, 10);

// Creates/updates users/{uid} on sign-in and returns the name to display
export async function recordLogin(user, provider, name) {
  const [{ db }, fs] = await firestore();
  const ref = fs.doc(db, 'users', user.uid);
  const snap = await fs.getDoc(ref);
  const now = Date.now();
  const isNew = !snap.exists();
  const displayName = snap.data()?.displayName || name || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  await fs.setDoc(ref, {
    email: user.email || '', provider, lastLogin: now, loginCount: fs.increment(1),
    ...(isNew ? { uid: user.uid, displayName, photoURL: user.photoURL || '', createdAt: now } : {})
  }, { merge: true });
  await fs.setDoc(fs.doc(db, 'stats_daily', utcDay()), {
    logins: fs.increment(1), ...(isNew ? { signups: fs.increment(1) } : {})
  }, { merge: true }).catch(() => {});
  return displayName;
}

// Firebase is the source of truth for the session; the stored copy only makes the header instant
async function watchAuth() {
  const [{ auth, db }, fa, fs] = await Promise.all([
    import('../firebase-init.js'),
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')
  ]);
  fa.onAuthStateChanged(auth, async (u) => {
    const stored = currentUser();
    if (!u) {
      if (stored) { localStorage.removeItem('user'); sessionStorage.removeItem('user'); renderAuthSlots(); }
      return;
    }
    const provider = u.providerData[0]?.providerId === 'google.com' ? 'google' : 'password';
    const remember = !sessionStorage.getItem('user');
    let name = stored?.name;
    try {
      const snap = await fs.getDoc(fs.doc(db, 'users', u.uid));
      name = snap.exists() ? snap.data().displayName : await recordLogin(u, provider);
    } catch (e) { console.warn('User profile unavailable:', e.message); }
    saveUser(u, provider, remember, name);
    renderAuthSlots();
  });
}

// Anonymous counters for the admin dashboard: a random browser id, no IP or personal data
// unless the visitor is signed in. Local previews are skipped so they never reach real stats.
async function track() {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return;
  try {
    const [{ db }, fs] = await firestore();
    const inc = fs.increment(1);
    const day = utcDay();
    const now = Date.now();
    let vid = localStorage.getItem('ofq_vid');
    const isNew = !vid;
    if (isNew) { vid = crypto.randomUUID(); localStorage.setItem('ofq_vid', vid); }
    const firstToday = localStorage.getItem('ofq_day') !== day;
    localStorage.setItem('ofq_day', day);
    const firstInSession = !sessionStorage.getItem('ofq_session');
    sessionStorage.setItem('ofq_session', '1');
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    const lang = getLang();
    const pageKey = /^[\w-]{1,60}$/.test(currentFile) ? currentFile : 'other';
    const itemId = new URLSearchParams(location.search).get('id') || '';
    let source = 'direct';
    try { const h = new URL(document.referrer).hostname; if (h && h !== location.hostname) source = h.slice(0, 60); } catch { /* no referrer */ }

    await fs.setDoc(fs.doc(db, 'stats_daily', day), {
      views: inc,
      pages: { [pageKey]: inc },
      ...(page === 'article' && /^[\w-]{1,64}$/.test(itemId) ? { items: { [itemId]: inc } } : {}),
      ...(firstInSession ? { sessions: inc, sources: { [source]: inc } } : {}),
      ...(firstToday ? { visitors: inc, devices: { [device]: inc }, langs: { [lang]: inc } } : {}),
      ...(isNew ? { newVisitors: inc } : {})
    }, { merge: true });

    if (firstInSession) {
      const u = currentUser();
      await fs.setDoc(fs.doc(db, 'visitors', vid), {
        lastSeen: now, visits: inc, device, lang,
        ...(isNew ? { firstSeen: now } : {}),
        ...(u?.loggedIn ? { uid: u.uid || '', name: String(u.name || '').slice(0, 60) } : {})
      }, { merge: true });
    }
  } catch (e) { console.warn('Stats skipped:', e.message); }
}

export async function logout() {
  try {
    const [{ auth }, { signOut }] = await Promise.all([
      import('../firebase-init.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js')
    ]);
    await Promise.race([signOut(auth), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* still clear the local session */ }
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
  location.reload();
}

/* ---------------- story rendering ---------------- */
function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'A';
}
export { initials };

export function media(item, cls = '') {
  const img = item.videoCover || item.image || item.cover || '';
  return `<div class="story__media ${cls}">${img
    ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.innerHTML='<div class=&quot;ph&quot;><img src=&quot;logo1.png&quot; alt=&quot;&quot;></div>'">`
    : '<div class="ph"><img src="logo1.png" alt=""></div>'}${item.video ? `<span class="story__play">${icon('play')}</span>` : ''}</div>`;
}

export function excerpt(item) {
  return pick(item.short) || pick(item.shortContent) || pick(item.description) || pick(item.details) || '';
}

export function storyCard(item, variant = '') {
  const title = pick(item.title) || t('untitled');
  const author = pick(item.author);
  const date = pick(item.date) || formatDate(item.createdAt);
  const label = t((SECTIONS[item.section] || {}).label || 'nav_articles');
  return `
    <article class="story ${variant}">
      ${media(item)}
      <div class="story__body">
        <span class="kicker">${esc(label)}</span>
        <h3><a class="story__link" href="${viewHref(item)}"><span class="story__title">${esc(title)}</span></a></h3>
        ${variant.includes('row') ? '' : excerpt(item) ? `<p class="story__excerpt">${esc(excerpt(item))}</p>` : ''}
        <div class="story__meta">
          ${author ? `<span>${esc(author)}</span>` : ''}
          ${author && date ? '<span class="dot"></span>' : ''}
          ${date ? `<span>${esc(date)}</span>` : ''}
        </div>
      </div>
    </article>`;
}

export function skeletons(n = 3) {
  return Array.from({ length: n }, () => '<div class="skel-card"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>').join('');
}

export function emptyState(titleKey = 'empty', hintKey = 'empty_hint', iconName = 'inbox', withHome = true) {
  return `<div class="empty" data-reveal>
    <div class="tile-ic">${icon(iconName)}</div>
    <h3>${esc(t(titleKey))}</h3>
    <p>${esc(t(hintKey))}</p>
    ${withHome ? `<a class="btn" href="index.html">${esc(t('back_home'))}</a>` : ''}
  </div>`;
}

/* ---------------- toast ---------------- */
export function toast(msg) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); }, 2600);
}

/* ---------------- header / footer ---------------- */
const page = document.body.dataset.page || '';
const currentFile = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

function isCurrent(href) {
  const target = href.replace(/\.html.*$/, '');
  const listOf = { 'research-view': 'research', 'articles-view': 'articles', 'files-view': 'files', 'articles-foreign-view': 'articles-foreign', 'general-article-view': 'general-articles', 'editions-view': 'editions', 'activities-view': 'activities', 'training-view': 'training' };
  return target === (listOf[currentFile] || currentFile);
}
const cur = (href) => (isCurrent(href) ? ' aria-current="page"' : '');

const NAV = [
  ['index.html', 'nav_home'], ['research.html', 'nav_research'], ['articles.html', 'nav_articles'],
  ['files.html', 'nav_files'], ['articles-foreign.html', 'nav_foreign'], ['general-articles.html', 'nav_general'],
  ['editions.html', 'nav_editions']
];
const NAV_AFTER = [['live.html', 'nav_live'], ['editorial-board.html', 'nav_board'], ['rules.html', 'nav_rules'], ['contact.html', 'nav_contact']];
const DISC_DESC = { ar: 'أبحاث ومقالات التخصص', en: 'Research & articles', fr: 'Recherches et articles' };

function brandHTML() {
  return `<a class="brand" href="index.html" aria-label="${esc(t('brand_full'))}">
    <img src="logo1.png" alt="" width="58" height="58">
    <span class="brand__name"><strong data-i="brand">${esc(t('brand'))}</strong><span data-i="tagline">${esc(t('tagline'))}</span></span>
  </a>`;
}

function langSwitchHTML() {
  return `<div class="lang-switch" role="group" data-i-aria="language">
    ${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}">${l.toUpperCase()}</button>`).join('')}
  </div>`;
}

function authHTML() {
  const u = currentUser();
  if (u && u.loggedIn) {
    const name = u.name || (u.email ? u.email.split('@')[0] : '');
    return `<a href="profile.html">${icon('user')} ${esc(name)}</a><button type="button" data-logout>${esc(t('logout'))}</button>`;
  }
  return `<a href="login.html">${esc(t('login'))}</a><a href="register.html">${esc(t('join'))}</a>`;
}

const MY_ACCOUNT = { ar: 'حسابي', en: 'My account', fr: 'Mon compte' };
function drawerAuthHTML() {
  return currentUser()?.loggedIn
    ? `<a class="btn btn--primary" href="profile.html">${esc(MY_ACCOUNT[getLang()])}</a><button class="btn" type="button" data-logout>${esc(t('logout'))}</button>`
    : `<a class="btn" href="login.html">${esc(t('login'))}</a><a class="btn btn--primary" href="register.html">${esc(t('join'))}</a>`;
}

function renderAuthSlots() {
  const top = document.querySelector('.topbar__auth');
  const drawer = document.querySelector('.drawer__auth');
  if (top) top.innerHTML = authHTML();
  if (drawer) drawer.innerHTML = drawerAuthHTML();
}
export { renderAuthSlots };

function headerHTML() {
  const discCurrent = DISCIPLINES.some((d) => isCurrent(SECTIONS[d].list));
  return `
  <a class="skip" href="#main" data-i="skip">${esc(t('skip'))}</a>
  <div class="topbar"><div class="wrap">
    <div class="topbar__meta">
      <span data-today></span><span class="topbar__sep hide-sm"></span>
      <span class="hide-sm"><b>ISSN</b> <bdi>${ISSN}</bdi></span>
    </div>
    <div class="topbar__tools"><div class="topbar__auth">${authHTML()}</div>${langSwitchHTML()}</div>
  </div></div>
  <header class="site-head">
    <div class="wrap masthead">
      ${brandHTML()}
      <div class="masthead__actions">
        <button class="icon-btn" type="button" data-search-open data-i-aria="search">${icon('search')}</button>
        <a class="btn btn--primary" href="rules.html"><span data-i="submit_paper">${esc(t('submit_paper'))}</span>${icon('arrow', 'ic--flip')}</a>
        <button class="icon-btn menu-btn" type="button" data-drawer-open aria-controls="drawer" aria-expanded="false" data-i-aria="menu">${icon('menu')}</button>
      </div>
    </div>
    <nav class="mainnav" aria-label="Main"><div class="wrap"><ul>
      ${NAV.map(([h, k]) => `<li><a href="${h}"${cur(h)} data-i="${k}">${esc(t(k))}</a></li>`).join('')}
      <li><button class="nav-drop${discCurrent ? ' is-current' : ''}" type="button" aria-expanded="false" aria-controls="mega"><span data-i="nav_academic">${esc(t('nav_academic'))}</span>${icon('chevron')}</button></li>
      ${NAV_AFTER.map(([h, k]) => `<li><a href="${h}"${cur(h)} data-i="${k}">${esc(t(k))}</a></li>`).join('')}
    </ul></div>
    <div class="mega" id="mega"><div class="wrap">
      ${DISCIPLINES.map((d) => `<a href="${SECTIONS[d].list}"${cur(SECTIONS[d].list)}><span class="tile-ic">${icon(SECTIONS[d].icon)}</span><b data-i="${SECTIONS[d].label}">${esc(t(SECTIONS[d].label))}</b><span>${esc(DISC_DESC[getLang()])}</span></a>`).join('')}
    </div></div>
    </nav>
  </header>
  <div class="search-pop" role="dialog" aria-modal="true" data-i-aria="search">
    <form action="search.html" role="search">
      ${icon('search')}
      <input type="search" name="q" data-i-ph="search_ph" placeholder="${esc(t('search_ph'))}" autocomplete="off" aria-label="search">
      <button class="btn btn--primary btn--sm" type="submit" data-i="search">${esc(t('search'))}</button>
    </form>
  </div>
  <div class="drawer-veil" data-drawer-close></div>
  <aside class="drawer" id="drawer" aria-label="Menu">
    <div class="drawer__head">${brandHTML()}<button class="icon-btn" type="button" data-drawer-close data-i-aria="close">${icon('x')}</button></div>
    <nav>
      ${[...NAV, ['activities.html', 'nav_activities']].map(([h, k]) => `<a class="d-link" href="${h}"${cur(h)}><span data-i="${k}">${esc(t(k))}</span>${icon('arrow', 'ic--flip')}</a>`).join('')}
      <h3 data-i="nav_academic">${esc(t('nav_academic'))}</h3>
      ${DISCIPLINES.map((d) => `<a class="d-link" href="${SECTIONS[d].list}"${cur(SECTIONS[d].list)}><span data-i="${SECTIONS[d].label}">${esc(t(SECTIONS[d].label))}</span>${icon(SECTIONS[d].icon)}</a>`).join('')}
      <h3 data-i="nav_journal">${esc(t('nav_journal'))}</h3>
      ${NAV_AFTER.map(([h, k]) => `<a class="d-link" href="${h}"${cur(h)}><span data-i="${k}">${esc(t(k))}</span>${icon('arrow', 'ic--flip')}</a>`).join('')}
    </nav>
    <div class="drawer__foot">
      ${langSwitchHTML()}
      <div class="drawer__auth">${drawerAuthHTML()}</div>
    </div>
  </aside>`;
}

function footerHTML() {
  const col = (titleKey, links) => `<div><h4 data-i="${titleKey}">${esc(t(titleKey))}</h4><ul>${links.map(([h, k]) => `<li><a href="${h}" data-i="${k}">${esc(t(k))}</a></li>`).join('')}</ul></div>`;
  return `
  <footer class="site-foot">
    <div class="wrap"><div class="site-foot__big" aria-hidden="true">${esc(t('brand'))}</div></div>
    <div class="wrap site-foot__grid">
      <div class="site-foot__brand">
        ${brandHTML()}
        <p data-i="footer_about">${esc(t('footer_about'))}</p>
        <span class="issn-pill"><b>ISSN</b> ${ISSN}</span>
      </div>
      ${col('nav_journal', [['editorial-board.html', 'nav_board'], ['rules.html', 'nav_rules'], ['editions.html', 'nav_editions'], ['live.html', 'nav_live'], ['contact.html', 'nav_contact']])}
      ${col('nav_studies', [['research.html', 'nav_research'], ['articles.html', 'nav_articles'], ['files.html', 'nav_files'], ['articles-foreign.html', 'nav_foreign'], ['general-articles.html', 'nav_general']])}
      ${col('nav_academic', DISCIPLINES.map((d) => [SECTIONS[d].list, SECTIONS[d].label]))}
    </div>
    <div class="site-foot__bar"><div class="wrap">
      <span>© 2026 ${esc(t('brand_latin'))} — <span data-i="rights">${esc(t('rights'))}</span></span>
      <a class="cc" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="license noopener">
        <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" loading="lazy">
        <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="" loading="lazy">
        <img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="" loading="lazy">
        <span data-i="license">${esc(t('license'))}</span>
      </a>
      <span><span data-i="built_by">${esc(t('built_by'))}</span> <a href="https://github.com/yasserA5" target="_blank" rel="noopener">Karim Rasmi</a></span>
    </div></div>
  </footer>
  <button class="to-top" type="button" data-i-aria="back_top"><svg class="ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22"/></svg>${icon('up')}</button>`;
}

function mountChrome() {
  if (document.body.dataset.chrome === 'none') return;
  document.body.insertAdjacentHTML('afterbegin', headerHTML());
  document.body.insertAdjacentHTML('beforeend', footerHTML());
}

/* ---------------- interactions ---------------- */
function bindChrome() {
  document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('.lang-switch button');
    if (langBtn) { setLang(langBtn.dataset.lang); return; }
    if (e.target.closest('[data-logout]')) { logout(); return; }
    if (e.target.closest('[data-search-open]')) { openSearch(); return; }
    if (e.target.closest('.search-pop') && !e.target.closest('form')) { closeSearch(); return; }
    if (e.target.closest('[data-drawer-open]')) { toggleDrawer(true); return; }
    if (e.target.closest('[data-drawer-close]')) { toggleDrawer(false); return; }
    const drop = e.target.closest('.nav-drop');
    const mega = document.getElementById('mega');
    if (drop && mega) {
      const open = drop.getAttribute('aria-expanded') !== 'true';
      drop.setAttribute('aria-expanded', String(open));
      mega.classList.toggle('is-open', open);
      return;
    }
    if (mega && mega.classList.contains('is-open') && !e.target.closest('.mega')) closeMega();
  });

  // hovering the disciplines button on desktop opens the panel too
  const drop = document.querySelector('.nav-drop');
  const mega = document.getElementById('mega');
  if (drop && mega && matchMedia('(hover:hover)').matches) {
    let timer;
    const open = () => { clearTimeout(timer); drop.setAttribute('aria-expanded', 'true'); mega.classList.add('is-open'); };
    const close = () => { timer = setTimeout(closeMega, 180); };
    [drop, mega].forEach((el) => { el.addEventListener('mouseenter', open); el.addEventListener('mouseleave', close); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearch(); toggleDrawer(false); closeMega(); }
    if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); openSearch(); }
  });
}

function closeMega() {
  document.querySelector('.nav-drop')?.setAttribute('aria-expanded', 'false');
  document.getElementById('mega')?.classList.remove('is-open');
}
function openSearch() {
  const pop = document.querySelector('.search-pop');
  if (!pop) return;
  pop.classList.add('is-open');
  setTimeout(() => pop.querySelector('input')?.focus(), 50);
}
function closeSearch() { document.querySelector('.search-pop')?.classList.remove('is-open'); }
function toggleDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  document.querySelector('[data-drawer-open]')?.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => document.querySelector('.drawer [data-drawer-close]')?.focus(), 50);
}

/* ---------------- motion ---------------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let io = null;

export function reveal(root = document) {
  const targets = root.querySelectorAll('[data-reveal]:not(.is-in), [data-stagger]:not(.is-in)');
  if (reduce || !('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  if (!io) {
    io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
      en.target.querySelectorAll('[data-count]').forEach(countUp);
      if (en.target.matches('[data-count]')) countUp(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  targets.forEach((el) => io.observe(el));
}

export function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  if (reduce || el.dataset.counted === String(target)) { el.textContent = target; return; }
  el.dataset.counted = String(target);
  const start = performance.now();
  const dur = 1200;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// subtle 3D tilt that follows the pointer (issue cover)
export function tilt(el) {
  if (!el || reduce || !matchMedia('(hover:hover)').matches) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${x * 16}deg`);
    el.style.setProperty('--rx', `${-y * 12}deg`);
  });
  el.addEventListener('pointerleave', () => { el.style.removeProperty('--ry'); el.style.removeProperty('--rx'); });
}

function scrollEffects() {
  const head = document.querySelector('.site-head');
  const top = document.querySelector('.to-top');
  const bar = document.querySelector('.reading-bar');
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, y / max) : 0;
    head?.classList.toggle('is-stuck', y > 40);
    if (top) { top.classList.toggle('is-shown', y > 600); top.style.setProperty('--p', p.toFixed(3)); }
    if (bar) bar.style.transform = `scaleX(${p})`;
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  top?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  update();
}

// clicked story image morphs into the article hero (cross-document view transition)
function sharedImageMorph() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.story a.story__link');
    if (!link) return;
    const img = link.closest('.story').querySelector('.story__media');
    if (img) img.style.viewTransitionName = 'hero-media';
  });
  addEventListener('pageshow', () => document.querySelectorAll('.story__media').forEach((m) => { m.style.viewTransitionName = ''; }));
}

/* ---------------- boot ---------------- */
document.documentElement.lang = getLang();
document.documentElement.dir = getLang() === 'ar' ? 'rtl' : 'ltr';
mountChrome();
applyLang();
bindChrome();
scrollEffects();
sharedImageMorph();
onLangChange(() => {
  document.querySelectorAll('.mega a > span:last-child').forEach((s) => { s.textContent = DISC_DESC[getLang()]; });
  renderAuthSlots();
  reveal();
});
// auth pages manage the session themselves, and shouldn't count as a second login
if (document.body.dataset.chrome !== 'none') watchAuth().catch((e) => console.warn('Auth watch failed:', e.message));
track();

export { page };
