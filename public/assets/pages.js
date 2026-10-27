// ==========================================================================
// Page controllers. Each page file is a thin shell:
//   <body data-page="home|list|article|board|rules|contact|live|search|login|register|forgot|reset"
//         data-section="research">   (lists / articles)
// and this module renders <main id="main"> for it.
// ==========================================================================
import {
  t, pick, esc, icon, getLang, onLangChange, formatDate, SECTIONS, DISCIPLINES, viewHref,
  onContent, bySection, storyCard, media, excerpt, skeletons, emptyState, reveal, tilt, toast, initials, ISSN, page
} from './core.js';

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const L = (obj) => obj[getLang()] || obj.ar;

/* ---------------- shared bits ---------------- */
function pageHero({ kicker, title, text, watermark, meta = '', crumbs = true }) {
  return `
  <section class="page-hero" data-watermark="${esc(watermark || title)}">
    <div class="wrap">
      ${crumbs ? `<nav class="crumbs" aria-label="breadcrumb"><a href="index.html">${esc(t('nav_home'))}</a>${icon('chevron', 'ic--flip')}<span>${esc(title)}</span></nav>` : ''}
      <span class="kicker">${esc(kicker || t('brand_full'))}</span>
      <h1>${esc(title)}</h1>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${meta ? `<div class="page-hero__meta">${meta}</div>` : ''}
    </div>
  </section>`;
}

function secHead(kicker, title, href) {
  return `<div class="sec-head"><div><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2></div>
    ${href ? `<a class="link-arrow" href="${href}">${esc(t('view_all'))}${icon('arrow', 'ic--flip')}</a>` : ''}</div>`;
}

function issueNo(ed) { return Number(ed.issueNumber || ed.editionNumber || 0) || ''; }
function issueTitle(ed) { return pick(ed.title) || `${t('issue')} ${issueNo(ed)}`; }

function issueTile(ed) {
  return `<a class="issue-tile" href="${viewHref(ed)}">
    <div class="issue-tile__cover">${ed.image ? `<img src="${esc(ed.image)}" alt="" loading="lazy">` : '<div class="story__media"><div class="ph"><img src="logo1.png" alt=""></div></div>'}
      ${issueNo(ed) ? `<span class="issue-tile__no">${esc(t('issue'))} ${issueNo(ed)}</span>` : ''}</div>
    <strong>${esc(issueTitle(ed))}</strong>
    ${pick(ed.short) ? `<p>${esc(pick(ed.short))}</p>` : ''}
  </a>`;
}

// rerun a render function on content updates and language changes
function live(render) {
  let items = null;
  onContent((list) => { items = list; render(items); reveal(); });
  onLangChange(() => { if (items) { render(items); reveal(); } });
}

/* ==========================================================================
   HOME
   ========================================================================== */
const TRACK_TEXT = {
  'special-politics': { ar: 'الأنظمة السياسية والأحزاب والانتخابات والسلوك السياسي.', en: 'Political systems, parties, elections and political behaviour.', fr: 'Systèmes politiques, partis, élections et comportement politique.' },
  'special-ir': { ar: 'نظريات العلاقات الدولية والفاعلون والأمن الدولي.', en: 'IR theory, global actors and international security.', fr: 'Théories des RI, acteurs mondiaux et sécurité internationale.' },
  'special-admin-law': { ar: 'تنظيم الإدارة العمومية والرقابة على أعمالها.', en: 'Organisation and oversight of public administration.', fr: 'Organisation et contrôle de l\'administration publique.' },
  'special-const-law': { ar: 'الدساتير والمؤسسات العليا والقضاء الدستوري.', en: 'Constitutions, high institutions and constitutional justice.', fr: 'Constitutions, institutions et justice constitutionnelle.' },
  'special-public-policy': { ar: 'تصميم السياسات العمومية وتقييم البرامج الحكومية.', en: 'Designing public policy and evaluating programmes.', fr: 'Conception des politiques et évaluation des programmes.' }
};

function homeShell() {
  main.innerHTML = `
    <div class="wrap lead-grid" id="lead"><div class="skel" style="min-height:460px;border-radius:22px"></div><div class="lead-side">${skeletons(2)}</div></div>
    <div id="ticker"></div>
    <div id="home-body"></div>`;
}

