// Сквозной тест NUMMAZA в настоящем браузере (Playwright + Chromium).
// Запуск: node tests/e2e.mjs [путь к index.html] [папка для скриншотов]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(process.argv[2] || new URL('../app/index.html', import.meta.url).pathname);
const shots = process.argv[3] || '/tmp/nz-shots';
fs.mkdirSync(shots, { recursive: true });
const PDF = '/tmp/kaspi_sample.pdf';
const CSV = '/tmp/sample.csv';
const url = 'file://' + root;

let failed = 0; let passed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
await ctx.addInitScript(() => { window.NZ = { _fakeToday: '2026-11-04' }; });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /i18n/.test(m.text()))) errors.push(m.type() + ': ' + m.text()); });
const text = () => page.locator('#app').innerText();
const shot = (n) => page.screenshot({ path: path.join(shots, n + '.png') });

console.log('1. Регистрация');
await page.goto(url);
ok(await page.getByRole('heading', { name: 'Создайте аккаунт' }).isVisible(), 'по умолчанию открыта регистрация');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
ok((await text()).includes('Введите имя') && (await text()).includes('Отметьте согласие'), 'ошибки пустой формы показаны');
await page.fill('#a-name', 'Айдана');
await page.fill('#a-login', '8 700 123 45 67');
await page.fill('#a-pw', 'nummaza2026');
await page.check('#a-agree');
await shot('01-signup');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
await page.waitForSelector('text=Добро пожаловать в NUMMAZA');
ok(true, 'аккаунт создан, открыт онбординг');

