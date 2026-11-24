'use strict';
/* ===== elhassan home — نظام إدارة فواتير الجملة وتشغيل الورشة ===== */

const LS_KEY = 'elhassan_system_v1';

const DEFAULT_SETTINGS = {
  name: 'elhassan home – بيت الحسن للديكور المنزلي',
  address: 'الجيزة - البدرشين - الطرفاية أمام الوحدة الصحية',
  phones: '01125384436 / 01063886389',
  website: 'elhassan.store'
};

const DEFAULT_CATALOG = [
  { code: 'DON-01', name: 'دوناتس سادة',      pieces: 3, price: 85  },
  { code: 'DON-02', name: 'دوناتس ورق دهب',   pieces: 3, price: 100 },
  { code: 'DON-03', name: 'دوناتس منقرش',     pieces: 3, price: 95  },
  { code: 'ROY-01', name: 'طقم ملكي',         pieces: 4, price: 150 },
  { code: 'THK-01', name: 'طقم مفكر',         pieces: 3, price: 110 },
  { code: 'PMP-01', name: 'طقم يقطينة',       pieces: 3, price: 90  },
  { code: 'BRD-01', name: 'عروسة وفازة',      pieces: 2, price: 120 },
  { code: 'INC-01', name: 'مبخرة وسكرية',     pieces: 2, price: 80  },
  { code: 'VAS-01', name: 'فازات مودرن',      pieces: 3, price: 105 }
];

const STATUSES = ['جديد', 'في الصب', 'في التأسيس والدهان', 'جاهز للتغليف', 'تم الشحن'];
const FINISHES = ['سادة', 'تشبيح ورق دهب', 'منقرش', 'لون خاص حسب الطلب'];

/* ===== الحالة والتخزين ===== */
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.settings && s.catalog && s.invoices) return s;
    }
  } catch (e) { /* corrupted storage -> reseed */ }
  return {
    settings: { ...DEFAULT_SETTINGS },
    catalog: DEFAULT_CATALOG.map(c => ({ ...c })),
    invoices: [],
    counter: 1
  };
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

/* ===== أدوات مساعدة ===== */
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('en-EG') + ' ج';
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
};

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ===== التنقل ===== */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    $('section-' + btn.dataset.section).classList.add('active');
    $('mainNav').classList.remove('open');
    if (btn.dataset.section === 'dashboard') renderDashboard();
    if (btn.dataset.section === 'invoices') renderInvoices();
    if (btn.dataset.section === 'catalog') renderCatalog();
    if (btn.dataset.section === 'settings') renderSettings();
    if (btn.dataset.section === 'new-invoice') resetInvoiceForm();
  });
});
$('menuToggle').addEventListener('click', () => $('mainNav').classList.toggle('open'));

/* ===== حسابات الفاتورة ===== */
function invSubtotal(inv) { return inv.items.reduce((s, it) => s + it.qty * it.price, 0); }
function invTotal(inv) { return invSubtotal(inv) - num(inv.discount) + num(inv.shippingCost); }
function invRemaining(inv) { return invTotal(inv) - num(inv.deposit); }
function invSets(inv) { return inv.items.reduce((s, it) => s + it.qty, 0); }
function findInvoice(number) { return state.invoices.find(i => i.number === number); }