function renderHome(items) {
  const editions = bySection(items, 'editions');
  const pool = items.filter((i) => !['editions', 'live'].includes(i.section));
  const research = bySection(items, 'research');
  const withImg = pool.filter((i) => i.image);
  const lead = withImg[0] || pool[0];
  const side = pool.filter((i) => i !== lead).slice(0, 2);
  const latestEd = editions.slice().sort((a, b) => issueNo(b) - issueNo(a))[0];

  // lead grid
  const leadEl = document.getElementById('lead');
  if (lead) {
    leadEl.innerHTML = `
      ${storyCard(lead, 'story--lead').replace('<span class="kicker">', `<span class="kicker">${esc(t('kicker_lead'))} · `)}
      <div class="lead-side">
        ${side.map((s) => storyCard(s, 'story--row')).join('')}
        ${latestEd ? `<a class="issue-card" href="${viewHref(latestEd)}">
          ${latestEd.image ? `<img src="${esc(latestEd.image)}" alt="">` : ''}
          <div><span class="kicker kicker--light">${esc(t('current_issue'))}</span><strong>${esc(issueTitle(latestEd))}</strong><p>${esc(pick(latestEd.short))}</p></div>
        </a>` : ''}
      </div>`;
  } else if (latestEd) {
    leadEl.innerHTML = '';
    leadEl.style.display = 'none';
  } else {
    leadEl.innerHTML = `<div style="grid-column:1/-1">${emptyState('empty', 'empty_hint', 'inbox', false)}</div>`;
  }

  // ticker
  const tick = [...pool.slice(0, 8), ...editions.slice(0, 4)];
  document.getElementById('ticker').innerHTML = tick.length ? `
    <div class="ticker" aria-label="${esc(t('latest_pub'))}">
      <span class="ticker__label">${esc(t('latest_pub'))}</span>
      <div class="ticker__view"><div class="ticker__track">
        ${[...tick, ...tick].map((i, n) => `<a href="${viewHref(i)}"${n >= tick.length ? ' aria-hidden="true" tabindex="-1"' : ''}>${esc(i.section === 'editions' ? issueTitle(i) : pick(i.title))}</a>`).join('')}
      </div></div>
    </div>` : '';

  const more = pool.filter((i) => i !== lead && !side.includes(i)).slice(0, 6);
  const ranked = pool.slice().sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 6);
  const toc = latestEd && Array.isArray(latestEd.articles) ? latestEd.articles.slice(0, 5) : [];

  document.getElementById('home-body').innerHTML = `
    ${research.length ? `<section class="section"><div class="wrap">
      ${secHead(t('nav_research'), t('home_research'), 'research.html')}
      <div class="grid-3" data-stagger>${research.slice(0, 3).map((i) => storyCard(i)).join('')}</div>
    </div></section>` : ''}

    ${latestEd ? `<section class="feature">
      <div class="wrap">
        <div class="feature__cover" data-reveal="scale">${latestEd.image ? `<img src="${esc(latestEd.image)}" alt="${esc(issueTitle(latestEd))}">` : ''}</div>
        <div data-reveal>
          <span class="kicker kicker--light">${esc(t('current_issue'))} · ISSN ${ISSN}</span>
          <h2>${esc(issueTitle(latestEd))}</h2>
          <p>${esc(pick(latestEd.short))}</p>
          ${toc.length ? `<ul class="feature__toc">${toc.map((a) => `<li>${a.file ? `<a href="${esc(a.file)}" target="_blank" rel="noopener">${esc(a.title || '')}</a>` : esc(a.title || '')}</li>`).join('')}</ul>` : ''}
          <div class="feature__actions">
            <a class="btn btn--accent" href="${viewHref(latestEd)}">${esc(t('issue_contents'))}${icon('arrow', 'ic--flip')}</a>
            ${latestEd.fullIssueFile ? `<a class="btn btn--light" href="${esc(latestEd.fullIssueFile)}" target="_blank" rel="noopener">${icon('download')}${esc(t('download_issue'))}</a>` : ''}
          </div>
        </div>
      </div>
    </section>` : ''}

    ${more.length ? `<section class="section"><div class="wrap">
      ${secHead(t('explore'), t('latest_pub'))}
      <div class="grid-3" data-stagger>${more.map((i) => storyCard(i)).join('')}</div>
    </div></section>` : ''}

    <section class="section section--tint"><div class="wrap">
      ${secHead(t('home_tracks_sub'), t('home_tracks'))}
      <div class="bento" data-stagger>
        ${DISCIPLINES.map((d) => `<a href="${SECTIONS[d].list}">
          <span class="tile-ic">${icon(SECTIONS[d].icon)}</span>
          <div><h3>${esc(t(SECTIONS[d].label))}</h3><p>${esc(L(TRACK_TEXT[d]))}</p></div>
        </a>`).join('')}
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      <div class="stats" data-stagger>
        <div><strong data-count="${research.length}">0</strong><span>${esc(t('stat_research'))}</span></div>
        <div><strong data-count="${pool.length}">0</strong><span>${esc(t('stat_articles'))}</span></div>
        <div><strong data-count="${editions.length}">0</strong><span>${esc(t('stat_editions'))}</span></div>
        <div><strong data-count="3">0</strong><span>${esc(t('stat_langs'))}</span></div>
      </div>
      ${ranked.length > 1 ? `<div style="margin-top:clamp(40px,6vw,72px)">
        ${secHead(t('explore'), t('most_read'))}
        <ol class="ranked" data-stagger>${ranked.map((i) => `<li><div><a href="${viewHref(i)}">${esc(pick(i.title) || t('untitled'))}</a><small>${esc(t(SECTIONS[i.section]?.label || 'nav_articles'))}${pick(i.author) ? ' · ' + esc(pick(i.author)) : ''}</small></div></li>`).join('')}</ol>
      </div>` : ''}
    </div></section>

    ${editions.length ? `<section class="section section--ink"><div class="wrap rail">
      <div class="sec-head"><div><span class="kicker kicker--light">${esc(t('all_issues'))}</span><h2>${esc(t('home_editions'))}</h2></div>
        <div class="rail__nav">
          <button class="icon-btn" type="button" data-rail="-1" aria-label="prev">${icon('arrow', 'ic--flip')}</button>
          <button class="icon-btn" type="button" data-rail="1" aria-label="next">${icon('arrow')}</button>
        </div></div>
      <div class="rail__track" data-stagger>${editions.slice().sort((a, b) => issueNo(b) - issueNo(a)).map(issueTile).join('')}</div>
    </div></section>` : ''}

    <section class="section"><div class="wrap">
      <div class="cfp" data-reveal>
        <div>
          <span class="kicker" style="color:var(--ink)">${esc(t('submit_paper'))}</span>
          <h2>${esc(t('home_cfp_title'))}</h2>
          <p>${esc(t('home_cfp_text'))}</p>
          <div class="cfp__actions">
            <a class="btn btn--primary" href="rules.html">${esc(t('nav_rules'))}${icon('arrow', 'ic--flip')}</a>
            <a class="btn" href="contact.html">${esc(t('nav_contact'))}</a>
          </div>
        </div>
        <ol class="steps">
          ${[1, 2, 3, 4].map((n) => `<li><div><strong>${esc(t('step' + n))}</strong><span>${esc(t('step' + n + '_d'))}</span></div></li>`).join('')}
        </ol>
      </div>
    </div></section>

    <section class="section section--tint"><div class="wrap">
      ${secHead(t('brand_full'), t('home.sec_glance'))}
      <div class="tiles" data-stagger>
        ${[['calendar', 'freq'], ['clock', 'review'], ['globe', 'lang'], ['unlock', 'access']].map(([ic, k]) => `
          <div class="tile"><div class="tile-ic">${icon(ic)}</div><strong>${esc(t('home.glance_' + k + '_v'))}</strong><span>${esc(t('home.glance_' + k))}</span></div>`).join('')}
        <div class="tile"><div class="tile-ic">${icon('receipt')}</div><strong dir="ltr">ISSN ${ISSN}</strong><span>${esc(t('home.glance_issn'))}</span></div>
      </div>
      <div style="margin-top:clamp(40px,6vw,72px)">
        ${secHead(t('home.sec_index'), t('home.sec_faq'))}
        <div class="faq">
          ${[5, 6, 7, 2, 3, 4].map((n) => `<details data-reveal><summary>${esc(t('home.faq' + n + '_q'))}${icon('plus')}</summary><div>${esc(t('home.faq' + n + '_a'))}</div></details>`).join('')}
        </div>
      </div>
    </div></section>

    <section class="section"><div class="wrap newsletter" data-reveal>
      <div><span class="kicker">${esc(t('brand_full'))}</span><h2>${esc(t('home.news_title'))}</h2><p>${esc(t('home.news_text'))}</p></div>
      <div>
        <form class="inline-form" id="newsForm">
          <input type="email" name="email" required autocomplete="email" placeholder="${esc(t('home.news_placeholder'))}" aria-label="${esc(t('home.news_placeholder'))}">
          <button class="btn btn--primary" type="submit">${esc(t('home.news_cta'))}</button>
        </form>
        <div class="form-msg" id="newsMsg" role="status" aria-live="polite"></div>
      </div>
    </div></section>`;

  tilt(document.querySelector('.feature__cover'));
  document.querySelectorAll('[data-rail]').forEach((b) => b.addEventListener('click', () => {
    const track = b.closest('.rail').querySelector('.rail__track');
    const dir = getLang() === 'ar' ? -1 : 1;
    track.scrollBy({ left: Number(b.dataset.rail) * dir * track.clientWidth * 0.8, behavior: 'smooth' });
  }));
  document.getElementById('newsForm')?.addEventListener('submit', subscribe);
}

