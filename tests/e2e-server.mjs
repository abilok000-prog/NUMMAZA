// Сквозной тест NUMMAZA с сервером: регистрация и вход через API, синхронизация между двумя устройствами.
// Запуск: NODE_PATH=$(npm root -g) node tests/e2e-server.mjs
import { createRequire } from 'node:module';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let failed = 0; let passed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

const db = await openDb({ pglite: true });
const mails = [];
const mailer = { enabled: true, async send(m) { mails.push(m); return { sent: true }; } };
const ratesSource = async () => ({ date: '2026-11-04', USD: 447.5, EUR: 502.2, RUB: 5.41 });
const server = createApp(db, { authLimit: 1000, mailer, ratesSource }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const count = async (sql, p = []) => (await db.query(sql, p)).rows[0].n;

const browser = await chromium.launch();
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.addInitScript(() => { window.NZ = { _fakeToday: '2026-11-04' }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  // «Failed to load resource» браузер пишет сам на ожидаемые ответы 401/409 и при отключённой сети — это не ошибки приложения
  page.on('console', (m) => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || (m.type() === 'warning' && /i18n/.test(m.text()))) errors.push(name + ' ' + m.type() + ': ' + m.text()); });
  await page.goto(base);
  return { ctx, page, text: () => page.locator('#app').innerText(), sync: () => page.evaluate(() => window.NZ.sync.run()), state: (f) => page.evaluate(f) };
}
const LOGIN = '+7 701 555 44 33';
const PW = 'nummaza2026';

console.log('1. Регистрация через сервер (телефон A)');
const A = await device('A');
ok((await A.text()).includes('Пароль хранится на сервере'), 'на экране входа сказано, что пароль хранится на сервере');
await A.page.fill('#a-name', 'Айдана');
await A.page.fill('#a-login', LOGIN);
await A.page.fill('#a-pw', PW);
await A.page.check('#a-agree');
await A.page.getByRole('button', { name: 'Создать аккаунт' }).click();
await A.page.waitForSelector('text=Добро пожаловать в NUMMAZA');
ok(await count("SELECT count(*)::int AS n FROM users WHERE login='+77015554433'") === 1, 'пользователь создан в базе сервера');
for (let i = 0; i < 3; i++) { if (i === 1) await A.page.fill('#o-income', '650000'); await A.page.locator('[data-a="onbNext"]').click(); }
await A.page.getByRole('button', { name: 'Попробовать на примере' }).click();
await A.page.waitForSelector('.safe-v');
await A.sync();
const txA = await A.state(() => window.NZ.app.state.txs.length);
const recTx = await count("SELECT count(*)::int AS n FROM records WHERE kind='tx' AND NOT deleted");
ok(recTx === txA && txA > 50, `все операции (${txA}) сохранены на сервере`);
ok(await count("SELECT count(*)::int AS n FROM records WHERE kind='profile' AND (data->>'onboarded')::boolean") === 1, 'профиль и онбординг на сервере');

console.log('2. Ручная трата уходит на сервер');
await A.page.locator('.fab').click();
for (const k of ['4', '2', '0', '0']) await A.page.locator('.keypad [data-v="' + k + '"]').click();
await A.page.locator('#add-where').fill('Кофейня Тест');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
await A.sync();
ok(await count("SELECT count(*)::int AS n FROM records WHERE kind='tx' AND data->>'merchant'='Кофейня Тест'") === 1, 'трата «Кофейня Тест» на сервере');

console.log('3. Вход на втором устройстве (телефон B)');
const B = await device('B');
await B.page.getByRole('button', { name: 'Вход', exact: true }).click();
await B.page.fill('#a-login', '87015554433');
await B.page.fill('#a-pw', PW);
await B.page.getByRole('button', { name: 'Войти' }).click();
await B.page.waitForSelector('.safe-v');
ok(true, 'вход сразу на обзор — онбординг не повторяется');
ok(await B.state(() => window.NZ.app.state.txs.length) === txA + 1, 'на втором устройстве те же операции');
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Кофейня Тест')), 'и ручная трата тоже');
ok(await B.state(() => window.NZ.app.state.profile.income) === 650000, 'доход из профиля пришёл');
const safeA = await A.page.locator('.safe-v').innerText();
const safeB = await B.page.locator('.safe-v').innerText();
ok(safeA === safeB, '«Сегодня можно» совпадает на обоих: ' + safeA.replace(/\s/g, ' '));

console.log('4. Изменение на B → видно на A');
await B.page.goto(base + '#profile');
await B.page.fill('#p-income', '700000');
await B.page.locator('#p-income').dispatchEvent('change');
await B.sync();
await A.sync();
ok(await A.state(() => window.NZ.app.state.profile.income) === 700000, 'новый доход доехал до телефона A');