console.log('2. Онбординг');
await page.getByRole('button', { name: /Қазақша/ }).click();
ok((await text()).includes('NUMMAZA-ға қош келдіңіз'), 'язык переключается на казахский сразу');
await page.getByRole('button', { name: /Русский/ }).click();
await page.getByRole('button', { name: 'Ночная' }).click();
ok((await page.getAttribute('html', 'data-app-theme')) === 'dark', 'ночная тема включилась');
await shot('02-onb-dark');
await page.getByRole('button', { name: 'Дневная' }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.getByRole('button', { name: 'Далее' }).click();
ok((await text()).includes('Укажите доход больше 0'), 'без дохода дальше не пускает');
await page.fill('#o-income', '650000');
ok((await page.locator('#o-est').innerText()).includes('18'), 'дневной лимит пересчитывается на лету');
await page.getByRole('button', { name: '5', exact: true }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.getByRole('button', { name: /Подушка безопасности/ }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.waitForSelector('text=Загрузите выписку Kaspi');
await page.setInputFiles('#file', PDF);
await page.waitForSelector('text=Сегодня можно потратить', { timeout: 15000 });
ok(true, 'PDF-выписка загружена в онбординге, открыт обзор');
await page.waitForTimeout(400);
await shot('03-home');

console.log('3. Обзор');
const st = await page.evaluate(() => { const s = window.NZ.app.state; return { n: s.txs.length, own: s.txs.filter((x) => x.own).length, sal: s.txs.filter((x) => x.cat === 'salary').length, cafe: s.txs.filter((x) => x.cat === 'cafe').length, env: Object.keys(s.envelopes).length, goals: s.goals.length }; });
ok(st.n === 88, 'распознаны все 88 операций из PDF (' + st.n + ')');
ok(st.own === 2 && st.sal === 2, 'переводы с депозита — не доход, зарплата распознана');
ok(st.cafe > 10, 'Glovo попал в «Кафе и доставка»');
ok(st.env > 3, 'лимиты конвертов предложены автоматически');
ok(st.goals === 1, 'цель из онбординга создана');
const safe = await page.locator('.safe-v').innerText();
ok(/\d/.test(safe) && safe.includes('₸'), '«Сегодня можно» посчитано: ' + safe.replace(/\s/g, ' '));
await page.locator('.safe-btn').click();
ok(await page.locator('.formula').isVisible(), 'формула раскрывается по нажатию');
await page.locator('.day:not([disabled])').first().click();
ok((await page.locator('.day[aria-pressed="true"]').count()) === 1, 'день календаря выбирается');
await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
ok((await text()).includes('октябрь'), 'календарь листается на прошлый месяц');
ok((await page.locator('.tip').count()) >= 1, 'советы Numa показаны: ' + (await page.locator('.tip').count()));
ok(await page.locator('.fab').isVisible(), 'кнопка «+» есть на обзоре');

console.log('4. Добавление операции и отмена');
await page.locator('.fab').click();
for (const k of ['3', '5', '0', '0']) await page.locator('.keypad [data-v="' + k + '"]').click();
ok((await page.locator('.amount output').innerText()).includes('3'), 'сумма набирается на клавиатуре');
ok(/останется|минус/.test(await page.locator('.amount .small').innerText()), 'подсказка по конверту считается вживую');
await page.locator('[data-a="addCat"][data-v="cafe"]').click();
await shot('04-add');
await page.getByRole('button', { name: 'Сохранить' }).click();
await page.waitForSelector('.toast-in');
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 89, 'трата сохранена');
await page.locator('.toast-in button').click();
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 88, '«Отменить» в тосте возвращает как было');
await page.locator('.fab').click();
await page.locator('.keypad [data-v="7"]').click();
await page.keyboard.press('Escape');
await page.locator('.fab').click();
ok((await page.locator('.amount output').innerText()).includes('7'), 'черновик восстанавливается после закрытия');
await page.keyboard.press('Escape');
await page.evaluate(() => { const s = window.NZ.app.state; s.draft = null; });

console.log('5. Выписки: дубликаты и CSV');
await page.goto(url + '#statements');
await page.setInputFiles('#file', PDF);
await page.waitForSelector('text=Уже были загружены', { timeout: 15000 });
ok(true, 'повторная выписка — дубликаты пропущены');
await page.setInputFiles('#file', CSV);
await page.waitForFunction(() => window.NZ.app.state.txs.some((x) => /starbucks/i.test(x.raw)), null, { timeout: 15000 });
const csv = await page.evaluate(() => window.NZ.app.state.txs.filter((x) => /starbucks|wildberries/i.test(x.raw)).map((x) => x.cat).join(','));
ok(csv === 'cafe,refund', 'CSV разобран, категории верные (' + csv + ')');
const badFile = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') };
await page.setInputFiles('#file', badFile);
ok((await text()).includes('Это не PDF и не CSV'), 'не тот файл — понятная ошибка');
await shot('05-statements');

console.log('6. Исправление категории');
await page.goto(url + '#ops');
await page.getByRole('button', { name: 'проверьте', exact: true }).click();
const reviewN = await page.locator('.li-btn').count();
ok(reviewN >= 1, 'фильтр «проверьте» находит сомнительные операции: ' + reviewN);
await page.locator('.li-btn').first().click();
await page.locator('[data-a="setCat"][data-v="shopping"]').click();
ok((await page.locator('.toast-in').innerText()).includes('Запомнила'), 'категория исправлена и запомнена как правило');
ok(await page.evaluate(() => Object.keys(window.NZ.app.state.rules).length) === 1, 'правило сохранено');

console.log('7. Конверты');
await page.goto(url + '#envelopes');
ok((await page.locator('.env').count()) >= 3, 'конверты показаны');
await page.locator('.env').first().click();
await page.fill('#env-lim', '99000000');
await page.getByRole('button', { name: 'Сохранить' }).click();
ok((await page.locator('.sheet').innerText()).includes('не может быть больше дохода'), 'лимит выше дохода не даёт сохранить');
await page.fill('#env-lim', '150000');
await page.getByRole('button', { name: 'Сохранить' }).click();
ok((await page.locator('.toast-in').innerText()).includes('Лимиты обновлены'), 'лимит сохранён');
await page.getByRole('button', { name: 'Перерасход', exact: true }).click();
await shot('06-envelopes');

console.log('8. Numa');
await page.goto(url + '#numa');
for (let i = 0; i < 6; i++) {
  await page.locator('[data-a="ask"]').nth(i).click();
  await page.waitForFunction((n) => document.querySelectorAll('.msg-n:not(.thinking)').length >= n, i + 1);
}
const answers = await page.locator('.msg-n:not(.thinking)').allInnerTexts();
ok(answers.length === 6 && answers.every((a) => a.length > 20), 'Numa ответила на все 6 готовых вопросов');
ok(answers[0].includes('доход') && answers[0].includes('₸'), 'ответ о бюджете с суммами');
ok(/Подписк|подписк/.test(answers[4]) && answers[4].includes('2'), 'нашла подписку Netflix');
ok(answers[5].includes('не инвестиционный совет'), 'про депозиты — с оговоркой');
await page.fill('#q', 'сколько я трачу на такси?');
await page.press('#q', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('.msg-n:not(.thinking)').length >= 7);
ok((await page.locator('.msg-n:not(.thinking)').last().innerText()).includes('Транспорт'), 'свободный вопрос про такси понят');
await page.locator('.basis summary').last().click();
ok((await page.locator('.basis').last().innerText()).includes('на устройстве'), '«На чём основан ответ» раскрывается');
await shot('07-numa');

console.log('9. Цели');
await page.goto(url + '#goals');
await page.getByRole('button', { name: '+ Цель' }).click();
await page.getByRole('button', { name: 'Создать цель' }).click();
ok((await page.locator('.sheet').innerText()).includes('Введите название'), 'пустую цель создать нельзя');
await page.fill('#g-name', 'Ноутбук');
await page.fill('#g-target', '100000');
await page.locator('#g-target').dispatchEvent('input');
ok((await page.locator('#g-hint').innerText()).includes('в месяц'), 'подсказка по взносу считается');
await page.getByRole('button', { name: 'Создать цель' }).click();
await page.locator('.goal').filter({ hasText: 'Ноутбук' }).getByRole('button', { name: 'Пополнить' }).click();
await page.fill('#ga-amt', '60000');
await page.locator('.sheet').getByRole('button', { name: 'Пополнить' }).click();
ok((await page.locator('.toast-in').innerText()).includes('50% пути'), 'отметка 50% пути');
await page.locator('.goal').filter({ hasText: 'Ноутбук' }).getByRole('button', { name: 'Пополнить' }).click();
await page.fill('#ga-amt', '40000');
await page.locator('.sheet').getByRole('button', { name: 'Пополнить' }).click();
ok(await page.getByRole('heading', { name: 'Цель достигнута!' }).isVisible(), 'экран-поздравление на 100%');
await shot('08-goal-done');
await page.keyboard.press('Escape');

console.log('10. Итоги месяца');
await page.goto(url + '#recap');
ok((await text()).toLowerCase().includes('итоги месяца') && (await text()).toLowerCase().includes('октябрь'), 'итоги за октябрь открыты');
for (let i = 0; i < 4; i++) await page.locator('.tap-r').click();
ok((await text()).includes('Поставить цель на месяц'), 'последняя карточка с действием');
await shot('09-recap');

console.log('11. Профиль, язык, тема, данные');
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="en"]').click();
ok((await page.locator('.tabbar').innerText()).includes('Overview'), 'интерфейс на английском');
await page.locator('[data-a="lang"][data-v="kk"]').click();
ok((await page.locator('.tabbar').innerText()).includes('Шолу'), 'интерфейс на казахском');
for (const r of ['home', 'envelopes', 'numa', 'goals', 'statements', 'ops', 'recap']) { await page.goto(url + '#' + r); await page.waitForTimeout(80); }
await page.goto(url + '#home');
await shot('10-home-kk');
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="en"]').click();
for (const r of ['home', 'envelopes', 'numa', 'goals', 'statements', 'ops', 'recap']) { await page.goto(url + '#' + r); await page.waitForTimeout(80); }
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="ru"]').click();
await page.locator('[data-a="theme"][data-v="dark"]').click();
await page.goto(url + '#home');
await shot('11-home-dark');
await page.goto(url + '#profile');
await page.fill('#p-income', '700000');
await page.locator('#p-income').dispatchEvent('change');
ok((await page.locator('.toast-in').innerText()).includes('Лимит обновлён'), 'смена дохода пересчитывает лимит');
await page.locator('[data-a="notif2"][data-v="tips"]').click();
await page.goto(url + '#home');
ok((await page.locator('.tip').count()) === 0, 'советы отключаются в профиле');