// Newsletter: store in Firestore when the rules allow it, otherwise hand off to email
async function subscribe(e) {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const msg = document.getElementById('newsMsg');
  try {
    const [{ db }, fs] = await Promise.all([import('../firebase-init.js'), import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')]);
    await fs.addDoc(fs.collection(db, 'subscribers'), { email, lang: getLang(), createdAt: Date.now() });
    msg.textContent = t('home.news_thanks');
    e.target.reset();
  } catch {
    location.href = `mailto:ofouqacademie@gmail.com?subject=${encodeURIComponent('Newsletter subscription')}&body=${encodeURIComponent(email)}`;
  }
}

/* ==========================================================================
   LIST PAGES
   ========================================================================== */
const LIST_TEXT = {
  'research': { ar: 'أبحاث أصيلة خضعت لتحكيم علمي مزدوج التعمية.', en: 'Original research that passed double-blind peer review.', fr: 'Recherches originales évaluées en double aveugle.' },
  'articles': { ar: 'مقالات علمية محكّمة في حقول المجلة.', en: 'Peer-reviewed scholarly articles across the journal\'s fields.', fr: 'Articles scientifiques évalués dans les domaines de la revue.' },
  'files': { ar: 'ملفات بحثية وتقارير ودراسات معمّقة.', en: 'Research dossiers, reports and in-depth studies.', fr: 'Dossiers de recherche, rapports et études approfondies.' },
  'articles-foreign': { ar: 'مقالات بالإنجليزية والفرنسية من باحثين دوليين.', en: 'Articles in English and French from international scholars.', fr: 'Articles en anglais et en français de chercheurs internationaux.' },
  'general-articles': { ar: 'مقالات رأي وتحليل في قضايا الساعة.', en: 'Opinion and analysis on current issues.', fr: 'Opinions et analyses sur l\'actualité.' },
  'editions': { ar: 'جميع أعداد المجلة الصادرة، مع إمكانية تحميل العدد كاملاً.', en: 'Every issue of the journal, each available as a full download.', fr: 'Tous les numéros de la revue, téléchargeables en intégralité.' },
  'activities': { ar: 'ندوات وورشات وفعاليات علمية تنظمها المجلة.', en: 'Seminars, workshops and scholarly events.', fr: 'Séminaires, ateliers et événements scientifiques.' },
  'training': { ar: 'برامج تكوينية ودورات في البحث العلمي.', en: 'Training programmes and research courses.', fr: 'Programmes de formation et cours de recherche.' }
};

function renderList() {
  const section = document.body.dataset.section;
  const meta = SECTIONS[section] || SECTIONS.articles;
  const isDisc = DISCIPLINES.includes(section);
  const isEd = section === 'editions';
  let sort = 'latest';
  let filter = '';
  let all = null;

  const shell = () => {
    const title = t(meta.label);
    main.innerHTML = `
      ${pageHero({ kicker: isDisc ? t('nav_academic') : t('brand_full'), title, text: isDisc ? L(TRACK_TEXT[section]) : L(LIST_TEXT[section] || LIST_TEXT.articles), meta: '<span class="chip" id="count"></span>' })}
      <section class="section"><div class="wrap">
        <div class="toolbar" id="toolbar" hidden>
          <label class="field">${icon('search')}<span class="sr-only">${esc(t('filter_ph'))}</span><input type="search" id="filter" placeholder="${esc(t('filter_ph'))}" value="${esc(filter)}"></label>
          <div class="seg" role="group">${['latest', 'oldest', 'az'].map((k) => `<button type="button" data-sort="${k}" aria-pressed="${sort === k}">${esc(t(k))}</button>`).join('')}</div>
        </div>
        <div id="list">${isEd ? `<div class="grid-4">${skeletons(4)}</div>` : `<div class="mag-grid">${skeletons(5)}</div>`}</div>
      </div></section>`;
    document.getElementById('filter').addEventListener('input', (e) => { filter = e.target.value.trim().toLowerCase(); paint(); });
    document.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      sort = b.dataset.sort;
      document.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));
    if (all) paint();
  };

  const paint = () => {
    let list = all.slice();
    if (filter) list = list.filter((i) => [pick(i.title), pick(i.author), excerpt(i)].join(' ').toLowerCase().includes(filter));
    if (sort === 'oldest') list.reverse();
    if (sort === 'az') list.sort((a, b) => pick(a.title).localeCompare(pick(b.title), getLang()));
    if (isEd && sort === 'latest') list.sort((a, b) => issueNo(b) - issueNo(a));

    document.getElementById('count').textContent = `${all.length} ${t('items')}`;
    document.getElementById('toolbar').hidden = all.length < 4;
    const box = document.getElementById('list');
    if (!all.length) {
      box.innerHTML = isDisc
        ? `<div class="soon" data-reveal><div class="tile-ic">${icon('hammer')}</div><h3>${esc(t('coming_soon'))}</h3><p>${esc(t('coming_soon_text'))}</p><a class="btn" href="index.html">${esc(t('back_home'))}</a></div>`
        : emptyState();
    } else if (!list.length) {
      box.innerHTML = emptyState('no_results', 'empty_hint', 'search', false);
    } else {
      box.innerHTML = isEd
        ? `<div class="grid-4" data-stagger>${list.map(issueTile).join('')}</div>`
        : `<div class="mag-grid" data-stagger>${list.map((i) => storyCard(i)).join('')}</div>`;
    }
    reveal();
  };

  shell();
  onContent((items) => { all = bySection(items, section); paint(); });
  onLangChange(shell);
}

/* ==========================================================================
   ARTICLE / EDITION VIEW
   ========================================================================== */
// Drop caps only for Latin text: a detached first letter breaks Arabic joining
const latinStart = (s) => /^[\s"«(]*[A-Za-zÀ-ÿ]/.test(s);

function paragraphs(text, dropcap = false) {
  const raw = String(text || '');
  if (/<\/?(p|div|span|br|strong|b|em|i|u|h[1-6]|ul|ol|li|table|blockquote)\b/i.test(raw)) return richText(raw, dropcap);
  const parts = raw.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  return parts.map((p, i) => `<p${dropcap && i === 0 && latinStart(p) ? ' class="dropcap"' : ''}>${esc(p)}</p>`).join('');
}

// Admin text is often pasted from Word: keep structure, drop styles/classes/scripts.
const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'SUP', 'SUB']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'META', 'LINK', 'XML', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE']);

function richText(html, dropcap) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const clean = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toUpperCase().replace(/^O:|^W:/, '');
      if (DROP.has(tag) || /:/.test(child.tagName)) { child.remove(); return; }
      clean(child);
      if (tag === 'H1') { const h = doc.createElement('h2'); h.append(...child.childNodes); child.replaceWith(h); return; }
      if (!ALLOWED.has(tag)) { child.replaceWith(...child.childNodes); return; }
      const href = tag === 'A' ? child.getAttribute('href') || '' : '';
      [...child.attributes].forEach((a) => child.removeAttribute(a.name));
      if (tag === 'A') {
        if (/^(https?:|mailto:)/i.test(href)) { child.setAttribute('href', href); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener'); }
        else child.replaceWith(...child.childNodes);
      }
    });
  };
  clean(root);
  // collapse empty paragraphs Word leaves behind
  root.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('br')) p.remove(); });
  const first = root.querySelector('p');
  if (dropcap && first && latinStart(first.textContent)) first.classList.add('dropcap');
  return root.innerHTML;
}

function embedFor(url) {
  if (!url) return '';
  const u = String(url);
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) return `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return `<iframe src="https://player.vimeo.com/video/${m[1]}" title="video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  if (/facebook\.com|fb\.watch/.test(u)) return `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false" title="video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  if ((m = u.match(/twitch\.tv\/([\w]+)/))) return `<iframe src="https://player.twitch.tv/?channel=${m[1]}&parent=${location.hostname}" title="video" allowfullscreen loading="lazy"></iframe>`;
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return `<video controls preload="metadata" src="${esc(u)}"></video>`;
  return '';
}
const isPdf = (u) => /\.pdf(\?|$)/i.test(String(u || '')) || /%2Fpdfs%2F|\/pdfs\//.test(String(u || ''));

