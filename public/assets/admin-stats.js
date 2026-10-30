// ==========================================================================
// Admin statistics dashboard. Adds a "الإحصائيات" entry to the admin menu and
// renders into #content. Reads users, visitors and stats_daily, which only
// admins can read (firestore.rules). admin-app.js is not involved.
// ==========================================================================
import { db } from '../admin-firebase.js';
import {
  collection, documentId, getCountFromServer, getDocs, limit, orderBy, query, where
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const WINDOWS = [[7, '7 أيام'], [15, '15 يوماً'], [30, 'شهر'], [90, '3 أشهر'], [180, '6 أشهر'], [365, 'سنة']];
const DAY = 86400000;
const USERS_SHOWN = 500; // shortcut: newest 500 logins only, add paging when the site passes that

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const fmtDate = (ms) => (ms ? new Intl.DateTimeFormat('ar-MA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '—');

function contentTitles() {
  try {
    const map = {};
    JSON.parse(localStorage.getItem('contentcache') || '[]').forEach((i) => {
      map[i.docId || i.id] = (i.title && (i.title.ar || i.title.en || i.title.fr)) || i.title;
    });
    return map;
  } catch { return {}; }
}

// sums a map field (pages, items, devices…) across daily docs, biggest first
function totals(days, field) {
  const sum = {};
  days.forEach((d) => Object.entries(d[field] || {}).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + Number(v || 0); }));
  return Object.entries(sum).sort((a, b) => b[1] - a[1]);
}

function ranked(title, rows, label = (k) => k) {
  const max = rows[0]?.[1] || 1;
  return `<div class="card st-panel"><h3>${esc(title)}</h3>
    ${rows.length ? `<ul class="st-rank">${rows.slice(0, 8).map(([k, v]) => `
      <li><span class="st-rank__name" title="${esc(label(k))}">${esc(label(k))}</span><b>${num(v)}</b>
        <i style="inline-size:${Math.max(2, (v / max) * 100)}%"></i></li>`).join('')}</ul>` : '<div class="empty">لا توجد بيانات بعد</div>'}</div>`;
}

function dailyChart(days) {
  const byKey = Object.fromEntries(days.map((d) => [d.id, d]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const key = dateKey(Date.now() - (29 - i) * DAY);
    return { key, visitors: Number(byKey[key]?.visitors || 0), views: Number(byKey[key]?.views || 0) };
  });
  const max = Math.max(1, ...series.map((s) => s.visitors));
  return `<div class="card"><h3>الزوار يومياً — آخر 30 يوماً</h3>
    <div class="st-chart" role="img" aria-label="عدد الزوار لكل يوم خلال آخر 30 يوماً">
      ${series.map((s) => `<div class="st-bar" tabindex="0">
        <i style="block-size:${s.visitors ? Math.max(3, (s.visitors / max) * 100) : 0}%"></i>
        <span class="st-tip">${s.key}<br>${num(s.visitors)} زائر · ${num(s.views)} مشاهدة</span></div>`).join('')}
    </div>
    <div class="st-axis"><span>${series[0].key}</span><span>أعلى يوم: ${num(max)}</span><span>${series[29].key}</span></div>
  </div>`;
}

function usersTable(users) {
  const provider = { google: 'Google', password: 'بريد وكلمة مرور' };
  return users.map((u) => `<tr data-q="${esc(`${u.displayName} ${u.email} ${u.affiliation || ''}`.toLowerCase())}">
    <td><strong>${esc(u.displayName || '—')}</strong></td><td dir="ltr">${esc(u.email || '—')}</td>
    <td>${esc(u.affiliation || '—')}</td><td>${esc(provider[u.provider] || u.provider || '—')}</td>
    <td>${fmtDate(u.createdAt)}</td><td>${fmtDate(u.lastLogin)}</td><td>${num(u.loginCount)}</td></tr>`).join('');
}

function exportCsv(users) {
  // the leading quote stops spreadsheet formula injection from user-chosen names
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
  const rows = [['الاسم', 'البريد', 'المؤسسة', 'الانضمام', 'آخر دخول', 'مرات الدخول'],
    ...users.map((u) => [u.displayName, u.email, u.affiliation, fmtDate(u.createdAt), fmtDate(u.lastLogin), u.loginCount])];
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `ofouq-users-${dateKey(Date.now())}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

async function load() {
  const now = Date.now();
  const visitorsCol = collection(db, 'visitors');
  const count = (q) => getCountFromServer(q).then((s) => s.data().count);
  const [visitorTotal, windowCounts, dailySnap, userTotal, usersSnap] = await Promise.all([
    count(visitorsCol),
    Promise.all(WINDOWS.map(([d]) => count(query(visitorsCol, where('lastSeen', '>=', now - d * DAY))))),
    getDocs(query(collection(db, 'stats_daily'), where(documentId(), '>=', dateKey(now - 365 * DAY)))),
    count(collection(db, 'users')),
    getDocs(query(collection(db, 'users'), orderBy('lastLogin', 'desc'), limit(USERS_SHOWN)))
  ]);
  return {
    visitorTotal, windowCounts, userTotal,
    days: dailySnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    users: usersSnap.docs.map((d) => d.data())
  };
}

function render(box, { visitorTotal, windowCounts, userTotal, days, users }) {
  const now = Date.now();
  const since = (d) => days.filter((x) => x.id >= dateKey(now - d * DAY));
  const sum = (list, f) => list.reduce((n, x) => n + Number(x[f] || 0), 0);
  const today = since(0);
  const titles = contentTitles();
  const newUsers = (d) => users.filter((u) => u.createdAt >= now - d * DAY).length;
  const activeUsers = (d) => users.filter((u) => u.lastLogin >= now - d * DAY).length;
  const allViews = sum(days, 'views');
  const allSessions = sum(days, 'sessions');

  box.innerHTML = `
    <div class="card"><h3>الزوار حسب الفترة</h3>
      <div class="st-grid st-grid--6">
        ${WINDOWS.map(([d, label], i) => `<div class="st-tile"><span>آخر ${label}</span><strong>${num(windowCounts[i])}</strong>
          <small>${num(sum(since(d), 'views'))} مشاهدة صفحة</small></div>`).join('')}
      </div>
      <p class="st-note">الزائر هو متصفح فريد ظهر خلال الفترة. العد يبدأ من يوم تفعيل الإحصائيات.</p>
    </div>

    <div class="st-grid st-grid--4">
      <div class="st-tile"><span>زوار اليوم</span><strong>${num(sum(today, 'visitors'))}</strong><small>${num(sum(today, 'views'))} مشاهدة</small></div>
      <div class="st-tile"><span>إجمالي الزوار</span><strong>${num(visitorTotal)}</strong><small>${num(sum(days, 'newVisitors'))} زائر جديد خلال السنة</small></div>
      <div class="st-tile"><span>صفحات لكل جلسة</span><strong>${allSessions ? (allViews / allSessions).toFixed(1) : '0'}</strong><small>${num(allSessions)} جلسة</small></div>
      <div class="st-tile"><span>الحسابات المسجلة</span><strong>${num(userTotal)}</strong><small>${num(newUsers(30))} جديد هذا الشهر</small></div>
      <div class="st-tile"><span>نشطون (7 أيام)</span><strong>${num(activeUsers(7))}</strong><small>سجلوا الدخول</small></div>
      <div class="st-tile"><span>نشطون (30 يوماً)</span><strong>${num(activeUsers(30))}</strong><small>سجلوا الدخول</small></div>
      <div class="st-tile"><span>عمليات الدخول (30 يوماً)</span><strong>${num(sum(since(30), 'logins'))}</strong><small>${num(sum(since(30), 'signups'))} تسجيل جديد</small></div>
      <div class="st-tile"><span>عمليات الدخول (سنة)</span><strong>${num(sum(days, 'logins'))}</strong><small>${num(sum(days, 'signups'))} تسجيل جديد</small></div>
    </div>

    ${dailyChart(days)}

    <div class="st-grid st-grid--2">
      ${ranked('أكثر المقالات قراءة', totals(days, 'items'), (k) => titles[k] || k)}
      ${ranked('أكثر الصفحات زيارة', totals(days, 'pages'))}
      ${ranked('مصادر الزيارات', totals(days, 'sources'), (k) => (k === 'direct' ? 'دخول مباشر' : k))}
      ${ranked('الأجهزة', totals(days, 'devices'), (k) => ({ mobile: 'هاتف / لوحي', desktop: 'حاسوب' }[k] || k))}
      ${ranked('لغات التصفح', totals(days, 'langs'), (k) => ({ ar: 'العربية', en: 'English', fr: 'Français' }[k] || k))}
    </div>

    <div class="card">
      <div class="actions st-head">
        <h3>المستخدمون المسجلون (${num(userTotal)})</h3>
        <div class="actions" style="margin:0">
          <input type="search" id="stUserSearch" placeholder="ابحث بالاسم أو البريد…" aria-label="بحث في المستخدمين" style="max-width:260px">
          <button class="btn btn-ghost btn-small" type="button" id="stCsv"><i class="ri-download-2-line"></i> تصدير CSV</button>
        </div>
      </div>
      ${users.length ? `<div class="st-table"><table><thead><tr>
        <th>الاسم</th><th>البريد</th><th>المؤسسة</th><th>طريقة الدخول</th><th>الانضمام</th><th>آخر دخول</th><th>مرات الدخول</th>
      </tr></thead><tbody id="stUsers">${usersTable(users)}</tbody></table></div>` : '<div class="empty">لا يوجد مستخدمون بعد</div>'}
    </div>`;

  box.querySelector('#stCsv').addEventListener('click', () => exportCsv(users));
  box.querySelector('#stUserSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    box.querySelectorAll('#stUsers tr').forEach((tr) => { tr.hidden = !tr.dataset.q.includes(q); });
  });
}

async function open(btn) {
  document.querySelectorAll('#menu button').forEach((b) => b.classList.toggle('active', b === btn));
  document.getElementById('sectionTitle').textContent = 'الإحصائيات';
  const box = document.getElementById('content');
  box.innerHTML = '<div class="card"><div class="empty">جاري تحميل الإحصائيات…</div></div>';
  try {
    const data = await load();
    // the admin may have moved to another section while this loaded
    if (btn.classList.contains('active')) render(box, data);
  } catch (e) {
    console.error(e);
    if (!btn.classList.contains('active')) return;
    const denied = /permission/i.test(e.message);
    box.innerHTML = `<div class="card"><div class="empty">${denied
      ? 'لا تملك صلاحية عرض الإحصائيات. تأكد من نشر قواعد Firestore ومن تسجيل الدخول بحساب مدير.'
      : `تعذر تحميل الإحصائيات: ${esc(e.message)}`}</div></div>`;
  }
}

function addMenuEntry() {
  const menu = document.getElementById('menu');
  if (!menu || !menu.children.length || menu.querySelector('[data-stats]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.stats = '1';
  btn.innerHTML = '<i class="ri-dashboard-3-line" style="opacity:1;font-size:17px;transform:none"></i><span>الإحصائيات</span>';
  btn.addEventListener('click', () => open(btn));
  menu.prepend(btn);
}

const menu = document.getElementById('menu');
new MutationObserver(addMenuEntry).observe(menu, { childList: true });
addMenuEntry();