/* ===== لوحة التحكم ===== */
function renderDashboard() {
  const invs = state.invoices;
  const totalSales = invs.reduce((s, i) => s + invTotal(i), 0);
  const totalDeposits = invs.reduce((s, i) => s + num(i.deposit), 0);
  const totalRemaining = invs.reduce((s, i) => s + Math.max(invRemaining(i), 0), 0);
  const running = invs.filter(i => i.status !== 'تم الشحن');
  const runningSets = running.reduce((s, i) => s + invSets(i), 0);

  $('statsGrid').innerHTML = [
    ['إجمالي المبيعات', fmt(totalSales)],
    ['إجمالي العربون المحصّل', fmt(totalDeposits)],
    ['المتبقي تحت التحصيل', fmt(totalRemaining)],
    ['أوردرات قيد التشغيل', running.length + ' <small>أوردر</small>'],
    ['إجمالي الأطقم المطلوبة للورشة', runningSets + ' <small>طقم</small>']
  ].map(([l, v]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('');

  const tb = document.querySelector('#dashOrdersTable tbody');
  $('dashEmpty').style.display = running.length ? 'none' : 'block';
  tb.innerHTML = running.map(inv => `
    <tr>
      <td><b>${esc(inv.number)}</b></td>
      <td>${esc(inv.customer.name)}</td>
      <td>${esc(inv.customer.gov)}</td>
      <td>${invSets(inv)}</td>
      <td>${fmt(invTotal(inv))}</td>
      <td>${fmt(Math.max(invRemaining(inv), 0))}</td>
      <td>${statusSelect(inv)}</td>
    </tr>`).join('');
}

function statusSelect(inv) {
  return `<select class="status-select" data-inv="${esc(inv.number)}">` +
    STATUSES.map((s, i) => `<option value="${i}" ${inv.status === s ? 'selected' : ''}>${s}</option>`).join('') +
    `</select>`;
}

document.addEventListener('change', e => {
  if (e.target.classList.contains('status-select')) {
    const inv = findInvoice(e.target.dataset.inv);
    if (!inv) return;
    inv.status = STATUSES[+e.target.value];
    save();
    toast('تم تحديث حالة ' + inv.number + ' إلى «' + inv.status + '»');
    renderDashboard();
    renderInvoices();
  }
});

/* ===== فاتورة جديدة ===== */
let draftItems = [];

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  return 'EH-' + year + '-' + String(state.counter).padStart(3, '0');
}

function resetInvoiceForm() {
  editingNumber = null;
  $('saveInvoiceBtn').textContent = 'حفظ الفاتورة';
  draftItems = [];
  $('invNumber').value = nextInvoiceNumber();
  $('invDate').value = todayISO();
  $('custName').value = ''; $('custMobile').value = ''; $('custGov').value = '';
  $('custRep').value = ''; $('custShipping').selectedIndex = 0;
  $('invDiscount').value = 0; $('invShippingCost').value = 0; $('invDeposit').value = 0;
  $('postSaveCard').classList.add('hidden');
  $('saveInvoiceBtn').disabled = false;
  addItemRow();
  renderDraftItems();
  renderTotals();
}

function addItemRow() {
  draftItems.push({ code: '', qty: 1, finish: '', finishNote: '', price: 0 });
}

function inferFinish(catalogName) {
  if (!catalogName) return '';
  if (catalogName.includes('ورق دهب')) return 'تشبيح ورق دهب';
  if (catalogName.includes('منقرش')) return 'منقرش';
  if (catalogName.includes('سادة')) return 'سادة';
  return '';
}

function renderDraftItems() {
  const wrap = $('itemsList');
  wrap.innerHTML = draftItems.map((it, idx) => {
    const catOpts = ['<option value="">— اختر الصنف —</option>']
      .concat(state.catalog.map(c =>
        `<option value="${esc(c.code)}" ${it.code === c.code ? 'selected' : ''}>${esc(c.code)} — ${esc(c.name)}</option>`)).join('');
    const finOpts = `<option value="" ${it.finish === '' ? 'selected' : ''} disabled>— اختر التشطيب —</option>` +
      FINISHES.map(f => `<option ${it.finish === f ? 'selected' : ''}>${f}</option>`).join('');
    const noteField = it.finish === 'لون خاص حسب الطلب'
      ? `<input type="text" class="finish-note-field" data-idx="${idx}" data-field="finishNote" placeholder="ملاحظة اللون المطلوب…" value="${esc(it.finishNote)}">` : '';
    const lineTotal = it.qty * it.price;
    return `<div class="item-row">
      <div class="item-row-grid">
        <label>الصنف
          <select data-idx="${idx}" data-field="code">${catOpts}</select>
        </label>
        <label>الكمية (أطقم)
          <input type="number" min="1" step="1" data-idx="${idx}" data-field="qty" value="${it.qty}">
        </label>
        <label>سعر الطقم (ج)
          <input type="number" min="0" step="any" data-idx="${idx}" data-field="price" value="${it.price}">
        </label>
        <label>التشطيب
          <select data-idx="${idx}" data-field="finish">${finOpts}</select>
        </label>
        <div class="row-total">${fmt(lineTotal)}</div>
        <button class="btn btn-danger btn-sm" data-remove="${idx}" title="حذف البند">✕</button>
        ${noteField}
      </div>
    </div>`;
  }).join('');
  renderTotals();
}

$('itemsList').addEventListener('input', e => {
  const idx = +e.target.dataset.idx;
  const field = e.target.dataset.field;
  if (isNaN(idx) || !field) return;
  if (field === 'code') {
    draftItems[idx].code = e.target.value;
    const c = state.catalog.find(x => x.code === e.target.value);
    if (c) {
      draftItems[idx].price = c.price;
      const inferred = inferFinish(c.name);
      if (inferred) draftItems[idx].finish = inferred;
    }
    renderDraftItems();
  } else if (field === 'qty') {
    draftItems[idx].qty = Math.max(1, Math.round(num(e.target.value)));
    renderTotals();
    updateRowTotal(e.target, idx);
  } else if (field === 'price') {
    draftItems[idx].price = num(e.target.value);
    renderTotals();
    updateRowTotal(e.target, idx);
  } else if (field === 'finish') {
    draftItems[idx].finish = e.target.value;
    renderDraftItems();
  } else if (field === 'finishNote') {
    draftItems[idx].finishNote = e.target.value;
  }
});
$('itemsList').addEventListener('click', e => {
  const rm = e.target.dataset.remove;
  if (rm !== undefined) {
    draftItems.splice(+rm, 1);
    if (!draftItems.length) addItemRow();
    renderDraftItems();
  }
});
function updateRowTotal(input, idx) {
  const row = input.closest('.item-row');
  const t = row && row.querySelector('.row-total');
  if (t) t.textContent = fmt(draftItems[idx].qty * draftItems[idx].price);
}

$('addItemBtn').addEventListener('click', () => { addItemRow(); renderDraftItems(); });

function currentDraftTotals() {
  const subtotal = draftItems.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.max(0, num($('invDiscount').value));
  const shipping = Math.max(0, num($('invShippingCost').value));
  const deposit = Math.max(0, num($('invDeposit').value));
  return { subtotal, discount, shipping, deposit, total: subtotal - discount + shipping, remaining: subtotal - discount + shipping - deposit };
}
function renderTotals() {
  const t = currentDraftTotals();
  $('totalsSummary').innerHTML = `
    <div class="t-row"><span>إجمالي البنود</span><span>${fmt(t.subtotal)}</span></div>
    <div class="t-row"><span>الخصم</span><span>− ${fmt(t.discount)}</span></div>
    <div class="t-row"><span>الشحن</span><span>+ ${fmt(t.shipping)}</span></div>
    <div class="t-row grand"><span>الإجمالي</span><span>${fmt(t.total)}</span></div>
    <div class="t-row"><span>العربون المدفوع</span><span>− ${fmt(t.deposit)}</span></div>
    <div class="t-row remaining"><span>صافي المتبقي قبل الشحن</span><span>${fmt(t.remaining)}</span></div>`;
}
['invDiscount', 'invShippingCost', 'invDeposit'].forEach(id => $(id).addEventListener('input', renderTotals));

let lastSavedNumber = null;
let editingNumber = null;

function loadInvoiceForEdit(inv) {
  editingNumber = inv.number;
  $('invNumber').value = inv.number;
  $('invDate').value = inv.date || todayISO();
  $('custName').value = inv.customer.name || '';
  $('custMobile').value = inv.customer.mobile || '';
  $('custGov').value = inv.customer.gov || '';
  $('custRep').value = inv.customer.rep || '';
  $('custShipping').value = inv.customer.shipping || 'موقف ميكروباص';
  $('invDiscount').value = num(inv.discount);
  $('invShippingCost').value = num(inv.shippingCost);
  $('invDeposit').value = num(inv.deposit);
  draftItems = inv.items.map(it => ({ code: it.code, qty: it.qty, finish: it.finish, finishNote: it.finishNote || '', price: it.price }));
  if (!draftItems.length) addItemRow();
  $('postSaveCard').classList.add('hidden');
  $('saveInvoiceBtn').disabled = false;
  $('saveInvoiceBtn').textContent = 'حفظ التعديلات';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-section="new-invoice"]').classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  $('section-new-invoice').classList.add('active');
  renderDraftItems();
  renderTotals();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('تعديل الفاتورة ' + inv.number);
}

