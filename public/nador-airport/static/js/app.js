/* Nador El Aroui Airport — front-end
   GSAP + ScrollTrigger + MotionPath, Lenis smooth scroll, Python JSON API. */
(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* ---------- state ---------- */
  let lang = store.get("ndr-lang") || "ar";
  if (!I18N[lang]) lang = "ar";
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
  const isRTL = () => I18N[lang].dir === "rtl";

  /* ---------- theme ---------- */
  const root = document.documentElement;
  const savedTheme = store.get("ndr-theme");
  root.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  $("#themeBtn").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(() => { root.dataset.theme = next; });
    } else root.dataset.theme = next;
    store.set("ndr-theme", next);
  });

  /* ---------- i18n ---------- */
  function applyLang(next, animate) {
    lang = next;
    store.set("ndr-lang", lang);
    root.lang = lang;
    root.dir = I18N[lang].dir;
    document.title = `${t("brand.name")} · NDR`;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    $(".skip").textContent = lang === "ar" ? "تخطي إلى المحتوى" : lang === "fr" ? "Aller au contenu" : "Skip to content";
    splitTitle(animate);
    buildMarquee();
    buildDaySelect();
    renderBoard(false);
    renderCrowd();
    renderReviews();
    renderSummary();
    buildReviewTags();
    moveSegPill();
    if (hasGSAP) requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.lang === lang) return;
    if (hasGSAP && !reduceMotion) {
      gsap.to("main, .header__inner, .footer", { opacity: 0, duration: .2, onComplete() {
        applyLang(b.dataset.lang, true);
        setupGuide();
        gsap.to("main, .header__inner, .footer", { opacity: 1, duration: .35 });
      } });
    } else { applyLang(b.dataset.lang, false); setupGuide(); }
  }));

  /* ---------- API ---------- */
  async function api(path, opts) {
    const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error("http " + res.status); e.data = data; throw e; }
    return data;
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /* ---------- clock (Morocco, UTC+1) ---------- */
  function moroccoNow() {
    const d = new Date();
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 3600000);
  }
  function tick() {
    const n = moroccoNow();
    $("#clock").textContent = n.toTimeString().slice(0, 8);
  }
  tick(); setInterval(tick, 1000);
  $("#year").textContent = moroccoNow().getFullYear();

  /* ---------- hero title split ---------- */
  function splitTitle(animate) {
    const el = $("[data-split]");
    const words = t(el.dataset.i18n).split(" ");
    el.setAttribute("aria-label", words.join(" "));
    el.innerHTML = words.map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(" ");
    if (animate && hasGSAP && !reduceMotion) {
      gsap.from(el.querySelectorAll(".w > span"), { yPercent: 110, duration: .9, ease: "expo.out", stagger: .06 });
    }
  }

  /* ---------- marquee ---------- */
  const DESTS = [
    ["BRU", { ar: "بروكسل", fr: "Bruxelles", en: "Brussels" }], ["AMS", { ar: "أمستردام", fr: "Amsterdam", en: "Amsterdam" }],
    ["DUS", { ar: "دوسلدورف", fr: "Düsseldorf", en: "Düsseldorf" }], ["CDG", { ar: "باريس", fr: "Paris", en: "Paris" }],
    ["MRS", { ar: "مارسيليا", fr: "Marseille", en: "Marseille" }], ["BCN", { ar: "برشلونة", fr: "Barcelone", en: "Barcelona" }],
    ["MAD", { ar: "مدريد", fr: "Madrid", en: "Madrid" }], ["AGP", { ar: "مالقة", fr: "Malaga", en: "Málaga" }],
    ["FRA", { ar: "فرانكفورت", fr: "Francfort", en: "Frankfurt" }], ["CMN", { ar: "الدار البيضاء", fr: "Casablanca", en: "Casablanca" }],
    ["MXP", { ar: "ميلانو", fr: "Milan", en: "Milan" }], ["EIN", { ar: "آيندهوفن", fr: "Eindhoven", en: "Eindhoven" }],
  ];
  let marqueeTween, marqueeST;
  function buildMarquee() {
    const track = $("#marquee");
    const one = DESTS.map(([c, n]) => `<span><svg class="ic"><use href="#i-plane"/></svg>${n[lang]} <code>${c}</code></span>`).join("");
    track.innerHTML = one + one;
    if (marqueeTween) marqueeTween.kill();
    if (marqueeST) marqueeST.kill();
    if (!hasGSAP || reduceMotion) return;
    marqueeTween = gsap.to(track, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
    // Speed up with scroll velocity
    marqueeST = ScrollTrigger.create({
      trigger: ".marquee", start: "top bottom", end: "bottom top",
      onUpdate(self) {
        const v = Math.min(Math.abs(self.getVelocity()) / 400, 4);
        gsap.to(marqueeTween, { timeScale: 1 + v, duration: .3, overwrite: true, onComplete() { gsap.to(marqueeTween, { timeScale: 1, duration: 1 }); } });
      },
    });
  }

  /* ---------- flight board ---------- */
  const board = { kind: "departures", flights: [], q: "", updated: "", error: false, source: null, srcError: null, loaded: false };
  const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const DONE = new Set(["departed", "baggage_done", "cancelled"]);

  function flap(text) {
    return `<span class="flap" aria-label="${text}">${[...text].map((c) => `<i data-c="${c}">${c === " " ? "&nbsp;" : c}</i>`).join("")}</span>`;
  }
  function animateFlaps(scope) {
    if (!hasGSAP || reduceMotion) return;
    $$(".flap i", scope).forEach((el, idx) => {
      const final = el.dataset.c;
      if (final === " ") return;
      let n = 4 + Math.floor(Math.random() * 6);
      const iv = setInterval(() => {
        if (n-- <= 0) { el.textContent = final; clearInterval(iv); return; }
        el.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
      }, 45 + (idx % 5) * 6);
      gsap.fromTo(el, { rotateX: -90 }, { rotateX: 0, duration: .35, delay: (idx % 12) * .02, ease: "back.out(2)" });
    });
  }

  async function loadBoard(animate = true) {
    try {
      const data = await api(`/api/flights?type=${board.kind}`);
      board.flights = data.flights;
      board.updated = data.updated;
      board.source = data.source;
      board.srcError = data.error;
      board.error = false;
    } catch {
      board.error = true;
    }
    board.loaded = true;
    renderBoard(animate);
  }

  function renderSource() {
    const badge = $("#boardSource");
    const real = board.source === "fr24";
    badge.hidden = !board.source;
    badge.className = "src-badge" + (!real ? " src-badge--sim" : board.srcError ? " src-badge--err" : "");
    badge.textContent = t(!real ? "src.sim" : board.srcError ? "src.err" : "src.live");
    if (board.srcError) badge.title = board.srcError; else badge.removeAttribute("title");
    $("#boardNotice").textContent = t(real ? "board.realnote" : "board.notice");
    // Real data has no gate/belt assignments
    $("#colGate").textContent = real ? t("fl.aircraft") : t(board.kind === "departures" ? "board.gate" : "board.belt");
  }

  function renderBoard(animate) {
    const rows = $("#boardRows");
    const real = board.source === "fr24";
    $("#colCity").textContent = t(board.kind === "departures" ? "board.dest" : "board.origin");
    renderSource();
    $("#boardUpdated").textContent = board.updated || "--:--";
    if (board.error) { rows.innerHTML = `<p class="board__empty">${t("err.net")}</p>`; return; }
    if (!board.loaded) { rows.innerHTML = '<div class="skeleton"></div>'.repeat(6); return; }
    if (!board.flights.length) { rows.innerHTML = `<p class="board__empty">${t(real ? (board.srcError ? "src.err" : "board.noreal") : "board.empty")}</p>`; return; }
    const q = board.q.trim().toLowerCase();
    const list = board.flights.filter((f) => !q || [f.number, f.airline, f.code, ...Object.values(f.city)].some((s) => s.toLowerCase().includes(q)));
    if (!list.length) { rows.innerHTML = `<p class="board__empty">${t("board.empty")}</p>`; return; }
    rows.innerHTML = list.map((f, i) => {
      const late = f.estimated !== f.scheduled;
      return `<button type="button" role="row" class="row row--flight ${DONE.has(f.status) ? "is-done" : ""}" data-i="${board.flights.indexOf(f)}">
        <span role="cell" class="tm">${flap(late ? f.estimated : f.scheduled)}${late ? `<s>${f.scheduled}</s>` : ""}</span>
        <span role="cell">${flap(f.number.replace(" ", ""))}</span>
        <span role="cell" class="city">${f.city[lang]}<small>${f.code}</small></span>
        <span role="cell" class="airline">${f.airline}</span>
        <span role="cell">${flap((real ? f.aircraft : board.kind === "departures" ? f.gate : f.belt) || "-")}</span>
        <span role="cell"><span class="badge badge--${f.status}">${t("st." + f.status)}</span></span>
      </button>`;
    }).join("");
    if (animate) {
      animateFlaps(rows);
      if (hasGSAP && !reduceMotion) gsap.from(rows.children, { opacity: 0, y: 14, duration: .45, stagger: .03, ease: "power2.out" });
    }
  }

  function moveSegPill() {
    const active = $("#boardTabs [aria-selected='true']");
    const pill = $("#boardTabs .seg__pill");
    if (!active) return;
    pill.style.left = active.offsetLeft + "px";
    pill.style.width = active.offsetWidth + "px";
  }
  function setKind(kind) {
    board.kind = kind;
    board.flights = [];
    board.loaded = false;
    $$("#boardTabs [role=tab], .quick__tabs [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.kind === kind)));
    moveSegPill();
    renderBoard(false);
    loadBoard(true);
  }
  $$("#boardTabs [role=tab]").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));
  $$(".quick__tabs [role=tab]").forEach((b) => b.addEventListener("click", () => {
    $$(".quick__tabs [role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  }));
  window.addEventListener("resize", moveSegPill);

  let filterTimer;
  $("#boardFilter").addEventListener("input", (e) => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => { board.q = e.target.value; renderBoard(true); }, 180);
  });
  $("#quickSearch").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.q.value;
    const kind = $(".quick__tabs [aria-selected='true']").dataset.kind;
    $("#boardFilter").value = q;
    board.q = q;
    if (kind !== board.kind) setKind(kind); else renderBoard(true);
    scrollToEl("#flights");
  });
  setInterval(() => { if (!document.hidden) loadBoard(true); }, 60000);

  /* ---------- flight drawer + boarding pass ---------- */
  let lastFocus;
  function openDialog(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    lenis && lenis.stop();
    const panel = $(".drawer__panel", el);
    if (hasGSAP && !reduceMotion) {
      gsap.fromTo($(".drawer__scrim", el), { opacity: 0 }, { opacity: 1, duration: .3 });
      if (el.classList.contains("drawer--center")) gsap.fromTo(panel, { y: 40, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .5, ease: "expo.out" });
      else gsap.fromTo(panel, { xPercent: isRTL() ? -100 : 100 }, { xPercent: 0, duration: .6, ease: "expo.out" });
    }
    const focusable = $("input, button:not(.drawer__close)", panel) || $(".drawer__close", panel);
    setTimeout(() => focusable.focus(), 50);
  }
  function closeDialog(el) {
    const done = () => { el.hidden = true; lenis && lenis.start(); lastFocus && lastFocus.focus(); };
    if (hasGSAP && !reduceMotion) {
      const panel = $(".drawer__panel", el);
      gsap.to($(".drawer__scrim", el), { opacity: 0, duration: .25 });
      if (el.classList.contains("drawer--center")) gsap.to(panel, { y: 20, opacity: 0, duration: .25, onComplete: done });
      else gsap.to(panel, { xPercent: isRTL() ? -100 : 100, duration: .35, ease: "power2.in", onComplete: done });
    } else done();
  }
  $$(".drawer").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDialog(d); });
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDialog(d);
      if (e.key === "Tab") { // focus trap
        const f = $$("button, input, textarea, select, a[href]", d).filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  });

  function flightProgress(f) {
    const now = moroccoNow();
    const [h, m] = f.estimated.split(":").map(Number);
    const start = new Date(now); start.setHours(h, m, 0, 0);
    if (board.kind === "arrivals") start.setMinutes(start.getMinutes() - f.duration);
    const p = (now - start) / (f.duration * 60000);
    return Math.max(0, Math.min(1, p));
  }

  $("#boardRows").addEventListener("click", (e) => {
    const row = e.target.closest(".row--flight");
    if (!row) return;
    const f = board.flights[+row.dataset.i];
    const dep = board.kind === "departures";
    const from = dep ? { c: "NDR", n: t("a.nador") } : { c: f.code, n: f.city[lang] };
    const to = dep ? { c: f.code, n: f.city[lang] } : { c: "NDR", n: t("a.nador") };
    const real = board.source === "fr24";
    const p = f.status === "cancelled" ? 0 : real ? (f.progress ?? (f.status === "landed" ? 1 : 0)) : flightProgress(f);
    const cells = real ? [
      [t("board.flight"), f.number], [t("board.time"), f.estimated], [t("fl.aircraft"), f.aircraft || "—"],
      [t("fl.reg"), f.reg || "—"],
      f.alt != null ? [t("fl.alt"), `${Number(f.alt).toLocaleString("en")} ft`] : [t("fl.duration"), f.duration ? `${f.duration} ${t("fl.min")}` : "—"],
      f.speed != null ? [t("fl.speed"), `${f.speed} kt`] : [t("fl.progress"), `${Math.round(p * 100)}%`],
    ] : [
      [t("board.flight"), f.number], [t("board.time"), f.estimated],
      [t(dep ? "board.gate" : "board.belt"), dep ? f.gate : f.belt], [dep ? t("fl.counter") : "IATA", dep ? f.counter : f.code],
      [t("fl.duration"), `${f.duration} ${t("fl.min")}`], [t("fl.progress"), `${Math.round(p * 100)}%`],
    ];
    $("#drawerTitle").textContent = `${f.number} ${from.c} → ${to.c}`;
    $("#pass").innerHTML = `
      <div class="pass__top"><strong>${f.airline}</strong><span class="badge badge--${f.status}">${t("st." + f.status)}</span></div>
      <div class="pass__route">
        <div><span class="code">${from.c}</span><small>${from.n}</small></div>
        <div class="pass__line" style="--p:0%" aria-label="${t("fl.progress")} ${Math.round(p * 100)}%"><svg><use href="#i-plane"/></svg></div>
        <div class="to"><span class="code">${to.c}</span><small>${to.n}</small></div>
      </div>
      <div class="pass__grid">${cells.map(([k, v]) => `<div><small>${k}</small><b dir="ltr">${esc(v)}</b></div>`).join("")}</div>
      <div class="pass__tear"></div>
      <div class="pass__barcode" aria-hidden="true"></div>
      ${real && f.link ? `<a class="pass__link" href="${esc(f.link)}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-plane"/></svg>${t("fl.fr24")}</a>` : ""}
      <div class="pass__shine" aria-hidden="true"></div>`;
    openDialog($("#drawer"));
    requestAnimationFrame(() => requestAnimationFrame(() => { $(".pass__line").style.setProperty("--p", (p * 100).toFixed(1) + "%"); }));
  });

  // 3D tilt on the boarding pass
  const pass = $("#pass");
  pass.addEventListener("pointermove", (e) => {
    if (reduceMotion) return;
    const r = pass.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    pass.style.transform = `rotateY(${(x - .5) * 16}deg) rotateX(${(.5 - y) * 12}deg)`;
    pass.style.setProperty("--sx", x * 100 + "%"); pass.style.setProperty("--sy", y * 100 + "%");
  });
  pass.addEventListener("pointerleave", () => { pass.style.transform = ""; });

  /* ---------- crowd chart ---------- */
  const crowd = { day: (moroccoNow().getDay() + 6) % 7, hours: [], live: null };
  function level(v) { return v < 30 ? 0 : v < 50 ? 1 : v < 70 ? 2 : 3; }
  function buildDaySelect() {
    const sel = $("#crowdDay");
    sel.innerHTML = [0, 1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${d === crowd.day ? "selected" : ""}>${t("d" + d)}</option>`).join("");
  }
  $("#crowdDay").addEventListener("change", (e) => { crowd.day = +e.target.value; loadCrowd(true); });
  async function loadCrowd(animate) {
    try {
      const d = await api(`/api/crowd?day=${crowd.day}`);
      crowd.hours = d.hours; crowd.live = d.live_hour;
    } catch { crowd.hours = []; }
    renderCrowd(animate);
  }
  function renderCrowd(animate) {
    const chart = $("#crowdChart");
    if (!crowd.hours.length) { chart.innerHTML = ""; return; }
    chart.innerHTML = crowd.hours.map((v, h) => `
      <div class="bar ${h === crowd.live ? "is-now" : ""}" style="--h:${v}%" data-now="${t("crowd.now")}">
        <i style="height:${v}%"></i><span class="tip">${String(h).padStart(2, "0")}:00 · ${t("crowd.l" + level(v))}</span><small>${h}</small>
      </div>`).join("");
    const liveV = crowd.live != null ? crowd.hours[crowd.live] : null;
    $("#crowdLive").hidden = liveV == null;
    $("#crowdLiveText").textContent = liveV == null ? "" : t("crowd.l" + level(liveV));
    chart.setAttribute("aria-label", crowd.hours.map((v, h) => `${h}:00 ${t("crowd.l" + level(v))}`).join(", "));
    if (animate && hasGSAP && !reduceMotion) {
      gsap.fromTo($$(".bar i", chart), { scaleY: 0 }, { scaleY: 1, duration: .8, ease: "elastic.out(1, .7)", stagger: { each: .025, from: "start" } });
    }
  }

  /* ---------- reviews ---------- */
  const rev = { all: [], stats: null, topic: "all" };
  const AVATAR = ["#1E3A8A", "#EA580C", "#0F766E", "#7C3AED", "#BE185D", "#2563EB"];
  function starsHTML(n) {
    return [1, 2, 3, 4, 5].map((i) => `<svg class="ic ${n >= i ? "on" : n >= i - .5 ? "half" : ""}"><use href="#i-star"/></svg>`).join("");
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function relDate(iso) {
    const days = Math.round((moroccoNow() - new Date(iso)) / 864e5);
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    if (days < 30) return rtf.format(-days, "day");
    if (days < 365) return rtf.format(-Math.round(days / 30), "month");
    return rtf.format(-Math.round(days / 365), "year");
  }
  async function loadReviews() {
    try {
      const [s, r] = await Promise.all([api("/api/stats"), api("/api/reviews")]);
      rev.stats = s; rev.all = r.reviews;
    } catch { /* keep static fallback */ }
    renderSummary(true); renderReviews(true);
  }
  function renderSummary(animate) {
    const s = rev.stats;
    if (!s) { $("#avgStars").innerHTML = starsHTML(3.5); return; }
    $("#avgScore").textContent = s.average.toLocaleString(lang === "fr" ? "fr" : "en", { minimumFractionDigits: 1 });
    $("#avgStars").innerHTML = starsHTML(s.average);
    $("#totalReviews").textContent = s.total.toLocaleString(lang === "fr" ? "fr" : "en");
    const max = Math.max(...Object.values(s.distribution));
    $("#dist").innerHTML = [5, 4, 3, 2, 1].map((k) => `<li><span>${k}</span><span class="track"><i style="transform:scaleX(${s.distribution[k] / max})"></i></span><span>${s.distribution[k]}</span></li>`).join("");
    if (animate && hasGSAP && !reduceMotion) {
      gsap.from("#dist .track i", { scaleX: 0, duration: 1.2, ease: "expo.out", stagger: .08, scrollTrigger: { trigger: "#dist", start: "top 85%" } });
    }
    $("#topicChips").innerHTML = `<button type="button" class="chip" aria-pressed="${rev.topic === "all"}" data-topic="all">${t("rev.all")}</button>` +
      s.topics.map((x) => `<button type="button" class="chip" aria-pressed="${rev.topic === x.key}" data-topic="${x.key}">${t("t." + x.key)} <b>${x.count}</b></button>`).join("");
  }
  $("#topicChips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    rev.topic = c.dataset.topic;
    $$("#topicChips .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    renderReviews(true);
  });
  function renderReviews(animate) {
    const list = $("#reviewList");
    const items = rev.all.filter((r) => rev.topic === "all" || (r.tags || []).includes(rev.topic));
    if (!items.length) { list.innerHTML = `<p class="board__empty" style="color:var(--muted)">—</p>`; return; }
    list.innerHTML = items.map((r, i) => `
      <article class="review">
        <div class="review__head">
          <span class="avatar" style="background:${AVATAR[i % AVATAR.length]}">${esc(r.name.trim()[0] || "?").toUpperCase()}</span>
          <span class="review__who"><b>${esc(r.name)}</b>${r.badge === "local_guide" ? `<small>${t("rev.local")}</small>` : ""}</span>
          <span class="review__meta">${r.rating ? `<span class="stars">${starsHTML(r.rating)}</span>` : ""}<span>${relDate(r.date)}</span></span>
        </div>
        <p dir="auto">${esc(r.text)}</p>
        ${(r.tags || []).length ? `<div class="review__tags">${r.tags.map((x) => `<span>${t("t." + x)}</span>`).join("")}</div>` : ""}
      </article>`).join("");
    if (animate && hasGSAP && !reduceMotion) gsap.from(list.children, { opacity: 0, y: 24, duration: .55, stagger: .07, ease: "power3.out" });
  }

  /* review form */
  let rating = 0;
  const TAGS = ["customs", "respect", "wifi", "toilet_paper", "parking", "cleanliness", "staff"];
  const chosenTags = new Set();
  function buildRatingStars() {
    $("#ratingStars").innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i}/5" aria-pressed="${i <= rating}" class="${i <= rating ? "on" : ""}"><svg class="ic"><use href="#i-star"/></svg></button>`).join("");
  }
  function buildReviewTags() {
    $("#reviewTags").innerHTML = TAGS.map((k) => `<button type="button" class="chip" data-tag="${k}" aria-pressed="${chosenTags.has(k)}">${t("t." + k)}</button>`).join("");
  }
  $("#ratingStars").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    rating = +b.dataset.v; buildRatingStars();
    if (hasGSAP && !reduceMotion) gsap.fromTo($$("#ratingStars .on"), { scale: .6 }, { scale: 1, duration: .5, ease: "back.out(3)", stagger: .04 });
  });
  $("#reviewTags").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    const k = b.dataset.tag;
    chosenTags.has(k) ? chosenTags.delete(k) : chosenTags.add(k);
    b.setAttribute("aria-pressed", String(chosenTags.has(k)));
  });
  $("#writeReviewBtn").addEventListener("click", () => { buildRatingStars(); buildReviewTags(); openDialog($("#reviewModal")); });

  function showErrors(form, prefix, errors) {
    $$(".field", form).forEach((f) => f.classList.remove("has-error"));
    $$(".field__err", form).forEach((p) => { p.textContent = ""; });
    let first;
    Object.keys(errors).forEach((k) => {
      const id = prefix + k[0].toUpperCase() + k.slice(1);
      const p = $(`#${id}-err`);
      if (p) { p.textContent = t("err." + k); p.closest(".field").classList.add("has-error"); }
      const input = $("#" + id);
      if (input) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", id + "-err"); first = first || input; }
    });
    if (first) first.focus();
    if (hasGSAP && !reduceMotion && Object.keys(errors).length) gsap.fromTo(form, { x: -8 }, { x: 0, duration: .5, ease: "elastic.out(1, .3)" });
  }

  $("#reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, status = $("#reviewStatus");
    const body = { name: $("#rName").value.trim(), text: $("#rText").value.trim(), rating, tags: [...chosenTags], lang };
    const errors = {};
    if (body.name.length < 2) errors.name = 1;
    if (!rating) errors.rating = 1;
    if (body.text.length < 10) errors.text = 1;
    showErrors(form, "r", errors);
    if (Object.keys(errors).length) return;
    const btn = $("button[type=submit]", form);
    btn.disabled = true; btn.textContent = t("form.sending"); status.textContent = ""; status.className = "form__status";
    try {
      await api("/api/reviews", { method: "POST", body: JSON.stringify(body) });
      form.reset(); rating = 0; chosenTags.clear();
      closeDialog($("#reviewModal"));
      toast(t("ok.review"));
      rev.topic = "all";
      await loadReviews();
    } catch (err) {
      if (err.data && err.data.errors) showErrors(form, "r", err.data.errors);
      else { status.textContent = t("err.net"); status.className = "form__status err"; }
    } finally { btn.disabled = false; btn.textContent = t("form.send"); }
  });

  /* contact form */
  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, status = $("#contactStatus");
    const body = Object.fromEntries(new FormData(form).entries());
    const errors = {};
    if ((body.name || "").trim().length < 2) errors.name = 1;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) errors.email = 1;
    if ((body.message || "").trim().length < 10) errors.message = 1;
    showErrors(form, "c", errors);
    if (Object.keys(errors).length) return;
    const btn = $("button[type=submit]", form), label = $("span", btn);
    btn.disabled = true; label.textContent = t("form.sending");
    try {
      const r = await api("/api/contact", { method: "POST", body: JSON.stringify(body) });
      status.textContent = `${t("ok.contact")} ${r.ticket}`; status.className = "form__status ok";
      form.reset();
      if (hasGSAP && !reduceMotion) {
        gsap.timeline()
          .to(".contact__plane .ic", { x: isRTL() ? -260 : 260, y: -160, rotate: 20, opacity: 0, duration: .9, ease: "power2.in" })
          .set(".contact__plane .ic", { x: 0, y: 30, rotate: 0 })
          .to(".contact__plane .ic", { y: 0, opacity: 1, duration: .6, ease: "back.out(2)" });
      }
    } catch (err) {
      if (err.data && err.data.errors) showErrors(form, "c", err.data.errors);
      else { status.textContent = t("err.net"); status.className = "form__status err"; }
    } finally { btn.disabled = false; label.textContent = t("form.send"); }
  });
  $$(".field input, .field textarea").forEach((el) => el.addEventListener("input", () => {
    const f = el.closest(".field"); f.classList.remove("has-error"); el.removeAttribute("aria-invalid");
    const p = $(".field__err", f); if (p) p.textContent = "";
  }));

  /* ---------- copy plus code ---------- */
  $("#copyPlus").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("XXVC+5C El Aroui"); toast(t("access.copied")); }
    catch { toast("XXVC+5C"); }
  });

  /* ---------- mobile nav ---------- */
  const nav = $("#nav"), menuBtn = $("#menuBtn");
  menuBtn.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    $("use", menuBtn).setAttribute("href", open ? "#i-x" : "#i-menu");
  });
  $$("a[href^='#']").forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    nav.classList.remove("is-open"); menuBtn.setAttribute("aria-expanded", "false"); $("use", menuBtn).setAttribute("href", "#i-menu");
    scrollToEl(id);
  }));

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && hasGSAP && !reduceMotion) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToEl(sel) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (lenis) lenis.scrollTo(el, { offset: -8, duration: 1.4, easing: (x) => 1 - Math.pow(1 - x, 4) });
    else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ---------- header state + progress + active link ---------- */
  const header = $("#header");
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("is-solid", y > 40);
    header.classList.toggle("is-hidden", y > 400 && y > lastY && !nav.classList.contains("is-open"));
    lastY = y;
    const h = document.documentElement.scrollHeight - innerHeight;
    $("#scrollProgress").style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) $$(".nav a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["flights", "guide", "services", "access", "reviews", "contact"].forEach((id) => io.observe($("#" + id)));

  /* ---------- pointer effects: tilt cards, spotlight, magnetic buttons ---------- */
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reduceMotion && hasGSAP) {
    $$(".tilt").forEach((card) => {
      const rx = gsap.quickTo(card, "rotationX", { duration: .5, ease: "power3" });
      const ry = gsap.quickTo(card, "rotationY", { duration: .5, ease: "power3" });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
        rx((.5 - y) * 10); ry((x - .5) * 12);
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
    $$(".magnetic").forEach((btn) => {
      const mx = gsap.quickTo(btn, "x", { duration: .4, ease: "power3" });
      const my = gsap.quickTo(btn, "y", { duration: .4, ease: "power3" });
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * .25); my((e.clientY - r.top - r.height / 2) * .35);
      });
      btn.addEventListener("pointerleave", () => { mx(0); my(0); });
    });
    // Hero parallax on pointer
    const hero = $(".hero");
    const layers = [[".c1", 18], [".c2", 30], [".m-back", 8], [".sun", 12], [".sun-core", 12]];
    const qs = layers.map(([s, d]) => [gsap.quickTo(s, "x", { duration: 1, ease: "power3" }), gsap.quickTo(s, "y", { duration: 1, ease: "power3" }), d]);
    hero.addEventListener("pointermove", (e) => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      qs.forEach(([qx, qy, d]) => { qx(-x * d); qy(-y * d * .5); });
    });
  }

  /* ---------- guide: pinned horizontal scroll ---------- */
  let guideST;
  function setupGuide() {
    if (!hasGSAP) return;
    if (guideST) { guideST.scrollTrigger && guideST.scrollTrigger.kill(); guideST.kill(); gsap.set("#guideTrack", { x: 0 }); }
    if (reduceMotion) return;
    const track = $("#guideTrack");
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    guideST = gsap.timeline({
      scrollTrigger: { trigger: ".guide", start: "top top", end: () => "+=" + dist(), pin: ".guide__pin", scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    guideST.to(track, { x: () => (isRTL() ? dist() : -dist()), ease: "none" }, 0)
      .to("#guideBar", { scaleX: 1, ease: "none" }, 0);
    $$(".step", track).forEach((s) => {
      gsap.from($(".step__ic", s), {
        scale: .4, rotate: -30, opacity: 0, duration: .6, ease: "back.out(2)",
        scrollTrigger: { trigger: s, containerAnimation: guideST, start: isRTL() ? "right 95%" : "left 95%" },
      });
    });
  }

  /* ---------- scroll animations ---------- */
  function setupScroll() {
    if (!hasGSAP) return;
    if (reduceMotion) { $$(".reveal").forEach((el) => { el.style.visibility = "visible"; }); return; }

    // Reveal blocks
    $$(".reveal").forEach((el) => {
      gsap.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    // Section headings: word reveal
    $$(".section__head h2, .guide__head h2, .crowd__text h2, .access__info h2, .contact__text h2").forEach((h) => {
      gsap.from(h, { clipPath: "inset(0 0 100% 0)", y: 30, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 90%" } });
    });
    // Bento cards stagger
    ScrollTrigger.batch(".bento .card", {
      start: "top 90%",
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 60, rotateX: -12 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: .9, ease: "expo.out", stagger: .08, overwrite: true }),
    });
    gsap.set(".bento .card", { autoAlpha: 0 });

    // Hero: scroll-scrubbed plane along the motion path + layered parallax
    const heroTL = gsap.timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });
    heroTL.to(".m-front", { y: 80, ease: "none" }, 0)
      .to(".m-back", { y: 40, ease: "none" }, 0)
      .to(".c2", { xPercent: 8, ease: "none" }, 0)
      .to(".hero__content", { y: -80, opacity: 0, ease: "none" }, 0)
      .to(".stats", { y: -40, ease: "none" }, 0);

    // Crowd chart on enter
    ScrollTrigger.create({ trigger: "#crowdChart", start: "top 80%", once: true, onEnter: () => renderCrowd(true) });
    // Distances bars
    ScrollTrigger.create({ trigger: ".distances", start: "top 85%", once: true, onEnter: () => $$(".distances i").forEach((i) => i.style.setProperty("--p", 1)) });
    // Contact plane float
    gsap.to(".contact__plane", { y: -14, rotate: -4, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    // Footer giant text
    gsap.from(".footer__big", { yPercent: 40, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".footer", start: "top 85%" } });

    setupGuide();
  }

  /* ---------- counters ---------- */
  function runCounters() {
    $$("[data-count]").forEach((el) => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
      const fmt = (v) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en");
      if (!hasGSAP || reduceMotion) { el.textContent = fmt(end); return; }
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2, ease: "power3.out", onUpdate: () => { el.textContent = fmt(o.v); } });
    });
  }

  /* ---------- intro: loader + hero ---------- */
  function intro() {
    const loader = $("#loader");
    if (!hasGSAP || reduceMotion) { loader.remove(); runCounters(); return; }
    document.body.classList.add("is-loading");
    const dir = isRTL() ? -1 : 1;
    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    tl.to(".loader__runway span", { opacity: 1, duration: .12, stagger: .07 })
      .to(".loader__code", { color: "rgba(255,255,255,.18)", duration: .4 }, "<")
      .to(".loader__plane", { x: dir * innerWidth * .9, y: -innerHeight * .55, scale: 1.6, duration: 1.1, ease: "power3.in" }, "-=.2")
      .to(loader, { clipPath: "inset(0 0 100% 0)", duration: .8, ease: "expo.inOut" }, "-=.35")
      .add(() => { loader.remove(); document.body.classList.remove("is-loading"); })
      .from(".hero__title .w > span", { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: .07 }, "-=.45")
      .from(".hero__kicker, .hero__lead", { y: 24, opacity: 0, duration: .8, ease: "expo.out", stagger: .1 }, "-=.9")
      .from(".quick", { y: 30, opacity: 0, scale: .97, duration: .9, ease: "expo.out" }, "-=.7")
      .from(".hero__meta > *", { y: 20, opacity: 0, duration: .7, ease: "expo.out", stagger: .1 }, "-=.6")
      .from(".stat", { y: 30, opacity: 0, duration: .7, ease: "expo.out", stagger: .08, onStart: runCounters }, "-=.6")
      .from(".header__inner > *", { y: -20, opacity: 0, duration: .6, stagger: .08 }, "-=.9")
      .from(".mountains", { y: 120, duration: 1.4, ease: "expo.out", stagger: .1 }, 1.2)
      .from(".sun, .sun-core", { y: 200, duration: 2, ease: "expo.out" }, 1.2);

    // Plane flies along the S-curve path, then loops with a pause
    const planeTL = gsap.timeline({ repeat: -1, repeatDelay: 2, delay: 1.6 });
    planeTL.fromTo("#heroPlane",
      { opacity: 1 },
      { duration: 9, ease: "power1.inOut", motionPath: { path: "#flightPath", align: "#flightPath", alignOrigin: [.5, .5], autoRotate: 45 } })
      .fromTo(".contrail", { strokeDashoffset: 0 }, { strokeDashoffset: -400, duration: 9, ease: "none" }, 0);
    gsap.to(".runway-lights circle", { opacity: .2, duration: .5, stagger: { each: .12, repeat: -1, yoyo: true } });
    gsap.to(".c1", { x: "+=60", duration: 18, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(".stars circle", { opacity: .2, duration: 1.4, stagger: { each: .3, repeat: -1, yoyo: true } });
  }

  /* ---------- defs for half star (added once) ---------- */
  document.querySelector("svg defs").insertAdjacentHTML("beforeend",
    '<linearGradient id="halfStar"><stop offset="50%" stop-color="#F59E0B"/><stop offset="50%" stop-color="transparent"/></linearGradient>');

  /* ---------- boot ---------- */
  applyLang(lang, false);
  setupScroll();
  intro();
  loadBoard(true);
  loadCrowd(false);
  loadReviews();
  window.addEventListener("load", () => hasGSAP && ScrollTrigger.refresh());
})();
