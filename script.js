/* ==========================================================
   GameZone — script.js
   ----------------------------------------------------------
   UBAH BAGIAN PENGATURAN DI BAWAH INI SAJA.
   Kode di bawahnya mengatur pilihan paket, navigasi HP,
   form booking, pesan WhatsApp, dan QRIS otomatis.
   ========================================================== */
const PENGATURAN = {
  namaUsaha: 'GameZone',

  // Nomor WhatsApp admin. Boleh ditulis 0812... atau 62812...
  // WAJIB diisi supaya tombol "Kirim via WhatsApp" langsung ke nomormu.
  whatsapp: '',

  alamat: '',   // contoh: 'Jl. Melati No. 5, Tebet, Jakarta Selatan'
  jamBuka: '',  // contoh: 'Setiap hari 10.00–23.00'

  hargaPS: 10000,         // Rental PS4, per jam
  hargaPlaybook: 100000,  // Sewa Playbook, per 12 jam

  // QRIS statis dari aplikasi merchant (GoPay, DANA, OVO, bank, dll). Pilih salah satu:
  // 1) Simpan gambar QRIS-mu sebagai assets/images/qris.png (dibaca otomatis), ATAU
  // 2) Tempel kode teks QRIS (diawali 000201...) di qrisKode.
  qrisGambar: 'assets/images/qris.png',
  qrisKode: '',

  // true = nominal QRIS ditambah kode unik 1–99 (contoh Rp30.000 jadi Rp30.037)
  // supaya setiap pembayaran mudah dicocokkan dengan bookingnya.
  kodeUnik: false,

  daftarGame: ['FIFA', 'GTA', 'RDR2'],
};