$('saveInvoiceBtn').addEventListener('click', () => {
  const name = $('custName').value.trim();
  if (!name) { toast('اكتب اسم العميل / المعرض أولاً', true); $('custName').focus(); return; }
  const items = draftItems.filter(it => it.code && it.qty > 0);
  if (!items.length) { toast('أضف بنداً واحداً على الأقل باختيار الصنف', true); return; }
  if (items.some(it => !it.finish)) { toast('اختر التشطيب لكل بند في الفاتورة', true); return; }

  const t = currentDraftTotals();
  if (t.deposit > t.total) { toast('العربون أكبر من إجمالي الفاتورة — راجع الأرقام', true); $('invDeposit').focus(); return; }
  if (t.discount > t.subtotal) { toast('الخصم أكبر من إجمالي البنود — راجع الأرقام', true); $('invDiscount').focus(); return; }
  const inv = {
    number: $('invNumber').value,
    date: $('invDate').value || todayISO(),
    customer: {
      name,
      mobile: $('custMobile').value.trim(),
      gov: $('custGov').value.trim(),
      rep: $('custRep').value.trim(),
      shipping: $('custShipping').value
    },
    items: items.map(it => {
      const c = state.catalog.find(x => x.code === it.code) || { name: it.code, pieces: 1 };
      return { code: it.code, name: c.name, pieces: c.pieces, mold: c.mold || '', qty: it.qty, price: it.price, finish: it.finish, finishNote: it.finishNote };
    }),
    discount: t.discount, shippingCost: t.shipping, deposit: t.deposit,
    status: STATUSES[0],
    createdAt: new Date().toISOString()
  };
  if (editingNumber) {
    const old = findInvoice(editingNumber);
    inv.number = editingNumber;
    inv.status = old ? old.status : inv.status;
    inv.createdAt = old ? old.createdAt : inv.createdAt;
    state.invoices = state.invoices.map(i => i.number === editingNumber ? inv : i);
    toast('تم حفظ تعديلات الفاتورة ' + inv.number);
  } else {
    state.invoices.push(inv);
    state.counter++;
    toast('تم حفظ الفاتورة ' + inv.number);
  }
  save();
  lastSavedNumber = inv.number;
  editingNumber = null;
  $('saveInvoiceBtn').textContent = 'حفظ الفاتورة';
  $('savedInvNum').textContent = inv.number;
  $('postSaveCard').classList.remove('hidden');
  $('saveInvoiceBtn').disabled = true;
  $('postSaveCard').scrollIntoView({ behavior: 'smooth' });
});

