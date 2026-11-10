/* NUMMAZA 1.3 — тексты новых экранов: кошелёк, рассрочки, экспорт, PIN, напоминания, восстановление пароля, семья.
   Добавляются к словарям из i18n.js. Казахский перевод перед релизом должен проверить носитель языка. */
(function () {
  'use strict';
  const NZ = window.NZ;
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100; const b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

  const ru = {
    prof: { more: 'Ещё', version: 'NUMMAZA 1.3 · данные хранятся на устройстве' },
    wal: { title: 'Кошелёк', net: 'Мои деньги за вычетом долгов', netSub: (a, d) => 'На счетах ' + a + ' · рассрочки и кредиты ' + d, emptyHome: 'Счета, наличные, валюта и рассрочки Kaspi Red, 0-0-12 в одном месте. Платежи по рассрочкам вычитаются из «Сегодня можно».', open: 'Открыть', onAccounts: 'На счетах' },
    acc: {
      title: 'Счета', add: 'Добавить', new: 'Новый счёт', empty: 'Добавьте карту, наличные или депозит — увидите, сколько у вас денег всего, в том числе в долларах и рублях.',
      ic: { card: '💳', cash: '💵', deposit: '🏦', other: '👛' }, type: { card: 'Карта', cash: 'Наличные', deposit: 'Депозит', other: 'Другое' },
      rates: (d, usd, eur, rub) => 'Курс НБ РК на ' + d + ': $ ' + usd + ' · € ' + eur + ' · ₽ ' + rub, ratesOld: 'сегодня, примерно',
      name: 'Название', namePh: 'Kaspi Gold', typeL: 'Тип', cur: 'Валюта', balance: (c) => 'Сколько сейчас, ' + c,
      balHint: 'Дальше остаток меняется сам по тратам и доходам, которые вы отмечаете с этого счёта.', balHintCur: 'Валютный счёт: остаток меняйте вручную, в тенге он пересчитывается по курсу.',
      del: 'Удалить счёт', deleted: 'Счёт удалён', errName: 'Введите название', from: 'Счёт', none: 'Без счёта'
    },
    loan: {
      title: 'Рассрочки и кредиты', add: 'Добавить', new: 'Новая рассрочка', empty: 'Добавьте рассрочку Kaspi Red, 0-0-12 или кредит — NUMMAZA напомнит о платеже и заранее отложит деньги в «Сегодня можно».',
      perMonth: ' в мес.', done: 'Выплачено', left: (n, s) => 'Осталось ' + n + ' ' + plural(n, 'платёж', 'платежа', 'платежей') + ' · ' + s, next: (d) => 'следующий ' + d,
      sum: (m, l) => 'Каждый месяц ' + m + ' · всего осталось ' + l, note: 'Платёж считается оплаченным в день по графику. Если погасили досрочно — измените число платежей.',
      nextHome: (n, d, a) => 'Ближайший: ' + n + ', ' + d + ' — ' + a,
      kind: { inst: 'Рассрочка', credit: 'Кредит' }, name: 'Что купили / название', namePh: 'iPhone 0-0-12', bank: 'Банк', monthly: 'Платёж в месяц, ₸', count: 'Осталось платежей', nextDate: 'Дата ближайшего платежа',
      hint: 'Дальше даты считаются сами: раз в месяц в тот же день.', del: 'Удалить', deleted: 'Рассрочка удалена',
      errName: 'Введите название', errMonthly: 'Введите сумму платежа', errLeft: 'Сколько платежей осталось (1–600)', saved: (v) => 'Сохранено. Сегодня можно: ' + v
    },
    exp: {
      btn: 'Скачать операции в Excel', cols: ['Дата', 'Сумма, ₸', 'Категория', 'Описание', 'Как в выписке', 'Счёт', 'Источник', 'Не трата', 'Семейная'],
      src: { manual: 'Вручную', push: 'Уведомление банка', statement: 'Выписка' }, yes: 'да',
      none: 'Пока нечего выгружать — нет операций', saved: (n) => 'Файл скачан: ' + n + ' операций. Откройте его в Excel или Google Таблицах', savedAndroid: (f) => 'Сохранено в «Загрузки»: ' + f, failed: 'Не удалось сохранить файл'
    },
    rem: {
      limitT: 'Сегодня можно потратить', limitB: (x) => 'Около ' + x + '. Хорошего дня!', payT: 'Завтра платёж', payB: (n, x) => n + ' — ' + x,
      envT: 'Конверт почти пуст', envB: (c, p) => c + ': потрачено ' + p + '% лимита', envOver: (c, p) => c + ': лимит превышен (' + p + '%)'
    },
    notif: {
      enable: 'Включить уведомления', active: 'Уведомления включены на этом устройстве', install: 'На iPhone уведомления работают, когда NUMMAZA установлена на экран «Домой».',
      unsupported: 'Этот браузер не умеет присылать уведомления.', denied: 'Уведомления запрещены в настройках браузера или телефона.',
      needServer: 'Уведомления работают при входе через сервер', serverOff: 'Сервер пока не настроен для уведомлений', on: 'Уведомления включены', fail: 'Не удалось включить уведомления',
      limit: 'Утром: сколько можно потратить', pay: 'Накануне платежа и рассрочки', env: 'Конверт заполнен на 80%'
    },
    pin: {
      section: 'Безопасность', toggle: 'Вход по PIN-коду', bioToggle: 'Отпечаток пальца / Face ID', change: 'Сменить PIN-код', note: 'Кто возьмёт телефон, не увидит ваши траты без PIN-кода.',
      enter: 'Введите PIN-код', hello: (n) => 'Сәлем, ' + n, dots: (n) => 'Введено цифр: ' + n + ' из 4', wait: (s) => 'Слишком много попыток. Подождите ' + s + ' с', wrong: 'Неверный PIN-код',
      bio: 'Отпечаток / Face ID', bioTitle: 'Вход в NUMMAZA', forgot: 'Забыли PIN?', forgotT: 'Сбросить PIN-код',
      forgotServer: 'Выйдем из аккаунта на этом устройстве. Данные сохранены на сервере — войдите по паролю, и всё вернётся.', forgotLocal: 'Без сервера PIN сбросить можно только вместе с данными на этом устройстве. Все операции будут удалены.', forgotYes: 'Сбросить',
      setT: 'Придумайте PIN-код', setS: '4 цифры', repeatT: 'Повторите PIN-код', repeatS: 'Ещё раз те же 4 цифры', mismatch: 'Коды не совпали, попробуйте ещё раз',
      on: 'PIN-код включён', off: 'PIN-код выключен', bioOn: 'Вход по отпечатку / Face ID включён', bioFail: 'Не получилось включить вход по отпечатку'
    },
    rec: {
      section: 'Восстановление пароля', has: (e) => 'Код для нового пароля придёт на ' + e, change: 'Изменить почту', label: 'Почта для восстановления', hint: 'Если забудете пароль, пришлём код на эту почту.',
      saved: 'Почта сохранена', errEmail: 'Проверьте адрес почты',
      title: 'Восстановление пароля', s1: 'Введите телефон или почту, с которыми входите. Пришлём код на почту, привязанную к аккаунту.', send: 'Получить код',
      noEmail: 'Нет почты в аккаунте? Тогда восстановить пароль нельзя — привяжите почту в «Профиле», пока помните пароль.',
      s2: 'Если к аккаунту привязана почта, код уже там (проверьте и «Спам»). Код действует 15 минут.', code: 'Код из письма', newPw: 'Новый пароль', reset: 'Сменить пароль и войти', again: 'Отправить код ещё раз',
      done: 'Пароль изменён, вы вошли', badCode: (n) => 'Неверный код' + (n !== '' ? '. Осталось попыток: ' + n : ''), expired: 'Код устарел — запросите новый'
    },
    fam: {
      title: 'Семейный бюджет', needServer: 'Семейный бюджет работает при входе через сервер.', introT: 'Общие траты семьи', introS: 'Создайте семью и пригласите близких по коду. Каждый сам отмечает, какие траты общие — личные операции никто не видит.',
      name: 'Название', namePh: 'Наша семья', create: 'Создать семью', joinT: 'Есть код приглашения?', code: 'Код из 6 символов', join: 'Вступить',
      over: (x) => 'Лимит превышен на ' + x, left: (x, l) => 'Осталось ' + x + ' из ' + l, noLimit: 'Лимит на месяц не задан', members: 'Участники', invite: 'Пригласить',
      codeIs: (c) => 'Код приглашения: ' + c + '. Действует 48 часов, один раз. Отправьте его близкому: «Профиль → Семейный бюджет → Вступить».',
      me: 'вы', owner: 'Создатель', member: 'Участник', kick: (n) => 'Убрать ' + n, kickText: 'Его общие траты исчезнут из семейного бюджета. Личные данные не пострадают.', kickYes: 'Убрать',
      limitL: 'Лимит семьи на месяц, ₸', ops: 'Общие траты', how: 'Чтобы трата попала сюда, отметьте «Семейная трата» при добавлении или в карточке операции.', none: 'Пока нет общих трат',
      leave: 'Выйти из семьи', leaveText: 'Ваши общие траты удалятся из семейного бюджета, личные данные останутся.', leaveYes: 'Выйти', month: 'Общие траты за месяц',
      mark: (n) => 'Семейная трата (' + n + ')', badCode: 'Код не подошёл или устарел', full: 'В семье уже 8 человек', already: 'Вы уже в семье', created: 'Семья создана — пригласите близких', joined: 'Вы в семье!'
    },
    news: { v1_3: [
      'Рассрочки и кредиты: Kaspi Red, 0-0-12 и другие. NUMMAZA помнит график, напоминает о платеже и заранее учитывает его в «Сегодня можно».',
      'Кошелёк: карты, наличные и депозиты, в том числе в долларах, евро и рублях по курсу Нацбанка.',
      'Вход по PIN-коду и отпечатку пальца или Face ID.',
      'Напоминания: утром — сколько можно потратить, накануне — о платеже, сразу — когда конверт заполнен на 80%.',
      'Семейный бюджет: общие траты и лимит на всю семью, приглашение по коду.',
      'Восстановление пароля по почте и выгрузка операций в Excel.',
      'Android: виджет «Сегодня можно» на главном экране.'
    ] }
  };

  const kk = {
    prof: { more: 'Тағы', version: 'NUMMAZA 1.3 · деректер құрылғыда сақталады' },
    wal: { title: 'Әмиян', net: 'Қарыздарды шегергендегі ақшам', netSub: (a, d) => 'Шоттарда ' + a + ' · бөліп төлеу мен несие ' + d, emptyHome: 'Шоттар, қолма-қол ақша, валюта және Kaspi Red, 0-0-12 бөліп төлеулері бір жерде. Бөліп төлеу төлемдері «Бүгін жұмсауға болады» сомасынан шегеріледі.', open: 'Ашу', onAccounts: 'Шоттарда' },
    acc: {
      title: 'Шоттар', add: 'Қосу', new: 'Жаңа шот', empty: 'Картаны, қолма-қол ақшаны немесе депозитті қосыңыз — барлық ақшаңыз, оның ішінде доллар мен рубльдегісі көрінеді.',
      ic: { card: '💳', cash: '💵', deposit: '🏦', other: '👛' }, type: { card: 'Карта', cash: 'Қолма-қол', deposit: 'Депозит', other: 'Басқа' },
      rates: (d, usd, eur, rub) => 'ҚР ҰБ бағамы, ' + d + ': $ ' + usd + ' · € ' + eur + ' · ₽ ' + rub, ratesOld: 'бүгін, шамамен',
      name: 'Атауы', namePh: 'Kaspi Gold', typeL: 'Түрі', cur: 'Валюта', balance: (c) => 'Қазір қанша, ' + c,
      balHint: 'Әрі қарай қалдық осы шоттан белгілеген шығын мен кіріс бойынша өзі өзгереді.', balHintCur: 'Валюталық шот: қалдықты қолмен өзгертіңіз, теңгеге бағам бойынша есептеледі.',
      del: 'Шотты жою', deleted: 'Шот жойылды', errName: 'Атауын енгізіңіз', from: 'Шот', none: 'Шотсыз'
    },
    loan: {
      title: 'Бөліп төлеу мен несиелер', add: 'Қосу', new: 'Жаңа бөліп төлеу', empty: 'Kaspi Red, 0-0-12 бөліп төлеуін немесе несиені қосыңыз — NUMMAZA төлемді еске салады және оны «Бүгін жұмсауға болады» сомасында алдын ала ескереді.',
      perMonth: ' / ай', done: 'Төленді', left: (n, s) => n + ' төлем қалды · ' + s, next: (d) => 'келесісі ' + d,
      sum: (m, l) => 'Ай сайын ' + m + ' · барлығы қалды ' + l, note: 'Төлем кесте бойынша күні төленді деп саналады. Мерзімінен бұрын жапсаңыз — төлем санын өзгертіңіз.',
      nextHome: (n, d, a) => 'Жақыны: ' + n + ', ' + d + ' — ' + a,
      kind: { inst: 'Бөліп төлеу', credit: 'Несие' }, name: 'Не сатып алдыңыз / атауы', namePh: 'iPhone 0-0-12', bank: 'Банк', monthly: 'Айлық төлем, ₸', count: 'Қалған төлемдер', nextDate: 'Жақын төлем күні',
      hint: 'Әрі қарай күндер өзі есептеледі: айына бір рет, сол күні.', del: 'Жою', deleted: 'Бөліп төлеу жойылды',
      errName: 'Атауын енгізіңіз', errMonthly: 'Төлем сомасын енгізіңіз', errLeft: 'Қанша төлем қалды (1–600)', saved: (v) => 'Сақталды. Бүгін жұмсауға болады: ' + v
    },
    exp: {
      btn: 'Операцияларды Excel-ге жүктеу', cols: ['Күні', 'Сомасы, ₸', 'Санат', 'Сипаттама', 'Үзіндідегідей', 'Шот', 'Дереккөз', 'Шығын емес', 'Отбасылық'],
      src: { manual: 'Қолмен', push: 'Банк хабарландыруы', statement: 'Үзінді' }, yes: 'иә',
      none: 'Әзірге жүктейтін ештеңе жоқ — операциялар жоқ', saved: (n) => 'Файл жүктелді: ' + n + ' операция. Excel немесе Google Кестелерде ашыңыз', savedAndroid: (f) => '«Жүктеулер» қалтасына сақталды: ' + f, failed: 'Файлды сақтау мүмкін болмады'
    },
    rem: {
      limitT: 'Бүгін жұмсауға болады', limitB: (x) => 'Шамамен ' + x + '. Күніңіз сәтті болсын!', payT: 'Ертең төлем', payB: (n, x) => n + ' — ' + x,
      envT: 'Конверт таусылуға жақын', envB: (c, p) => c + ': лимиттің ' + p + '% жұмсалды', envOver: (c, p) => c + ': лимиттен асты (' + p + '%)'
    },
    notif: {
      enable: 'Хабарландыруларды қосу', active: 'Бұл құрылғыда хабарландырулар қосулы', install: 'iPhone-да хабарландырулар NUMMAZA басты экранға орнатылғанда жұмыс істейді.',
      unsupported: 'Бұл браузер хабарландыру жібере алмайды.', denied: 'Хабарландырулар браузер немесе телефон баптауларында тыйым салынған.',
      needServer: 'Хабарландырулар сервер арқылы кіргенде жұмыс істейді', serverOff: 'Сервер хабарландыруларға әлі бапталмаған', on: 'Хабарландырулар қосылды', fail: 'Хабарландыруларды қосу мүмкін болмады',
      limit: 'Таңертең: қанша жұмсауға болады', pay: 'Төлем мен бөліп төлеу алдында', env: 'Конверт 80% толды'
    },
    pin: {
      section: 'Қауіпсіздік', toggle: 'PIN-кодпен кіру', bioToggle: 'Саусақ ізі / Face ID', change: 'PIN-кодты өзгерту', note: 'Телефонды алған адам PIN-кодсыз шығындарыңызды көрмейді.',
      enter: 'PIN-кодты енгізіңіз', hello: (n) => 'Сәлем, ' + n, dots: (n) => 'Енгізілді: 4-тен ' + n, wait: (s) => 'Тым көп әрекет. ' + s + ' с күтіңіз', wrong: 'PIN-код қате',
      bio: 'Саусақ ізі / Face ID', bioTitle: 'NUMMAZA-ға кіру', forgot: 'PIN-ды ұмыттыңыз ба?', forgotT: 'PIN-кодты тастау',
      forgotServer: 'Осы құрылғыда аккаунттан шығамыз. Деректер серверде сақтаулы — құпиясөзбен кірсеңіз, бәрі қайтады.', forgotLocal: 'Серверсіз PIN-ды тек осы құрылғыдағы деректермен бірге тастауға болады. Барлық операциялар жойылады.', forgotYes: 'Тастау',
      setT: 'PIN-код ойлап табыңыз', setS: '4 сан', repeatT: 'PIN-кодты қайталаңыз', repeatS: 'Сол 4 санды тағы бір рет', mismatch: 'Кодтар сәйкес келмеді, қайталап көріңіз',
      on: 'PIN-код қосылды', off: 'PIN-код өшірілді', bioOn: 'Саусақ ізі / Face ID арқылы кіру қосылды', bioFail: 'Саусақ ізімен кіруді қосу мүмкін болмады'
    },
    rec: {
      section: 'Құпиясөзді қалпына келтіру', has: (e) => 'Жаңа құпиясөз коды мына поштаға келеді: ' + e, change: 'Поштаны өзгерту', label: 'Қалпына келтіру поштасы', hint: 'Құпиясөзді ұмытсаңыз, кодты осы поштаға жібереміз.',
      saved: 'Пошта сақталды', errEmail: 'Пошта мекенжайын тексеріңіз',
      title: 'Құпиясөзді қалпына келтіру', s1: 'Кіретін телефон немесе поштаны енгізіңіз. Аккаунтқа байланған поштаға код жібереміз.', send: 'Код алу',
      noEmail: 'Аккаунтта пошта жоқ па? Онда құпиясөзді қалпына келтіру мүмкін емес — құпиясөзді есте сақтап тұрғанда «Профильде» поштаны байлаңыз.',
      s2: 'Аккаунтқа пошта байланған болса, код сонда («Спам» қалтасын да қараңыз). Код 15 минут жарамды.', code: 'Хаттағы код', newPw: 'Жаңа құпиясөз', reset: 'Құпиясөзді өзгертіп, кіру', again: 'Кодты қайта жіберу',
      done: 'Құпиясөз өзгерді, сіз кірдіңіз', badCode: (n) => 'Код қате' + (n !== '' ? '. Қалған әрекет: ' + n : ''), expired: 'Кодтың мерзімі өтті — жаңасын сұраңыз'
    },
    fam: {
      title: 'Отбасылық бюджет', needServer: 'Отбасылық бюджет сервер арқылы кіргенде жұмыс істейді.', introT: 'Отбасының ортақ шығындары', introS: 'Отбасын құрып, жақындарыңызды код арқылы шақырыңыз. Әркім қай шығын ортақ екенін өзі белгілейді — жеке операцияларды ешкім көрмейді.',
      name: 'Атауы', namePh: 'Біздің отбасы', create: 'Отбасын құру', joinT: 'Шақыру коды бар ма?', code: '6 таңбалы код', join: 'Қосылу',
      over: (x) => 'Лимиттен ' + x + ' асты', left: (x, l) => l + ' ішінен ' + x + ' қалды', noLimit: 'Айлық лимит берілмеген', members: 'Қатысушылар', invite: 'Шақыру',
      codeIs: (c) => 'Шақыру коды: ' + c + '. 48 сағат, бір рет жарамды. Жақыныңызға жіберіңіз: «Профиль → Отбасылық бюджет → Қосылу».',
      me: 'сіз', owner: 'Құрушы', member: 'Қатысушы', kick: (n) => n + ' шығару', kickText: 'Оның ортақ шығындары отбасылық бюджеттен жоғалады. Жеке деректеріне әсер етпейді.', kickYes: 'Шығару',
      limitL: 'Отбасының айлық лимиті, ₸', ops: 'Ортақ шығындар', how: 'Шығын осында түсуі үшін қосқанда немесе операция картасында «Отбасылық шығын» деп белгілеңіз.', none: 'Әзірге ортақ шығын жоқ',
      leave: 'Отбасынан шығу', leaveText: 'Ортақ шығындарыңыз отбасылық бюджеттен жойылады, жеке деректер қалады.', leaveYes: 'Шығу', month: 'Айдағы ортақ шығындар',
      mark: (n) => 'Отбасылық шығын (' + n + ')', badCode: 'Код жарамсыз немесе мерзімі өткен', full: 'Отбасында 8 адам бар', already: 'Сіз отбасындасыз', created: 'Отбасы құрылды — жақындарыңызды шақырыңыз', joined: 'Сіз отбасындасыз!'
    },
    news: { v1_3: [
      'Бөліп төлеу мен несиелер: Kaspi Red, 0-0-12 және басқалар. NUMMAZA кестені есте сақтайды, төлемді еске салады және оны «Бүгін жұмсауға болады» сомасында алдын ала ескереді.',
      'Әмиян: карталар, қолма-қол ақша және депозиттер, оның ішінде Ұлттық банк бағамы бойынша доллар, еуро және рубльмен.',
      'PIN-кодпен және саусақ ізімен немесе Face ID арқылы кіру.',
      'Еске салғыштар: таңертең — қанша жұмсауға болатыны, алдыңғы күні — төлем туралы, бірден — конверт 80% толғанда.',
      'Отбасылық бюджет: бүкіл отбасының ортақ шығындары мен лимиті, код арқылы шақыру.',
      'Құпиясөзді пошта арқылы қалпына келтіру және операцияларды Excel-ге жүктеу.',
      'Android: басты экранда «Бүгін жұмсауға болады» виджеті.'
    ] }
  };

  const en = {
    prof: { more: 'More', version: 'NUMMAZA 1.3 · data stays on your device' },
    wal: { title: 'Wallet', net: 'My money minus debts', netSub: (a, d) => 'Accounts ' + a + ' · installments and loans ' + d, emptyHome: 'Accounts, cash, foreign currency and Kaspi Red / 0-0-12 installments in one place. Installment payments are set aside from “Safe to spend”.', open: 'Open', onAccounts: 'In accounts' },
    acc: {
      title: 'Accounts', add: 'Add', new: 'New account', empty: 'Add a card, cash or a deposit to see how much money you have in total, including dollars and rubles.',
      ic: { card: '💳', cash: '💵', deposit: '🏦', other: '👛' }, type: { card: 'Card', cash: 'Cash', deposit: 'Deposit', other: 'Other' },
      rates: (d, usd, eur, rub) => 'National Bank rate, ' + d + ': $ ' + usd + ' · € ' + eur + ' · ₽ ' + rub, ratesOld: 'today (approx.)',
      name: 'Name', namePh: 'Kaspi Gold', typeL: 'Type', cur: 'Currency', balance: (c) => 'Balance now, ' + c,
      balHint: 'From now on the balance follows the expenses and income you mark with this account.', balHintCur: 'Foreign currency account: update the balance by hand; it is converted to tenge at the current rate.',
      del: 'Delete account', deleted: 'Account deleted', errName: 'Enter a name', from: 'Account', none: 'No account'
    },
    loan: {
      title: 'Installments and loans', add: 'Add', new: 'New installment', empty: 'Add a Kaspi Red, 0-0-12 installment or a loan — NUMMAZA will remind you before each payment and set the money aside in “Safe to spend”.',
      perMonth: '/mo', done: 'Paid off', left: (n, s) => n + ' payment' + (n === 1 ? '' : 's') + ' left · ' + s, next: (d) => 'next ' + d,
      sum: (m, l) => 'Every month ' + m + ' · left in total ' + l, note: 'A payment counts as paid on its scheduled date. Paid early? Change the number of payments.',
      nextHome: (n, d, a) => 'Next: ' + n + ', ' + d + ' — ' + a,
      kind: { inst: 'Installment', credit: 'Loan' }, name: 'What you bought / name', namePh: 'iPhone 0-0-12', bank: 'Bank', monthly: 'Monthly payment, ₸', count: 'Payments left', nextDate: 'Next payment date',
      hint: 'Later dates are calculated automatically: once a month on the same day.', del: 'Delete', deleted: 'Installment deleted',
      errName: 'Enter a name', errMonthly: 'Enter the payment amount', errLeft: 'How many payments are left (1–600)', saved: (v) => 'Saved. Safe to spend today: ' + v
    },
    exp: {
      btn: 'Download transactions for Excel', cols: ['Date', 'Amount, ₸', 'Category', 'Description', 'As in statement', 'Account', 'Source', 'Not spending', 'Family'],
      src: { manual: 'Manual', push: 'Bank notification', statement: 'Statement' }, yes: 'yes',
      none: 'Nothing to export yet — no transactions', saved: (n) => 'Downloaded ' + n + ' transactions. Open the file in Excel or Google Sheets', savedAndroid: (f) => 'Saved to Downloads: ' + f, failed: 'Could not save the file'
    },
    rem: {
      limitT: 'Safe to spend today', limitB: (x) => 'About ' + x + '. Have a good day!', payT: 'Payment due tomorrow', payB: (n, x) => n + ' — ' + x,
      envT: 'Envelope almost empty', envB: (c, p) => c + ': ' + p + '% of the limit spent', envOver: (c, p) => c + ': over the limit (' + p + '%)'
    },
    notif: {
      enable: 'Turn on notifications', active: 'Notifications are on for this device', install: 'On iPhone, notifications work once NUMMAZA is added to the Home Screen.',
      unsupported: 'This browser cannot show notifications.', denied: 'Notifications are blocked in your browser or phone settings.',
      needServer: 'Notifications need a server account', serverOff: 'The server is not set up for notifications yet', on: 'Notifications are on', fail: 'Could not turn on notifications',
      limit: 'Morning: how much you can spend', pay: 'The day before a payment', env: 'Envelope 80% full'
    },
    pin: {
      section: 'Security', toggle: 'PIN code', bioToggle: 'Fingerprint / Face ID', change: 'Change PIN code', note: 'Anyone who picks up your phone will not see your spending without the PIN.',
      enter: 'Enter your PIN', hello: (n) => 'Hi, ' + n, dots: (n) => n + ' of 4 digits entered', wait: (s) => 'Too many attempts. Wait ' + s + ' s', wrong: 'Wrong PIN',
      bio: 'Fingerprint / Face ID', bioTitle: 'Unlock NUMMAZA', forgot: 'Forgot PIN?', forgotT: 'Reset PIN',
      forgotServer: 'We will sign you out on this device. Your data is safe on the server — sign in with your password to get it back.', forgotLocal: 'Without a server, the PIN can only be reset together with the data on this device. All transactions will be deleted.', forgotYes: 'Reset',
      setT: 'Choose a PIN', setS: '4 digits', repeatT: 'Repeat the PIN', repeatS: 'The same 4 digits again', mismatch: 'The codes did not match, try again',
      on: 'PIN is on', off: 'PIN is off', bioOn: 'Fingerprint / Face ID unlock is on', bioFail: 'Could not turn on fingerprint unlock'
    },
    rec: {
      section: 'Password recovery', has: (e) => 'A reset code will be sent to ' + e, change: 'Change email', label: 'Recovery email', hint: 'If you forget your password, we will send a code to this address.',
      saved: 'Email saved', errEmail: 'Check the email address',
      title: 'Reset password', s1: 'Enter the phone or email you sign in with. We will send a code to the email linked to your account.', send: 'Get a code',
      noEmail: 'No email on your account? Then the password cannot be recovered — add an email in Profile while you still remember it.',
      s2: 'If your account has an email, the code is already there (check Spam too). It is valid for 15 minutes.', code: 'Code from the email', newPw: 'New password', reset: 'Change password and sign in', again: 'Send the code again',
      done: 'Password changed, you are signed in', badCode: (n) => 'Wrong code' + (n !== '' ? '. Attempts left: ' + n : ''), expired: 'The code has expired — request a new one'
    },
    fam: {
      title: 'Family budget', needServer: 'The family budget needs a server account.', introT: 'Shared family spending', introS: 'Create a family and invite your loved ones with a code. Everyone marks which expenses are shared — nobody sees personal transactions.',
      name: 'Name', namePh: 'Our family', create: 'Create family', joinT: 'Have an invite code?', code: '6-character code', join: 'Join',
      over: (x) => 'Over the limit by ' + x, left: (x, l) => x + ' left of ' + l, noLimit: 'No monthly limit set', members: 'Members', invite: 'Invite',
      codeIs: (c) => 'Invite code: ' + c + '. Valid for 48 hours, once. Send it: Profile → Family budget → Join.',
      me: 'you', owner: 'Creator', member: 'Member', kick: (n) => 'Remove ' + n, kickText: 'Their shared expenses will disappear from the family budget. Personal data is not affected.', kickYes: 'Remove',
      limitL: 'Family limit per month, ₸', ops: 'Shared expenses', how: 'To add an expense here, tick “Family expense” when adding it or in the transaction card.', none: 'No shared expenses yet',
      leave: 'Leave family', leaveText: 'Your shared expenses will be removed from the family budget; personal data stays.', leaveYes: 'Leave', month: 'Shared spending this month',
      mark: (n) => 'Family expense (' + n + ')', badCode: 'The code is wrong or expired', full: 'The family already has 8 members', already: 'You are already in a family', created: 'Family created — invite your loved ones', joined: 'You joined the family!'
    },
    news: { v1_3: [
      'Installments and loans: Kaspi Red, 0-0-12 and more. NUMMAZA keeps the schedule, reminds you before a payment and sets it aside in “Safe to spend”.',
      'Wallet: cards, cash and deposits, including dollars, euros and rubles at the National Bank rate.',
      'Unlock with a PIN code and fingerprint or Face ID.',
      'Reminders: in the morning — how much you can spend; the day before — upcoming payments; right away — when an envelope is 80% full.',
      'Family budget: shared expenses and one limit for the whole family, invite by code.',
      'Password recovery by email and export of transactions for Excel.',
      'Android: “Safe to spend” widget on the home screen.'
    ] }
  };

  function merge(dst, src) {
    Object.keys(src).forEach((k) => {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      else dst[k] = src[k];
    });
  }
  merge(NZ.I18N.ru, ru);
  merge(NZ.I18N.kk, kk);
  merge(NZ.I18N.en, en);
})();