console.log('12. Выход и вход');
await page.goto(url + '#profile');
await page.getByRole('button', { name: 'Выйти' }).click();
await page.fill('#a-login', '+77001234567');
await page.fill('#a-pw', 'wrongpass1');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForSelector('.err-box');
ok((await text()).includes('Осталось попыток: 4'), 'неверный пароль — понятная ошибка с попытками');
await page.fill('#a-login', '87001234567');
await page.fill('#a-pw', 'nummaza2026');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForSelector('.safe-v');
ok(true, 'вход по паролю работает, данные на месте');

console.log('13. Компьютер');
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(url + '#home');
await page.waitForTimeout(200);
ok(await page.locator('.tabbar .brand').isVisible(), 'на широком экране — боковое меню');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflow, 'нет горизонтальной прокрутки');
await shot('12-desktop-dark');
await page.setViewportSize({ width: 390, height: 844 });

console.log('14. Удаление аккаунта');
await page.goto(url + '#delete');
ok(await page.locator('#del-btn').isDisabled(), 'кнопка неактивна без слова-подтверждения');
await page.fill('#del-w', 'удалить');
ok(!(await page.locator('#del-btn').isDisabled()), 'после ввода слова — активна');
await page.locator('#del-btn').click();
await page.waitForSelector('text=Создайте аккаунт');
ok(await page.evaluate(() => localStorage.getItem('nummaza.v1') === null || JSON.parse(localStorage.getItem('nummaza.v1')).account === null), 'все данные удалены');