$('newInvoiceBtn').addEventListener('click', resetInvoiceForm);
$('printClientBtn').addEventListener('click', () => printClientInvoice(findInvoice(lastSavedNumber)));
$('printWorkshopBtn').addEventListener('click', () => printWorkshopSheet(findInvoice(lastSavedNumber)));
$('copyClientBtn').addEventListener('click', () => copyText(clientSummaryText(findInvoice(lastSavedNumber)), 'تم نسخ ملخص الفاتورة'));
$('copyWorkshopBtn').addEventListener('click', () => copyText(workshopSummaryText(findInvoice(lastSavedNumber)), 'تم نسخ أمر التشغيل'));

/* ===== سجل الفواتير ===== */
function renderInvoices() {
  const q = ($('invSearch').value || '').trim();
  const st = $('invStatusFilter').value;
  const tb = document.querySelector('#invoicesTable tbody');
  const list = state.invoices.slice().reverse().filter(inv => {
    if (st !== '' && inv.status !== STATUSES[+st]) return false;
    if (!q) return true;
    return inv.customer.name.includes(q) || (inv.customer.mobile || '').includes(q) || (inv.customer.gov || '').includes(q);
  });
  $('invEmpty').style.display = list.length ? 'none' : 'block';
  tb.innerHTML = list.map(inv => `
    <tr>
      <td><b>${esc(inv.number)}</b></td>
      <td>${fmtDate(inv.date)}</td>
      <td>${esc(inv.customer.name)}</td>
      <td>${esc(inv.customer.mobile)}</td>
      <td>${esc(inv.customer.gov)}</td>
      <td>${fmt(invTotal(inv))}</td>
      <td>${fmt(num(inv.deposit))}</td>
      <td>${fmt(Math.max(invRemaining(inv), 0))}</td>
      <td>${statusSelect(inv)}</td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-act="edit" data-inv="${esc(inv.number)}">تعديل</button>
        <button class="btn btn-gold btn-sm" data-act="print-client" data-inv="${esc(inv.number)}">فاتورة</button>
        <button class="btn btn-gold btn-sm" data-act="print-workshop" data-inv="${esc(inv.number)}">ورشة</button>
        <button class="btn btn-outline btn-sm" data-act="copy-client" data-inv="${esc(inv.number)}">واتساب</button>
        <button class="btn btn-danger btn-sm" data-act="delete" data-inv="${esc(inv.number)}">حذف</button>
      </div></td>
    </tr>`).join('');
}
$('invSearch').addEventListener('input', renderInvoices);
$('invStatusFilter').addEventListener('change', renderInvoices);

