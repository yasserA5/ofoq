import { supabase } from "./supabase-init.js";

const { data: authData } = await supabase.auth.getUser();

if (!authData?.user) {
  location.href = "./login-page.html";
}
const currentUser = authData.user;
// ... rest of your code here

const SECTIONS = [
  { key:"research", title:"أبحاث محكمة", kind:"content" },
  { key:"articles", title:"مقالات محكمة", kind:"content" },
  { key:"files", title:"ملفات بحثية", kind:"content" },
  { key:"articles-foreign", title:"مقالات أجنبية", kind:"content" },
  { key:"general-articles", title:"مقالات", kind:"content" },
  { key:"editions", title:"إصداراتنا", kind:"edition" },
  { key:"activities", title:"أنشطتنا", kind:"content" },
  { key:"special-politics", title:"تخصص علوم سياسية", kind:"content" },
  { key:"special-ir", title:"تخصص العلاقات الدولية", kind:"content" },
  { key:"special-admin-law", title:"تخصص القانون الإداري", kind:"content" },
  { key:"special-const-law", title:"تخصص القانون الدستوري", kind:"content" },
  { key:"special-public-policy", title:"تخصص السياسات العمومية", kind:"content" },
  { key:"live", title:"بث مباشر", kind:"live" }
];

const state = {
  bySection: Object.fromEntries(SECTIONS.map(s => [s.key, []])),
  currentSectionKey: "editions",
  editing: { key: null, id: null }
};

function el(id){ return document.getElementById(id); }
function setStatus(msg){ el("status").textContent = msg || ""; }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.floor(Math.random() * 99999); }
function esc(s){ return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function safeParse(v, fallback=[]){ try { const x = JSON.parse(v); return Array.isArray(x) ? x : fallback; } catch { return fallback; } }
function getByLang(field, lang="ar"){ if (!field) return ""; if (typeof field === "string") return field; return field[lang] || field.ar || field.fr || field.en || ""; }
function getContentCache(){ return safeParse(localStorage.getItem("contentcache"), []); }
function setContentCache(items){ localStorage.setItem("contentcache", JSON.stringify(items)); }
function sectionTitle(key){ return SECTIONS.find(s => s.key === key)?.title || "لوحة التحكم"; }
function getSectionConfig(key){ return SECTIONS.find(s => s.key === key); }
function getNextEditionNumber(){
  const nums = state.bySection.editions.map(x => Number(x.editionNumber || x.issueNumber || 0)).filter(Boolean);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function normalizeItem(sectionKey, raw){
  const id = String(raw.docId || raw.id || uid());
  return {
    id,
    docId: id,
    section: sectionKey || raw.section || "research",
    type: raw.type || "item",
    title: typeof raw.title === "object" ? raw.title : { ar: raw.title || "", fr:"", en:"" },
    short: typeof raw.short === "object" ? raw.short : { ar: raw.short || "", fr:"", en:"" },
    full: typeof raw.full === "object" ? raw.full : { ar: raw.full || "", fr:"", en:"" },
    details: typeof raw.details === "object" ? raw.details : { ar: raw.details || "", fr:"", en:"" },
    author: typeof raw.author === "object" ? raw.author : { ar: raw.author || "", fr:"", en:"" },
    affiliation: typeof raw.affiliation === "object" ? raw.affiliation : { ar: raw.affiliation || "", fr:"", en:"" },
    date: typeof raw.date === "object" ? raw.date : { ar: raw.date || "", fr:"", en:"" },
   image: raw.image || "",
imagePath: raw.imagePath || "",
file: raw.file || raw.link || "",
filePath: raw.filePath || "",
fullIssueFile: raw.fullIssueFile || "",
fullIssueFilePath: raw.fullIssueFilePath || "",
issueNumber: Number(raw.issueNumber || raw.editionNumber || 0),
    editionNumber: Number(raw.editionNumber || raw.issueNumber || 0),
    articles: Array.isArray(raw.articles) ? raw.articles : [],
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || raw.createdAt || Date.now()),
    status: raw.status || "published"
  
};
}

function rebuildDbFromCache(){
  const all = getContentCache().map(item => normalizeItem(item.section, item)).filter(item => SECTIONS.some(s => s.key === item.section));
  SECTIONS.forEach(s => {
    state.bySection[s.key] = all.filter(item => item.section === s.key).sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  });
}

function buildMenu(){
  const menu = el("menu");
  menu.innerHTML = "";
  SECTIONS.forEach(sec => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.key = sec.key;
    b.innerHTML = `<span>${esc(sec.title)}</span><i class="ri-arrow-left-s-line"></i>`;
    b.addEventListener("click", () => showSection(sec.key));
    menu.appendChild(b);
  });
}