function renderArticle() {
  const id = params.get('id') || '';
  const forced = params.get('type') || document.body.dataset.section || '';
  let item = null;
  let items = [];

  const paint = () => {
    if (!item) {
      main.innerHTML = `<section class="section"><div class="wrap">${emptyState('not_found', 'not_found_hint', 'search')}</div></section>`;
      reveal();
      return;
    }
    if (item.section === 'editions') return paintEdition();
    const section = item.section || forced;
    const meta = SECTIONS[section] || SECTIONS.articles;
    const title = pick(item.title) || t('untitled');
    const author = pick(item.author);
    const aff = pick(item.affiliation);
    const date = pick(item.date) || formatDate(item.createdAt);
    const abstract = pick(item.short);
    const full = pick(item.full);
    const details = pick(item.details);
    const words = [abstract, full, details].join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    const file = item.file || '';
    const video = embedFor(file);
    const related = items.filter((i) => i.section === section && i !== item).slice(0, 3);
    document.title = `${title} — ${t('brand')}`;

    main.innerHTML = `
      <div class="reading-bar" aria-hidden="true"></div>
      <header class="art-head"><div class="wrap">
        <nav class="crumbs" aria-label="breadcrumb"><a href="index.html">${esc(t('nav_home'))}</a>${icon('chevron', 'ic--flip')}<a href="${meta.list}">${esc(t(meta.label))}</a></nav>
        <span class="kicker">${esc(t(meta.label))}</span>
        <h1>${esc(title)}</h1>
        <div>
          ${abstract ? `<p class="lede">${esc(abstract.length > 320 ? abstract.slice(0, 320) + '…' : abstract)}</p>` : ''}
          <div class="byline">
            ${author ? `<div class="who"><span class="avatar">${esc(initials(author))}</span><div><strong>${esc(author)}</strong>${aff ? `<span>${esc(aff)}</span>` : ''}</div></div>` : ''}
            <div class="facts">
              ${date ? `<span>${icon('calendar')}${esc(date)}</span>` : ''}
              <span>${icon('clock')}${minutes} ${esc(t('reading_time'))}</span>
            </div>
          </div>
        </div>
      </div></header>
      ${video ? `<div class="art-media">${video}</div>` : item.image ? `<div class="art-media"><img src="${esc(item.image)}" alt=""></div>` : ''}
      <div class="wrap art-layout">
        <article class="prose">
          ${abstract ? `<h2>${esc(t('abstract'))}</h2>${paragraphs(abstract, true)}` : ''}
          ${full ? `<h2>${esc(t('full_text'))}</h2>${paragraphs(full, !abstract)}` : ''}
          ${details ? `<h2>${esc(t('details'))}</h2>${paragraphs(details)}` : ''}
          ${file && isPdf(file) ? `<h2>${esc(t('attachment'))}</h2><div class="pdf-frame"><iframe src="${esc(file)}#view=FitH" title="PDF" loading="lazy"></iframe></div>` : ''}
        </article>
        <aside class="art-aside"><div class="sticky">
          <div class="panel">
            <h3>${esc(t('brand_full'))}</h3>
            <dl>
              ${author ? `<div><dt>${esc(t('author'))}</dt><dd>${esc(author)}</dd></div>` : ''}
              ${aff ? `<div><dt>${esc(t('affiliation'))}</dt><dd>${esc(aff)}</dd></div>` : ''}
              ${date ? `<div><dt>${esc(t('date'))}</dt><dd>${esc(date)}</dd></div>` : ''}
              <div><dt>${esc(t('section'))}</dt><dd>${esc(t(meta.label))}</dd></div>
              <div><dt>ISSN</dt><dd dir="ltr">${ISSN}</dd></div>
            </dl>
          </div>
          <div class="panel actions">
            ${file && !video ? `<a class="btn btn--primary" href="${esc(file)}" target="_blank" rel="noopener">${icon('download')}${esc(isPdf(file) ? t('download') : t('open_file'))}</a>` : ''}
            <button class="btn" type="button" data-cite>${icon('quote')}${esc(t('cite'))}</button>
            <div class="share-row">
              <button class="icon-btn" type="button" data-share aria-label="${esc(t('share'))}">${icon('share')}</button>
              <button class="icon-btn" type="button" data-copy aria-label="${esc(t('copy_link'))}">${icon('link')}</button>
              <button class="icon-btn" type="button" onclick="print()" aria-label="${esc(t('print'))}">${icon('print')}</button>
            </div>
          </div>
        </div></aside>
      </div>
      ${related.length ? `<section class="section section--tint"><div class="wrap">
        ${secHead(t(meta.label), t('related'), meta.list)}
        <div class="grid-3" data-stagger>${related.map((i) => storyCard(i)).join('')}</div>
      </div></section>` : ''}`;

    bindArticleActions(`${author ? author + '. ' : ''}(${new Date(item.createdAt || Date.now()).getFullYear()}). ${title}. ${t('brand_full')}, ISSN ${ISSN}. ${location.href}`);
    // the bar lives inside main, so core's scroll handler needs a nudge
    dispatchEvent(new Event('scroll'));
    reveal();
  };

  const paintEdition = () => {
    const ed = item;
    const arts = Array.isArray(ed.articles) ? ed.articles : Array.isArray(ed.items) ? ed.items : [];
    const others = items.filter((i) => i.section === 'editions' && i !== ed).sort((a, b) => issueNo(b) - issueNo(a)).slice(0, 8);
    document.title = `${issueTitle(ed)} — ${t('brand')}`;
    main.innerHTML = `
      <section class="feature">
        <div class="wrap">
          <div class="feature__cover">${ed.image ? `<img src="${esc(ed.image)}" alt="${esc(issueTitle(ed))}">` : ''}</div>
          <div>
            <nav class="crumbs" aria-label="breadcrumb" style="color:var(--on-ink-muted)"><a href="index.html">${esc(t('nav_home'))}</a>${icon('chevron', 'ic--flip')}<a href="editions.html">${esc(t('nav_editions'))}</a></nav>
            <span class="kicker kicker--light" style="margin-top:14px">${esc(t('issue'))} ${issueNo(ed)} · ISSN ${ISSN}</span>
            <h1 style="color:#fff;font-size:clamp(34px,5vw,64px);margin-block:12px 16px">${esc(issueTitle(ed))}</h1>
            <p>${esc(pick(ed.short))}</p>
            <div class="feature__actions">
              ${ed.fullIssueFile ? `<a class="btn btn--accent" href="${esc(ed.fullIssueFile)}" target="_blank" rel="noopener">${icon('download')}${esc(t('download_issue'))}</a>` : ''}
              <button class="btn btn--light" type="button" data-share>${icon('share')}${esc(t('share'))}</button>
            </div>
          </div>
        </div>
      </section>
      <section class="section"><div class="wrap">
        ${secHead(`${t('issue')} ${issueNo(ed)}`, t('issue_contents'))}
        ${arts.length ? `<ol class="toc-list" data-stagger>${arts.map((a, n) => `
          <li><span>${String(n + 1).padStart(2, '0')}</span>
            <div><strong>${esc(pick(a.title) || t('untitled'))}</strong>${pick(a.description) ? `<p>${esc(pick(a.description))}</p>` : ''}</div>
            ${a.file ? `<a class="btn btn--sm" href="${esc(a.file)}" target="_blank" rel="noopener">${icon('download')}PDF</a>` : '<span></span>'}
          </li>`).join('')}</ol>` : emptyState('empty', 'empty_hint', 'book', false)}
        ${ed.fullIssueFile ? `<div class="pdf-frame" style="margin-top:36px" data-reveal><iframe src="${esc(ed.fullIssueFile)}#view=FitH" title="PDF" loading="lazy"></iframe></div>` : ''}
      </div></section>
      ${others.length ? `<section class="section section--ink"><div class="wrap">
        ${secHead(t('all_issues'), t('home_editions'), 'editions.html')}
        <div class="grid-4" data-stagger>${others.slice(0, 4).map(issueTile).join('')}</div>
      </div></section>` : ''}`;
    tilt(document.querySelector('.feature__cover'));
    bindArticleActions(`${issueTitle(ed)}. ${t('brand_full')}, ISSN ${ISSN}. ${location.href}`);
    reveal();
  };

  main.innerHTML = `<div class="wrap" style="padding-block:60px"><div class="skel" style="height:48px;width:70%;margin-bottom:16px"></div><div class="skel" style="height:20px;width:45%;margin-bottom:40px"></div><div class="skel" style="aspect-ratio:16/7"></div></div>`;
  onContent((list, { fresh }) => {
    items = list;
    const found = list.find((i) => String(i.docId) === id || String(i.id) === id) || null;
    if (found || fresh) { item = found; paint(); }
  });
  onLangChange(() => paint());
}

function bindArticleActions(citation) {
  main.querySelector('[data-cite]')?.addEventListener('click', () => navigator.clipboard?.writeText(citation).then(() => toast(t('cite_copied'))));
  main.querySelector('[data-copy]')?.addEventListener('click', () => navigator.clipboard?.writeText(location.href).then(() => toast(t('link_copied'))));
  main.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ title: document.title, url: location.href }); } catch { /* cancelled */ } }
    else navigator.clipboard?.writeText(location.href).then(() => toast(t('link_copied')));
  }));
}

