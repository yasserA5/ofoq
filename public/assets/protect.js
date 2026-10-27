// ==========================================================================
// Content protection for article / issue view pages.
//
// A web page cannot truly stop OS-level screenshots or screen recording, so
// this layers deterrents that make casual copying hard and leaks traceable:
//   - no text selection, copy/cut, context menu, image drag, print
//   - common shortcuts blocked (copy, select all, save, print, view source, devtools)
//   - content blurs whenever the window loses focus (snipping/recording tools
//     usually take focus first), and after PrintScreen the clipboard is wiped
//   - a drifting watermark with the reader's identity and the time, so any
//     capture that does get out shows where it came from
// ==========================================================================
import { currentUser, getLang, toast, ISSN } from './core.js';

const MSG = {
  ar: { copy: 'المحتوى محمي — يمكنك نسخ رابط المقال من زر المشاركة.', shot: 'التقاط الشاشة غير مسموح لهذا المحتوى.', hidden: 'المحتوى مخفي أثناء عدم نشاط النافذة', print: 'طباعة هذا المحتوى غير متاحة.', back: 'انقر للعودة إلى القراءة' },
  en: { copy: 'This content is protected — use the share button to copy the link.', shot: 'Screenshots are not allowed for this content.', hidden: 'Content hidden while this window is inactive', print: 'Printing this content is not available.', back: 'Click to resume reading' },
  fr: { copy: 'Contenu protégé — utilisez le bouton de partage pour copier le lien.', shot: 'Les captures d\'écran ne sont pas autorisées.', hidden: 'Contenu masqué tant que la fenêtre est inactive', print: 'L\'impression de ce contenu n\'est pas disponible.', back: 'Cliquez pour reprendre la lecture' }
};
const m = (k) => (MSG[getLang()] || MSG.ar)[k];

let lastToast = 0;
function warn(key) {
  const now = Date.now();
  if (now - lastToast < 1800) return; // don't stack toasts while a key is held
  lastToast = now;
  toast(m(key));
}

/* ---------- watermark ---------- */
function watermarkText() {
  const u = currentUser();
  const who = (u && u.loggedIn && (u.email || u.name)) || 'Ofouq Al-Maarifa';
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  return `${who} · ${when} · ISSN ${ISSN}`;
}

function buildWatermark() {
  const layer = document.createElement('div');
  layer.className = 'wm';
  layer.setAttribute('aria-hidden', 'true');
  const text = watermarkText();
  // SVG tile so the mark repeats across the whole page and scales cleanly
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><text x="0" y="120" transform="rotate(-24 210 110)" font-family="IBM Plex Sans Arabic, sans-serif" font-size="15" font-weight="600" fill="rgba(11,17,24,0.10)">${text.replace(/[<&>]/g, '')}</text></svg>`;
  layer.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  document.body.appendChild(layer);

  // refresh the timestamp every minute so screenshots carry the real time
  setInterval(() => {
    const fresh = svg.replace(text.replace(/[<&>]/g, ''), watermarkText().replace(/[<&>]/g, ''));
    layer.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(fresh)}")`;
  }, 60000);
}

/* ---------- focus shield ---------- */
function buildShield() {
  const shield = document.createElement('div');
  shield.className = 'shield';
  shield.innerHTML = `<div><img src="logo1.png" alt="" width="64" height="64"><strong></strong><span></span></div>`;
  document.body.appendChild(shield);
  const show = () => {
    shield.querySelector('strong').textContent = m('hidden');
    shield.querySelector('span').textContent = m('back');
    document.body.classList.add('is-shielded');
  };
  const hide = () => document.body.classList.remove('is-shielded');
  // clicking into the page's own PDF/video frame also blurs the window; that is reading, not capturing
  addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') return;
    show();
  }, 0));
  addEventListener('focus', hide);
  document.addEventListener('visibilitychange', () => (document.hidden ? show() : hide()));
  shield.addEventListener('click', () => { hide(); focus(); });
  return { show, hide };
}