function setActiveMenu(key){
  document.querySelectorAll("#menu button").forEach(btn => btn.classList.toggle("active", btn.dataset.key === key));
}

function buildEditionForm(key){
  return `
    <div class="card">
      <h3>إضافة عدد جديد</h3>
      <div class="grid-2">
        <div>
          <div class="row"><label>رقم العدد</label><input type="text" id="${key}-number-ar" /></div>
          <div class="row"><label>عنوان العدد</label><input type="text" id="${key}-title-ar" /></div>
          <div class="row"><label>وصف العدد</label><textarea id="${key}-short-ar"></textarea></div>
          <div class="row"><label>صورة الغلاف</label><input type="file" id="${key}-image" accept="image/*" /></div>
          <div class="row"><label>PDF العدد كامل</label><input type="file" id="${key}-full-pdf-file" accept="application/pdf" /></div>
        </div>
        <div><div class="preview" id="${key}-preview"></div></div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>مقالات العدد</h3>
        <div id="${key}-articles-wrap"></div>
        <div class="actions">
          <button class="btn btn-ghost btn-small" type="button" onclick="addEditionArticleRow('${key}')">إضافة مقال</button>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">حفظ العدد</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">مسح</button>
      </div>
    </div>
  `;
}

function buildLiveForm(key){
  return `
    <div class="card">
      <h3>إضافة بث مباشر</h3>
      <div class="row"><label>العنوان</label><input type="text" id="${key}-title-ar" /></div>
      <div class="row"><label>الوصف</label><textarea id="${key}-short-ar"></textarea></div>
      <div class="row"><label>الرابط</label><input type="url" id="${key}-live-link" /></div>
      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">حفظ</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">مسح</button>
      </div>
      <div class="preview" id="${key}-preview"></div>
    </div>
  `;
}

function buildContentForm(key, title){
  return `
    <div class="card">
      <h3>إضافة إلى ${esc(title)}</h3>
      <div class="grid-2">
        <div>
          <div class="row"><label>العنوان</label><input type="text" id="${key}-title-ar" /></div>
          <div class="row"><label>المؤلف</label><input type="text" id="${key}-author-ar" /></div>
          <div class="row"><label>المؤسسة</label><input type="text" id="${key}-aff-ar" /></div>
          <div class="row"><label>التاريخ</label><input type="text" id="${key}-date-ar" /></div>
          <div class="row"><label>ملخص مختصر</label><textarea id="${key}-short-ar"></textarea></div>
          <div class="row"><label>النص الكامل</label><div class="editor" id="${key}-full-ar-editor" contenteditable="true"></div></div>
          <div class="row"><label>تفاصيل إضافية</label><textarea id="${key}-details-ar"></textarea></div>
        </div>
        <div>
          <div class="row"><label>PDF</label><input type="file" id="${key}-pdf-file" accept="application/pdf" /></div>
          <div class="row"><label>صورة</label><input type="file" id="${key}-image" accept="image/*" /></div>
          <div class="preview" id="${key}-preview"></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">حفظ</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">مسح</button>
      </div>
    </div>
  `;
}

function buildFormHTML(key){
  const cfg = getSectionConfig(key);
  if (!cfg) return `<div class="card"><div class="empty">القسم غير موجود</div></div>`;
  if (cfg.kind === "edition") return buildEditionForm(key);
  if (cfg.kind === "live") return buildLiveForm(key);
  return buildContentForm(key, cfg.title);
}