console.log('5. Без интернета');
await A.ctx.setOffline(true);
await A.page.goto(base + '#home').catch(() => {});
await A.page.evaluate(() => { location.hash = 'home'; });
await A.page.locator('.fab').click();
for (const k of ['9', '9', '9']) await A.page.locator('.keypad [data-v="' + k + '"]').click();
await A.page.locator('#add-where').fill('Офлайн-покупка');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
const r = await A.sync();
ok(r.error === 'offline', 'без сети синхронизация не падает, а ждёт');
await A.page.evaluate(() => { location.hash = 'profile'; });
ok((await A.page.locator('#sync-status').innerText()).includes('Ждут отправки: 1'), 'в профиле видно: 1 изменение ждёт отправки');
await A.ctx.setOffline(false);
await A.sync();
await B.sync();
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Офлайн-покупка')), 'после появления сети трата дошла до телефона B');

console.log('6. «Отменить» тоже синхронизируется');
await A.page.evaluate(() => { location.hash = 'home'; });
await A.page.locator('.fab').click();
await A.page.locator('.keypad [data-v="5"]').click();
await A.page.locator('#add-where').fill('Отменённая');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
await A.sync();
await B.sync();
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Отменённая')), 'трата появилась на B');
await A.page.locator('.toast-in button').click();
await A.sync();
await B.sync();
ok(!(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Отменённая'))), 'после «Отменить» на A она исчезла и на B');

console.log('7. Ошибки входа и регистрации');
const C = await device('C');
await C.page.fill('#a-name', 'Другой');
await C.page.fill('#a-login', LOGIN);
await C.page.fill('#a-pw', PW);
await C.page.check('#a-agree');
await C.page.getByRole('button', { name: 'Создать аккаунт' }).click();
await C.page.waitForSelector('.err-box');
ok((await C.text()).includes('уже зарегистрирован'), 'занятый телефон — понятная ошибка');
await C.page.getByRole('button', { name: 'Вход', exact: true }).click();
await C.page.fill('#a-login', LOGIN);
await C.page.fill('#a-pw', 'wrongpass1');
await C.page.getByRole('button', { name: 'Войти' }).click();
await C.page.waitForSelector('.err-box');
ok((await C.text()).includes('Осталось попыток: 4'), 'неверный пароль — счётчик попыток с сервера');
await C.ctx.setOffline(true);
await C.page.getByRole('button', { name: 'Войти' }).click();
await C.page.waitForFunction(() => document.querySelector('.err-box') && /Нет связи/.test(document.querySelector('.err-box').textContent));
ok(true, 'без интернета — «Нет связи с сервером»');
await C.ctx.setOffline(false);

console.log('8. Выход и истёкшая сессия');
await B.page.evaluate(() => { location.hash = 'profile'; });
await B.page.getByRole('button', { name: 'Выйти' }).click();
await B.page.waitForSelector('text=С возвращением');
ok(await B.state(() => window.NZ.app.state.txs.length === 0 && !localStorage.getItem('nummaza.auth')), 'после выхода данные и токены стёрты с устройства');
ok((await B.page.inputValue('#a-login')) === '+77015554433', 'логин подставлен для быстрого входа');
await db.query('DELETE FROM sessions');
await A.sync();
await A.page.waitForSelector('text=Сессия истекла');
ok(true, 'отозванная сессия → экран входа «Сессия истекла»');

console.log('9. Удаление аккаунта');
await A.page.fill('#a-pw', PW);
await A.page.getByRole('button', { name: 'Войти' }).click();
await A.page.waitForSelector('.safe-v');
ok(await A.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Офлайн-покупка')), 'после повторного входа всё на месте');
await A.page.evaluate(() => { location.hash = 'delete'; });
await A.page.fill('#del-w', 'удалить');
await A.page.locator('#del-btn').click();
await A.page.waitForSelector('text=Создайте аккаунт');
ok(await count("SELECT count(*)::int AS n FROM users WHERE login='+77015554433'") === 0, 'аккаунт удалён на сервере');
ok(await count('SELECT count(*)::int AS n FROM records') === 0, 'и все его данные тоже');

console.log('10. PDF-выписка на сайте с сервера (строгая политика безопасности страницы)');
const D = await device('D');
await D.page.fill('#a-name', 'Тест'); await D.page.fill('#a-login', 'pdf@test.kz'); await D.page.fill('#a-pw', PW); await D.page.check('#a-agree');
await D.page.getByRole('button', { name: 'Создать аккаунт' }).click();
for (let i = 0; i < 3; i++) { await D.page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await D.page.fill('#o-income', '400000'); await D.page.locator('[data-a="onbNext"]').click(); }
await D.page.setInputFiles('#file', '/tmp/kaspi_sample.pdf');
await D.page.waitForSelector('.safe-v', { timeout: 20000 });
await D.sync();
ok(await D.state(() => window.NZ.app.state.txs.length) === 88, 'PDF разобран: 88 операций');
ok(await count("SELECT count(*)::int AS n FROM records r JOIN users u ON u.id=r.user_id WHERE u.login='pdf@test.kz' AND r.kind='tx'") === 88, 'и все 88 на сервере');

console.log('11. iPhone: подсказка «На экран Домой» и работа без интернета');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(() => { window.NZ = { _fakeToday: '2026-11-04' }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('iPhone pageerror: ' + e.message));
  await page.goto(base);
  await page.fill('#a-name', 'Тест'); await page.fill('#a-login', 'ios@test.kz'); await page.fill('#a-pw', PW); await page.check('#a-agree');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  for (let i = 0; i < 3; i++) { await page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await page.fill('#o-income', '500000'); await page.locator('[data-a="onbNext"]').click(); }
  await page.getByRole('button', { name: 'Попробовать на примере' }).click();
  await page.waitForSelector('.safe-v');
  ok(await page.locator('[data-a="iosHow"]').isVisible(), 'на iPhone в Safari видна подсказка об установке');
  await page.locator('[data-a="iosHow"]').click();
  const sheet = await page.locator('#sheet').innerText();
  ok(sheet.includes('На экран Домой') && sheet.includes('Apple не даёт'), 'инструкция: «Поделиться» → «На экран Домой», и честно про уведомления банка');
  await page.getByRole('button', { name: 'Понятно' }).click();
  await page.waitForSelector('#sheet .scrim', { state: 'detached' });
  await page.locator('[data-a="dismiss"][data-v="ios-install"]').click();
  ok(await page.locator('[data-a="iosHow"]').count() === 0, 'подсказку можно закрыть');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForSelector('.safe-v');
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker управляет страницей');
  ok(await page.evaluate(async () => (await (await caches.open('nummaza-files')).keys()).length > 15), 'файлы приложения сохранены на телефоне');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.safe-v', { timeout: 15000 });
  ok((await page.locator('#app').innerText()).includes('Сегодня можно потратить'), 'без интернета приложение открывается с данными');
  await ctx.setOffline(false);
  await ctx.close();
  // Android Chrome / обычный компьютер — подсказки для iPhone нет
  ok(!(await D.page.locator('[data-a="iosHow"]').count()), 'не на iPhone подсказки нет');
}

console.log('12. Версия 1.3: почта для восстановления, сброс пароля, семья, рассрочки');
{
  const signup = async (dev, name, login, income) => {
    await dev.page.fill('#a-name', name); await dev.page.fill('#a-login', login); await dev.page.fill('#a-pw', PW); await dev.page.check('#a-agree');
    await dev.page.getByRole('button', { name: 'Создать аккаунт' }).click();
    for (let i = 0; i < 3; i++) { await dev.page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await dev.page.fill('#o-income', income); await dev.page.locator('[data-a="onbNext"]').click(); }
    await dev.page.getByRole('button', { name: 'Попробовать на примере' }).click();
    await dev.page.waitForSelector('.safe-v');
  };
  const E = await device('E');
  await signup(E, 'Мама', '+7 702 111 22 33', '600000');
  await E.page.evaluate(() => { location.hash = 'profile'; });
  await E.page.fill('#rec-email', 'mama@test.kz');
  await E.page.locator('[data-form="email"] button[type="submit"]').click();
  await E.page.waitForSelector('text=Почта сохранена');
  ok(await count("SELECT count(*)::int AS n FROM users WHERE email='mama@test.kz'") === 1, 'почта для восстановления сохранена на сервере');

  // Семья: E создаёт, F вступает по коду
  await E.page.evaluate(() => { location.hash = 'family'; });
  await E.page.fill('#fam-name', 'Семья Б.');
  await E.page.locator('[data-form="famCreate"] button[type="submit"]').click();
  await E.page.waitForSelector('[data-a="famInvite"]');
  await E.page.locator('[data-a="famInvite"]').click();
  await E.page.waitForSelector('text=Код приглашения');
  const code = (await E.page.locator('.note').innerText()).match(/: ([A-Z0-9]{6})\./)[1];
  ok(/^[A-Z0-9]{6}$/.test(code), 'код приглашения показан: ' + code);
  const F = await device('F');
  await signup(F, 'Папа', '+7 702 444 55 66', '700000');
  await F.page.evaluate(() => { location.hash = 'family'; });
  await F.page.fill('#fam-code', 'ZZZZZZ');
  await F.page.locator('[data-form="famJoin"] button[type="submit"]').click();
  await F.page.waitForSelector('text=Код не подошёл');
  ok(true, 'неверный код отклонён');
  await F.page.fill('#fam-code', code.toLowerCase());
  await F.page.locator('[data-form="famJoin"] button[type="submit"]').click();
  await F.page.waitForSelector('[data-a="famInvite"]');
  ok((await F.text()).includes('Мама') && (await F.text()).includes('Папа'), 'второй участник вступил, видит обоих');

  // E отмечает трату как семейную в листе операции → F видит её в семейном бюджете
  const spendId = await E.state(() => window.NZ.app.state.txs.find((x) => x.amount < 0 && x.date.startsWith('2026-11')).id);
  await E.page.evaluate(() => { location.hash = 'home'; });
  await E.page.waitForSelector('.safe-v');
  await E.page.evaluate((id) => window.NZ.app.openSheet('tx', { id }), spendId);
  await E.page.locator('[data-ch="txFam"]').check();
  for (let i = 0; i < 40 && await count('SELECT count(*)::int AS n FROM family_records') === 0; i++) await new Promise((r) => setTimeout(r, 250));
  ok(await count('SELECT count(*)::int AS n FROM family_records') === 1, 'семейная трата ушла на сервер (личные — нет)');
  await F.page.reload();
  await F.page.evaluate(() => { location.hash = 'family'; });
  await F.page.waitForSelector('[data-a="famInvite"]');
  ok((await F.state(() => window.NZ.app.state.family.records.length)) === 1, 'второй участник видит общую трату');
  await E.page.evaluate(() => window.NZ.app.closeSheet && window.NZ.app.closeSheet());

  // Рассрочка синхронизируется на другое устройство того же аккаунта
  await E.page.evaluate(() => { const s = window.NZ.app.state; s.loans.push({ id: 'ln1', name: 'Диван 0-0-12', bank: 'Kaspi', kind: 'inst', monthly: 30000, left: 8, next: '2026-11-20', createdAt: '2026-11-04' }); window.NZ.app.commit(); });
  await E.sync();
  ok(await count("SELECT count(*)::int AS n FROM records WHERE kind='loan'") === 1, 'рассрочка сохранена на сервере');

  // Забыли пароль: код приходит на почту, новый пароль, вход
  await E.page.evaluate(() => { location.hash = 'profile'; });
  await E.page.getByRole('button', { name: 'Выйти' }).click();
  await E.page.waitForSelector('#a-pw');
  if (await E.page.locator('[data-a="forgot"]').count() === 0) await E.page.getByRole('button', { name: 'Войти', exact: true }).first().click();
  await E.page.locator('[data-a="forgot"]').click();
  await E.page.fill('#fg-login', '+7 702 111 22 33');
  await E.page.locator('[data-form="forgot1"] button[type="submit"]').click();
  await E.page.waitForSelector('#fg-code');
  ok(mails.length === 1 && mails[0].to === 'mama@test.kz', 'письмо с кодом отправлено на почту восстановления');
  const mailCode = mails[0].text.match(/\b(\d{6})\b/)[1];
  await E.page.fill('#fg-code', '000000'); await E.page.fill('#fg-pw', 'novyiparol7');
  await E.page.locator('[data-form="forgot2"] button[type="submit"]').click();
  await E.page.waitForSelector('text=Неверный код');
  ok((await E.page.locator('#sheet').innerText()).includes('Осталось попыток'), 'неверный код: показано, сколько попыток осталось');
  await E.page.fill('#fg-code', mailCode); await E.page.fill('#fg-pw', 'novyiparol7');
  await E.page.locator('[data-form="forgot2"] button[type="submit"]').click();
  await E.page.waitForSelector('.safe-v');
  ok((await E.page.locator('.toast-in').innerText()).includes('Пароль изменён'), 'новый пароль установлен, вход выполнен');
  ok(await E.state(() => window.NZ.app.state.loans.some((l) => l.name === 'Диван 0-0-12')), 'после сброса пароля данные (и рассрочка) на месте');
  await E.ctx.close(); await F.ctx.close();
}

ok(errors.length === 0, 'нет ошибок в консоли' + (errors.length ? ':\n    ' + errors.join('\n    ') : ''));
await browser.close();
server.close();
await db.close();
console.log('\nИтого: ' + passed + ' прошло, ' + failed + ' упало');
process.exit(failed ? 1 : 0);