/* ---------- early trigger on the Windows / Cmd key ----------
   Screenshot shortcuts all start with this key (Win+Shift+S, Win+PrintScreen,
   Win+Alt+PrintScreen for Game Bar, Cmd+Shift+3/4/5 on Mac). The browser hears
   the key going down before the combination completes, so the content is
   hidden before the capture is taken.
   - key alone (Start menu, Cmd+F…): lifts shortly after release
   - a screenshot combination was seen: stays until a click or the window
     regains focus, because the Mac crosshair (Cmd+Shift+4/5) and the Windows
     snipping overlay are still capturing after the keys are released */
function watchSystemKey(shield) {
  let held = false;
  let sticky = false;
  let liftTimer = 0;
  const isSystemKey = (e) => e.key === 'Meta' || e.key === 'OS' || e.key === 'Super' || e.key === 'Win';

  document.addEventListener('keydown', (e) => {
    if (isSystemKey(e)) {
      clearTimeout(liftTimer);
      held = true;
      sticky = false;
      shield.show();
      return;
    }
    if (held || e.metaKey) {
      // Shift / Alt / PrintScreen / 3-4-5 with the system key held = screenshot combo
      if (e.shiftKey || e.altKey || e.key === 'PrintScreen' || ['3', '4', '5', 'Shift', 'Alt'].includes(e.key)) {
        sticky = true;
        shield.show();
        wipeClipboard();
      }
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (!isSystemKey(e)) return;
    held = false;
    if (sticky) { warn('shot'); return; }
    // plain press: give the OS a moment, then lift if this window still has focus
    liftTimer = setTimeout(() => { if (document.hasFocus() && !held) shield.hide(); }, 350);
  }, true);

  // focus returning (after the Start menu or a snip) ends the sticky state too
  addEventListener('focus', () => { sticky = false; held = false; });
}

/* ---------- boot ---------- */
// hide: false keeps every other protection but never shows the hide screen
// (used for the issues / الأعداد pages)
export function protect({ hide = true } = {}) {
  const root = document.documentElement;
  root.classList.add('protected');
  buildWatermark();
  let shieldNow = () => {};
  if (hide) {
    const shield = buildShield();
    shieldNow = shield.show;
    watchSystemKey(shield);
  }

  const editable = (t) => t && t.closest && t.closest('input, textarea, [contenteditable="true"]');

  ['copy', 'cut'].forEach((type) => document.addEventListener(type, (e) => {
    if (editable(e.target)) return;
    e.preventDefault();
    // whatever was selected is replaced by the citation link
    e.clipboardData?.setData('text/plain', `${document.title}\n${location.href}`);
    warn('copy');
  }));
  document.addEventListener('contextmenu', (e) => { if (!editable(e.target)) { e.preventDefault(); warn('copy'); } });
  document.addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (!editable(e.target)) e.preventDefault(); });

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'PrintScreen') { e.preventDefault(); shieldNow(); wipeClipboard(); warn('shot'); return; }
    if (editable(e.target) && mod && ['c', 'x', 'a', 'v'].includes(k)) return;
    const blocked =
      (mod && ['c', 'x', 'a', 's', 'p', 'u'].includes(k)) ||
      (mod && e.shiftKey && ['i', 'j', 'c', 's'].includes(k)) || // devtools, Firefox screenshot
      e.key === 'F12';
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      warn(k === 'p' ? 'print' : 'copy');
    }
  }, true);
  // Windows only reports PrintScreen on keyup; the screen is already captured,
  // so wipe the clipboard copy of it right after
  document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') { wipeClipboard(); shieldNow(); warn('shot'); }
  });

  addEventListener('beforeprint', () => warn('print'));
}

function wipeClipboard() {
  try { navigator.clipboard?.writeText(`${document.title} — ${location.href}`); } catch { /* needs focus/permission */ }
}