function buildListHTML(key){
  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between;margin-bottom:10px">
        <div>العناصر <span id="${key}-count">0</span></div>
        <input type="search" id="${key}-search" placeholder="ابحث..." style="max-width:240px" />
      </div>
      <div class="list" id="${key}-list"></div>
    </div>
  `;
}

function buildPreviewHTML(imageUrl="", pdfUrl=""){
  let out = "";
  if (pdfUrl) out += `<div style="margin-bottom:6px">PDF: <a href="${pdfUrl}" target="_blank" style="color:#7dd3fc">فتح الملف</a></div>`;
  if (imageUrl) out += `<div><img src="${imageUrl}" alt="preview"></div>`;
  return out;
}

function bindPreviewInputs(key){
  const imgInput = el(`${key}-image`);
  const pdfInput = el(`${key}-pdf-file`);
  const preview = el(`${key}-preview`);
  if (!preview) return;

  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file = imgInput.files?.[0];
      if (!file) return;
      preview.innerHTML = buildPreviewHTML(URL.createObjectURL(file), "");
    });
  }

  if (pdfInput) {
    pdfInput.addEventListener("change", () => {
      const file = pdfInput.files?.[0];
      preview.innerHTML = file ? `<div>PDF: ${esc(file.name)}</div>` : "";
    });
  }
}

function showSection(key){
  try {
    state.currentSectionKey = key;
    state.editing = { key: null, id: null };
    setActiveMenu(key);
    el("sectionTitle").textContent = sectionTitle(key);
    el("content").innerHTML = buildFormHTML(key) + buildListHTML(key);

    const searchInput = el(`${key}-search`);
    if (searchInput) searchInput.addEventListener("input", () => renderList(key));

    bindPreviewInputs(key);

    if (key === "editions") {
      const numInput = el(`${key}-number-ar`);
      const titleInput = el(`${key}-title-ar`);
      if (numInput) numInput.value = getNextEditionNumber();
      if (titleInput) titleInput.value = `العدد ${getNextEditionNumber()}`;
      addEditionArticleRow(key);
    }

    renderList(key);
  } catch (err) {
    console.error(err);
    setStatus(`خطأ في عرض القسم: ${err.message}`);
  }
}

async function uploadPdfToStorage(file, sectionKey, itemId){
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `pdfs/${sectionKey}/${itemId}-${safeName}`;

  const { error } = await supabase.storage
    .from('site-files')
    .upload(filePath, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('site-files')
    .getPublicUrl(filePath);

  return { url: data.publicUrl, path: filePath };
}

async function uploadImageToStorage(file, sectionKey, itemId){
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `images/${sectionKey}/${itemId}-${safeName}`;

  const { error } = await supabase.storage
    .from('site-files')
    .upload(filePath, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('site-files')
    .getPublicUrl(filePath);

  return { url: data.publicUrl, path: filePath };
}
function addEditionArticleRow(key, article = {}) {
  const wrap = el(`${key}-articles-wrap`);
  if (!wrap) return;

  const row = document.createElement("div");
  row.className = "card edition-article-row";
  row.style.marginTop = "10px";
  row.dataset.rowId = uid();
  row.dataset.file = article.file || "";

  const count = wrap.children.length + 1;

  row.innerHTML = `
    <h4 style="margin-bottom:8px">المقال رقم ${count}</h4>
    <div class="row">
      <label>عنوان المقال</label>
      <input type="text" class="edition-article-title" placeholder="عنوان المقال..." value="${esc(article.title || "")}" />
    </div>
    <div class="row">
      <label>وصف المقال</label>
      <textarea class="edition-article-description" placeholder="وصف مختصر للمقال...">${esc(article.description || "")}</textarea>
    </div>
    <div class="row">
      <label>PDF المقال</label>
      <input type="file" class="edition-article-file" accept="application/pdf" />
      ${article.file ? `<div class="hint" style="margin-top:6px"><a href="${article.file}" target="_blank">فتح الملف الحالي</a></div>` : ""}
    </div>
    <div class="actions">
      <button class="btn btn-red btn-small" type="button" onclick="this.closest('.edition-article-row').remove()">
        <i class="ri-delete-bin-line"></i>حذف هذا المقال
      </button>
    </div>
  `;

  wrap.appendChild(row);
}
async function collectEditionArticles(key, issueId) {
const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) {
  alert("Please sign in first");
  setStatus("You are not signed in");
  return [];
}

  const wrap = el(`${key}-articles-wrap`);
  if (!wrap) return [];

  const rows = [...wrap.querySelectorAll(".edition-article-row")];
  const articles = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.querySelector(".edition-article-title")?.value.trim() || "";
    const description = row.querySelector(".edition-article-description")?.value.trim() || "";
    const fileInput = row.querySelector(".edition-article-file");

    let file = row.dataset.file || "";
    let filePath = row.dataset.filePath || "";

    if (!title) continue;

    if (fileInput?.files?.[0]) {
      const uploaded = await uploadPdfToStorage(fileInput.files[0], `${key}-articles`, `${issueId}-${i + 1}`);
      file = uploaded.url;
      filePath = uploaded.path;
    }

    articles.push({ title, description, file, filePath });
  }

  return articles;
}

function upsertLocal(sectionKey, obj){
  const all = getContentCache().map(item => normalizeItem(item.section, item));
  const normalized = normalizeItem(sectionKey, { ...obj, section: sectionKey });
  const filtered = all.filter(x => String(x.docId || x.id) !== String(normalized.docId || normalized.id));
  filtered.unshift(normalized);
  setContentCache(filtered);
  rebuildDbFromCache();
}

async function upsertSupabase(sectionKey, obj){
  const now = Date.now();
  const docIdValue = String(obj.docId || obj.id || uid());

  obj.id = docIdValue;
  obj.docId = docIdValue;
  obj.section = sectionKey;
  obj.updatedAt = now;
  if (!obj.createdAt) obj.createdAt = now;
  if (!obj.status) obj.status = "published";

  const { error } = await supabase
    .from('content')
    .upsert([obj], { onConflict: 'id' });

  if (error) throw error;

  return obj;
}

async function saveItem(key){
  const cfg = getSectionConfig(key);
  if (!cfg) return;

  try {
    const currentId = state.editing.key === key && state.editing.id ? state.editing.id : uid();
    const existing = state.bySection[key].find(x => String(x.id) === String(currentId));

    const obj = {
      id: currentId,
      docId: currentId,
      section: key,
      type: cfg.kind,
      title: { ar:"", fr:"", en:"" },
      short: { ar:"", fr:"", en:"" },
      full: { ar:"", fr:"", en:"" },
      details: { ar:"", fr:"", en:"" },
      author: { ar:"", fr:"", en:"" },
      affiliation: { ar:"", fr:"", en:"" },
      date: { ar:"", fr:"", en:"" },
      image: existing?.image || "",
      imagePath: existing?.imagePath || "",
      file: existing?.file || "",
      filePath: existing?.filePath || "",
      fullIssueFile: existing?.fullIssueFile || "",
fullIssueFilePath: existing?.fullIssueFilePath || "",
      editionNumber: existing?.editionNumber || 0,
      issueNumber: existing?.issueNumber || 0,
      articles: existing?.articles || []
    };

    if (cfg.kind === "edition") {
      obj.type = "edition";
      obj.issueNumber = Number(el(`${key}-number-ar`)?.value.trim()) || getNextEditionNumber();
      obj.editionNumber = obj.issueNumber;
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || `العدد ${obj.issueNumber}`;
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";

      const imgInput = el(`${key}-image`);
      if (imgInput?.files?.[0]) {
        const uploadedImage = await uploadImageToStorage(imgInput.files[0], key, currentId);
        obj.image = uploadedImage.url;
        obj.imagePath = uploadedImage.path;
      }
      const fullPdfInput = el(`${key}-full-pdf-file`);
if (fullPdfInput?.files?.[0]) {
  setStatus("جاري رفع PDF العدد الكامل...");
  const uploadedFullPdf = await uploadPdfToStorage(fullPdfInput.files[0], `${key}-full`, currentId);
  obj.fullIssueFile = uploadedFullPdf.url;
  obj.fullIssueFilePath = uploadedFullPdf.path;
}

      obj.articles = await collectEditionArticles(key, currentId);

const editionsData = JSON.parse(localStorage.getItem('contentcache') || '[]')
  .filter(item => item.section === 'editions')
  .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      const filtered = editionsData.filter(x => String(x.id) !== String(obj.id));
      filtered.unshift({
        id: obj.id,
        issueNumber: obj.issueNumber,
        number: obj.issueNumber,
        title: obj.title,
        short: obj.short,
        description: obj.short,
        image: obj.image || "",
        file: obj.file || "",
        articles: obj.articles || []
      });
      localStorage.setItem("editions", JSON.stringify(filtered));
    } else if (cfg.kind === "live") {
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || "";
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";
      obj.file = el(`${key}-live-link`)?.value.trim() || "";
    } else {
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || "";
      obj.author.ar = el(`${key}-author-ar`)?.value.trim() || "";
      obj.affiliation.ar = el(`${key}-aff-ar`)?.value.trim() || "";
      obj.date.ar = el(`${key}-date-ar`)?.value.trim() || "";
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";
      obj.full.ar = el(`${key}-full-ar-editor`)?.innerHTML?.trim() || "";
      obj.details.ar = el(`${key}-details-ar`)?.value.trim() || "";

      const pdfInput = el(`${key}-pdf-file`);
      if (pdfInput?.files?.[0]) {
const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) throw new Error("يجب تسجيل الدخول أولاً");
        const uploadedPdf = await uploadPdfToStorage(pdfInput.files[0], key, currentId);
        obj.file = uploadedPdf.url;
        obj.filePath = uploadedPdf.path;
      }

      const imgInput = el(`${key}-image`);
      if (imgInput?.files?.[0]) {
        const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) throw new Error("يجب تسجيل الدخول أولاً");
        const uploadedImage = await uploadImageToStorage(imgInput.files[0], key, currentId);
        obj.image = uploadedImage.url;
        obj.imagePath = uploadedImage.path;
      }
    }

    upsertLocal(key, obj);
await upsertSupabase(key, obj);
    resetForm(key);
    renderList(key);
    setStatus(`تم حفظ: ${obj.title.ar || "عنصر جديد"}`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || "حدث خطأ أثناء الحفظ");
    alert(err.message || "حدث خطأ أثناء الحفظ");
  }
}

function loadForEdit(key, id){
  const item = state.bySection[key].find(x => String(x.id) === String(id));
  if (!item) return;
  state.editing = { key, id };

  if (el(`${key}-title-ar`)) el(`${key}-title-ar`).value = getByLang(item.title, "ar");
  if (el(`${key}-author-ar`)) el(`${key}-author-ar`).value = getByLang(item.author, "ar");
  if (el(`${key}-aff-ar`)) el(`${key}-aff-ar`).value = getByLang(item.affiliation, "ar");
  if (el(`${key}-date-ar`)) el(`${key}-date-ar`).value = getByLang(item.date, "ar");
  if (el(`${key}-short-ar`)) el(`${key}-short-ar`).value = getByLang(item.short, "ar");
  if (el(`${key}-details-ar`)) el(`${key}-details-ar`).value = getByLang(item.details, "ar");
  if (el(`${key}-full-ar-editor`)) el(`${key}-full-ar-editor`).innerHTML = getByLang(item.full, "ar");
  if (el(`${key}-live-link`)) el(`${key}-live-link`).value = item.file || "";

  const p = el(`${key}-preview`);
if (p) {
  let previewHtml = buildPreviewHTML(item.image, item.file);

  if (key === "editions" && item.fullIssueFile) {
    previewHtml =
      `<div style="margin-bottom:6px">PDF العدد الكامل: <a href="${item.fullIssueFile}" target="_blank" style="color:#7dd3fc">فتح الملف</a></div>` +
      previewHtml;
  }

  p.innerHTML = previewHtml;
}
  if (key === "editions") {
    if (el(`${key}-number-ar`)) el(`${key}-number-ar`).value = item.issueNumber || item.editionNumber || "";
    if (el(`${key}-title-ar`)) el(`${key}-title-ar`).value = getByLang(item.title, "ar");
    if (el(`${key}-short-ar`)) el(`${key}-short-ar`).value = getByLang(item.short, "ar");
    const wrap = el(`${key}-articles-wrap`);
    if (wrap) wrap.innerHTML = "";
    (item.articles || []).forEach(article => addEditionArticleRow(key, article));
  }
}

async function deleteItemById(sectionKey, id){
  if (!confirm("هل تريد الحذف النهائي؟")) return;

  const target = state.bySection[sectionKey].find(x => String(x.docId || x.id) === String(id));

  const all = getContentCache().map(item => normalizeItem(item.section, item));
  const filtered = all.filter(x => String(x.docId || x.id) !== String(id));
  setContentCache(filtered);
  rebuildDbFromCache();
  renderList(sectionKey);

try {
  const { error } = await supabase
    .from("content")
    .delete()
    .eq("id", String(id));

  if (error) throw error;
} catch (e) {
  console.error("Supabase delete error:", e);
  alert("فشل حذف المستند من Supabase");
}

try { if (target?.imagePath) await supabase.storage.from('site-files').remove([target.imagePath]); } catch (e) { console.error(e); }
try { if (target?.filePath) await supabase.storage.from('site-files').remove([target.filePath]); } catch (e) { console.error(e); }
try { if (target?.fullIssueFilePath) await supabase.storage.from('site-files').remove([target.fullIssueFilePath]); } catch (e) { console.error(e); }

  if (Array.isArray(target?.articles)) {
    for (const article of target.articles) {
      try {
        if (article?.filePath) await supabase.storage.from('site-files').remove([article.filePath]);
      } catch (e) {
        console.error(e);
      }
    }
  }

  setStatus("تم الحذف");
}


function resetForm(key){
  state.editing = { key:null, id:null };
  ["title-ar","author-ar","aff-ar","date-ar","short-ar","details-ar","live-link"].forEach(name => {
    const node = el(`${key}-${name}`);
    if (node) node.value = "";
  });
  const editor = el(`${key}-full-ar-editor`);
  if (editor) editor.innerHTML = "";
  const img = el(`${key}-image`);
  if (img) img.value = "";
  const pdf = el(`${key}-pdf-file`);
  if (pdf) pdf.value = "";
  const fullPdf = el(`${key}-full-pdf-file`);
if (fullPdf) fullPdf.value = "";
  const preview = el(`${key}-preview`);
  if (preview) preview.innerHTML = "";

  if (key === "editions") {
    const numInput = el(`${key}-number-ar`);
    const titleInput = el(`${key}-title-ar`);
    const shortInput = el(`${key}-short-ar`);
    const wrap = el(`${key}-articles-wrap`);
    if (numInput) numInput.value = getNextEditionNumber();
    if (titleInput) titleInput.value = `العدد ${getNextEditionNumber()}`;
    if (shortInput) shortInput.value = "";
    if (wrap) {
      wrap.innerHTML = "";
      addEditionArticleRow(key);
    }
  }
}

function renderList(key){
  const list = el(`${key}-list`);
  const count = el(`${key}-count`);
  if (!list || !count) return;

  const q = el(`${key}-search`)?.value?.trim().toLowerCase() || "";
  const data = state.bySection[key].filter(item => {
    if (item.section !== key) return false;
    if (!q) return true;
    const t = getByLang(item.title, "ar").toLowerCase();
    const s = getByLang(item.short, "ar").toLowerCase();
    const d = getByLang(item.details, "ar").toLowerCase();
    return t.includes(q) || s.includes(q) || d.includes(q);
  });

  count.textContent = data.length;

  if (!data.length) {
list.innerHTML = `<div class="empty">لا توجد بيانات في هذا القسم حالياً.<br>أضف محتوى جديداً أو اضغط "تحميل Supabase".</div>`;
    return;
  }

  list.innerHTML = "";
  data.forEach(item => {
    const title = getByLang(item.title, "ar") || "بدون عنوان";
    const descBase = getByLang(item.short, "ar") || getByLang(item.details, "ar") || "";
    const desc = descBase.length > 120 ? descBase.slice(0, 120) + "..." : descBase;
    const author = getByLang(item.author, "ar") || "";
    const dateLabel = key === "editions" ? `العدد ${item.editionNumber || item.issueNumber || ""}` : (getByLang(item.date, "ar") || "");
    const imgHtml = item.image ? `<img src="${item.image}" alt="img" />` : `<img src="logo1222.jpeg" alt="logo" />`;
    const articlesHtml = key === "editions" && Array.isArray(item.articles) && item.articles.length
      ? `<div style="margin-top:8px">${item.articles.map(a => `<span style="display:inline-block;margin:4px;padding:5px 9px;border-radius:999px;background:rgba(56,189,248,.14);border:1px solid rgba(56,189,248,.25)">${esc(a.title || "مقال")}</span>`).join("")}</div>`
      : "";

    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `
      <div class="item-actions">
        <button class="mini" title="تعديل" onclick="loadForEdit('${key}','${item.id}')"><i class="ri-pencil-line"></i></button>
        <button class="mini" title="حذف" onclick="deleteItem('${key}','${item.docId || item.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
      ${imgHtml}
      <div class="item-body">
        <div class="item-title">${esc(title)}</div>
        <div class="item-desc">${esc(desc)}</div>
        <div class="item-meta"><span>${esc(author)}</span><span>${esc(dateLabel)}</span></div>
        ${articlesHtml}
      </div>
    `;
    list.appendChild(wrap);
  });
}

async function reloadFromSupabase(){
  try {
    setStatus("جاري تحميل البيانات من Supabase...");
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) throw error;

    const all = (data || []).map(raw => normalizeItem(raw.section, raw));
    setContentCache(all);
    rebuildDbFromCache();
    renderList(state.currentSectionKey);
    setStatus(`تم تحميل ${all.length} عنصر من Supabase`);
  } catch (e) {
    console.error(e);
    setStatus("فشل تحميل Supabase");
  }
}

async function recoverAllData(){
  setStatus("جاري المزامنة بين Supabase و Local...");
  let supabaseItems = [];
  let localItems = [];

  try {
    const { data, error } = await supabase.from("content").select("*");
    if (error) throw error;
    supabaseItems = (data || []).map(raw => normalizeItem(raw.section, raw));
  } catch (e) {
    console.error(e);
  }

  try {
    localItems = getContentCache().map(item => normalizeItem(item.section, item));
  } catch (e) {
    console.error(e);
  }

  const mergedMap = new Map();
  [...localItems, ...supabaseItems].forEach(item => {
    const id = String(item.docId || item.id || uid());
    const existing = mergedMap.get(id);
    if (!existing || Number(item.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
      mergedMap.set(id, item);
    }
  });

  const merged = Array.from(mergedMap.values());
  setContentCache(merged);
  rebuildDbFromCache();
  showSection(state.currentSectionKey);
  setStatus(`تمت المزامنة: ${merged.length} عنصر`);
}

function exportJSON(){
  const out = {};
  SECTIONS.forEach(s => out[s.key] = state.bySection[s.key]);
  const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-data-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearLocalStorageOnly(){
  if (!confirm("هل تريد مسح التخزين المحلي فقط؟")) return;
  localStorage.removeItem("contentcache");
  localStorage.removeItem("editions");
  SECTIONS.forEach(s => state.bySection[s.key] = []);
  showSection(state.currentSectionKey);
  setStatus("تم مسح localStorage");
}

async function init() {
  buildMenu();
  rebuildDbFromCache();
  showSection(state.currentSectionKey);
  await recoverAllData();

  el("reloadBtn").addEventListener("click", reloadFromSupabase);
  el("recoverBtn").addEventListener("click", recoverAllData);
  el("exportBtn").addEventListener("click", exportJSON);
  el("clearBtn").addEventListener("click", clearLocalStorageOnly);
  el("logoutBtn").addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    location.reload();
  });
}

window.addEditionArticleRow = addEditionArticleRow;
window.publishItem = saveItem;
window.resetForm = resetForm;
window.loadForEdit = loadForEdit;
window.deleteItem = deleteItemById;
window.showSection = showSection;

init();