/* ==========================================================================
   EDITORIAL BOARD
   ========================================================================== */
const DIRECTOR = { name: 'كريم رصمي', mono: 'KR', degree: 'دكتوراه في القانون العام و العلوم السياسية', place: 'الكلية متعددة التخصصات الناظور - المغرب' };
const MEMBERS = [
  ['عبد العلي الفيلالي', 'AF', 'أستاذ القانون العام', 'الكلية متعددة التخصصات الراشيدية - المغرب'],
  ['عبد العزيز اقلالوش', 'AA', 'أستاذ القانون العام', 'الكلية متعددة التخصصات الناظور - المغرب'],
  ['المصطفى قريشي', 'MQ', 'أستاذ القانون العام', 'الكلية متعددة التخصصات الناظور - المغرب'],
  ['الهام بخوشي', 'EB', 'أستاذ القانون العام', 'الكلية متعددة التخصصات الراشيدية - المغرب'],
  ['رقية محمود مهدي المغربي', 'RM', 'دكتوراه في القانون العام', 'ليبيا'],
  ['زكرياء حلوي', 'ZH', 'دكتوراه في القانون العام', 'الكلية متعددة التخصصات الناظور - المغرب'],
  ['وفاء الناجي', 'WN', 'دكتوراه في العلوم القانونية و السياسية', 'كلية العلوم القانونية السويسي - المغرب'],
  ['محمد مرعي بن عبد المنعم', 'MM', 'دكتوراه في إدارة الأعمال', 'سوريا'],
  ['الحسين بزات', 'HB', 'دكتوراه في الطب', 'جامعة محمد الأول بوجدة - المغرب'],
  ['بنعيسى اشتاتو', 'BA', 'مختص في القانون العام الداخلي و إنتاج القواعد القانونية', 'جامعة محمد الأول بوجدة - المغرب'],
  ['عبد الاله الفتاحي', 'AF', 'دكتوراه في القانون العام و العلوم السياسية', 'الكلية متعددة التخصصات الناظور - المغرب']
];

function renderBoard() {
  main.innerHTML = `
    ${pageHero({ title: t('board_title'), text: t('board_sub') })}
    <section class="section"><div class="wrap">
      <div class="director" data-reveal>
        <span class="mono">${DIRECTOR.mono}</span>
        <div><span class="kicker kicker--light">${esc(t('director'))}</span><h2 lang="ar">${esc(DIRECTOR.name)}</h2><p lang="ar">${esc(DIRECTOR.degree)}</p><p lang="ar">${esc(DIRECTOR.place)}</p></div>
      </div>
      <div class="people" data-stagger>
        ${MEMBERS.map(([name, mono, degree, place]) => `<article class="person"><span class="mono">${mono}</span><div lang="ar">
          <span class="role">${esc(t('member'))}</span><h3>${esc(name)}</h3><p>${esc(degree)}</p><small>${esc(place)}</small></div></article>`).join('')}
      </div>
    </div></section>`;
  reveal();
}

/* ==========================================================================
   RULES
   ========================================================================== */
function renderRules() {
  const secs = [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const items = [];
    for (let m = 1; t(`rules.sec${n}_item${m}_title`); m++) items.push(m);
    return { n, items };
  });
  main.innerHTML = `
    ${pageHero({ title: t('rules.hero_title_rules') || t('nav_rules'), text: t('rules.hero_sub_rules'), meta: `<a class="btn btn--primary" href="contact.html">${esc(t('submit_paper'))}${icon('arrow', 'ic--flip')}</a>` })}
    <section class="section"><div class="wrap rules-layout">
      <nav class="rules-toc" aria-label="contents">
        ${secs.map(({ n }) => `<a href="#rule-${n}"><span>${String(n).padStart(2, '0')}</span>${esc(t(`rules.sec${n}_title`))}</a>`).join('')}
      </nav>
      <div>
        ${secs.map(({ n, items }) => `<section class="rule-sec" id="rule-${n}" data-reveal>
          <h2><span>${String(n).padStart(2, '0')}</span>${esc(t(`rules.sec${n}_title`))}</h2>
          <div class="rule-items">${items.map((m) => `<div class="rule-item">
            <h3>${esc(t(`rules.sec${n}_item${m}_title`))}</h3>
            <p>${esc(t(`rules.sec${n}_item${m}_text`))}</p>
            ${t(`rules.sec${n}_item${m}_note`) ? `<div class="note">${esc(t(`rules.sec${n}_item${m}_note`))}</div>` : ''}
          </div>`).join('')}</div>
        </section>`).join('')}
      </div>
    </div></section>`;

  // scroll-spy for the table of contents
  const links = [...main.querySelectorAll('.rules-toc a')];
  const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-30% 0px -60% 0px' });
  main.querySelectorAll('.rule-sec').forEach((s) => spy.observe(s));
  reveal();
}

/* ==========================================================================
   CONTACT (EmailJS)
   ========================================================================== */
const EMAIL = 'ofouqacademie@gmail.com';
const PHONE = '+212 608062366';

function renderContact() {
  const c = (k) => t('contact.' + k);
  main.innerHTML = `
    ${pageHero({ title: c('hero_title_contact') || t('nav_contact'), text: c('hero_sub_contact') })}
    <section class="section"><div class="wrap contact-grid">
      <aside class="contact-card" data-reveal>
        <h2>${esc(c('contact_info_title'))}</h2>
        <p>${esc(c('contact_info_sub'))}</p>
        <a class="contact-line" href="mailto:${EMAIL}"><span class="tile-ic">${icon('mail')}</span><span><small>${esc(c('contact_email_label'))}</small><strong>${EMAIL}</strong></span></a>
        <a class="contact-line" href="https://wa.me/${PHONE.replace(/\D/g, '')}" target="_blank" rel="noopener"><span class="tile-ic">${icon('phone')}</span><span><small>${esc(c('contact_phone_label'))}</small><strong>${PHONE}</strong></span></a>
        <a class="btn btn--accent" href="rules.html">${esc(t('nav_rules'))}${icon('arrow', 'ic--flip')}</a>
      </aside>
      <div data-reveal>
        <h2 style="font-size:clamp(26px,3vw,36px)">${esc(c('contact_form_title'))}</h2>
        <p style="color:var(--muted);margin-block:6px 22px">${esc(c('contact_form_sub'))}</p>
        <form class="form" id="contactForm" novalidate>
          ${field('name', 'text', c('contact_name_label'), c('err_name'), 'name', true)}
          ${field('email', 'email', c('contact_email_input_label'), c('err_email'), 'email', true)}
          ${field('phone', 'tel', c('contact_phone_input_label'), '', 'tel', false, c('contact_phone_help'))}
          ${field('subject', 'text', c('contact_subject_label'), c('err_subject'), 'off', true)}
          <div class="field-group full"><label for="message">${esc(c('contact_message_label'))}</label><textarea id="message" name="message" required></textarea><span class="err">${esc(c('err_message'))}</span></div>
          <div class="full" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px">
            <p style="font-size:13px;color:var(--muted);max-width:46ch">${esc(c('contact_submit_note'))}</p>
            <button class="btn btn--primary" type="submit" id="sendBtn">${icon('mail')}<span>${esc(c('contact_btn_send'))}</span></button>
          </div>
          <div class="alert full" id="formAlert" role="status" aria-live="polite"></div>
        </form>
      </div>
    </div></section>`;
  document.getElementById('contactForm').addEventListener('submit', sendContact);
  reveal();
}

