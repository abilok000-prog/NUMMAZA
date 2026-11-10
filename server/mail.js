// Отправка писем через Brevo (бесплатно до 300 писем в день, отправитель — ваш проверенный адрес, свой домен не нужен).
//   BREVO_API_KEY  — ключ API (Brevo → SMTP & API → API Keys)
//   MAIL_FROM      — адрес отправителя, подтверждённый в Brevo (Senders)
//   MAIL_FROM_NAME — имя отправителя (по умолчанию NUMMAZA)
// Без ключа письмо только пишется в лог сервера (разработка).

export function createMailer(env = process.env) {
  const key = env.BREVO_API_KEY;
  const from = env.MAIL_FROM;
  const name = env.MAIL_FROM_NAME || 'NUMMAZA';
  return {
    enabled: !!(key && from),
    async send({ to, subject, text, html }) {
      if (!key || !from) {
        console.log(`[mail:dev] → ${to} | ${subject}\n${text}`);
        return { dev: true };
      }
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: from, name }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error('brevo ' + res.status + ' ' + (await res.text()).slice(0, 200));
      return { sent: true };
    }
  };
}

const T = {
  ru: { subject: 'NUMMAZA: код для нового пароля', hello: 'Здравствуйте', line: 'Код для восстановления пароля NUMMAZA:', note: 'Код действует 15 минут. Если вы не просили сменить пароль, просто удалите это письмо.' },
  kk: { subject: 'NUMMAZA: жаңа құпиясөз коды', hello: 'Сәлеметсіз бе', line: 'NUMMAZA құпиясөзін қалпына келтіру коды:', note: 'Код 15 минут жарамды. Құпиясөзді өзгертуді сұрамаған болсаңыз, бұл хатты өшіріп тастаңыз.' },
  en: { subject: 'NUMMAZA: your password reset code', hello: 'Hello', line: 'Your NUMMAZA password reset code:', note: 'The code is valid for 15 minutes. If you did not ask to reset your password, just delete this email.' }
};
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function resetEmail(lang, name, code) {
  const t = T[lang] || T.ru;
  const text = `${t.hello}, ${name}!\n\n${t.line} ${code}\n\n${t.note}\n\n— NUMMAZA`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b2422;max-width:460px">
<p>${escHtml(t.hello)}, ${escHtml(name)}!</p><p>${escHtml(t.line)}</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#0B6E64">${code}</p>
<p style="color:#5d6b68;font-size:13px">${escHtml(t.note)}</p><p style="color:#5d6b68">— NUMMAZA</p></div>`;
  return { subject: t.subject, text, html };
}
