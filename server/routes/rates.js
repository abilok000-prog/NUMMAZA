// Курсы валют Национального банка РК (USD, EUR, RUB → тенге). Кэш на 6 часов; если банк недоступен — последние известные.
import express from 'express';

const URL_NBK = 'https://nationalbank.kz/rss/rates_all.xml?switch=russian';
const TTL = 6 * 3600 * 1000;

export async function fetchNbk() {
  const res = await fetch(URL_NBK, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('nbk ' + res.status);
  return parseNbk(await res.text());
}

export function parseNbk(xml) {
  const out = {};
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => ((new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(m[1]) || [])[1] || '').trim();
    const code = get('title');
    if (!['USD', 'EUR', 'RUB'].includes(code)) continue;
    const v = parseFloat(get('description').replace(',', '.')) / (parseFloat(get('quant')) || 1);
    if (v > 0) out[code] = Math.round(v * 10000) / 10000;
    const d = /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(get('pubDate'));
    if (d) out.date = `${d[3]}-${d[2]}-${d[1]}`;
  }
  if (!out.USD) throw new Error('nbk: no USD');
  return out;
}

export function ratesRouter(source = fetchNbk) {
  const r = express.Router();
  let cache = null; let at = 0; let pending = null;
  r.get('/rates', async (req, res) => {
    if (!cache || Date.now() - at > TTL) {
      pending = pending || source().then((v) => { cache = v; at = Date.now(); }).catch((e) => { console.warn('rates', e.message); }).finally(() => { pending = null; });
      await pending;
    }
    if (!cache) return res.status(503).json({ error: 'rates_unavailable' });
    res.set('Cache-Control', 'public, max-age=3600').json(cache);
  });
  return r;
}