document.querySelector('#invoicesTable tbody').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const inv = findInvoice(btn.dataset.inv);
  if (!inv) return;
  if (btn.dataset.act === 'edit') loadInvoiceForEdit(inv);
  if (btn.dataset.act === 'print-client') printClientInvoice(inv);
  if (btn.dataset.act === 'print-workshop') printWorkshopSheet(inv);
  if (btn.dataset.act === 'copy-client') copyText(clientSummaryText(inv), 'تم نسخ ملخص الفاتورة');
  if (btn.dataset.act === 'delete') {
    if (confirm('حذف الفاتورة ' + inv.number + ' نهائياً؟')) {
      state.invoices = state.invoices.filter(i => i.number !== inv.number);
      save(); renderInvoices(); toast('تم حذف ' + inv.number);
    }
  }
});

/* ===== الكتالوج ===== */
let editingCatCode = null;

function renderCatalog() {
  const tb = document.querySelector('#catalogTable tbody');
  tb.innerHTML = state.catalog.map(c => `
    <tr>
      <td><b>${esc(c.code)}</b></td>
      <td>${esc(c.name)}</td>
      <td>${c.pieces}</td>
      <td>${fmt(c.price)}</td>
      <td>${esc(c.mold || '—')}</td>
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" data-cat-edit="${esc(c.code)}">تعديل</button>
        <button class="btn btn-danger btn-sm" data-cat-del="${esc(c.code)}">حذف</button>
      </div></td>
    </tr>`).join('');
}
function clearCatalogForm() {
  editingCatCode = null;
  $('catalogFormTitle').textContent = 'إضافة صنف جديد';
  $('catCode').value = ''; $('catCode').disabled = false;
  $('catName').value = ''; $('catPieces').value = 3; $('catPrice').value = 0;
  $('catMold').value = '';
  $('cancelEditCatBtn').classList.add('hidden');
}
$('saveCatalogBtn').addEventListener('click', () => {
  const code = $('catCode').value.trim().toUpperCase();
  const name = $('catName').value.trim();
  const pieces = Math.max(1, Math.round(num($('catPieces').value)));
  const price = num($('catPrice').value);
  const mold = $('catMold').value.trim();
  if (!code || !name) { toast('أدخل كود الصنف واسمه', true); return; }
  if (editingCatCode) {
    const c = state.catalog.find(x => x.code === editingCatCode);
    if (c) { c.name = name; c.pieces = pieces; c.price = price; c.mold = mold; }
    toast('تم تعديل الصنف ' + editingCatCode);
  } else {
    if (state.catalog.some(x => x.code === code)) { toast('الكود ' + code + ' موجود بالفعل', true); return; }
    state.catalog.push({ code, name, pieces, price, mold });
    toast('تمت إضافة الصنف ' + code);
  }
  save(); renderCatalog(); clearCatalogForm();
});
$('cancelEditCatBtn').addEventListener('click', clearCatalogForm);
document.querySelector('#catalogTable tbody').addEventListener('click', e => {
  const edit = e.target.dataset.catEdit, del = e.target.dataset.catDel;
  if (edit) {
    const c = state.catalog.find(x => x.code === edit);
    if (!c) return;
    editingCatCode = c.code;
    $('catalogFormTitle').textContent = 'تعديل الصنف ' + c.code;
    $('catCode').value = c.code; $('catCode').disabled = true;
    $('catName').value = c.name; $('catPieces').value = c.pieces; $('catPrice').value = c.price;
    $('catMold').value = c.mold || '';
    $('cancelEditCatBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (del && confirm('حذف الصنف ' + del + ' من الكتالوج؟')) {
    state.catalog = state.catalog.filter(x => x.code !== del);
    save(); renderCatalog(); toast('تم حذف الصنف ' + del);
  }
});

/* ===== الإعدادات والنسخ الاحتياطي ===== */
function renderSettings() {
  $('setName').value = state.settings.name;
  $('setAddress').value = state.settings.address;
  $('setPhones').value = state.settings.phones;
  $('setWebsite').value = state.settings.website;
}
$('saveSettingsBtn').addEventListener('click', () => {
  state.settings = {
    name: $('setName').value.trim() || DEFAULT_SETTINGS.name,
    address: $('setAddress').value.trim(),
    phones: $('setPhones').value.trim(),
    website: $('setWebsite').value.trim()
  };
  save(); applyBranding(); toast('تم حفظ بيانات المصنع');
});
function applyBranding() {
  const parts = state.settings.name.split('–');
  $('brandName').textContent = (parts[0] || state.settings.name).trim();
  $('brandSub').textContent = (parts[1] || '').trim() || 'بيت الحسن للديكور المنزلي';
  document.title = state.settings.name;
}

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'elhassan-backup-' + todayISO() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('تم تصدير النسخة الاحتياطية');
});
$('importFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!s || !s.settings || !Array.isArray(s.catalog) || !Array.isArray(s.invoices)) throw new Error('bad');
      state = s;
      if (typeof state.counter !== 'number') state.counter = state.invoices.length + 1;
      save(); applyBranding(); renderDashboard(); renderInvoices(); renderCatalog(); renderSettings(); resetInvoiceForm();
      toast('تم استيراد النسخة الاحتياطية بنجاح');
    } catch (err) {
      toast('ملف غير صالح — تأكد من ملف النسخة الاحتياطية', true);
    }
  };
  r.readAsText(f);
  e.target.value = '';
});

