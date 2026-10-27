// ==========================================================================
// Back-office UI helpers. Presentation only: admin-app.js keeps all data,
// auth and upload logic. This file adds the mobile sidebar, per-section
// counts, the overview strip, Enter-to-login, password reveal and Ctrl+S.
// ==========================================================================
(function () {
  'use strict';

  const SECTION_ICON = {
    'research': 'ri-book-open-line', 'articles': 'ri-article-line', 'files': 'ri-folders-line',
    'articles-foreign': 'ri-global-line', 'general-articles': 'ri-quill-pen-line', 'editions': 'ri-book-3-line',
    'activities': 'ri-calendar-event-line', 'special-politics': 'ri-government-line', 'special-ir': 'ri-earth-line',
    'special-admin-law': 'ri-scales-3-line', 'special-const-law': 'ri-file-paper-2-line',
    'special-public-policy': 'ri-bar-chart-2-line', 'live': 'ri-live-line'
  };

  function readCache() {
    try {
      const list = JSON.parse(localStorage.getItem('contentcache') || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  /* ---------- sidebar (mobile drawer) ---------- */
  function toggleSide(open) {
    document.body.classList.toggle('side-open', open);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-side-open]')) toggleSide(true);
    else if (e.target.closest('[data-side-close]')) toggleSide(false);
    else if (e.target.closest('#menu button')) {
      toggleSide(false);
      document.querySelector('.workspace')?.scrollIntoView({ block: 'start' });
    }
  });

  /* ---------- menu: icons, counts, separators ---------- */
  let lastSig = '';
  function decorateMenu() {
    const menu = document.getElementById('menu');
    if (!menu || !menu.children.length) return;
    const counts = {};
    readCache().forEach((i) => { counts[i.section] = (counts[i.section] || 0) + 1; });
    const sig = JSON.stringify(counts) + menu.children.length;
    if (sig === lastSig && menu.querySelector('.count')) return;
    lastSig = sig;

    menu.querySelectorAll('button[data-key]').forEach((btn) => {
      const key = btn.dataset.key;
      if (!btn.querySelector('.menu-ic')) {
        const ic = document.createElement('i');
        ic.className = `menu-ic ${SECTION_ICON[key] || 'ri-file-line'}`;
        ic.style.cssText = 'opacity:1;font-size:17px;transform:none';
        btn.prepend(ic);
        // admin-app.js labels live with an emoji; the icon replaces it
        const label = btn.querySelector('span');
        if (label) label.textContent = label.textContent.replace(/^[^\p{L}]+/u, '');
      }
      let badge = btn.querySelector('.count');
      if (!badge) {
        badge = document.createElement('b');
        badge.className = 'count';
        btn.insertBefore(badge, btn.lastElementChild);
      }
      badge.textContent = counts[key] || 0;
      // visual groups: journal sections / disciplines / live
      if ((key === 'special-politics' || key === 'live') && !btn.previousElementSibling?.classList.contains('menu-sep')) {
        const sep = document.createElement('div');
        sep.className = 'menu-sep';
        btn.before(sep);
      }
    });
  }

  /* ---------- overview strip ---------- */
  function renderOverview() {
    const box = document.getElementById('overview');
    if (!box) return;
    const all = readCache();
    const content = all.filter((i) => i.section !== 'editions' && i.section !== 'live');
    const editions = all.filter((i) => i.section === 'editions');
    const live = all.filter((i) => i.section === 'live' && i.status === 'live');
    const latest = all.reduce((m, i) => Math.max(m, Number(i.updatedAt || i.createdAt || 0)), 0);
    const ago = latest ? new Intl.RelativeTimeFormat('ar', { numeric: 'auto' }).format(-Math.max(0, Math.round((Date.now() - latest) / 86400000)), 'day') : '—';
    const html = `
      <div class="ov"><i class="ri-file-text-line"></i><div><strong>${content.length}</strong><span>مادة منشورة</span></div></div>
      <div class="ov"><i class="ri-book-3-line"></i><div><strong>${editions.length}</strong><span>عدد صادر</span></div></div>
      <div class="ov"><i class="ri-live-line"></i><div><strong>${live.length}</strong><span>بث مباشر الآن</span></div></div>
      <div class="ov"><i class="ri-time-line"></i><div><strong style="font-family:inherit;font-size:16px;line-height:1.5">${ago}</strong><span>آخر تحديث</span></div></div>`;
    if (box.dataset.sig !== html) { box.innerHTML = html; box.dataset.sig = html; }
  }

  function refresh() { decorateMenu(); renderOverview(); }

  /* ---------- login conveniences ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('#loginEmail, #loginPassword')) {
      e.preventDefault();
      document.getElementById('loginBtn')?.click();
    }
    // Ctrl/Cmd+S saves the open form (the first primary button in the content area)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && document.getElementById('adminApp')?.style.display !== 'none') {
      const save = document.querySelector('#content .btn-green');
      if (save) { e.preventDefault(); save.click(); }
    }
    if (e.key === 'Escape') toggleSide(false);
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pw]');
    if (!t) return;
    const input = document.getElementById(t.dataset.pw);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    t.innerHTML = `<i class="${show ? 'ri-eye-off-line' : 'ri-eye-line'}"></i>`;
  });

  /* ---------- keep in sync with admin-app.js ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('menu');
    if (menu) new MutationObserver(refresh).observe(menu, { childList: true });
    const status = document.getElementById('status');
    if (status) new MutationObserver(refresh).observe(status, { childList: true, characterData: true, subtree: true });
    refresh();
  });
  // admin-app.js writes the cache in this same tab (no storage event), so poll lightly
  setInterval(refresh, 2500);
})();
