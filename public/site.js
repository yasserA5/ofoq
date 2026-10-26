/* ============================================================
   Ofouq – shared enhancements loaded at the end of every page.

   Every page keeps its own header, translations and render code;
   this file layers the cross-site fixes on top of them:
     - highlights the current page in the nav
     - translates nav/placeholder strings a page forgot to define
     - keeps the "lang" and "uiLang" storage keys in sync
     - syncs the Firestore "content" collection (where the admin
       panel writes) into the localStorage keys each page reads
     - accessibility: skip link, Escape to close menus, labels
     - back-to-top button, lazy images, safe external links
   ============================================================ */
(function () {
  'use strict';

  var LANGS = ['ar', 'en', 'fr'];

  function getLang() {
    var l = localStorage.getItem('uiLang') || localStorage.getItem('lang') || 'ar';
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }

  /* ---------- Shared UI strings (pages may override any key) ---------- */
  var I18N = {
    ar: {
      nav_home: 'الرئيسية', nav_studies: 'أبحاث ودراسات ▾', nav_research_peer: 'أبحاث محكمة',
      nav_articles_peer: 'مقالات محكمة', nav_files: 'ملفات بحثية', nav_foreign: 'مقالات أجنبية',
      nav_articles: 'مقالات', nav_editions: 'إصداراتنا', nav_activities: 'أنشطتنا', nav_academic: 'أكاديمي',
      nav_live: 'بث مباشر', nav_rules: 'شروط النشر', nav_contact: 'اتصل بنا', nav_board: 'هيئة التحرير',
      nav_login: 'تسجيل الدخول', nav_join: 'انضم إلينا', logout: 'تسجيل الخروج',
      sp_politics: 'تخصص علوم سياسية', sp_ir: 'تخصص العلاقات الدولية', sp_admin_law: 'تخصص القانون الإداري',
      sp_const_law: 'تخصص القانون الدستوري', sp_public_policy: 'تخصص السياسات العمومية',
      brand_name: 'أفق', brand_tagline: 'منصة أكاديمية حديثة', mobile_discover: 'اكتشف',
      search_placeholder: 'ابحث...', search_placeholder_long: 'ابحث في المنصة...',
      skip: 'تخطَّ إلى المحتوى', menu: 'القائمة', close: 'إغلاق', back_top: 'العودة للأعلى', language: 'اللغة'
    },
    en: {
      nav_home: 'Home', nav_studies: 'Research & Studies ▾', nav_research_peer: 'Peer-reviewed research',
      nav_articles_peer: 'Scholarly Articles', nav_files: 'Research Files', nav_foreign: 'Foreign Articles',
      nav_articles: 'Articles', nav_editions: 'Our Publications', nav_activities: 'Activities', nav_academic: 'Academic',
      nav_live: 'Live', nav_rules: 'Submission Rules', nav_contact: 'Contact us', nav_board: 'Editorial Board',
      nav_login: 'Login', nav_join: 'Join us', logout: 'Logout',
      sp_politics: 'Political Science', sp_ir: 'International Relations', sp_admin_law: 'Administrative Law',
      sp_const_law: 'Constitutional Law', sp_public_policy: 'Public Policy',
      brand_name: 'Ofouq', brand_tagline: 'A modern academic platform', mobile_discover: 'Discover',
      search_placeholder: 'Search...', search_placeholder_long: 'Search the platform...',
      skip: 'Skip to content', menu: 'Menu', close: 'Close', back_top: 'Back to top', language: 'Language'
    },
    fr: {
      nav_home: 'Accueil', nav_studies: 'Recherches et études ▾', nav_research_peer: 'Recherches évaluées',
      nav_articles_peer: 'Articles scientifiques', nav_files: 'Dossiers de recherche', nav_foreign: 'Articles étrangers',
      nav_articles: 'Articles', nav_editions: 'Nos publications', nav_activities: 'Activités', nav_academic: 'Académique',
      nav_live: 'Direct', nav_rules: 'Conditions de publication', nav_contact: 'Contactez-nous', nav_board: 'Comité éditorial',
      nav_login: 'Connexion', nav_join: 'Rejoignez-nous', logout: 'Déconnexion',
      sp_politics: 'Science politique', sp_ir: 'Relations internationales', sp_admin_law: 'Droit administratif',
      sp_const_law: 'Droit constitutionnel', sp_public_policy: 'Politiques publiques',
      brand_name: 'Ofouq', brand_tagline: 'Une plateforme académique moderne', mobile_discover: 'Découvrir',
      search_placeholder: 'Rechercher...', search_placeholder_long: 'Rechercher sur la plateforme...',
      skip: 'Aller au contenu', menu: 'Menu', close: 'Fermer', back_top: 'Haut de page', language: 'Langue'
    }
  };

  function s(key, lang) {
    return (I18N[lang || getLang()] || I18N.ar)[key] || I18N.ar[key] || '';
  }

  // The page's own dictionary, when it declares a global `translations`
  function pageDict(lang) {
    try {
      // eslint-disable-next-line no-undef
      return (typeof translations !== 'undefined' && translations && translations[lang]) || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Current page in the navigation ---------- */
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  // view pages highlight their listing page
  var LISTING = {
    'research-view': 'research', 'articles-view': 'articles', 'files-view': 'files',
    'articles-foreign-view': 'articles-foreign', 'general-article-view': 'general-articles',
    'editions-view': 'editions', 'activities-view': 'activities', 'training-view': 'training'
  };
  var listing = LISTING[page] || page;

  var NAV_IDS = {
    navHome: 'nav_home', navResearchStudies: 'nav_studies', navResearch: 'nav_research_peer',
    navArticles: 'nav_articles_peer', navFiles: 'nav_files', navForeign: 'nav_foreign',
    navGeneral: 'nav_articles', navEditions: 'nav_editions', navActivities: 'nav_activities',
    navAcademic: 'nav_academic', navPol: 'sp_politics', navIr: 'sp_ir', navAdmin: 'sp_admin_law',
    navConst: 'sp_const_law', navPolicy: 'sp_public_policy', navLive: 'nav_live',
    navRules: 'nav_rules', navContact: 'nav_contact', navBoard: 'nav_board'
  };

  function hrefPage(a) {
    var h = (a.getAttribute('href') || '').split(/[?#]/)[0];
    return h.split('/').pop().replace(/\.html$/, '');
  }

  function markCurrentNav() {
    var target = listing === 'index' ? 'index' : listing;
    document.querySelectorAll('nav a, .nav-sheet a, .mobile-menu a').forEach(function (a) {
      var match = hrefPage(a) === target;
      if (a.closest('nav')) a.classList.toggle('active', match);
      if (match) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    // a page inside a dropdown also lights up the dropdown's label
    document.querySelectorAll('nav .dropdown').forEach(function (dd) {
      var label = dd.querySelector(':scope > a');
      if (label && dd.querySelector('.dropdown-content a[aria-current="page"]')) label.classList.add('active');
    });
  }

  function addNavTranslationKeys() {
    Object.keys(NAV_IDS).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.hasAttribute('data-t')) el.setAttribute('data-t', NAV_IDS[id]);
    });
  }

  /* ---------- Translation gap-filler, run after each setLang ---------- */
  function applySharedStrings(lang) {
    var own = pageDict(lang) || {};
    var shared = I18N[lang] || I18N.ar;

    document.querySelectorAll('[data-t]').forEach(function (el) {
      var key = el.getAttribute('data-t');
      if (own[key] === undefined && shared[key] !== undefined) el.textContent = shared[key];
    });
    document.querySelectorAll('[data-ph]').forEach(function (el) {
      var key = el.getAttribute('data-ph');
      var text = own[key] !== undefined ? own[key] : shared[key];
      if (text !== undefined) el.setAttribute('placeholder', text);
    });

    var skip = document.querySelector('.ofq-skip');
    if (skip) skip.textContent = s('skip', lang);
    var menuBtn = document.getElementById('menu-btn');
    if (menuBtn) menuBtn.setAttribute('aria-label', s('menu', lang));
    document.querySelectorAll('.nav-sheet-close').forEach(function (b) { b.setAttribute('aria-label', s('close', lang)); });
    document.querySelectorAll('.lang-toggle').forEach(function (b) { b.setAttribute('aria-label', s('language', lang)); });
    var top = document.querySelector('.ofq-top');
    if (top) top.setAttribute('aria-label', s('back_top', lang));
  }

  function wrapSetLang() {
    var original = window.setLang;
    if (typeof original !== 'function' || original.__ofq) return;

    var wrapped = function (lang) {
      if (LANGS.indexOf(lang) < 0) lang = 'ar';
      // pages read either key; keep them identical
      localStorage.setItem('lang', lang);
      localStorage.setItem('uiLang', lang);
      var result = original.apply(this, arguments);
      applySharedStrings(lang);
      return result;
    };
    wrapped.__ofq = true;
    window.setLang = wrapped;
  }

  // Pages' logout() only clears the stored user; also end the Firebase
  // session so the account is really signed out.
  function wrapLogout() {
    var original = window.logout;
    if (typeof original !== 'function' || original.__ofq) return;
    var wrapped = function () {
      var self = this, args = arguments;
      var fs = window.fs;
      var done = function () { original.apply(self, args); };
      if (fs && fs.auth && typeof fs.signOut === 'function') {
        Promise.race([fs.signOut(fs.auth), new Promise(function (r) { setTimeout(r, 1500); })]).then(done, done);
      } else {
        done();
      }
      return false;
    };
    wrapped.__ofq = true;
    window.logout = wrapped;
  }

  /* ---------- Firestore "content" -> localStorage keys pages read ---------- */
  // section (as written by admin-app.js) -> storage keys used by the pages
  var SECTION_KEYS = {
    'research': ['research'],
    'articles': ['articles'],
    'files': ['files'],
    'articles-foreign': ['foreign-articles', 'articles-foreign'],
    'general-articles': ['general-articles'],
    'editions': ['editions'],
    'activities': ['activities'],
    'special-politics': ['special-politics'],
    'special-ir': ['special-ir'],
    'special-admin-law': ['special-admin-law'],
    'special-const-law': ['special-const-law'],
    'special-public-policy': ['special-public-policy'],
    'live': ['live']
  };

  function sortValue(item) {
    var raw = item.updatedAt || item.createdAt || item.date || 0;
    if (raw && typeof raw === 'object' && typeof raw.seconds === 'number') return raw.seconds * 1000;
    var n = Number(raw);
    if (!isNaN(n)) return n;
    var d = Date.parse(raw);
    return isNaN(d) ? 0 : d;
  }

  function waitForFs(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function tick() {
        if (window.fs && window.fs.db && window.fs.collection && window.fs.getDocs) return resolve(window.fs);
        if (Date.now() - t0 > timeoutMs) return reject(new Error('Firestore bridge not ready'));
        setTimeout(tick, 60);
      })();
    });
  }

  function loadBridge() {
    if (window.fs) return Promise.resolve();
    // same URL as the pages' <script type="module" src="/firestore-bridge.js">,
    // so the module (and Firebase app) is only ever instantiated once
    return import(new URL('/firestore-bridge.js', location.href).href).catch(function (e) {
      console.warn('Could not load firestore-bridge.js', e);
    });
  }

  function syncContent() {
    return loadBridge()
      .then(function () { return waitForFs(8000); })
      .then(function (fs) { return fs.getDocs(fs.collection(fs.db, 'content')); })
      .then(function (snap) {
        var all = [];
        snap.forEach(function (d) {
          var data = d.data() || {};
          all.push(Object.assign({ id: data.id != null ? data.id : d.id }, data, { docId: d.id }));
        });
        all.sort(function (a, b) { return sortValue(b) - sortValue(a); });

        var before = localStorage.getItem('contentcache');
        var json = JSON.stringify(all);
        localStorage.setItem('contentcache', json);

        Object.keys(SECTION_KEYS).forEach(function (section) {
          var items = all.filter(function (i) { return i.section === section; });
          SECTION_KEYS[section].forEach(function (key) {
            localStorage.setItem(key, JSON.stringify(items));
          });
        });

        document.dispatchEvent(new CustomEvent('ofouq:content', { detail: all }));
        // every page re-renders its lists inside setLang
        if (before !== json && typeof window.setLang === 'function') window.setLang(getLang());
      })
      .catch(function (e) {
        console.warn('Content sync skipped:', e && e.message ? e.message : e);
      });
  }

  /* ---------- Accessibility + small UX helpers ---------- */
  function addSkipLink() {
    var header = document.querySelector('header');
    if (!header || document.querySelector('.ofq-skip')) return;
    var target = document.querySelector('main') ||
      (function () {
        var el = header.nextElementSibling;
        while (el && /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) el = el.nextElementSibling;
        return el;
      })();
    if (!target) return;
    if (!target.id) target.id = 'ofq-main';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');

    var link = document.createElement('a');
    link.className = 'ofq-skip';
    link.href = '#' + target.id;
    link.textContent = s('skip');
    document.body.insertBefore(link, document.body.firstChild);
  }

  function makeLogoKeyboardFriendly() {
    document.querySelectorAll('header .logo').forEach(function (logo) {
      if (logo.tagName === 'A') return;
      logo.setAttribute('role', 'link');
      logo.setAttribute('tabindex', '0');
      logo.setAttribute('aria-label', s('nav_home'));
      logo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = 'index.html'; }
      });
    });
  }

  function isSheetOpen() {
    var m = document.getElementById('mobileMenu');
    if (!m) return false;
    return m.classList.contains('show') || m.classList.contains('open') || m.style.display === 'block';
  }

  function onEscape(e) {
    if (e.key !== 'Escape') return;
    if (isSheetOpen() && typeof window.toggleMenu === 'function') window.toggleMenu();
    ['langMenu', 'langMenuMobile'].forEach(function (id) {
      var m = document.getElementById(id);
      if (m) m.style.display = 'none';
    });
    document.querySelectorAll('.lang-toggle[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  // updateHeader() on several pages writes <a> inside the #mobileLogin <a>;
  // flatten it so the link works and the markup stays valid
  function flattenNestedAuthLinks(el) {
    var inner = el && el.tagName === 'A' && el.querySelector('a');
    if (!inner) return;
    el.setAttribute('href', inner.getAttribute('href') || '#');
    var onclick = inner.getAttribute('onclick');
    if (onclick) el.setAttribute('onclick', onclick + '; return false;');
    if (inner.getAttribute('data-t')) el.setAttribute('data-t', inner.getAttribute('data-t'));
    el.textContent = inner.textContent;
  }

  function watchAuthLinks() {
    ['mobileLogin', 'mobileRegister'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      flattenNestedAuthLinks(el);
      new MutationObserver(function () { flattenNestedAuthLinks(el); }).observe(el, { childList: true });
    });
  }

  function addBackToTop() {
    if (document.getElementById('backTop') || document.querySelector('.ofq-top')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ofq-top';
    btn.textContent = '↑';
    btn.setAttribute('aria-label', s('back_top'));
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(btn);

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        btn.classList.toggle('show', window.scrollY > 500);
        ticking = false;
      });
    }, { passive: true });
  }

  function polishNode(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('img:not([loading])').forEach(function (img) {
      if (!img.closest('header')) img.setAttribute('loading', 'lazy');
    });
    root.querySelectorAll('a[target="_blank"]:not([rel])').forEach(function (a) {
      a.setAttribute('rel', 'noopener');
    });
  }

  function watchDynamicContent() {
    polishNode(document);
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        r.addedNodes.forEach(function (n) { if (n.nodeType === 1) polishNode(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Boot ---------- */
  // Runs before the pages' DOMContentLoaded handlers (this script sits at
  // the end of <body>), so their first setLang() call already goes through
  // the wrapper and sees the nav translation keys.
  addNavTranslationKeys();
  markCurrentNav();
  wrapSetLang();
  wrapLogout();
  addSkipLink();
  makeLogoKeyboardFriendly();
  addBackToTop();
  document.addEventListener('keydown', onEscape);

  document.addEventListener('DOMContentLoaded', function () {
    wrapSetLang(); // in case setLang was defined late
    watchAuthLinks();
    watchDynamicContent();
    markCurrentNav(); // updateHeader() may have rebuilt parts of the header
    if (typeof window.setLang !== 'function') {
      document.documentElement.lang = getLang();
      applySharedStrings(getLang());
    }
    // content pages only (view pages need it for direct links too)
    var AUTH_PAGES = ['login', 'register', 'forgot', 'reset-password'];
    if (AUTH_PAGES.indexOf(page) < 0) syncContent();
  });
})();