console.log('15. Пример данных без файла');
await page.fill('#a-name', 'Тест'); await page.fill('#a-login', 'test@example.com'); await page.fill('#a-pw', 'abcd1234'); await page.check('#a-agree');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
for (let i = 0; i < 3; i++) { await page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await page.fill('#o-income', '400000'); await page.locator('[data-a="onbNext"]').click(); }
await page.getByRole('button', { name: 'Попробовать на примере' }).click();
await page.waitForSelector('.safe-v');
ok((await text()).includes('пример данных'), 'пример данных загружен и помечен');
await page.getByRole('button', { name: 'Удалить пример' }).click();
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 0, 'пример удаляется одной кнопкой');

console.log('16. Траты из уведомлений банка (мост Android подменён)');
await page.evaluate(() => {
  const t0 = new Date('2026-11-04T12:00:00').getTime();
  let queue = [
    { pkg: 'kz.kaspi.mobile', title: 'Kaspi.kz', text: 'Покупка 2 500 ₸ MAGNUM ALMATY. Доступно 45 000 ₸', time: t0 },
    { pkg: 'kz.kaspi.mobile', title: 'Kaspi.kz', text: 'Покупка 2 500 ₸ MAGNUM ALMATY. Доступно 45 000 ₸', time: t0 + 10000 },
    { pkg: 'kz.kaspi.mobile', title: 'Kaspi.kz', text: 'Код подтверждения: 1234. Никому не сообщайте', time: t0 + 20000 },
    { pkg: 'kz.kaspi.mobile', title: 'Kaspi.kz', text: 'Вам перевели 5 000 ₸ от Айгерим Б.', time: t0 + 30000 },
    { pkg: 'kz.halyk.onlinebank', title: 'Homebank', text: 'Оплата 3 450,00 KZT GLOVO*KZ Остаток: 120 000,00 KZT', time: t0 + 40000 }
  ];
  let access = false;
  window.NummazaNative = { notifAccess: () => access, openNotifSettings: () => { access = true; }, pullNotifications: () => { const r = JSON.stringify(queue); queue = []; return r; }, share() {} };
  location.hash = 'statements';
});
await page.waitForSelector('#push-h');
ok((await text()).includes('Выключено'), 'карточка уведомлений: доступ выключен');
await page.locator('[data-a="pushSettings"]').click();
await page.evaluate(() => window.NZ.onNativeResume());
const pushTx = await page.evaluate(() => window.NZ.app.state.txs.filter((x) => x.source === 'push').map((x) => x.amount + ' ' + x.cat));
ok(pushTx.length === 3, 'из 5 уведомлений добавлено 3 операции (повтор и код пропущены): ' + pushTx.join(', '));
ok(pushTx.includes('-2500 groceries') && pushTx.includes('5000 transfer_in') && pushTx.includes('-3450 cafe'), 'суммы, знак и категории распознаны');
ok((await page.locator('.toast-in').innerText()).includes('Из уведомлений'), 'тост об импорте с отменой');
ok((await text()).includes('Включено'), 'после разрешения — «Включено»');
await page.evaluate(() => {
  const S = window.NZ.app.state;
  const covered = window.NZ.dropPushesCovered(S.txs, [{ date: '2026-11-04', amount: -2500 }]);
  window.__pushLeft = covered.kept.filter((x) => x.source === 'push').length;
});
ok(await page.evaluate(() => window.__pushLeft) === 2, 'строка выписки заменяет такую же операцию из уведомления');