/* ===== الطباعة ===== */
function printHeader(title, inv) {
  return `<div class="p-sheet">
    <div class="p-header">
      <div>
        <div class="p-name">${esc(state.settings.name)}</div>
        <div class="p-sub">${esc(state.settings.address)}</div>
        <div class="p-sub">تليفون: ${esc(state.settings.phones)} — ${esc(state.settings.website)}</div>
      </div>
      <div class="p-meta">
        <div><b>رقم:</b> ${esc(inv.number)}</div>
        <div><b>التاريخ:</b> ${fmtDate(inv.date)}</div>
      </div>
    </div>
    <div class="p-title">${title}</div>`;
}
function printFooter() {
  return `<div class="p-footer">${esc(state.settings.name)} — ${esc(state.settings.phones)} — ${esc(state.settings.website)}</div></div>`;
}

function printClientInvoice(inv) {
  if (!inv) return;
  const rows = inv.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.code)} — ${esc(it.name)}${it.finishNote ? ' (' + esc(it.finishNote) + ')' : ''}</td>
      <td>${esc(it.finish)}</td>
      <td>${it.qty}</td>
      <td>${fmt(it.price)}</td>
      <td>${fmt(it.qty * it.price)}</td>
    </tr>`).join('');
  $('printRoot').innerHTML = printHeader('فاتورة جملة', inv) + `
    <div class="p-info">
      <div><b>العميل / المعرض:</b> ${esc(inv.customer.name)}</div>
      <div><b>الموبايل:</b> ${esc(inv.customer.mobile) || '—'}</div>
      <div><b>المحافظة:</b> ${esc(inv.customer.gov) || '—'}</div>
      <div><b>مسؤول المبيعات:</b> ${esc(inv.customer.rep) || '—'}</div>
      <div><b>طريقة الشحن:</b> ${esc(inv.customer.shipping)}</div>
      <div><b>الحالة:</b> ${esc(inv.status)}</div>
    </div>
    <table class="p-table">
      <thead><tr><th>م</th><th>الصنف</th><th>التشطيب</th><th>الكمية</th><th>سعر الطقم</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="p-totals">
      <div class="p-t-row"><span>إجمالي البنود:</span><span>${fmt(invSubtotal(inv))}</span></div>
      <div class="p-t-row"><span>الخصم:</span><span>− ${fmt(num(inv.discount))}</span></div>
      <div class="p-t-row"><span>الشحن:</span><span>+ ${fmt(num(inv.shippingCost))}</span></div>
      <div class="p-t-row p-grand"><span>الإجمالي:</span><span>${fmt(invTotal(inv))}</span></div>
      <div class="p-t-row"><span>العربون المدفوع:</span><span>− ${fmt(num(inv.deposit))}</span></div>
      <div class="p-t-row p-grand"><span>صافي المتبقي قبل الشحن:</span><span>${fmt(Math.max(invRemaining(inv), 0))}</span></div>
    </div>
    <div class="p-term">شرط الدفع: عربون قبل التنفيذ وباقي الحساب عند الجاهزية وقبل الشحن</div>
  ` + printFooter();
  window.print();
}

function printWorkshopSheet(inv) {
  if (!inv) return;
  const rows = inv.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.code)}</td>
      <td>${esc(it.name)}${it.mold ? '<div style="font-size:.78rem;color:#333">قوالب: ' + esc(it.mold) + '</div>' : ''}</td>
      <td>${it.qty}</td>
      <td>${it.pieces}</td>
      <td><b>${it.qty * it.pieces}</b></td>
      <td>${esc(it.finish)}${it.finishNote ? ' — ' + esc(it.finishNote) : ''}</td>
    </tr>`).join('');
  const totalSets = invSets(inv);
  const totalPieces = inv.items.reduce((s, it) => s + it.qty * it.pieces, 0);
  const finishGroups = {};
  inv.items.forEach(it => {
    const k = it.finish + (it.finishNote ? ' (' + it.finishNote + ')' : '');
    finishGroups[k] = (finishGroups[k] || 0) + it.qty;
  });
  const finishLines = Object.entries(finishGroups).map(([k, v]) => `<li>${esc(k)}: ${v} طقم</li>`).join('');
  $('printRoot').innerHTML = printHeader('ورقة تشغيل الورشة والدهان', inv) + `
    <div class="p-info">
      <div><b>العميل / المعرض:</b> ${esc(inv.customer.name)}</div>
      <div><b>المحافظة:</b> ${esc(inv.customer.gov) || '—'}</div>
      <div><b>طريقة الشحن:</b> ${esc(inv.customer.shipping)}</div>
      <div><b>إجمالي الأطقم:</b> ${totalSets} طقم</div>
    </div>
    <div class="p-notes"><h4>ملاحظة الصب</h4><ul><li>«إجمالي القطع للصب» = عدد الأطقم × عدد القطع في الطقم المسجّل في بطاقة الصنف، وتفاصيل القوالب تظهر فقط كما هي مسجّلة في الكتالوج — كلاهما قابل للتعديل من قسم «أصناف الكتالوج».</li></ul></div>
    <table class="p-table">
      <thead><tr><th>م</th><th>القالب / الكود</th><th>الصنف</th><th>الأطقم</th><th>قطع/طقم</th><th>إجمالي القطع للصب</th><th>التشطيب</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="p-notes">
      <h4>تقسيمة الألوان والتشطيبات (إجمالي القطع للصب: ${totalPieces} قطعة)</h4>
      <ul>${finishLines}</ul>
    </div>
    <div class="p-notes">
      <h4>ملاحظات الدهان</h4>
      <ul>
        <li>دهانات Start و GLC حسب تقسيمة الألوان أعلاه.</li>
        <li>التأسيس بالفيلر ثم الورنيش بعد جفاف الدهان.</li>
        <li>ورق الدهب (تشبيح) يُركّب بعد التأسيس وقبل الورنيش النهائي.</li>
      </ul>
    </div>
    <div class="p-notes">
      <h4>ملاحظات التغليف</h4>
      <ul>
        <li>تغليف كل قطعة بالبابل راب.</li>
        <li>الترصيص في كراتين مع فواصل حماية.</li>
      </ul>
    </div>
  ` + printFooter();
  window.print();
}

