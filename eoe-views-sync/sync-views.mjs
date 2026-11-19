// Eyes on Eyecare: copy article view counts from Abacus into the Webflow CMS field "views" ("29 views"),
// so the number is in the page HTML on the very first load. Run by .github/workflows/sync-views.yml.
// Env: WEBFLOW_TOKEN (Site API token, CMS read + write)

const TOKEN = process.env.WEBFLOW_TOKEN;
if (!TOKEN) throw new Error('WEBFLOW_TOKEN is missing');

const ABACUS = 'https://abacus.jasoncameron.dev/get/eyesoneyecare/';
const API = 'https://api.webflow.com/v2';
const FIELD = 'views';
// URL prefix (collection slug) -> collection ID; must match the site script (ArticleViewsCounter)
const COLLECTIONS = {
  'news': '6ad09fe30d94e165bdb51650',
  'market-research': '6ad09fe4b679a54cbe8e60b6',
  'eyecare-executive': '6ad09fe4d184dfb5599e0b6f',
  'case-studies': '6abe38599ee094bc6f839d38',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toNum = (v) => parseInt(String(v ?? '').replace(/\D/g, ''), 10) || 0;
const fmt = (n) => n.toLocaleString('en-US') + (n === 1 ? ' view' : ' views');

async function wf(path, init = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(API + path, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', accept: 'application/json' },
    });
    if (res.status === 429 && i < 5) { await sleep(5000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`Webflow ${res.status} ${init.method || 'GET'} ${path}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
}

async function liveItems(collectionId) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const d = await wf(`/collections/${collectionId}/items/live?limit=100&offset=${offset}`);
    out.push(...(d.items || []));
    if (!d.pagination || offset + 100 >= d.pagination.total) return out;
  }
}

// Abacus allows 30 requests / 10 s per IP -> ~2 per second
async function abacus(key) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(ABACUS + key);
    await sleep(400);
    if (res.status === 404) return 0; // no views yet
    if (res.status === 429) { await sleep(10000); continue; }
    if (!res.ok) throw new Error(`Abacus ${res.status} ${key}`);
    return toNum((await res.json()).value);
  }
  return null;
}

let changed = 0;
for (const [prefix, collectionId] of Object.entries(COLLECTIONS)) {
  const items = await liveItems(collectionId);
  const updates = [];
  for (const it of items) {
    const key = `${prefix}-${it.fieldData.slug}`.toLowerCase().slice(0, 64); // same key as the site script
    const count = await abacus(key);
    if (count == null) continue;
    const current = toNum(it.fieldData[FIELD]);
    if (count > current) updates.push({ id: it.id, fieldData: { [FIELD]: fmt(count) } });
  }
  for (let i = 0; i < updates.length; i += 100) {
    const items = updates.slice(i, i + 100);
    // staged first (so a later full-site publish keeps the number), then live (shows on the site right away)
    await wf(`/collections/${collectionId}/items`, { method: 'PATCH', body: JSON.stringify({ items }) });
    await wf(`/collections/${collectionId}/items/live`, { method: 'PATCH', body: JSON.stringify({ items }) });
  }
  changed += updates.length;
  console.log(`${prefix}: ${items.length} live items, ${updates.length} updated`);
}
console.log(`done, ${changed} items updated`);