console.log('\n17. Версия 1.3 и «Что нового»');
await page.evaluate(() => { location.hash = 'profile'; });
await page.waitForSelector('[data-a="news"]');
ok((await text()).includes('NUMMAZA 1.3'), 'в профиле версия 1.3');
await page.locator('[data-a="news"]').click();
await page.waitForSelector('.news li');
ok(await page.locator('#sheet-h').innerText() === 'Что нового', 'открылся лист «Что нового»');
ok(await page.locator('.news li').count() === 7, 'в списке 7 изменений версии 1.3');
ok(await page.evaluate(() => ['kk', 'en'].every((l) => { const p = window.NZ.lang; window.NZ.lang = l; const r = window.NZ.t('news.v1_3'); window.NZ.lang = p; return Array.isArray(r) && r.length === 7; })), 'список изменений переведён на казахский и английский');
await page.locator('.sheet [data-a="closeSheet"].btn').click();
ok(await page.locator('.news').count() === 0, '«Понятно» закрывает лист');

console.log('\n18. Обновления: новая веб-версия и новый APK (мост Android подменён)');
await page.evaluate(() => {
  window.NummazaNative.apkUpdate = () => JSON.stringify({ name: '1.3', url: 'https://example.com/NUMMAZA.apk' });
  window.NummazaNative.applyUpdate = () => { window.__applied = true; };
  location.hash = 'home';
});
await page.waitForSelector('.banner-teal a[href="https://example.com/NUMMAZA.apk"]');
ok((await text()).includes('Вышло приложение 1.3 для Android'), 'на «Обзоре» — баннер о новом APK со ссылкой');
await page.locator('[data-a="dismiss"][data-v="apk:1.3"]').click();
ok(await page.locator('a[href="https://example.com/NUMMAZA.apk"]').count() === 0, 'баннер APK можно закрыть');
await page.evaluate(() => window.NZ.onUpdateReady());
await page.waitForSelector('[data-a="applyUpdate"]');
ok((await text()).includes('Доступна новая версия NUMMAZA'), 'скачано обновление — баннер «Обновить»');
await page.locator('[data-a="applyUpdate"]').click();
ok(await page.evaluate(() => window.__applied === true), '«Обновить» применяет обновление через Android');

console.log('\n19. Версия 1.3: кошелёк, рассрочки, экспорт, PIN-код');
await page.evaluate(() => { delete window.NummazaNative.apkUpdate; location.hash = 'wallet'; });
await page.waitForSelector('[data-a="accNew"]');
ok((await text()).includes('Рассрочки и кредиты'), 'экран «Кошелёк» открыт');
await page.locator('[data-a="accNew"]').click();
await page.fill('#acc-name', 'Kaspi Gold');
await page.fill('#acc-bal', '120000');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForSelector('text=Kaspi Gold');
ok(await page.evaluate(() => window.NZ.app.state.accounts.length === 1 && window.NZ.app.state.accounts[0].balance === 120000), 'счёт добавлен с остатком 120 000');
await page.locator('[data-a="accNew"]').click();
await page.fill('#acc-name', 'Доллары');
await page.locator('[data-a="accCur"][data-v="USD"]').click();
await page.fill('#acc-bal', '100');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForSelector('text=Доллары');
const nw = await page.evaluate(() => window.NZ.netWorth(window.NZ.app.state).assets);
ok(nw > 120000 + 100 * 400, 'валютный счёт пересчитан в тенге (' + nw + ')');
const safeBefore = await page.evaluate(() => window.NZ.safeToday(window.NZ.app.state, window.NZ.today()).value);
await page.locator('[data-a="loanNew"]').click();
await page.locator('.sheet button[type="submit"]').click();
ok((await page.locator('.sheet').innerText()).includes('Введите название'), 'пустую рассрочку сохранить нельзя');
await page.fill('#ln-name', 'iPhone 0-0-12');
await page.fill('#ln-monthly', '45000');
await page.fill('#ln-left', '10');
await page.fill('#ln-next', '2026-11-04'); // день зарплаты 5-го: платёж сегодня попадает в текущий период
await page.locator('.sheet button[type="submit"]').click();
await page.waitForSelector('.toast-in');
ok((await page.locator('.toast-in').innerText()).includes('Сегодня можно'), 'после сохранения рассрочки — тост с новым лимитом');
const safeAfter = await page.evaluate(() => window.NZ.safeToday(window.NZ.app.state, window.NZ.today()).value);
ok(safeAfter < safeBefore, 'платёж по рассрочке уменьшил «Сегодня можно»: ' + safeBefore + ' → ' + safeAfter);
ok(await page.evaluate(() => window.NZ.upcoming(window.NZ.app.state, window.NZ.today()).some((u) => u.loan)), 'платёж появился в ближайших платежах');
ok((await text()).includes('Осталось 10 платежей'), 'на карточке — сколько платежей осталось');
await shot('19-wallet');
ok(await page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.NZ.app.state)); s.loans[0].next = '2026-11-08'; return window.NZ.reminderPlan(s, new Date('2026-11-04T10:00:00').getTime()).some((p) => /iPhone/.test(p.body) && p.at === new Date('2026-11-07T19:00:00').getTime()); }), 'напоминание накануне платежа запланировано');