/* ===== نصوص الواتساب ===== */
function clientSummaryText(inv) {
  if (!inv) return '';
  const lines = inv.items.map(it =>
    `• ${it.name} (${it.code}) — ${it.qty} طقم × ${fmt(it.price)} — ${it.finish}${it.finishNote ? ' — ' + it.finishNote : ''} = ${fmt(it.qty * it.price)}`);
  return `فاتورة جملة ${inv.number}
${state.settings.name}
التاريخ: ${fmtDate(inv.date)}
العميل: ${inv.customer.name}
المحافظة: ${inv.customer.gov || '—'} — موبايل: ${inv.customer.mobile || '—'}
طريقة الشحن: ${inv.customer.shipping}
مسؤول المبيعات: ${inv.customer.rep || '—'}
──────────
${lines.join('\n')}
──────────
إجمالي البنود: ${fmt(invSubtotal(inv))}
الخصم: ${fmt(num(inv.discount))} — الشحن: ${fmt(num(inv.shippingCost))}
الإجمالي: ${fmt(invTotal(inv))}
العربون المدفوع: ${fmt(num(inv.deposit))}
صافي المتبقي قبل الشحن: ${fmt(Math.max(invRemaining(inv), 0))}
شرط الدفع: عربون قبل التنفيذ وباقي الحساب عند الجاهزية وقبل الشحن`;
}