function field(id, type, label, err, auto, required, help = '') {
  return `<div class="field-group"><label for="${id}">${esc(label)}</label>
    <input id="${id}" name="${id}" type="${type}" autocomplete="${auto}" ${required ? 'required' : ''}>
    ${err ? `<span class="err">${esc(err)}</span>` : ''}${help ? `<span class="help">${esc(help)}</span>` : ''}</div>`;
}

let emailjsReady = null;
function loadEmailJs() {
  if (!emailjsReady) {
    emailjsReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
      s.onload = () => { window.emailjs.init({ publicKey: 'urmsYG_uydTuRjsXf' }); resolve(window.emailjs); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return emailjsReady;
}

async function sendContact(e) {
  e.preventDefault();
  const f = e.target;
  const alertEl = document.getElementById('formAlert');
  const v = (n) => f[n].value.trim();
  const checks = { name: !v('name'), email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')), subject: !v('subject'), message: !v('message') };
  Object.entries(checks).forEach(([n, bad]) => f[n].closest('.field-group').classList.toggle('invalid', bad));
  const firstBad = Object.keys(checks).find((n) => checks[n]);
  if (firstBad) { f[firstBad].focus(); return; }

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = t('contact.contact_btn_sending');
  try {
    const emailjs = await loadEmailJs();
    await emailjs.send('service_mpy2rwy', 'template_9b9yiqg', {
      from_name: v('name'), from_email: v('email'), subject: v('subject'), message: v('message'),
      name: v('name'), email: v('email'), phone: v('phone'), company_name: t('brand_full')
    });
    alertEl.className = 'alert full alert--ok is-shown';
    alertEl.textContent = t('contact.contact_success');
    f.reset();
  } catch {
    alertEl.className = 'alert full alert--error is-shown';
    alertEl.textContent = t('contact.contact_error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = t('contact.contact_btn_send');
  }
}

/* ==========================================================================
   LIVE
   ========================================================================== */
function renderLive() {
  live((items) => {
    const streams = bySection(items, 'live');
    const order = { live: 0, upcoming: 1, ended: 2 };
    streams.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    const badge = (s) => s === 'live' ? `<span class="badge badge--live">${esc(t('live_now'))}</span>`
      : s === 'ended' ? `<span class="badge badge--ended">${esc(t('live_ended'))}</span>` : `<span class="badge badge--soon">${esc(t('live_upcoming'))}</span>`;
    main.innerHTML = `
      ${pageHero({ title: t('live_title'), text: t('live_sub'), meta: streams.some((s) => s.status === 'live') ? `<span class="badge badge--live">${esc(t('live_now'))}</span>` : '' })}
      <section class="section"><div class="wrap">
        ${streams.length ? `<div class="live-grid" data-stagger>${streams.map((s) => {
          const emb = s.status !== 'upcoming' ? embedFor(s.file) : '';
          return `<article class="live-card${s.status === 'live' ? ' is-live' : ''}">
            <div class="live-card__media">${emb || (s.file ? `<a class="play" href="${esc(s.file)}" target="_blank" rel="noopener" aria-label="${esc(t('watch'))}">${icon('play')}</a>` : `<span class="play">${icon('radio')}</span>`)}</div>
            <div class="live-card__body">${badge(s.status)}<h3>${esc(pick(s.title) || t('untitled'))}</h3>
              ${pick(s.short) ? `<p>${esc(pick(s.short))}</p>` : ''}
              ${pick(s.date) ? `<div class="story__meta">${icon('calendar')}<span>${esc(pick(s.date))}</span></div>` : ''}
            </div></article>`;
        }).join('')}</div>` : emptyState('live_none', 'empty_hint', 'radio')}
      </div></section>`;
  });
}

/* ==========================================================================
   SEARCH
   ========================================================================== */
function normalize(s) {
  return String(s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}
function allText(f) { return f && typeof f === 'object' ? Object.values(f).filter((v) => typeof v === 'string').join(' ') : String(f || ''); }

function renderSearch() {
  let items = null;
  let active = 'all';
  const paint = () => {
    const q = (params.get('q') || '').trim();
    main.innerHTML = `
      ${pageHero({ title: t('search_title'), text: t('search_prompt'), crumbs: true })}
      <section class="section"><div class="wrap">
        <form class="inline-form" role="search" style="max-width:720px;margin-bottom:28px" id="sForm">
          <input type="search" name="q" value="${esc(q)}" placeholder="${esc(t('search_ph'))}" aria-label="${esc(t('search'))}">
          <button class="btn btn--primary" type="submit">${icon('search')}${esc(t('search'))}</button>
        </form>
        <div id="sOut"></div>
      </div></section>`;
    document.getElementById('sForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.q.value.trim();
      const u = new URL(location.href);
      v ? u.searchParams.set('q', v) : u.searchParams.delete('q');
      history.pushState(null, '', u);
      params.set('q', v);
      active = 'all';
      paint();
    });
    const out = document.getElementById('sOut');
    if (!q) { out.innerHTML = ''; return; }
    if (!items) { out.innerHTML = `<div class="grid-3">${skeletons(3)}</div>`; return; }

    const terms = normalize(q).split(/\s+/).filter(Boolean);
    const hits = items.filter((i) => SECTIONS[i.section]).map((i) => {
      const title = normalize(allText(i.title));
      const hay = title + ' ' + normalize([i.author, i.short, i.full, i.details, i.affiliation].map(allText).join(' ')) + ' ' +
        normalize((i.articles || []).map((a) => allText(a.title)).join(' '));
      if (!terms.every((x) => hay.includes(x))) return null;
      return { i, score: terms.reduce((n, x) => n + (title.includes(x) ? 3 : 1), 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map((h) => h.i);

    const counts = {};
    hits.forEach((h) => { counts[h.section] = (counts[h.section] || 0) + 1; });
    if (active !== 'all' && !counts[active]) active = 'all';
    const shown = active === 'all' ? hits : hits.filter((h) => h.section === active);
    out.innerHTML = `
      <div class="toolbar"><p style="color:var(--muted)">${hits.length} ${esc(t('results_for'))} «<b>${esc(q)}</b>»</p>
        ${hits.length ? `<div class="seg" role="group">
          <button type="button" data-f="all" aria-pressed="${active === 'all'}">${esc(t('all'))} (${hits.length})</button>
          ${Object.keys(counts).map((s) => `<button type="button" data-f="${s}" aria-pressed="${active === s}">${esc(t(SECTIONS[s].label))} (${counts[s]})</button>`).join('')}
        </div>` : ''}</div>
      ${shown.length ? `<div class="grid-3" data-stagger>${shown.map((i) => i.section === 'editions' ? issueTile(i) : storyCard(i)).join('')}</div>` : emptyState('no_results', 'empty_hint', 'search', false)}`;
    out.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { active = b.dataset.f; paint(); }));
    reveal();
  };
  paint();
  onContent((list) => { items = list; paint(); });
  onLangChange(paint);
  addEventListener('popstate', () => { params.set('q', new URLSearchParams(location.search).get('q') || ''); paint(); });
}

/* ==========================================================================
   AUTH
   ========================================================================== */
const AUTH_ART = {
  ar: ['منصة المعرفة الأكاديمية', 'انضم إلى مجتمع من الباحثين في العلوم السياسية والقانونية، وتابع أحدث الأبحاث والأعداد.'],
  en: ['A home for scholarly knowledge', 'Join a community of researchers in political and legal sciences and follow the latest research and issues.'],
  fr: ['Un foyer pour le savoir académique', 'Rejoignez une communauté de chercheurs en sciences politiques et juridiques.']
};
const AUTH_TEXT = {
  login: { ar: ['تسجيل الدخول', 'سجّل دخولك للوصول إلى المحتوى الكامل.'], en: ['Log in', 'Sign in to access the full content.'], fr: ['Connexion', 'Connectez-vous pour accéder au contenu complet.'] },
  register: { ar: ['إنشاء حساب', 'أنشئ حسابك في أقل من دقيقة.'], en: ['Create account', 'Create your account in under a minute.'], fr: ['Créer un compte', 'Créez votre compte en moins d\'une minute.'] },
  forgot: { ar: ['استرجاع كلمة المرور', 'أدخل بريدك وسنرسل لك رابطاً لإعادة التعيين.'], en: ['Reset password', 'Enter your email and we\'ll send you a reset link.'], fr: ['Mot de passe oublié', 'Saisissez votre e-mail pour recevoir un lien.'] },
  reset: { ar: ['كلمة مرور جديدة', 'اختر كلمة مرور قوية لحسابك.'], en: ['New password', 'Choose a strong password for your account.'], fr: ['Nouveau mot de passe', 'Choisissez un mot de passe solide.'] }
};
const A = {
  email: { ar: 'البريد الإلكتروني', en: 'Email', fr: 'E-mail' },
  password: { ar: 'كلمة المرور', en: 'Password', fr: 'Mot de passe' },
  confirm: { ar: 'تأكيد كلمة المرور', en: 'Confirm password', fr: 'Confirmer le mot de passe' },
  name: { ar: 'الاسم الكامل', en: 'Full name', fr: 'Nom complet' },
  remember: { ar: 'تذكرني', en: 'Remember me', fr: 'Se souvenir de moi' },
  forgot: { ar: 'نسيت كلمة المرور؟', en: 'Forgot password?', fr: 'Mot de passe oublié ?' },
  google: { ar: 'المتابعة باستخدام Google', en: 'Continue with Google', fr: 'Continuer avec Google' },
  or: { ar: 'أو', en: 'or', fr: 'ou' },
  noAccount: { ar: 'ليس لديك حساب؟', en: 'No account yet?', fr: 'Pas encore de compte ?' },
  haveAccount: { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?', fr: 'Vous avez déjà un compte ?' },
  send: { ar: 'إرسال الرابط', en: 'Send link', fr: 'Envoyer le lien' },
  save: { ar: 'حفظ كلمة المرور', en: 'Save password', fr: 'Enregistrer' },
  backLogin: { ar: 'العودة لتسجيل الدخول', en: 'Back to log in', fr: 'Retour à la connexion' },
  sent: { ar: 'إذا كان هذا البريد مسجلاً، فستصلك رسالة تحتوي على رابط إعادة التعيين. تحقق من البريد غير المرغوب فيه أيضاً.', en: 'If this email is registered, you\'ll receive a reset link. Check your spam folder too.', fr: 'Si cet e-mail est enregistré, vous recevrez un lien. Vérifiez aussi vos spams.' },
  badLink: { ar: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.', en: 'This reset link is invalid or has expired.', fr: 'Ce lien est invalide ou a expiré.' },
  noCode: { ar: 'افتح هذه الصفحة من الرابط المرسل إلى بريدك.', en: 'Open this page from the link sent to your email.', fr: 'Ouvrez cette page depuis le lien reçu par e-mail.' },
  done: { ar: 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.', en: 'Password updated. You can log in now.', fr: 'Mot de passe mis à jour. Vous pouvez vous connecter.' },
  welcome: { ar: 'مرحباً بك! جاري التحويل…', en: 'Welcome! Redirecting…', fr: 'Bienvenue ! Redirection…' },
  mismatch: { ar: 'كلمتا المرور غير متطابقتين.', en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.' },
  short: { ar: 'كلمة المرور قصيرة (6 أحرف على الأقل).', en: 'Password too short (min. 6 characters).', fr: 'Mot de passe trop court (6 caractères min.).' }
};
const AUTH_ERR = {
  'auth/invalid-credential': { ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', en: 'Incorrect email or password.', fr: 'E-mail ou mot de passe incorrect.' },
  'auth/email-already-in-use': { ar: 'هذا البريد مستخدم بالفعل. جرّب تسجيل الدخول.', en: 'This email is already in use. Try logging in.', fr: 'Cet e-mail est déjà utilisé.' },
  'auth/invalid-email': { ar: 'بريد إلكتروني غير صحيح.', en: 'Invalid email address.', fr: 'Adresse e-mail invalide.' },
  'auth/weak-password': { ar: 'كلمة المرور ضعيفة جداً.', en: 'Password is too weak.', fr: 'Mot de passe trop faible.' },
  'auth/too-many-requests': { ar: 'محاولات كثيرة، حاول لاحقاً.', en: 'Too many attempts, try again later.', fr: 'Trop de tentatives, réessayez plus tard.' },
  'auth/popup-closed-by-user': { ar: 'أُغلقت نافذة Google قبل الإكمال.', en: 'The Google window was closed.', fr: 'La fenêtre Google a été fermée.' },
  'auth/network-request-failed': { ar: 'تعذر الاتصال بالشبكة.', en: 'Network error.', fr: 'Erreur réseau.' },
  'auth/unauthorized-domain': { ar: 'هذا النطاق غير مضاف في Firebase Authorized Domains.', en: 'This domain is not authorised in Firebase.', fr: 'Ce domaine n\'est pas autorisé dans Firebase.' }
};
const GENERIC_ERR = { ar: 'حدث خطأ، حاول مرة أخرى.', en: 'Something went wrong, please try again.', fr: 'Une erreur est survenue, réessayez.' };

function authShell(kind, formHTML) {
  const [h, p] = L(AUTH_TEXT[kind]);
  const [ah, ap] = L(AUTH_ART);
  main.innerHTML = `
    <div class="auth">
      <div class="auth__art">
        <span class="orbit" aria-hidden="true"></span>
        <a class="brand" href="index.html"><img src="logo1.png" alt="" width="58" height="58"><span class="brand__name"><strong>${esc(t('brand'))}</strong><span>ISSN ${ISSN}</span></span></a>
        <div><h2>${esc(ah)}</h2><p>${esc(ap)}</p></div>
        <div class="lang-switch" role="group" aria-label="${esc(t('language'))}">${['ar', 'en', 'fr'].map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}">${l.toUpperCase()}</button>`).join('')}</div>
      </div>
      <div class="auth__form"><div class="auth__box">
        <h1>${esc(h)}</h1><p>${esc(p)}</p>
        <div class="alert" id="authAlert" role="status" aria-live="polite"></div>
        ${formHTML}
      </div></div>
    </div>`;
}

function authInput(id, type, labelObj, auto) {
  const label = L(labelObj);
  const input = `<input id="${id}" name="${id}" type="${type}" autocomplete="${auto}" required>`;
  return `<div class="field-group"><label for="${id}">${esc(label)}</label>${type === 'password'
    ? `<div class="pw-wrap">${input}<button type="button" data-pw="${id}" aria-label="${esc(label)}">${icon('eye')}</button></div>` : input}</div>`;
}

function showAlert(msg, ok = false) {
  const el = document.getElementById('authAlert');
  el.className = `alert ${ok ? 'alert--ok' : 'alert--error'} is-shown`;
  el.textContent = msg;
}
function authError(err) { showAlert(L(AUTH_ERR[err?.code] || GENERIC_ERR)); }

function bindPasswordToggles() {
  main.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
    const input = document.getElementById(b.dataset.pw);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
  }));
}

function setBusy(form, busy) { form.querySelectorAll('button').forEach((b) => { b.disabled = busy; }); }

// same user record every page reads for the header
function saveUser(user, provider, remember = true, name) {
  const data = JSON.stringify({
    provider, loggedIn: true, uid: user.uid, email: user.email || '',
    name: name || user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
    photoURL: user.photoURL || '', lastLogin: Date.now()
  });
  if (remember) { localStorage.setItem('user', data); sessionStorage.removeItem('user'); }
  else { sessionStorage.setItem('user', data); localStorage.removeItem('user'); }
}
function goBack() { setTimeout(() => { location.href = sessionStorage.getItem('loginFrom') || 'index.html'; }, 700); }

const firebaseAuth = () => Promise.all([import('../firebase-init.js'), import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js')]);

function renderLogin() {
  authShell('login', `
    <form id="f" novalidate style="display:grid;gap:14px">
      ${authInput('email', 'email', A.email, 'email')}
      ${authInput('password', 'password', A.password, 'current-password')}
      <div class="auth__row"><label><input type="checkbox" id="remember" checked> ${esc(L(A.remember))}</label><a href="forgot.html">${esc(L(A.forgot))}</a></div>
      <button class="btn btn--primary" type="submit">${esc(t('login'))}</button>
      <div class="divider">${esc(L(A.or))}</div>
      <button class="btn btn--google" type="button" id="g">${googleLogo()}${esc(L(A.google))}</button>
    </form>
    <p class="auth__alt">${esc(L(A.noAccount))} <a href="register.html">${esc(t('join'))}</a></p>`);
  bindPasswordToggles();
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.email.value.trim() || !f.password.value) return showAlert(L(AUTH_ERR['auth/invalid-credential']));
    setBusy(f, true);
    try {
      const [{ auth }, fa] = await firebaseAuth();
      const remember = f.remember.checked;
      await fa.setPersistence(auth, remember ? fa.browserLocalPersistence : fa.browserSessionPersistence);
      const cred = await fa.signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
      saveUser(cred.user, 'password', remember);
      showAlert(L(A.welcome), true);
      goBack();
    } catch (err) { authError(err); } finally { setBusy(f, false); }
  });
  document.getElementById('g').addEventListener('click', () => googleSignIn(f));
}

async function googleSignIn(form) {
  setBusy(form, true);
  try {
    const [{ auth }, fa] = await firebaseAuth();
    const res = await fa.signInWithPopup(auth, new fa.GoogleAuthProvider());
    saveUser(res.user, 'google', true);
    showAlert(L(A.welcome), true);
    goBack();
  } catch (err) { authError(err); } finally { setBusy(form, false); }
}

function renderRegister() {
  authShell('register', `
    <form id="f" novalidate style="display:grid;gap:14px">
      ${authInput('name', 'text', A.name, 'name')}
      ${authInput('email', 'email', A.email, 'email')}
      ${authInput('password', 'password', A.password, 'new-password')}
      ${authInput('confirm', 'password', A.confirm, 'new-password')}
      <button class="btn btn--primary" type="submit">${esc(L(AUTH_TEXT.register)[0])}</button>
      <div class="divider">${esc(L(A.or))}</div>
      <button class="btn btn--google" type="button" id="g">${googleLogo()}${esc(L(A.google))}</button>
    </form>
    <p class="auth__alt">${esc(L(A.haveAccount))} <a href="login.html">${esc(t('login'))}</a></p>`);
  bindPasswordToggles();
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = f.name.value.trim();
    const email = f.email.value.trim();
    if (!name) return showAlert(L(A.name));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert(L(AUTH_ERR['auth/invalid-email']));
    if (f.password.value.length < 6) return showAlert(L(A.short));
    if (f.password.value !== f.confirm.value) return showAlert(L(A.mismatch));
    setBusy(f, true);
    try {
      const [{ auth }, fa] = await firebaseAuth();
      const cred = await fa.createUserWithEmailAndPassword(auth, email, f.password.value);
      await fa.updateProfile(cred.user, { displayName: name });
      saveUser(cred.user, 'password', true, name);
      showAlert(L(A.welcome), true);
      goBack();
    } catch (err) { authError(err); } finally { setBusy(f, false); }
  });
  document.getElementById('g').addEventListener('click', () => googleSignIn(f));
}

function renderForgot() {
  authShell('forgot', `
    <form id="f" novalidate style="display:grid;gap:14px">
      ${authInput('email', 'email', A.email, 'email')}
      <button class="btn btn--primary" type="submit">${esc(L(A.send))}</button>
    </form>
    <p class="auth__alt"><a href="login.html">${esc(L(A.backLogin))}</a></p>`);
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert(L(AUTH_ERR['auth/invalid-email']));
    setBusy(f, true);
    try {
      const [{ auth }, fa] = await firebaseAuth();
      await fa.sendPasswordResetEmail(auth, email);
      showAlert(L(A.sent), true);
    } catch (err) {
      // unknown accounts get the same message, so the form never reveals who is registered
      if (['auth/invalid-email', 'auth/too-many-requests', 'auth/network-request-failed'].includes(err.code)) authError(err);
      else showAlert(L(A.sent), true);
    } finally { setBusy(f, false); }
  });
}

function renderReset() {
  const code = params.get('oobCode');
  authShell('reset', code ? `
    <form id="f" novalidate style="display:grid;gap:14px">
      <div class="field-group"><label for="email">${esc(L(A.email))}</label><input id="email" type="email" readonly></div>
      ${authInput('password', 'password', A.password, 'new-password')}
      ${authInput('confirm', 'password', A.confirm, 'new-password')}
      <button class="btn btn--primary" type="submit">${esc(L(A.save))}</button>
    </form>
    <p class="auth__alt"><a href="login.html">${esc(L(A.backLogin))}</a></p>`
    : `<a class="btn btn--primary" href="forgot.html">${esc(L(A.send))}</a><p class="auth__alt"><a href="login.html">${esc(L(A.backLogin))}</a></p>`);
  if (!code) return showAlert(L(A.noCode));
  bindPasswordToggles();
  const f = document.getElementById('f');
  firebaseAuth().then(([{ auth }, fa]) => fa.verifyPasswordResetCode(auth, code))
    .then((email) => { f.email.value = email; })
    .catch(() => { showAlert(L(A.badLink)); setBusy(f, true); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.password.value.length < 8) return showAlert(L(A.short).replace('6', '8'));
    if (f.password.value !== f.confirm.value) return showAlert(L(A.mismatch));
    setBusy(f, true);
    try {
      const [{ auth }, fa] = await firebaseAuth();
      await fa.confirmPasswordReset(auth, code, f.password.value);
      showAlert(L(A.done), true);
      setTimeout(() => { location.href = 'login.html'; }, 1500);
    } catch { showAlert(L(A.badLink)); setBusy(f, false); }
  });
}

function googleLogo() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 8.6-4.8 8.6-7.3 0-.5 0-.9-.1-1.3H12z"/><path fill="#34A853" d="M3.8 7.7l3.2 2.3C7.9 8 9.8 6.6 12 6.6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 8.4 2.4 5.3 4.5 3.8 7.7z"/><path fill="#FBBC05" d="M12 20.8c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.8l-3.2 2.5c1.5 3.2 4.7 5.1 8.7 5.1z"/><path fill="#4285F4" d="M20.6 12.2H12v3.9h5.5c-.3 1.4-1.4 2.5-2.9 3.3l3 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.5 0-.9-.1-1.3z"/></svg>';
}

/* ==========================================================================
   ROUTER
   ========================================================================== */
const ROUTES = {
  home: () => { homeShell(); live(renderHome); },
  list: renderList,
  article: renderArticle,
  board: () => { renderBoard(); onLangChange(renderBoard); },
  rules: () => { renderRules(); onLangChange(renderRules); },
  contact: () => { renderContact(); onLangChange(renderContact); },
  live: renderLive,
  search: renderSearch,
  login: () => { renderLogin(); onLangChange(renderLogin); },
  register: () => { renderRegister(); onLangChange(renderRegister); },
  forgot: () => { renderForgot(); onLangChange(renderForgot); },
  reset: () => { renderReset(); onLangChange(renderReset); }
};

if (document.referrer && !/login|register|forgot|reset/.test(location.pathname) && document.body.dataset.page !== 'login') {
  sessionStorage.setItem('loginFrom', location.pathname.split('/').pop() + location.search);
}
(ROUTES[page] || ROUTES.home)();
