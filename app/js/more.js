/* NUMMAZA 1.3 — интерфейс новых возможностей:
   кошелёк (счета, валюты, рассрочки), экспорт в Excel, PIN-код и отпечаток / Face ID,
   напоминания (Android — нативно, сайт — push), виджет Android, восстановление пароля по почте, семейный бюджет.
   Подключается к app.js через NZ.ext (см. core.js). Помощники интерфейса берём из NZ.app во время отрисовки. */
(function () {
  'use strict';
  const NZ = window.NZ;
  const EXT = NZ.ext;
  const app = () => NZ.app;
  const S = () => NZ.app.state;
  const t = (...a) => NZ.t(...a);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const M = (n, o) => NZ.money(n, o);
  const icon = (n, s) => NZ.app.icon(n, s);
  const nat = () => window.NummazaNative || null;
  const has = (fn) => { const n = nat(); return !!(n && typeof n[fn] === 'function'); };
  const num = (v) => parseInt(String(v || '').replace(/\D/g, ''), 10) || 0;
  const grp = (n) => String(n || '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const serverOn = () => !!(NZ.api && NZ.api.enabled() && S().account && S().account.server && S().session);
  const save = () => { NZ.save(S()); app().render(); };
  const sw = (on, action, label, v) => '<button type="button" role="switch" class="switch" aria-checked="' + !!on + '" aria-label="' + esc(label) + '" data-a="' + action + '"' + (v ? ' data-v="' + v + '"' : '') + '><i></i></button>';
  const ui = () => NZ.app.ui;

  /* ================= КОШЕЛЁК: счета и рассрочки ================= */
  const ACC_TYPES = ['card', 'cash', 'deposit', 'other'];
  function viewWallet() {
    const s = S();
    const td = NZ.today();
    const nw = NZ.netWorth(s);
    const ls = NZ.loansSummary(s, td);
    const r = NZ.rates;
    const accs = (s.accounts || []).map((a) => {
      const bal = NZ.accBalance(s, a);
      return '<li><button type="button" class="li li-btn" data-a="accOpen" data-v="' + a.id + '"><span class="acc-ic">' + esc(t('acc.ic.' + (a.type || 'other'))) + '</span><span class="grow"><b>' + esc(a.name) + '</b><span class="small muted block">' + esc(t('acc.type.' + (a.type || 'other'))) + (a.cur !== 'KZT' ? ' · ≈ ' + esc(M(NZ.toKZT(bal, a.cur))) : '') + '</span></span><b>' + esc(NZ.fmtCur(bal, a.cur)) + '</b></button></li>';
    }).join('');
    const loans = (s.loans || []).map((l) => ({ l, st: NZ.loanState(l, td) })).sort((a, b) => (a.st.done - b.st.done) || ((a.st.nextDue || '9') < (b.st.nextDue || '9') ? -1 : 1)).map(({ l, st }) =>
      '<li><button type="button" class="li li-btn loan" data-a="loanOpen" data-v="' + l.id + '"><span class="grow stack-6"><span class="row-between"><b>' + esc(l.name) + '</b><b>' + (st.done ? '<span class="pill pill-ok">' + esc(t('loan.done')) + '</span>' : M(l.monthly) + esc(t('loan.perMonth'))) + '</b></span>' +
      (st.done ? '' : '<span class="bar"><i style="width:' + st.pct + '%"></i></span><span class="small muted">' + esc(t('loan.left', st.remaining, M(st.leftSum))) + ' · ' + esc(t('loan.next', NZ.fmtDate(st.nextDue))) + '</span>') +
      '</span></button></li>').join('');
    return '<header class="page-head"><h1 class="h2">' + esc(t('wal.title')) + '</h1></header>' +
      '<section class="card card-ink stack-6" aria-labelledby="nw-h"><span id="nw-h" class="small teal-l">' + esc(t('wal.net')) + '</span><b class="h1">' + M(nw.net) + '</b><span class="small">' + esc(t('wal.netSub', M(nw.assets), M(nw.debt))) + '</span></section>' +
      '<section class="card stack-10" aria-labelledby="acc-h"><div class="row-between"><h2 id="acc-h" class="h3">' + esc(t('acc.title')) + '</h2><button type="button" class="btn btn-sm" data-a="accNew">' + esc(t('acc.add')) + '</button></div>' +
      (accs ? '<ul class="list">' + accs + '</ul>' : '<p class="muted small">' + esc(t('acc.empty')) + '</p>') +
      '<p class="small muted">' + esc(t('acc.rates', r.date ? NZ.fmtDate(r.date) : t('acc.ratesOld'), NZ.fmtCur(r.USD, 'KZT').replace(' ₸', ''), NZ.fmtCur(r.EUR, 'KZT').replace(' ₸', ''), String(r.RUB).replace('.', NZ.lang === 'en' ? '.' : ','))) + '</p></section>' +
      '<section class="card stack-10" aria-labelledby="loan-h"><div class="row-between"><h2 id="loan-h" class="h3">' + esc(t('loan.title')) + '</h2><button type="button" class="btn btn-sm" data-a="loanNew">' + esc(t('loan.add')) + '</button></div>' +
      (ls.count ? '<p class="small">' + esc(t('loan.sum', M(ls.monthly), M(ls.leftSum))) + '</p>' : '') +
      (loans ? '<ul class="list">' + loans + '</ul>' : '<p class="muted small">' + esc(t('loan.empty')) + '</p>') +
      '<p class="small muted">' + esc(t('loan.note')) + '</p></section>';
  }
  EXT.views.wallet = viewWallet;

  // Карточка на «Обзоре»
  EXT.homeCards.push(function () {
    const s = S();
    const ls = NZ.loansSummary(s, NZ.today());
    const accs = s.accounts || [];
    if (!ls.count && !accs.length) return '<section class="card stack-10" aria-labelledby="wal-h"><h2 id="wal-h" class="h3">' + esc(t('wal.title')) + '</h2><p class="muted small">' + esc(t('wal.emptyHome')) + '</p><a class="btn btn-sm" href="#wallet">' + esc(t('wal.open')) + '</a></section>';
    const nw = NZ.netWorth(s);
    return '<section class="card stack-10" aria-labelledby="wal-h"><div class="row-between"><h2 id="wal-h" class="h3">' + esc(t('wal.title')) + '</h2><a href="#wallet" class="link">' + esc(t('wal.open')) + '</a></div>' +
      (accs.length ? '<div class="row-between"><span class="muted">' + esc(t('wal.onAccounts')) + '</span><b>' + M(nw.assets) + '</b></div>' : '') +
      (ls.count ? '<div class="row-between"><span class="muted">' + esc(t('loan.title')) + '</span><b>' + M(ls.monthly) + esc(t('loan.perMonth')) + '</b></div>' +
        (ls.next ? '<p class="small muted">' + esc(t('loan.nextHome', ls.next.name, NZ.fmtDate(ls.next.date), M(ls.next.amount))) + '</p>' : '') : '') + '</section>';
  });

  // --- Счёт
  function sheetAcc() {
    const d = ui().sheetData;
    const a = d.id ? (S().accounts || []).find((x) => x.id === d.id) : null;
    const cur = d.cur || (a ? a.cur : 'KZT');
    const type = d.type || (a ? a.type : 'card');
    const bal = a ? NZ.accBalance(S(), a) : '';
    return [a ? a.name : t('acc.new'), '<form class="stack-14" data-form="acc">' +
      '<label class="field"><span>' + esc(t('acc.name')) + '</span><input id="acc-name" data-autofocus maxlength="40" value="' + esc(d.nameDraft != null ? d.nameDraft : a ? a.name : '') + '" placeholder="' + esc(t('acc.namePh')) + '" aria-invalid="' + !!d.err + '">' + (d.err ? '<span class="err">' + esc(d.err) + '</span>' : '') + '</label>' +
      '<div class="field"><span>' + esc(t('acc.typeL')) + '</span><div class="row-gap wrap">' + ACC_TYPES.map((k) => '<button type="button" class="chip-btn" data-a="accType" data-v="' + k + '" aria-pressed="' + (type === k) + '">' + esc(t('acc.type.' + k)) + '</button>').join('') + '</div></div>' +
      '<div class="field"><span>' + esc(t('acc.cur')) + '</span><div class="seg seg-full" role="group">' + NZ.CURRENCIES.map((c) => '<button type="button" data-a="accCur" data-v="' + c + '" aria-pressed="' + (cur === c) + '">' + c + ' ' + NZ.CUR_SIGN[c] + '</button>').join('') + '</div></div>' +
      '<label class="field"><span>' + esc(t('acc.balance', NZ.CUR_SIGN[cur])) + '</span><input id="acc-bal" inputmode="decimal" value="' + esc(d.balDraft != null ? d.balDraft : bal === '' ? '' : String(Math.round(bal * 100) / 100)) + '"><span class="hint">' + esc(cur === 'KZT' ? t('acc.balHint') : t('acc.balHintCur')) + '</span></label>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('c.save')) + '</button>' +
      (a ? '<button type="button" class="btn btn-danger-t" data-a="accDel" data-v="' + a.id + '">' + icon('trash', 18) + esc(t('acc.del')) + '</button>' : '') + '</form>'];
  }
  EXT.sheets.acc = sheetAcc;
  Object.assign(EXT.actions, {
    accNew() { app().openSheet('acc', {}); },
    accOpen(el) { app().openSheet('acc', { id: el.dataset.v }); },
    accType(el) { keepAccInputs(); ui().sheetData.type = el.dataset.v; app().renderSheet(); },
    accCur(el) { keepAccInputs(); ui().sheetData.cur = el.dataset.v; app().renderSheet(); },
    accDel(el) {
      const s = S(); const before = app().snapshot();
      s.accounts = s.accounts.filter((a) => a.id !== el.dataset.v);
      s.txs.forEach((x) => { if (x.acc === el.dataset.v) delete x.acc; });
      ui().sheet = null; save(); app().toast(t('acc.deleted'), app().restore(before));
    }
  });
  function keepAccInputs() {
    const n = document.getElementById('acc-name'); const b = document.getElementById('acc-bal');
    const d = ui().sheetData;
    if (n) d.nameDraft = n.value;
    if (b) d.balDraft = b.value; // лист перерисуется с этими значениями (см. sheetAcc)
  }
  EXT.forms.acc = function () {
    const s = S(); const d = ui().sheetData;
    const name = document.getElementById('acc-name').value.trim();
    if (!name) { d.err = t('acc.errName'); app().renderSheet(); return; }
    const bal = parseFloat(String(document.getElementById('acc-bal').value).replace(/\s/g, '').replace(',', '.')) || 0;
    const before = app().snapshot();
    let a = d.id ? s.accounts.find((x) => x.id === d.id) : null;
    const cur = d.cur || (a ? a.cur : 'KZT');
    const type = d.type || (a ? a.type : 'card');
    if (!a) { a = { id: NZ.uid(), createdAt: NZ.today() }; s.accounts.push(a); }
    // Остаток вводится «на сейчас»: операции до сегодняшнего дня в него уже входят
    Object.assign(a, { name, type, cur, balance: cur === 'KZT' ? bal - NZ.sum(s.txs.filter((x) => x.acc === a.id && x.date >= NZ.today()), (x) => x.amount) : bal, since: NZ.today() });
    if (cur !== 'KZT') s.txs.forEach((x) => { if (x.acc === a.id) delete x.acc; });
    ui().sheet = null; save(); app().toast(t('c.saved'), app().restore(before));
  };

  // --- Рассрочка / кредит
  function sheetLoan() {
    const d = ui().sheetData;
    const l = d.id ? (S().loans || []).find((x) => x.id === d.id) : null;
    const st = l ? NZ.loanState(l, NZ.today()) : null;
    const e = d.err || {};
    const kind = d.kind || (l ? l.kind : 'inst');
    const nextDef = l ? (st.nextDue || l.next) : NZ.addDays(NZ.today(), 10);
    return [l ? l.name : t('loan.new'), '<form class="stack-14" data-form="loan">' +
      '<div class="seg seg-full" role="group">' + ['inst', 'credit'].map((k) => '<button type="button" data-a="loanKind" data-v="' + k + '" aria-pressed="' + (kind === k) + '">' + esc(t('loan.kind.' + k)) + '</button>').join('') + '</div>' +
      '<label class="field"><span>' + esc(t('loan.name')) + '</span><input id="ln-name" data-autofocus maxlength="60" value="' + esc(l ? l.name : '') + '" placeholder="' + esc(t('loan.namePh')) + '" aria-invalid="' + !!e.name + '">' + (e.name ? '<span class="err">' + esc(e.name) + '</span>' : '') + '</label>' +
      '<label class="field"><span>' + esc(t('loan.bank')) + '</span><input id="ln-bank" maxlength="40" list="banks" value="' + esc(l ? l.bank || '' : 'Kaspi') + '"><datalist id="banks"><option value="Kaspi"><option value="Halyk"><option value="Freedom"><option value="Jusan"><option value="Home Credit"><option value="Forte"><option value="BCC"></datalist></label>' +
      '<div class="grid-2"><label class="field"><span>' + esc(t('loan.monthly')) + '</span><input id="ln-monthly" inputmode="numeric" value="' + esc(l ? grp(l.monthly) : '') + '" aria-invalid="' + !!e.monthly + '">' + (e.monthly ? '<span class="err">' + esc(e.monthly) + '</span>' : '') + '</label>' +
      '<label class="field"><span>' + esc(t('loan.count')) + '</span><input id="ln-left" inputmode="numeric" value="' + esc(l ? st.remaining : '') + '" placeholder="12" aria-invalid="' + !!e.left + '">' + (e.left ? '<span class="err">' + esc(e.left) + '</span>' : '') + '</label></div>' +
      '<label class="field"><span>' + esc(t('loan.nextDate')) + '</span><input id="ln-next" type="date" value="' + esc(nextDef) + '"></label>' +
      '<p class="small muted">' + esc(t('loan.hint')) + '</p>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('c.save')) + '</button>' +
      (l ? '<button type="button" class="btn btn-danger-t" data-a="loanDel" data-v="' + l.id + '">' + icon('trash', 18) + esc(t('loan.del')) + '</button>' : '') + '</form>'];
  }
  EXT.sheets.loan = sheetLoan;
  Object.assign(EXT.actions, {
    loanNew() { app().openSheet('loan', {}); },
    loanOpen(el) { app().openSheet('loan', { id: el.dataset.v }); },
    loanKind(el) {
      const ids = ['ln-name', 'ln-bank', 'ln-monthly', 'ln-left', 'ln-next'];
      const vals = ids.map((i) => (document.getElementById(i) || {}).value);
      ui().sheetData.kind = el.dataset.v; app().renderSheet();
      ids.forEach((i, k) => { const x = document.getElementById(i); if (x && vals[k] != null) x.value = vals[k]; });
    },
    loanDel(el) {
      const s = S(); const before = app().snapshot();
      s.loans = s.loans.filter((x) => x.id !== el.dataset.v);
      ui().sheet = null; save(); app().toast(t('loan.deleted'), app().restore(before));
    }
  });
  EXT.forms.loan = function () {
    const s = S(); const d = ui().sheetData;
    const name = document.getElementById('ln-name').value.trim();
    const monthly = num(document.getElementById('ln-monthly').value);
    const left = num(document.getElementById('ln-left').value);
    const next = document.getElementById('ln-next').value || NZ.today();
    const e = {};
    if (!name) e.name = t('loan.errName');
    if (!monthly) e.monthly = t('loan.errMonthly');
    if (!left || left > 600) e.left = t('loan.errLeft');
    if (Object.keys(e).length) { d.err = e; app().renderSheet(); return; }
    const before = app().snapshot();
    let l = d.id ? s.loans.find((x) => x.id === d.id) : null;
    if (!l) { l = { id: NZ.uid(), createdAt: NZ.today() }; s.loans.push(l); }
    Object.assign(l, { name, bank: document.getElementById('ln-bank').value.trim(), kind: d.kind || l.kind || 'inst', monthly, left, next });
    ui().sheet = null; save();
    app().toast(t('loan.saved', M(NZ.safeToday(s, NZ.today()).value)), app().restore(before));
  };

  // --- В листе «Новая операция»: счёт и «семейная трата»
  EXT.addExtras.push(function (a) {
    const s = S();
    const accs = (s.accounts || []).filter((x) => x.cur === 'KZT');
    let h = '';
    if (accs.length) {
      h += '<div class="field"><span>' + esc(t('acc.from')) + '</span><div class="row-gap wrap">' + [{ id: '', name: t('acc.none') }].concat(accs).map((x) => '<button type="button" class="chip-btn" data-a="addAcc" data-v="' + x.id + '" aria-pressed="' + ((a.acc || '') === x.id) + '">' + esc(x.name) + '</button>').join('') + '</div></div>';
    }
    if (s.family && s.family.family) h += '<label class="check"><input type="checkbox" data-ch="addFam" ' + (a.fam ? 'checked' : '') + '><span>' + esc(t('fam.mark', s.family.family.name)) + '</span></label>';
    return h;
  });
  EXT.actions.addAcc = (el) => { ui().add.acc = el.dataset.v; app().renderSheet(); };
  EXT.change.addFam = (el) => { ui().add.fam = el.checked; };
  EXT.addApply.push(function (tx, a) {
    if (a.acc) tx.acc = a.acc;
    if (a.fam) tx.fam = true;
    S().profile.lastAcc = a.acc || '';
  });

  /* ================= ЭКСПОРТ В EXCEL ================= */
  EXT.actions.exportCsv = function () {
    const s = S();
    if (!s.txs.length) { app().toast(t('exp.none')); return; }
    const csv = NZ.exportCsv(s);
    const name = NZ.exportName();
    if (has('saveFile')) {
      let r = '';
      try { r = String(nat().saveFile(name, 'text/csv', csv) || ''); } catch (e) { r = ''; }
      if (r === 'picker') return; // Android 8–9: пользователь выбирает папку, итог — в NZ.onFileSaved
      app().toast(r ? t('exp.savedAndroid', name) : t('exp.failed'));
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      app().toast(t('exp.saved', s.txs.length));
    } catch (e) { app().toast(t('exp.failed')); }
  };

  NZ.onFileSaved = (ok) => app().toast(ok ? t('exp.saved', S().txs.length) : t('exp.failed'));

  /* ================= PIN-КОД И ОТПЕЧАТОК / FACE ID =================
     Только на этом устройстве: PIN хранится как хеш с солью, в синхронизацию не попадает.
     Блокировка — при запуске и если приложение было свёрнуто дольше минуты. */
  let unlocked = false;
  let hiddenAt = 0;
  let pinFails = 0; let pinWaitUntil = 0;
  let webBio = false;
  const lockOn = () => { const s = S(); return !!(s.lock && s.lock.hash && s.account && s.session); };
  EXT.lock = {
    active: () => lockOn() && !unlocked,
    view() {
      const u = ui();
      const entry = u.pinEntry || '';
      const wait = pinWaitUntil > Date.now() ? Math.ceil((pinWaitUntil - Date.now()) / 1000) : 0;
      const bio = S().lock.bio && bioAvailable();
      if (bio && !u.bioTried) { u.bioTried = true; setTimeout(() => EXT.actions.pinBio(), 300); }
      return '<div class="solo"><div class="solo-in lock-in"><div class="brand-row">' + NZ.app.icon('lock', 26) + '<b>nummaza</b></div>' +
        '<h1 class="h2">' + esc(t('pin.enter')) + '</h1><p class="muted">' + esc(t('pin.hello', S().account.name)) + '</p>' +
        '<div class="pin-dots' + (u.pinErr ? ' is-err' : '') + '" aria-label="' + esc(t('pin.dots', entry.length)) + '">' + [0, 1, 2, 3].map((i) => '<i class="' + (i < entry.length ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<p class="err center" role="alert">' + esc(wait ? t('pin.wait', wait) : u.pinErr || '') + '</p>' +
        pinPad('pinKey', wait > 0) +
        '<div class="row-between">' + (bio ? '<button type="button" class="btn btn-sm" data-a="pinBio">' + esc(t('pin.bio')) + '</button>' : '<span></span>') + '<button type="button" class="link" data-a="pinForgot">' + esc(t('pin.forgot')) + '</button></div></div></div>';
    }
  };
  function pinPad(action, disabled) {
    return '<div class="keypad pin-pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? '<span></span>' : '<button type="button" data-a="' + action + '" data-v="' + k + '" ' + (disabled ? 'disabled' : '') + (k === 'del' ? ' aria-label="' + esc(t('add.erase')) + '"' : '') + '>' + (k === 'del' ? '←' : k) + '</button>').join('') + '</div>';
  }
  function bioAvailable() {
    if (has('bioAvailable')) { try { return !!nat().bioAvailable(); } catch (e) { return false; } }
    return webBio;
  }
  function unlock() { unlocked = true; pinFails = 0; const u = ui(); u.pinEntry = ''; u.pinErr = ''; u.bioTried = false; app().render(); planReminders(true); }
  NZ.onBio = (ok) => { if (ok) unlock(); };
  const b64u = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  Object.assign(EXT.actions, {
    async pinKey(el) {
      const u = ui();
      if (pinWaitUntil > Date.now()) return;
      const k = el.dataset.v;
      u.pinErr = '';
      u.pinEntry = k === 'del' ? (u.pinEntry || '').slice(0, -1) : ((u.pinEntry || '') + k).slice(0, 4);
      app().render();
      if (u.pinEntry.length < 4) return;
      const lk = S().lock;
      const ok = (await NZ.hash(lk.salt, u.pinEntry)) === lk.hash;
      if (ok) { unlock(); return; }
      pinFails++;
      u.pinEntry = '';
      if (pinFails >= 5) { pinWaitUntil = Date.now() + 30000; pinFails = 0; setTimeout(() => app().render(), 30100); }
      u.pinErr = t('pin.wrong');
      if (navigator.vibrate) try { navigator.vibrate(80); } catch (e) { /* нет вибрации */ }
      app().render();
    },
    async pinBio() {
      if (has('bioAuth')) { try { nat().bioAuth(t('pin.bioTitle'), t('c.cancel')); } catch (e) { /* нет */ } return; }
      const cred = S().lock && S().lock.cred;
      if (!cred || !webBio) return;
      try {
        await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(cred) }], userVerification: 'required', timeout: 60000 } });
        unlock();
      } catch (e) { /* отменили — остаётся PIN */ }
    },
    pinForgot() {
      app().openSheet('confirm', { title: t('pin.forgotT'), text: serverOn() ? t('pin.forgotServer') : t('pin.forgotLocal'), yes: t('pin.forgotYes'), fn: async () => {
        const s = S();
        s.lock = null; unlocked = true;
        if (serverOn()) { await app().A.logout({ dataset: { force: '1' } }); return; }
        NZ.wipe(); app().state = NZ.defaultState(); app().render();
      } });
    },
    pinToggle() {
      const s = S();
      if (s.lock && s.lock.hash) {
        const before = app().snapshot();
        s.lock = null; save(); app().toast(t('pin.off'), app().restore(before)); return;
      }
      ui().pinSet = { step: 1, first: '', entry: '' };
      app().openSheet('pinSet');
    },
    pinChange() { ui().pinSet = { step: 1, first: '', entry: '' }; app().openSheet('pinSet'); },
    async pinSetKey(el) {
      const p = ui().pinSet;
      const k = el.dataset.v;
      p.err = '';
      p.entry = k === 'del' ? p.entry.slice(0, -1) : (p.entry + k).slice(0, 4);
      app().renderSheet();
      if (p.entry.length < 4) return;
      if (p.step === 1) { p.first = p.entry; p.entry = ''; p.step = 2; app().renderSheet(); return; }
      if (p.entry !== p.first) { p.step = 1; p.first = ''; p.entry = ''; p.err = t('pin.mismatch'); app().renderSheet(); return; }
      const s = S();
      const salt = NZ.uid();
      s.lock = Object.assign({}, s.lock || {}, { salt, hash: await NZ.hash(salt, p.entry) });
      unlocked = true;
      ui().sheet = null; save(); app().toast(t('pin.on'));
    },
    async bioToggle() {
      const s = S();
      if (!s.lock) return;
      if (s.lock.bio) { s.lock.bio = false; save(); return; }
      if (has('bioAuth')) { s.lock.bio = true; save(); app().toast(t('pin.bioOn')); return; }
      try {
        const c = await navigator.credentials.create({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'NUMMAZA' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: s.account.login, displayName: s.account.name },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000
        } });
        s.lock.bio = true; s.lock.cred = b64u(c.rawId); save(); app().toast(t('pin.bioOn'));
      } catch (e) { app().toast(t('pin.bioFail')); }
    }
  });
  EXT.sheets.pinSet = function () {
    const p = ui().pinSet || { step: 1, entry: '' };
    return [t(p.step === 1 ? 'pin.setT' : 'pin.repeatT'), '<p class="muted center">' + esc(t(p.step === 1 ? 'pin.setS' : 'pin.repeatS')) + '</p>' +
      '<div class="pin-dots' + (p.err ? ' is-err' : '') + '">' + [0, 1, 2, 3].map((i) => '<i class="' + (i < p.entry.length ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<p class="err center" role="alert">' + esc(p.err || '') + '</p>' + pinPad('pinSetKey', false)];
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (lockOn() && unlocked && hiddenAt && Date.now() - hiddenAt > 60000) { unlocked = false; ui().bioTried = false; ui().sheet = null; app().render(); }
  });
  if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && /^https:$/.test(location.protocol)) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then((v) => { webBio = !!v; }).catch(() => {});
  }

  /* ================= НАПОМИНАНИЯ И ВИДЖЕТ ================= */
  const PUSH_KEY = 'nummaza.push';
  const pushEndpoint = () => { try { return localStorage.getItem(PUSH_KEY); } catch (e) { return null; } };
  function notifState() {
    if (has('setReminders')) { try { return nat().notifPermission ? nat().notifPermission() : 'granted'; } catch (e) { return 'granted'; } }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !window.PushManager) return isIos() && !standalone() ? 'install' : 'unsupported';
    if (Notification.permission === 'granted' && pushEndpoint()) return 'granted';
    return Notification.permission === 'denied' ? 'denied' : 'default';
  }
  const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  async function enableNotif() {
    if (has('setReminders')) {
      if (has('requestNotifPermission')) { try { nat().requestNotifPermission(); } catch (e) { /* старый APK */ } }
      planReminders(true); app().render(); return;
    }
    if (!serverOn()) { app().toast(t('notif.needServer')); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { app().render(); return; }
      const key = (await NZ.api.pub('/push/key')).key;
      if (!key) { app().toast(t('notif.serverOff')); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
      await NZ.api.call('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      try { localStorage.setItem(PUSH_KEY, sub.endpoint); } catch (e) { /* хранилище недоступно */ }
      await planReminders(true);
      app().toast(t('notif.on'));
    } catch (e) { app().toast(t('notif.fail')); }
    app().render();
  }
  NZ.onNotifPermission = () => { planReminders(true); app().render(); }; // Android: ответ на системный запрос разрешения

  let planTimer = null; let lastPlan = '';
  function planReminders(force) {
    clearTimeout(planTimer);
    return new Promise((resolve) => {
      planTimer = setTimeout(async () => {
        const s = S();
        if (!s.account || !s.session || EXT.lock.active()) return resolve();
        const plan = NZ.reminderPlan(s);
        const key = JSON.stringify(plan.map((p) => [p.id, p.at, p.body]));
        if (key === lastPlan && !force) return resolve();
        lastPlan = key;
        try {
          if (has('setReminders')) nat().setReminders(JSON.stringify(plan));
          else if (pushEndpoint() && serverOn() && navigator.onLine !== false) await NZ.api.call('/push/plan', { method: 'POST', body: { endpoint: pushEndpoint(), items: plan } });
        } catch (e) { lastPlan = ''; /* без сети — попробуем при следующем изменении */ }
        resolve();
      }, force ? 0 : 1500);
    });
  }
  function notifyNow(title, body) {
    if (has('notifyNow')) { try { nat().notifyNow(title, body); } catch (e) { /* старый APK */ } return; }
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'env' })).catch(() => {});
    }
  }
  function updateWidget() {
    if (!has('setWidget')) return;
    const s = S();
    if (!s.account || !s.profile.onboarded) return;
    const st = NZ.safeToday(s, NZ.today());
    try { nat().setWidget(JSON.stringify({ label: t('home.safe'), value: M(st.value), sub: s.profile.income ? t('home.daysLeft', t('c.days', st.daysLeft), M(Math.max(0, st.leftTotal))) : '' })); } catch (e) { /* старый APK */ }
  }
  let envBefore = null;
  EXT.onSaved.push(function (s) {
    if (!s.account || !s.session || !s.profile.onboarded) return;
    const now = NZ.envelopes(s, NZ.today());
    if (envBefore && (s.profile.notif || {}).env !== false) {
      NZ.envCrossings(envBefore, now).forEach((c) => notifyNow(t('rem.envT'), t(c.over ? 'rem.envOver' : 'rem.envB', t('cat.' + c.cat), c.pct)));
    }
    envBefore = now;
    planReminders(false);
    updateWidget();
    famMaybeSync();
  });

  // Карточка «Напоминания» в профиле (заменяет прежнюю)
  EXT.notifCard = function () {
    const s = S();
    const n = s.profile.notif;
    const st = notifState();
    const row = (k, label) => '<div class="row-between"><span>' + esc(label) + '</span>' + sw(n[k] !== false && !!(n[k] || k === 'env'), 'notif2', label, k) + '</div>';
    let status = '';
    if (st === 'granted') status = '<p class="small teal">' + esc(t('notif.active')) + '</p>';
    else if (st === 'install') status = '<p class="small muted">' + esc(t('notif.install')) + '</p>';
    else if (st === 'unsupported') status = '<p class="small muted">' + esc(t('notif.unsupported')) + '</p>';
    else if (st === 'denied') status = '<p class="small warn-t">' + esc(t('notif.denied')) + '</p>' + (has('requestNotifPermission') ? '<button type="button" class="btn btn-sm" data-a="notifEnable">' + esc(t('notif.enable')) + '</button>' : '');
    else status = '<button type="button" class="btn btn-sm btn-primary" data-a="notifEnable">' + esc(t('notif.enable')) + '</button>';
    return '<section class="card stack-14" aria-labelledby="notif-h"><h2 id="notif-h" class="cap small muted">' + esc(t('prof.notif')) + '</h2>' + status +
      row('limit', t('notif.limit')) + row('pay', t('notif.pay')) + row('env', t('notif.env')) + row('tips', t('prof.nTips')) + '</section>';
  };
  Object.assign(EXT.actions, {
    notifEnable: enableNotif,
    notif2(el) { const n = S().profile.notif; const k = el.dataset.v; n[k] = !(n[k] !== false && !!(n[k] || k === 'env')); save(); planReminders(true); }
  });

  /* ================= ПРОФИЛЬ: безопасность, почта, семья, экспорт ================= */
  EXT.profileCards.push(function () {
    const s = S();
    const on = !!(s.lock && s.lock.hash);
    const bio = bioAvailable() || has('bioAuth');
    return '<section class="card stack-14" aria-labelledby="sec-h"><h2 id="sec-h" class="cap small muted">' + esc(t('pin.section')) + '</h2>' +
      '<div class="row-between"><span>' + esc(t('pin.toggle')) + '</span>' + sw(on, 'pinToggle', t('pin.toggle')) + '</div>' +
      (on && bio ? '<div class="row-between"><span>' + esc(t('pin.bioToggle')) + '</span>' + sw(s.lock.bio, 'bioToggle', t('pin.bioToggle')) + '</div>' : '') +
      (on ? '<button type="button" class="link" data-a="pinChange">' + esc(t('pin.change')) + '</button>' : '<p class="small muted">' + esc(t('pin.note')) + '</p>') + '</section>';
  });
  EXT.profileCards.push(function () {
    if (!serverOn()) return '';
    const a = S().account;
    if (a.email === undefined && !ui().meLoading) {
      ui().meLoading = true;
      NZ.api.call('/me').then((r) => { a.email = r.user.email || null; NZ.save(S()); app().render(); }).catch(() => {}).finally(() => { ui().meLoading = false; });
    }
    const editing = ui().emailEdit || !a.email;
    const isLoginEmail = a.login.indexOf('@') > 0;
    return '<section class="card stack-10" aria-labelledby="rec-h"><h2 id="rec-h" class="cap small muted">' + esc(t('rec.section')) + '</h2>' +
      (a.email && !ui().emailEdit ? '<p class="small">' + esc(t('rec.has', a.email.replace(/^(.).*(@.*)$/, '$1•••$2'))) + '</p>' + (isLoginEmail ? '' : '<button type="button" class="link" data-a="emailEdit">' + esc(t('rec.change')) + '</button>') : '') +
      (editing && !(isLoginEmail && a.email) ? '<form class="stack-10" data-form="email"><label class="field"><span>' + esc(t('rec.label')) + '</span><input id="rec-email" type="email" inputmode="email" autocomplete="email" value="' + esc(a.email || '') + '" placeholder="name@mail.kz" aria-invalid="' + !!ui().emailErr + '">' + (ui().emailErr ? '<span class="err">' + esc(ui().emailErr) + '</span>' : '<span class="hint">' + esc(t('rec.hint')) + '</span>') + '</label><button class="btn btn-sm btn-primary" type="submit">' + esc(t('c.save')) + '</button></form>' : '') + '</section>';
  });
  EXT.actions.emailEdit = () => { ui().emailEdit = true; app().render(); };
  EXT.forms.email = async function () {
    const v = document.getElementById('rec-email').value.trim();
    try {
      const r = await NZ.api.call('/me/email', { method: 'PUT', body: { email: v } });
      S().account.email = r.user.email; ui().emailEdit = false; ui().emailErr = ''; save(); app().toast(t('rec.saved'));
    } catch (e) { ui().emailErr = e.code === 'validation' ? t('rec.errEmail') : e.code === 'offline' ? t('auth.errOffline') : t('auth.errServer'); app().render(); }
  };
  EXT.profileCards.push(function () {
    const s = S();
    const f = s.family && s.family.family;
    return '<section class="card stack-10"><h2 class="cap small muted">' + esc(t('prof.more')) + '</h2>' +
      '<a class="li li-link" href="#wallet"><span class="grow">' + esc(t('wal.title')) + '</span>' + icon('chev', 16) + '</a>' +
      (NZ.api && NZ.api.enabled() ? '<a class="li li-link" href="#family"><span class="grow">' + esc(t('fam.title')) + (f ? ' · ' + esc(f.name) : '') + '</span>' + icon('chev', 16) + '</a>' : '') +
      '<button type="button" class="li li-link" data-a="exportCsv"><span class="grow">' + esc(t('exp.btn')) + '</span>' + icon('upload', 16) + '</button></section>';
  });

  /* ================= ВОССТАНОВЛЕНИЕ ПАРОЛЯ ПО ПОЧТЕ ================= */
  EXT.sheets.forgotServer = function () {
    const d = ui().sheetData;
    if (!d.step) d.step = 1;
    const err = d.err ? '<p class="err-box" role="alert">' + esc(d.err) + '</p>' : '';
    if (d.step === 1) return [t('rec.title'), '<form class="stack-14" data-form="forgot1"><p class="muted">' + esc(t('rec.s1')) + '</p><label class="field"><span>' + esc(t('auth.login')) + '</span><input id="fg-login" data-autofocus autocomplete="username" value="' + esc(d.login || ui().authLogin || '') + '" placeholder="' + esc(t('auth.loginPh')) + '"></label>' + err + '<button class="btn btn-primary btn-lg" type="submit" ' + (d.busy ? 'disabled' : '') + '>' + esc(t('rec.send')) + '</button><p class="small muted">' + esc(t('rec.noEmail')) + '</p></form>'];
    return [t('rec.title'), '<form class="stack-14" data-form="forgot2"><p class="muted">' + esc(t('rec.s2')) + '</p><label class="field"><span>' + esc(t('rec.code')) + '</span><input id="fg-code" data-autofocus inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label><label class="field"><span>' + esc(t('rec.newPw')) + '</span><input id="fg-pw" type="password" autocomplete="new-password"><span class="hint">' + esc(t('auth.pwHint')) + '</span></label>' + err + '<button class="btn btn-primary btn-lg" type="submit" ' + (d.busy ? 'disabled' : '') + '>' + esc(t('rec.reset')) + '</button><button type="button" class="link" data-a="forgotBack">' + esc(t('rec.again')) + '</button></form>'];
  };
  EXT.actions.forgotBack = () => { const d = ui().sheetData; d.step = 1; d.err = ''; app().renderSheet(); };
  EXT.forms.forgot1 = async function () {
    const d = ui().sheetData;
    d.login = document.getElementById('fg-login').value.trim();
    d.busy = true; d.err = ''; app().renderSheet();
    try {
      await NZ.api.pub('/auth/forgot', { method: 'POST', body: { login: d.login, lang: NZ.lang } });
      d.step = 2;
    } catch (e) { d.err = e.code === 'validation' ? t('auth.errLogin') : e.code === 'offline' ? t('auth.errOffline') : e.code === 'rate_limited' ? t('auth.errRate') : t('auth.errServer'); }
    d.busy = false; app().renderSheet();
  };
  EXT.forms.forgot2 = async function () {
    const d = ui().sheetData;
    const code = document.getElementById('fg-code').value.replace(/\D/g, '');
    const pw = document.getElementById('fg-pw').value;
    if (pw.length < 8 || !/[a-zа-яәғқңөұүһі]/i.test(pw) || !/\d/.test(pw)) { d.err = t('auth.errPw'); app().renderSheet(); return; }
    d.busy = true; d.err = ''; app().renderSheet();
    try {
      const r = await NZ.api.pub('/auth/reset', { method: 'POST', body: { login: d.login, code, password: pw } });
      const user = NZ.api.adopt(r);
      ui().sheet = null; app().renderSheet();
      await app().serverAuthDone('in', user);
      app().toast(t('rec.done'));
      return;
    } catch (e) {
      d.err = e.code === 'bad_code' ? t('rec.badCode', e.data.attemptsLeft == null ? '' : e.data.attemptsLeft) : e.code === 'code_expired' ? t('rec.expired') : e.code === 'validation' ? t('auth.errPw') : e.code === 'offline' ? t('auth.errOffline') : t('auth.errServer');
    }
    d.busy = false; app().renderSheet();
  };

  /* ================= СЕМЕЙНЫЙ БЮДЖЕТ ================= */
  const FAM_DAYS = 120;
  let famSent = null; let famTimer = null; let famBusy = false;
  const famMine = (s) => s.txs.filter((x) => x.fam && x.date >= NZ.addDays(NZ.today(), -FAM_DAYS + 1)).map((x) => ({ id: x.id, date: x.date, amount: x.amount, cat: x.cat, merchant: x.merchant || '' }));
  async function famLoad(push) {
    if (!serverOn() || famBusy) return;
    famBusy = true;
    try {
      const s = S();
      const mine = famMine(s);
      const r = push && s.family && s.family.family ? await NZ.api.call('/family/sync', { method: 'POST', body: { mine } }) : await NZ.api.call('/family');
      if (push) famSent = JSON.stringify(mine);
      setFamily(r);
      if (r.family && famSent === null) { famSent = ''; famMaybeSync(); }
    } catch (e) { /* без сети — в следующий раз */ }
    famBusy = false;
  }
  function setFamily(r) {
    const s = S();
    s.family = r && r.family ? Object.assign({ at: Date.now() }, r) : null;
    if (!s.family) s.txs.forEach((x) => { if (x.fam) delete x.fam; });
    NZ.save(s); app().render();
  }
  function famMaybeSync() {
    const s = S();
    if (!serverOn() || !s.family || !s.family.family) return;
    if (JSON.stringify(famMine(s)) === famSent) return;
    clearTimeout(famTimer);
    famTimer = setTimeout(() => famLoad(true), 2500);
  }
  function famStats(f) {
    const ym = NZ.ym(NZ.today());
    const month = (f.records || []).filter((r) => r.date.slice(0, 7) === ym && r.amount < 0);
    const by = {};
    month.forEach((r) => { by[r.by] = (by[r.by] || 0) - r.amount; });
    return { total: NZ.sum(month, (r) => -r.amount), by, month };
  }
  function viewFamily() {
    const s = S();
    const head = '<header class="page-head"><h1 class="h2">' + esc(t('fam.title')) + '</h1></header>';
    if (!serverOn()) return head + '<section class="card empty"><p class="muted">' + esc(t('fam.needServer')) + '</p></section>';
    if (!s.family || !s.family.family) {
      if (!ui().famChecked) { ui().famChecked = true; famLoad(false); }
      return head + '<section class="card stack-14"><h2 class="h3">' + esc(t('fam.introT')) + '</h2><p class="muted">' + esc(t('fam.introS')) + '</p>' +
        '<form class="stack-10" data-form="famCreate"><label class="field"><span>' + esc(t('fam.name')) + '</span><input id="fam-name" maxlength="40" placeholder="' + esc(t('fam.namePh')) + '"></label><button class="btn btn-primary" type="submit">' + esc(t('fam.create')) + '</button></form></section>' +
        '<section class="card stack-10"><h2 class="h3">' + esc(t('fam.joinT')) + '</h2><form class="stack-10" data-form="famJoin"><label class="field"><span>' + esc(t('fam.code')) + '</span><input id="fam-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC234" aria-invalid="' + !!ui().famErr + '">' + (ui().famErr ? '<span class="err">' + esc(ui().famErr) + '</span>' : '') + '</label><button class="btn" type="submit">' + esc(t('fam.join')) + '</button></form></section>';
    }
    const f = s.family;
    const st = famStats(f);
    const lim = f.family.limit;
    const pct = lim ? Math.min(100, Math.round((st.total / lim) * 100)) : 0;
    const name = (id) => { const m = f.members.find((x) => x.id === id); return m ? m.name : '—'; };
    const recent = (f.records || []).slice(0, 30).map((r) => '<li class="li"><span class="dot" style="background:' + (NZ.CATS[r.cat] ? NZ.CATS[r.cat].color : 'var(--line)') + '"></span><span class="grow"><b>' + esc(r.merchant || t('cat.' + r.cat)) + '</b><span class="small muted block">' + esc(NZ.fmtDate(r.date) + ' · ' + name(r.by)) + '</span></span><b>' + M(r.amount, { sign: true }) + '</b></li>').join('');
    return head +
      '<section class="card card-ink stack-6"><span class="small teal-l">' + esc(f.family.name + ' · ' + NZ.monthName(NZ.ym(NZ.today()))) + '</span><b class="h1">' + M(st.total) + '</b>' +
      (lim ? '<div class="bar bar-light"><i style="width:' + pct + '%"></i></div><span class="small">' + esc(st.total > lim ? t('fam.over', M(st.total - lim)) : t('fam.left', M(lim - st.total), M(lim))) + '</span>' : '<span class="small">' + esc(t('fam.noLimit')) + '</span>') + '</section>' +
      '<section class="card stack-10"><div class="row-between"><h2 class="h3">' + esc(t('fam.members')) + '</h2><button type="button" class="btn btn-sm" data-a="famInvite">' + esc(t('fam.invite')) + '</button></div>' +
      (ui().famCode ? '<p class="note">' + esc(t('fam.codeIs', ui().famCode)) + '</p>' : '') +
      '<ul class="list">' + f.members.map((m) => '<li class="li"><span class="ava ava-sm" aria-hidden="true">' + esc(m.name[0].toUpperCase()) + '</span><span class="grow"><b>' + esc(m.name) + (m.me ? ' (' + esc(t('fam.me')) + ')' : '') + '</b><span class="small muted block">' + esc(m.owner ? t('fam.owner') : t('fam.member')) + '</span></span><b>' + M(st.by[m.id] || 0) + '</b>' + (f.family.isOwner && !m.me ? '<button type="button" class="icon-btn icon-btn-sm" data-a="famKick" data-v="' + m.id + '" aria-label="' + esc(t('fam.kick', m.name)) + '">' + icon('close', 16) + '</button>' : '') + '</li>').join('') + '</ul></section>' +
      (f.family.isOwner ? '<section class="card stack-10"><form class="stack-10" data-form="famLimit"><label class="field"><span>' + esc(t('fam.limitL')) + '</span><input id="fam-limit" inputmode="numeric" value="' + esc(lim ? grp(lim) : '') + '"></label><button class="btn btn-sm" type="submit">' + esc(t('c.save')) + '</button></form></section>' : '') +
      '<section class="card stack-10"><h2 class="h3">' + esc(t('fam.ops')) + '</h2><p class="small muted">' + esc(t('fam.how')) + '</p>' + (recent ? '<ul class="list">' + recent + '</ul>' : '<p class="muted small">' + esc(t('fam.none')) + '</p>') + '</section>' +
      '<button type="button" class="btn btn-danger-t" data-a="famLeave">' + esc(t('fam.leave')) + '</button>';
  }
  EXT.views.family = viewFamily;
  EXT.homeCards.push(function () {
    const f = S().family;
    if (!f || !f.family) return '';
    const st = famStats(f);
    const lim = f.family.limit;
    return '<section class="card stack-10" aria-labelledby="fam-h"><div class="row-between"><h2 id="fam-h" class="h3">' + esc(f.family.name) + '</h2><a href="#family" class="link">' + esc(t('wal.open')) + '</a></div><div class="row-between"><span class="muted">' + esc(t('fam.month')) + '</span><b>' + M(st.total) + (lim ? ' / ' + M(lim) : '') + '</b></div>' + (lim ? '<div class="bar"><i style="width:' + Math.min(100, Math.round(st.total / lim * 100)) + '%"></i></div>' : '') + '</section>';
  });
  const famErr = (e) => ({ bad_code: t('fam.badCode'), family_full: t('fam.full'), already_in_family: t('fam.already'), offline: t('auth.errOffline') })[e.code] || t('auth.errServer');
  EXT.forms.famCreate = async function () {
    const name = document.getElementById('fam-name').value.trim() || t('fam.namePh');
    try { setFamily(await NZ.api.call('/family', { method: 'POST', body: { name } })); famSent = null; famMaybeSync(); app().toast(t('fam.created')); } catch (e) { app().toast(famErr(e)); }
  };
  EXT.forms.famJoin = async function () {
    const code = document.getElementById('fam-code').value.trim().toUpperCase();
    try { setFamily(await NZ.api.call('/family/join', { method: 'POST', body: { code } })); ui().famErr = ''; famSent = null; famMaybeSync(); app().toast(t('fam.joined')); } catch (e) { ui().famErr = famErr(e); app().render(); }
  };
  EXT.forms.famLimit = async function () {
    try { setFamily(await NZ.api.call('/family', { method: 'PUT', body: { limit: num(document.getElementById('fam-limit').value) } })); app().toast(t('c.saved')); } catch (e) { app().toast(famErr(e)); }
  };
  Object.assign(EXT.actions, {
    async famInvite() {
      try { const r = await NZ.api.call('/family/invite', { method: 'POST', body: {} }); ui().famCode = r.code; app().render(); } catch (e) { app().toast(famErr(e)); }
    },
    famKick(el) {
      const m = S().family.members.find((x) => x.id === el.dataset.v);
      app().openSheet('confirm', { title: t('fam.kick', m.name), text: t('fam.kickText'), yes: t('fam.kickYes'), fn: async () => { try { setFamily(await NZ.api.call('/family/members/' + encodeURIComponent(m.id), { method: 'DELETE' })); } catch (e) { app().toast(famErr(e)); } } });
    },
    famLeave() {
      app().openSheet('confirm', { title: t('fam.leave'), text: t('fam.leaveText'), yes: t('fam.leaveYes'), fn: async () => { try { await NZ.api.call('/family/leave', { method: 'POST', body: {} }); ui().famCode = ''; setFamily(null); } catch (e) { app().toast(famErr(e)); } } });
    }
  });
  // Пометить существующую операцию как семейную (лист операции)
  EXT.txExtras = function (x) {
    const f = S().family;
    if (!f || !f.family || x.amount >= 0) return '';
    return '<label class="check"><input type="checkbox" data-ch="txFam" ' + (x.fam ? 'checked' : '') + '><span>' + esc(t('fam.mark', f.family.name)) + '</span></label>';
  };
  EXT.change.txFam = function (el) {
    const x = S().txs.find((y) => y.id === ui().sheetData.id);
    if (!x) return;
    if (el.checked) x.fam = true; else delete x.fam;
    NZ.save(S());
  };

  /* ================= ЗАПУСК ================= */
  function refreshRates() {
    if (!NZ.api || !NZ.api.enabled() || navigator.onLine === false) return;
    const at = (NZ.rates && NZ.rates.fetchedAt) || 0;
    if (Date.now() - at < 6 * 3600 * 1000) return;
    NZ.api.pub('/rates').then((r) => { NZ.setRates(Object.assign(r, {})); NZ.rates.fetchedAt = Date.now(); try { localStorage.setItem('nummaza.rates', JSON.stringify(NZ.rates)); } catch (e) { /* нет */ } if (ui().route === 'wallet') app().render(); }).catch(() => {});
  }
  NZ.moreStart = function () {
    refreshRates();
    planReminders(true);
    updateWidget();
    if (serverOn()) famLoad(!!(S().family && S().family.family));
    envBefore = S().account ? NZ.envelopes(S(), NZ.today()) : null;
  };
})();