await page.evaluate(() => { location.hash = 'profile'; });
await page.waitForSelector('[data-a="exportCsv"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-a="exportCsv"]').click()]);
const csvPath = await dl.path();
const expCsv = fs.readFileSync(csvPath, 'utf8');
ok(/\.csv$/.test(dl.suggestedFilename()) && expCsv.charCodeAt(0) === 0xFEFF && expCsv.includes('Дата;Сумма'), 'экспорт: CSV для Excel с заголовком (' + dl.suggestedFilename() + ')');
ok(expCsv.split('\n').filter((l) => l.trim()).length === 1 + (await page.evaluate(() => window.NZ.app.state.txs.length)), 'экспорт: все операции в файле');

await page.locator('[data-a="pinToggle"]').click();
for (const k of '1234') await page.locator('.sheet [data-a="pinSetKey"][data-v="' + k + '"]').click();
ok((await page.locator('#sheet-h').innerText()) === 'Повторите PIN-код', 'PIN: просит повторить');
for (const k of '1239') await page.locator('.sheet [data-a="pinSetKey"][data-v="' + k + '"]').click();
ok((await page.locator('.sheet').innerText()).includes('не совпали'), 'PIN: несовпадение замечено');
for (const k of '12341234') await page.locator('.sheet [data-a="pinSetKey"][data-v="' + k + '"]').click();
await page.waitForSelector('.toast-in');
ok(await page.evaluate(() => !!window.NZ.app.state.lock.hash && !JSON.stringify(window.NZ.app.state.lock).includes('1234')), 'PIN включён и хранится только как хеш');
await page.reload();
await page.waitForSelector('text=Введите PIN-код');
ok(!(await text()).includes('Сегодня можно'), 'после перезапуска — экран PIN, данные скрыты');
await shot('19-pin');
for (const k of '0000') await page.locator('[data-a="pinKey"][data-v="' + k + '"]').click();
await page.waitForSelector('text=Неверный PIN-код');
ok(true, 'неверный PIN отклонён');
for (const k of '1234') await page.locator('[data-a="pinKey"][data-v="' + k + '"]').click();
await page.waitForSelector('[data-a="pinToggle"]');
ok(true, 'верный PIN открывает приложение');
await page.evaluate(() => { location.hash = 'profile'; });
await page.locator('[data-a="pinToggle"]').click();
ok(await page.evaluate(() => !window.NZ.app.state.lock), 'PIN можно выключить');

const missing = await page.evaluate(() => window.NZ.missing);
ok(missing.length === 0, 'нет непереведённых строк' + (missing.length ? ': ' + missing.join(', ') : ''));
ok(errors.length === 0, 'нет ошибок в консоли' + (errors.length ? ':\n    ' + errors.join('\n    ') : ''));
await browser.close();
console.log('\nИтого: ' + passed + ' прошло, ' + failed + ' упало');
process.exit(failed ? 1 : 0);