function workshopSummaryText(inv) {
  if (!inv) return '';
  const lines = inv.items.map(it =>
    `• ${it.name} (${it.code}): ${it.qty} طقم × ${it.pieces} قطعة = ${it.qty * it.pieces} قطعة للصب — ${it.finish}${it.finishNote ? ' — ' + it.finishNote : ''}`);
  const totalPieces = inv.items.reduce((s, it) => s + it.qty * it.pieces, 0);
  return `أمر تشغيل ورشة — فاتورة ${inv.number}
التاريخ: ${fmtDate(inv.date)}
العميل: ${inv.customer.name} — ${inv.customer.gov || '—'}
──────────
${lines.join('\n')}
──────────
إجمالي الأطقم: ${invSets(inv)} — إجمالي القطع للصب: ${totalPieces}
دهانات Start و GLC حسب التقسيمة — التأسيس بالفيلر ثم الورنيش
التغليف: بابل راب + كراتين`;
}

function copyText(text, okMsg) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(okMsg), () => fallbackCopy(text, okMsg));
  } else fallbackCopy(text, okMsg);
}
function fallbackCopy(text, okMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast(okMsg); }
  catch (e) { toast('تعذّر النسخ — انسخ يدوياً', true); }
  document.body.removeChild(ta);
}

/* ===== تهيئة ===== */
(function init() {
  const stFilter = $('invStatusFilter');
  STATUSES.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = s;
    stFilter.appendChild(o);
  });
  applyBranding();
  renderDashboard();
  resetInvoiceForm();
})();
