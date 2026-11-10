/* NUMMAZA — расчёты без интерфейса: рассрочки и кредиты, счета и валюты, экспорт, план напоминаний.
   Всё доступно через window.NZ и проверяется тестами. */
(function () {
  'use strict';
  const NZ = window.NZ;

  /* ---------- Рассрочки и кредиты ----------
     Запись: { id, name, bank, kind: 'inst'|'credit', monthly, left, next, createdAt }
       left — сколько платежей оставалось на момент добавления (включая ближайший),
       next — дата ближайшего платежа на момент добавления.
     Дальше график считается сам: платёж раз в месяц в тот же день, прошедшие даты — оплачены. */
  NZ.loanDate = function (l, k) {
    const day = +l.next.slice(8);
    const ym = NZ.addMonths(NZ.ym(l.next), k);
    return ym + '-' + String(Math.min(day, NZ.daysInMonth(ym))).padStart(2, '0');
  };
  NZ.loanState = function (l, today) {
    const left = Math.max(0, l.left | 0);
    let passed = 0;
    while (passed < left && NZ.loanDate(l, passed) < today) passed++;
    const remaining = left - passed;
    return {
      remaining,
      done: remaining === 0,
      nextDue: remaining ? NZ.loanDate(l, passed) : null,
      leftSum: remaining * (l.monthly || 0),
      end: left ? NZ.loanDate(l, left - 1) : null,
      pct: left ? Math.round(((l.paidBefore || 0) + passed) / ((l.paidBefore || 0) + left) * 100) : 100
    };
  };
  // Платежи по рассрочкам в [from, to). Платёж, уже оплаченный незадолго до срока (трата «рассрочка»
  // на ту же сумму за 5 дней до даты или позже), не считается — иначе он вычелся бы дважды.
  NZ.loanDuesIn = function (state, from, to) {
    const out = [];
    (state.loans || []).forEach((l) => {
      const st = NZ.loanState(l, from);
      if (st.done) return;
      for (let k = 0; k < (l.left | 0); k++) {
        const d = NZ.loanDate(l, k);
        if (d < from) continue;
        if (d >= to) break;
        const paid = (state.txs || []).some((t) => NZ.isSpend(t) && t.cat === 'installments' && t.date >= NZ.addDays(d, -5) && t.date <= d && t.date <= from &&
          Math.abs(-t.amount - l.monthly) <= l.monthly * 0.1);
        if (!paid) out.push({ loan: l, date: d, amount: l.monthly || 0 });
      }
    });
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  };
  NZ.loansSummary = function (state, today) {
    const active = (state.loans || []).map((l) => ({ l, st: NZ.loanState(l, today) })).filter((x) => !x.st.done);
    const next = active.filter((x) => x.st.nextDue).sort((a, b) => (a.st.nextDue < b.st.nextDue ? -1 : 1))[0];
    return {
      count: active.length,
      monthly: NZ.sum(active, (x) => x.l.monthly || 0),
      leftSum: NZ.sum(active, (x) => x.st.leftSum),
      next: next ? { name: next.l.name, date: next.st.nextDue, amount: next.l.monthly } : null
    };
  };

  /* ---------- Счета и валюты ----------
     Счёт: { id, name, type: 'card'|'cash'|'deposit'|'other', cur: 'KZT'|'USD'|'EUR'|'RUB', balance, since, createdAt }
     Баланс сейчас = введённый остаток + операции с этим счётом начиная с даты since (только счета в тенге). */
  NZ.CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB'];
  NZ.CUR_SIGN = { KZT: '₸', USD: '$', EUR: '€', RUB: '₽' };
  // Курсы на случай, если сервер недоступен (обновляются с сервера: курсы Национального банка РК)
  const FALLBACK = { USD: 447, EUR: 502, RUB: 5.4, date: null, fallback: true }; // НБ РК, ноябрь 2026
  const RATES_KEY = 'nummaza.rates';
  NZ.rates = (function () {
    try { const r = JSON.parse(localStorage.getItem(RATES_KEY)); if (r && r.USD) return r; } catch (e) { /* нет сохранённых */ }
    return Object.assign({}, FALLBACK);
  })();
  NZ.setRates = function (r) {
    if (!r || !(r.USD > 0)) return;
    NZ.rates = { USD: +r.USD, EUR: +r.EUR || FALLBACK.EUR, RUB: +r.RUB || FALLBACK.RUB, date: r.date || null };
    try { localStorage.setItem(RATES_KEY, JSON.stringify(NZ.rates)); } catch (e) { /* хранилище недоступно */ }
  };
  NZ.toKZT = (amount, cur) => (cur && cur !== 'KZT' ? amount * (NZ.rates[cur] || 0) : amount);
  NZ.accBalance = function (state, a) {
    if (a.cur && a.cur !== 'KZT') return a.balance || 0;
    return (a.balance || 0) + NZ.sum((state.txs || []).filter((t) => t.acc === a.id && t.date >= (a.since || '0000')), (t) => t.amount);
  };
  NZ.netWorth = function (state) {
    const accs = state.accounts || [];
    const assets = NZ.sum(accs, (a) => NZ.toKZT(NZ.accBalance(state, a), a.cur));
    const debt = NZ.loansSummary(state, NZ.today()).leftSum;
    return { assets: Math.round(assets), debt, net: Math.round(assets - debt) };
  };
  NZ.fmtCur = function (n, cur) {
    if (!cur || cur === 'KZT') return NZ.money(n);
    const v = Math.round(n * 100) / 100;
    const s = Math.abs(v).toLocaleString(NZ.lang === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 });
    return (v < 0 ? '−' : '') + s + ' ' + NZ.CUR_SIGN[cur];
  };

  /* ---------- Экспорт в Excel (CSV) ----------
     Разделитель «;», UTF-8 с BOM — Excel на русском и казахском открывает сразу, без мастера импорта. */
  NZ.exportCsv = function (state) {
    const accName = {};
    (state.accounts || []).forEach((a) => { accName[a.id] = a.name; });
    const q = (v) => { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = NZ.t('exp.cols');
    const rows = state.txs.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((x) => [
      x.date, x.amount, NZ.t('cat.' + x.cat), x.merchant || '', x.raw && x.raw !== x.merchant ? x.raw : '',
      accName[x.acc] || '', NZ.t('exp.src.' + (x.source === 'manual' || x.source === 'push' ? x.source : 'statement')), x.own ? NZ.t('exp.yes') : '', x.fam ? NZ.t('exp.yes') : ''
    ]);
    return '﻿' + [head].concat(rows).map((r) => r.map(q).join(';')).join('\r\n') + '\r\n';
  };
  NZ.exportName = () => 'nummaza-' + NZ.today() + '.csv';

  /* ---------- Напоминания ----------
     План на ближайшие дни: утром «сколько можно потратить», накануне платежа — «завтра платёж».
     Считается на устройстве (там все данные) и отдаётся Android-приложению или серверу для push. */
  function at(iso, hh) { const d = NZ.parseISO(iso); d.setHours(hh, 0, 0, 0); return d.getTime(); }
  NZ.reminderPlan = function (state, nowMs) {
    const now = nowMs || Date.now();
    const td = NZ.today();
    const n = state.profile.notif || {};
    const out = [];
    if (!state.account || !state.profile.onboarded) return out;
    const s = NZ.safeToday(state, td);
    if (n.limit && state.profile.income) {
      const even = Math.floor(Math.max(0, s.leftTotal) / Math.max(1, s.daysLeft) / 10) * 10;
      for (let k = 0; k < Math.min(7, s.daysLeft); k++) {
        const day = NZ.addDays(td, k);
        const when = at(day, 9);
        if (when <= now) continue;
        out.push({ id: 'limit:' + day, at: when, title: NZ.t('rem.limitT'), body: NZ.t('rem.limitB', NZ.money(k === 0 ? s.value : even)) });
      }
    }
    if (n.pay) {
      const end = NZ.addDays(td, 31);
      const list = NZ.upcoming(state, td).filter((u) => !u.loan).concat(NZ.loanDuesIn(state, td, end).map((d) => ({ merchant: d.loan.name, amount: d.amount, date: d.date })));
      const seen = {};
      list.forEach((u) => {
        const id = 'pay:' + u.date + ':' + u.merchant;
        if (seen[id]) return; seen[id] = 1;
        const when = at(NZ.addDays(u.date, -1), 19);
        if (when <= now) return;
        out.push({ id, at: when, title: NZ.t('rem.payT'), body: NZ.t('rem.payB', u.merchant, NZ.money(u.amount)) });
      });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 40);
  };
  // Конверты, которые этим изменением перешли порог 80% (или 100%): [{ cat, pct }]
  NZ.envCrossings = function (before, after) {
    const out = [];
    after.forEach((e) => {
      const b = before.find((x) => x.cat === e.cat);
      if (!b || !e.limit) return;
      const lvl = (r) => (r >= 1 ? 2 : r >= 0.8 ? 1 : 0);
      if (lvl(e.ratio) > lvl(b.ratio)) out.push({ cat: e.cat, pct: Math.round(e.ratio * 100), over: e.ratio >= 1 });
    });
    return out;
  };
})();