/* ================== kode website (tidak perlu diubah) ================== */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  const C = PENGATURAN;
  const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  const JSQR_LIB = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- utilitas ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const nf = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');
  const rp = (n) => 'Rp' + nf(n);
  function rpShort(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return 'Rp' + String(+(n / 1e6).toFixed(1)).replace('.', ',') + 'jt';
    if (n >= 1000) return 'Rp' + String(+(n / 1000).toFixed(1)).replace('.', ',') + 'rb';
    return rp(n);
  }
  const isoDate = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const todayISO = () => isoDate(new Date());
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } },
  };
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = res;
        s.onerror = () => { delete scripts[src]; rej(new Error('Gagal memuat ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  /* nomor HP disimpan sebagai 62xxxxxxxxx */
  function normPhone(s) {
    let d = String(s || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = '62' + d.slice(1);
    else if (d.startsWith('8')) d = '62' + d;
    return d;
  }
  const validPhone = (d) => /^62\d{8,13}$/.test(d);
  function fmtPhone(d) {
    if (!d) return '';
    const x = d.startsWith('62') ? '0' + d.slice(2) : d;
    return x.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
  }
  const ADMIN_WA = normPhone(C.whatsapp);
  const waLink = (phone, text) => 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text);

  /* tanggal */
  const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fmtDay = (d) => DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()];
  const fmtTime = (d) => pad2(d.getHours()) + '.' + pad2(d.getMinutes());
  function nextSlot() {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    return { date: isoDate(d), time: pad2(d.getHours()) + ':00' };
  }

  /* ---------- paket ---------- */
  const ITEMS = {
    ps: { name: 'Rental PS4', mode: 'main di tempat', hours: 1, price: () => C.hargaPS },
    pb: { name: 'Sewa Playbook', mode: 'diantar', hours: 12, price: () => C.hargaPlaybook },
  };
  const LIMIT = { ps: [1, 24], pb: [1, 14] };
  const CHIPS = { ps: [[1, '1 jam'], [2, '2 jam'], [3, '3 jam'], [5, '5 jam']], pb: [[1, '12 jam'], [2, '24 jam'], [4, '2 hari'], [6, '3 hari']] };
  const qtyText = (item, qty) => (item === 'pb' ? qty * 12 : qty) + ' jam';
  const durLabel = (item, qty) => (item === 'pb' && qty > 1 ? qty * 12 + ' jam (' + qty + ' × 12 jam)' : qtyText(item, qty));
  const startOf = (b) => new Date((b.date || '') + 'T' + (b.time || '00:00'));
  const endOf = (b) => new Date(startOf(b).getTime() + ITEMS[b.item].hours * b.qty * 3600e3);
  function fmtSched(b) {
    const s = startOf(b), e = endOf(b);
    if (isNaN(s)) return '-';
    const same = s.toDateString() === e.toDateString();
    return fmtDay(s) + ' · ' + fmtTime(s) + '–' + (same ? fmtTime(e) : fmtDay(e) + ' ' + fmtTime(e));
  }
  function codePrefix() {
    const caps = String(C.namaUsaha || '').match(/[A-Z]/g);
    const p = caps && caps.length >= 2 ? caps.slice(0, 2).join('') : String(C.namaUsaha || 'GZ').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
    return p || 'GZ';
  }
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode() {
    const a = new Uint32Array(4);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < 4; i++) a[i] = Math.floor(Math.random() * 1e9);
    return codePrefix() + '-' + Array.from(a, (x) => ALPH[x % 32]).join('');
  }
  function uniqFor(code) { let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 1 + (h % 99); }

  /* ---------- QRIS: QRIS statis -> QRIS dengan nominal ---------- */
  const Q = {
    crc(str) {
      let c = 0xffff;
      for (let i = 0; i < str.length; i++) {
        c ^= (str.charCodeAt(i) & 0xff) << 8;
        for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
      }
      return c.toString(16).toUpperCase().padStart(4, '0');
    },
    parse(s) {
      const tags = []; let i = 0;
      while (i < s.length) {
        const id = s.substr(i, 2), ln = s.substr(i + 2, 2);
        if (!/^\d\d$/.test(id) || !/^\d\d$/.test(ln)) return null;
        const val = s.substr(i + 4, +ln);
        if (val.length !== +ln) return null;
        tags.push({ id, val }); i += 4 + +ln;
      }
      return tags;
    },
    clean: (raw) => String(raw || '').replace(/[\r\n\t]+/g, '').trim(),
    info(raw) {
      const s = Q.clean(raw);
      if (!s) return { ok: false, empty: true, err: 'QRIS belum diatur.' };
      const tags = Q.parse(s);
      if (!tags || !tags.length || tags[0].id !== '00') return { ok: false, err: 'Ini bukan kode QRIS (harus diawali 000201).' };
      const last = tags[tags.length - 1];
      if (last.id !== '63' || last.val.length !== 4) return { ok: false, err: 'Checksum QRIS tidak ditemukan. Pastikan kodenya lengkap.' };
      if (Q.crc(s.slice(0, -4)) !== last.val.toUpperCase()) return { ok: false, err: 'Checksum QRIS tidak cocok. Kodenya terpotong atau salah salin.' };
      const get = (id) => (tags.find((t) => t.id === id) || {}).val || '';
      const isQris = tags.some((t) => +t.id >= 26 && +t.id <= 51 && /QRIS/i.test(t.val)) || get('58') === 'ID';
      if (!isQris) return { ok: false, err: 'Kode ini bukan QRIS Indonesia.' };
      let nmid = '';
      const sub = Q.parse(get('51')) || [];
      sub.forEach((t) => { if (t.id === '02') nmid = t.val; });
      return { ok: true, merchant: get('59'), city: get('60'), nmid, hasAmount: !!get('54') };
    },
    withAmount(raw, amount) {
      const tags = (Q.parse(Q.clean(raw)) || []).filter((t) => t.id !== '63' && t.id !== '54');
      const t01 = tags.find((t) => t.id === '01');
      if (t01) t01.val = '12'; else tags.splice(1, 0, { id: '01', val: '12' });
      let at = tags.findIndex((t) => +t.id > 54);
      if (at < 0) at = tags.length;
      tags.splice(at, 0, { id: '54', val: String(Math.round(amount)) });
      const body = tags.map((t) => t.id + pad2(t.val.length) + t.val).join('') + '6304';
      return body + Q.crc(body);
    },
  };

  function loadImg(url) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  }
  function imageData(img, max) {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    return { data: x.getImageData(0, 0, w, h).data, w, h };
  }
  async function decodeQrImage(url) {
    let img;
    try { img = await loadImg(url); } catch (e) { return null; }
    if ('BarcodeDetector' in window) {
      try {
        const found = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(img);
        const hit = found.find((x) => /^000201/.test(x.rawValue)) || found[0];
        if (hit) return hit.rawValue;
      } catch (e) { /* lanjut ke jsQR */ }
    }
    await loadScript(JSQR_LIB);
    for (const max of [1600, 1100, 800, 560]) {
      const d = imageData(img, max);
      const r = window.jsQR(d.data, d.w, d.h, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) return r.data;
    }
    return null;
  }
  let qrisPromise = null;
  function getQris() {
    if (!qrisPromise) {
      qrisPromise = (async () => {
        if (Q.clean(C.qrisKode)) { const raw = Q.clean(C.qrisKode); return { raw, info: Q.info(raw), source: 'kode di script.js' }; }
        if (C.qrisGambar) {
          const raw = await decodeQrImage(C.qrisGambar);
          if (raw) return { raw: Q.clean(raw), info: Q.info(raw), source: C.qrisGambar };
          return { raw: '', info: { ok: false, empty: true, err: 'Gambar ' + C.qrisGambar + ' belum ada atau QR-nya tidak terbaca.' }, source: C.qrisGambar };
        }
        return { raw: '', info: { ok: false, empty: true, err: 'QRIS belum diatur.' }, source: '' };
      })().catch(() => ({ raw: '', info: { ok: false, err: 'QRIS tidak bisa dibaca di browser ini.' }, source: '' }));
    }
    return qrisPromise;
  }
  function qrCanvas(text, px) {
    return loadScript(QR_LIB).then(() => {
      const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
      const n = qr.getModuleCount(), quiet = 4, cell = Math.max(2, Math.floor(px / (n + quiet * 2))), dim = cell * (n + quiet * 2);
      const c = document.createElement('canvas'); c.width = c.height = dim;
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, dim, dim); x.fillStyle = '#000000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
      return c;
    });
  }
  async function qrisCardBlob(b, payload, merchant) {
    const qc = await qrCanvas(payload, 560);
    const W = 720, H = 1010, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.textAlign = 'center';
    x.fillStyle = '#0b0f10'; x.font = '800 44px ' + sans; x.fillText('QRIS', W / 2, 78);
    x.font = '600 28px ' + sans; x.fillText(String(merchant || C.namaUsaha).slice(0, 34), W / 2, 124);
    x.drawImage(qc, Math.round((W - qc.width) / 2), 150);
    const y = 150 + qc.width + 70;
    x.font = '800 56px ' + sans; x.fillText(rp(b.total), W / 2, y);
    x.fillStyle = '#4a5558'; x.font = '500 26px ' + sans;
    x.fillText('Kode booking ' + b.code + ' · ' + C.namaUsaha, W / 2, y + 48);
    x.fillText(ITEMS[b.item].name + ' · ' + durLabel(b.item, b.qty), W / 2, y + 88);
    return new Promise((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error('blob'))), 'image/png'));
  }

  /* ---------- pesan WhatsApp ---------- */
  function waMessage(b) {
    const s = startOf(b), e = endOf(b), same = s.toDateString() === e.toDateString();
    const d = (x) => pad2(x.getDate()) + '/' + pad2(x.getMonth() + 1) + '/' + x.getFullYear();
    const out = [
      'Halo ' + C.namaUsaha + ', saya mau booking.',
      '',
      'Kode: ' + b.code,
      'Paket: ' + ITEMS[b.item].name + ' (' + ITEMS[b.item].mode + ')',
      'Durasi: ' + durLabel(b.item, b.qty),
      'Jadwal: ' + DOW[s.getDay()] + ', ' + d(s) + ' ' + fmtTime(s) + ' s/d ' + (same ? fmtTime(e) : d(e) + ' ' + fmtTime(e)),
      'Nama: ' + b.name,
      'No. WA: ' + fmtPhone(b.phone),
    ];
    if (b.item === 'pb') out.push('Alamat: ' + b.address.replace(/\s*\n\s*/g, ', '));
    if (b.note) out.push('Catatan: ' + b.note.replace(/\s*\n\s*/g, ' '));
    out.push('Total: ' + rp(b.total) + (b.uniq ? ' (termasuk kode unik ' + b.uniq + ')' : ''));
    return out.join('\n');
  }

  /* ---------- isi halaman dari PENGATURAN ---------- */
  function applySettings() {
    const price = { ps: C.hargaPS, pb: C.hargaPlaybook };
    $$('[data-price]').forEach((el) => { el.textContent = rp(price[el.dataset.price]); });
    $$('[data-price-short]').forEach((el) => { el.textContent = rpShort(price[el.dataset.priceShort]); });
    $$('[data-num]').forEach((el) => { el.textContent = nf(price[el.dataset.num]); });
    $$('[data-calc]').forEach((el) => { const [k, n] = el.dataset.calc.split(':'); el.textContent = rp(price[k] * +n); });
    $$('[data-name]').forEach((el) => { el.textContent = C.namaUsaha; });
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    const name = String(C.namaUsaha || 'GameZone').trim();
    const m = name.match(/^(.+?)\s+(\S+)$/) || name.match(/^(.*[a-z])([A-Z][A-Za-z0-9]*)$/);
    $$('[data-wordmark]').forEach((el) => { el.innerHTML = m ? esc(m[1]) + '<i>' + esc(m[2]) + '</i>' : esc(name); });
    if (name !== 'GameZone') document.title = document.title.replace('GameZone', name);

    const games = (C.daftarGame || []).filter(Boolean);
    const g = $('#games');
    if (g) { g.hidden = !games.length; g.innerHTML = games.map((x) => '<span>' + esc(x) + '</span>').join('') + '<span class="more">dan lainnya</span>'; }

    const list = $('#contact-list');
    if (list) {
      let rows = '';
      if (ADMIN_WA) rows += '<li>' + svg('chat') + '<div><small>WhatsApp admin</small><b class="sel">' + esc(fmtPhone(ADMIN_WA)) + '</b></div><button class="btn btn-ghost btn-xs" type="button" data-copy="' + esc(fmtPhone(ADMIN_WA)) + '">Salin</button></li>';
      if (C.alamat) rows += '<li>' + svg('pin') + '<div><small>Alamat rental</small><b>' + esc(C.alamat) + '</b></div></li>';
      if (C.jamBuka) rows += '<li>' + svg('clock') + '<div><small>Jam buka</small><b>' + esc(C.jamBuka) + '</b></div></li>';
      list.innerHTML = rows; list.hidden = !rows;
    }
    const chat = $('#wa-chat');
    if (chat && ADMIN_WA) { chat.href = waLink(ADMIN_WA, 'Halo ' + C.namaUsaha + ', saya mau tanya jadwal rental.'); chat.hidden = false; }
  }
  const ICONS = {
    chat: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5 5 16a8.4 8.4 0 1 1 15.5-4.4z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18.5h1.5M18.5 14H20"/>',
  };
  const svg = (n) => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';

  /* ---------- navigasi HP ---------- */
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    menuBtn.innerHTML = svg(open ? 'x' : 'menu');
  }
  if (menuBtn) menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  if (menu) menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  /* ---------- animasi muncul + dock ---------- */
  function watch() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion()) { items.forEach((el) => el.classList.add('in')); }
    else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      items.forEach((el) => io.observe(el));
    }
    const dock = $('#dock');
    if (dock && 'IntersectionObserver' in window) {
      const seen = {};
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((en) => { seen[en.target.id] = en.isIntersecting; });
        dock.classList.toggle('off', !!(seen.booking || seen.kontak));
      }, { rootMargin: '0px 0px -30% 0px' });
      ['booking', 'kontak'].forEach((id) => { const el = document.getElementById(id); if (el) io2.observe(el); });
    }
  }

  /* ---------- form booking ---------- */
  const form = $('#booking-form');
  const me = store.get('gz-me') || {};
  const F = { item: 'ps', qty: 2, code: newCode() };
  const el = {
    date: $('#f-date'), time: $('#f-time'), name: $('#f-name'), phone: $('#f-phone'), address: $('#f-address'), note: $('#f-note'),
    out: $('#qty-out'), minus: $('#qty-minus'), plus: $('#qty-plus'), chips: $('#chips'), sum: $('#sum'), addr: $('#addr-wrap'), timeL: $('#f-time-l'), submit: $('#f-submit'),
  };

  function initForm() {
    if (!form) return;
    const slot = nextSlot();
    el.date.value = slot.date; el.date.min = todayISO(); el.time.value = slot.time;
    if (me.name) el.name.value = me.name;
    if (me.phone) el.phone.value = me.phone;
    if (me.address) el.address.value = me.address;
    refresh();

    form.addEventListener('change', (e) => { if (e.target.name === 'paket') setItem(e.target.dataset.item); });
    el.minus.addEventListener('click', () => setQty(F.qty - 1));
    el.plus.addEventListener('click', () => setQty(F.qty + 1));
    el.chips.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) setQty(+b.dataset.q); });
    [el.date, el.time].forEach((x) => x.addEventListener('input', () => { el.sum.innerHTML = sumHtml(); }));
    ['date', 'time', 'name', 'phone', 'address'].forEach((k) => el[k].addEventListener('input', () => setErr(el[k], '')));
    form.addEventListener('focusin', warmUp, { once: true });
    form.addEventListener('submit', onSubmit);
  }
  function setItem(k) {
    if (!ITEMS[k] || F.item === k) return;
    F.item = k; F.qty = k === 'pb' ? 1 : 2;
    const r = document.getElementById('item-' + k); if (r) r.checked = true;
    refresh();
  }
  function setQty(q) {
    const [mn, mx] = LIMIT[F.item];
    F.qty = Math.min(mx, Math.max(mn, q | 0));
    refresh();
    el.out.classList.remove('pop'); void el.out.offsetWidth; el.out.classList.add('pop');
  }
  function refresh() {
    ['ps', 'pb'].forEach((k) => { const c = document.getElementById('card-' + k); if (c) c.classList.toggle('on', F.item === k); });
    const [mn, mx] = LIMIT[F.item];
    el.out.textContent = qtyText(F.item, F.qty);
    el.minus.disabled = F.qty <= mn; el.plus.disabled = F.qty >= mx;
    el.chips.innerHTML = CHIPS[F.item].map(([q, l]) => '<button type="button" class="chip' + (F.qty === q ? ' on' : '') + '" data-q="' + q + '">' + l + '</button>').join('');
    el.addr.hidden = F.item !== 'pb';
    el.timeL.textContent = F.item === 'pb' ? 'Jam antar' : 'Jam mulai';
    el.sum.innerHTML = sumHtml();
  }
  function totals() {
    const unit = ITEMS[F.item].price(), amount = unit * F.qty, uniq = C.kodeUnik ? uniqFor(F.code) : 0;
    return { unit, amount, uniq, total: amount + uniq };
  }
  function sumHtml() {
    const t = totals(), b = { item: F.item, qty: F.qty, date: el.date.value, time: el.time.value }, e = endOf(b);
    let h = '<div class="sum-row"><span>' + (F.item === 'pb' ? qtyText('pb', F.qty) + ' (' + F.qty + ' × ' + rp(t.unit) + ')' : F.qty + ' jam × ' + rp(t.unit)) + '</span><span>' + rp(t.amount) + '</span></div>';
    if (t.uniq) h += '<div class="sum-row"><span>Kode unik QRIS</span><span>+' + t.uniq + '</span></div>';
    if (!isNaN(e)) h += '<div class="sum-row soft"><span>' + (F.item === 'pb' ? 'Dijemput kembali' : 'Selesai main') + '</span><span>' + fmtDay(e) + ' · ' + fmtTime(e) + '</span></div>';
    return h + '<div class="sum-total"><span>Total bayar</span><strong>' + rp(t.total) + '</strong></div>';
  }
  function setErr(input, msg) {
    const field = input.closest('.field'); if (!field) return;
    field.classList.toggle('bad', !!msg);
    let e = field.querySelector('.err');
    if (msg) {
      if (!e) { e = document.createElement('span'); e.className = 'err'; e.id = input.id + '-err'; field.appendChild(e); }
      e.textContent = msg; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', e.id);
    } else {
      if (e) e.remove();
      input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    }
  }
  function validate() {
    const bad = [];
    const add = (k, m) => { bad.push(el[k]); setErr(el[k], m); };
    ['date', 'time', 'name', 'phone', 'address'].forEach((k) => setErr(el[k], ''));
    if (!el.date.value) add('date', 'Pilih tanggal.');
    else if (el.date.value < todayISO()) add('date', 'Tanggal ini sudah lewat.');
    if (!el.time.value) add('time', 'Pilih jam.');
    else if (el.date.value === todayISO() && startOf({ date: el.date.value, time: el.time.value }).getTime() < Date.now() - 20 * 60e3) add('time', 'Jam ini sudah lewat. Pilih jam berikutnya.');
    if (el.name.value.trim().length < 2) add('name', 'Isi nama kamu.');
    if (!validPhone(normPhone(el.phone.value))) add('phone', 'Nomor WhatsApp belum benar. Contoh: 0812-3456-7890.');
    if (F.item === 'pb' && el.address.value.trim().length < 8) add('address', 'Tulis alamat lengkap untuk pengantaran.');
    if (bad.length) bad[0].focus();
    return !bad.length;
  }
  function warmUp() { loadScript(QR_LIB).catch(() => {}); getQris(); }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const t = totals();
    const b = {
      code: F.code, item: F.item, qty: F.qty, total: t.total, uniq: t.uniq,
      date: el.date.value, time: el.time.value, name: el.name.value.trim(), phone: normPhone(el.phone.value),
      address: F.item === 'pb' ? el.address.value.trim() : '', note: el.note.value.trim(),
    };
    $('#f-code').value = b.code;
    $('#f-durasi').value = durLabel(b.item, b.qty);
    $('#f-jadwal').value = fmtSched(b);
    $('#f-total').value = rp(b.total);
    const body = new URLSearchParams(new FormData(form)).toString();

    store.set('gz-last', b);
    store.set('gz-me', { name: b.name, phone: el.phone.value, address: el.address.value });
    showLast();
    openConfirm(b);

    el.submit.disabled = true;
    const saved = await sendToNetlify(body);
    el.submit.disabled = false;
    if (saved) {
      const n = $('#saved-note'); if (n) n.hidden = false;
    }
    F.code = newCode(); el.note.value = ''; el.sum.innerHTML = sumHtml();
  }
  /* Netlify Forms: booking tersimpan di dashboard Netlify (aktifkan dulu, lihat README) */
  async function sendToNetlify(body) {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      return res.ok;
    } catch (err) { return false; }
  }

  /* ---------- lembar konfirmasi ---------- */
  let layer = null, lastFocus = null, blobUrl = '';
  function openSheet(html, label) {
    closeSheet();
    lastFocus = document.activeElement;
    layer = document.createElement('div');
    layer.className = 'backdrop';
    layer.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '" tabindex="-1">' + html + '</div>';
    document.body.appendChild(layer);
    document.documentElement.classList.add('locked');
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-close]')) closeSheet(); });
    const sh = layer.querySelector('.sheet');
    requestAnimationFrame(() => sh.focus({ preventScroll: true }));
    return sh;
  }
  function closeSheet() {
    if (!layer) return;
    layer.remove(); layer = null;
    document.documentElement.classList.remove('locked');
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); setMenu(false); } });

  function openConfirm(b) {
    const closeBtn = '<button class="icon-btn" type="button" data-close aria-label="Tutup">' + svg('x') + '</button>';
    const sh = openSheet(
      '<div class="sh-head"><div><span class="eyebrow">Booking dibuat</span><h3 class="code-big">' + esc(b.code) + '</h3></div>' + closeBtn + '</div>' +
      '<p class="ok-note" id="saved-note" hidden>' + svg('check') + 'Booking sudah masuk ke sistem kami.</p>' +
      '<div class="recap"><div><span>' + ITEMS[b.item].name + '</span><b>' + durLabel(b.item, b.qty) + '</b></div><div><span>Jadwal</span><b>' + fmtSched(b) + '</b></div>' +
        (b.uniq ? '<div><span>Kode unik</span><b>+' + b.uniq + '</b></div>' : '') +
        '<div class="recap-total"><span>Total bayar</span><b>' + rp(b.total) + '</b></div></div>' +
      '<ol class="flow">' +
        '<li><span class="fl-n">1</span><div class="fl-b"><b>Kirim booking ke WhatsApp admin</b><p>Jadwalmu dicatat dari pesan ini.</p>' +
          '<a class="btn btn-primary btn-block" href="' + esc(waLink(ADMIN_WA, waMessage(b))) + '" target="_blank" rel="noopener">' + svg('chat') + 'Kirim via WhatsApp</a></div></li>' +
        '<li><span class="fl-n">2</span><div class="fl-b"><b>Bayar ' + rp(b.total) + ' lewat QRIS</b><div id="pay"><p class="hint">Menyiapkan QRIS…</p></div></div></li>' +
        '<li><span class="fl-n">3</span><div class="fl-b"><b>Kirim bukti bayar</b><p>Kirim screenshot bukti bayar di chat WhatsApp yang sama.</p></div></li>' +
      '</ol>',
      'Booking ' + b.code);
    fillPayment(sh, b);
  }
  async function fillPayment(sh, b) {
    const q = await getQris();
    const pay = sh.querySelector('#pay'); if (!pay || !sh.isConnected) return;
    if (!q.info.ok) { pay.innerHTML = '<p>Admin akan mengirim info pembayaran lewat WhatsApp.</p>'; return; }
    const payload = Q.withAmount(q.raw, b.total);
    pay.innerHTML =
      '<div class="qris"><div class="qris-box"><img id="qr-img" alt="QRIS pembayaran ' + rp(b.total) + '"><span class="qris-load">Membuat QR…</span></div>' +
      '<div class="qris-meta"><small>Dibayar ke</small><b>' + esc(q.info.merchant || C.namaUsaha) + '</b><span>Nominal ' + rp(b.total) + ' sudah terisi otomatis</span></div></div>' +
      '<a class="btn btn-ghost btn-block" id="qr-dl" href="#" download="QRIS-' + esc(b.code) + '.png" aria-disabled="true">' + svg('download') + 'Simpan gambar QRIS</a>' +
      '<p class="hint">Bayar dari HP ini: simpan gambar QR, lalu buka e-wallet atau m-banking, pilih Scan, lalu ambil gambar dari galeri.</p>';
    const dl = pay.querySelector('#qr-dl');
    dl.addEventListener('click', (e) => { if (dl.getAttribute('aria-disabled') === 'true') e.preventDefault(); });
    try {
      const c = await qrCanvas(payload, 480);
      const img = pay.querySelector('#qr-img');
      img.src = c.toDataURL('image/png'); img.parentElement.classList.add('ready');
      const blob = await qrisCardBlob(b, payload, q.info.merchant);
      if (!sh.isConnected) return;
      blobUrl = URL.createObjectURL(blob);
      dl.href = blobUrl; dl.removeAttribute('aria-disabled');
    } catch (err) {
      pay.innerHTML = '<p>QR belum bisa dimuat. Periksa koneksi, atau minta QRIS ke admin lewat WhatsApp.</p>';
    }
  }

  /* ---------- booking terakhir ---------- */
  function showLast() {
    const box = $('#last-booking'); if (!box) return;
    const b = store.get('gz-last');
    if (!b || !b.code || !ITEMS[b.item]) { box.innerHTML = ''; return; }
    const e = endOf(b);
    if (isNaN(e) || e.getTime() < Date.now() - 12 * 3600e3) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="last"><div>' + svg('qr') + '<span>Booking terakhirmu <b>' + esc(b.code) + '</b> · ' + rp(b.total) + '</span></div><button class="btn btn-ghost btn-sm" type="button" id="show-last">Lihat QRIS</button></div>';
    $('#show-last').addEventListener('click', () => openConfirm(b));
  }

  /* ---------- tombol "Sewa Sekarang" & salin nomor ---------- */
  document.addEventListener('click', (e) => {
    const book = e.target.closest('[data-book]');
    if (book) {
      setItem(book.dataset.book);
      document.getElementById('booking').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const done = () => { const o = copy.textContent; copy.textContent = 'Tersalin'; setTimeout(() => { copy.textContent = o; }, 1600); };
      const fallback = () => { const t = copy.parentElement.querySelector('.sel'); if (!t) return; const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(done, fallback); else fallback();
    }
  });

  /* ---------- cek QRIS untuk pemilik: buka situs dengan #cek-qris ---------- */
  async function qrisCheck() {
    const sh = openSheet('<div class="sh-head"><div><span class="eyebrow">Untuk pemilik</span><h3>Cek QRIS</h3></div><button class="icon-btn" type="button" data-close aria-label="Tutup">' + svg('x') + '</button></div><div id="cq"><p class="hint">Membaca QRIS…</p></div>', 'Cek QRIS');
    const q = await getQris();
    const box = sh.querySelector('#cq'); if (!box) return;
    if (!q.info.ok) {
      box.innerHTML = '<div class="recap"><div><span>Status</span><b>Belum siap</b></div><div><span>Sumber</span><b>' + esc(q.source || '-') + '</b></div></div><p class="hint" style="margin-top:12px">' + esc(q.info.err) + ' Simpan gambar QRIS statis sebagai assets/images/qris.png, atau tempel kodenya di qrisKode pada script.js, lalu deploy ulang.</p>';
      return;
    }
    box.innerHTML = '<div class="recap"><div><span>Status</span><b>QRIS terbaca</b></div><div><span>Merchant</span><b>' + esc(q.info.merchant) + '</b></div><div><span>Kota</span><b>' + esc(q.info.city || '-') + '</b></div>' + (q.info.nmid ? '<div><span>NMID</span><b>' + esc(q.info.nmid) + '</b></div>' : '') + '<div><span>Sumber</span><b>' + esc(q.source) + '</b></div></div>' +
      (q.info.hasAmount ? '<p class="hint" style="margin-top:10px">QRIS ini sudah berisi nominal. Sebaiknya pakai QRIS statis dari aplikasi merchant.</p>' : '') +
      '<div class="qris" style="margin-top:14px"><div class="qris-box"><img id="cq-img" alt="Contoh QRIS Rp1.000"></div><div class="qris-meta"><small>Contoh nominal</small><b>Rp1.000</b><span>Scan dari HP lain. Nominal Rp1.000 harus muncul otomatis di aplikasi pembayaran.</span></div></div>';
    try { const c = await qrCanvas(Q.withAmount(q.raw, 1000), 480); const im = box.querySelector('#cq-img'); im.src = c.toDataURL('image/png'); im.parentElement.classList.add('ready'); } catch (err) { /* abaikan */ }
  }
  function onHash() { if (location.hash === '#cek-qris') qrisCheck(); }
  window.addEventListener('hashchange', onHash);

  /* ---------- mulai ---------- */
  applySettings();
  initForm();
  showLast();
  watch();
  onHash();
})();
