# Odoo Price Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Railway Node.js service that syncs product prices from Odoo into Firebase Firestore every 6 hours, and adds a manual "Sincronizar desde Odoo" button to the existing AdminPanel.

**Architecture:** New `odoo-sync-server` project (sibling directory to `pick-alto`) deployed on Railway. It authenticates to Odoo via JSON-RPC, reads prices from the two active "Tienda Nube" pricelists, and batch-writes them to Firestore using Firebase Admin SDK. An Express endpoint allows the AdminPanel to trigger a manual sync via a secret bearer token.

**Tech Stack:** Node.js 20 ESM, Express 4, node-cron 3, firebase-admin 12, dotenv 16. No bundler. `node:test` for unit tests.

## Global Constraints

- All files use ESM (`"type": "module"` in package.json), `.mjs` extension or `.js` with type=module.
- Odoo DB name is `odoo`, URL is `https://lett.exemax.ar`.
- Firebase collection: `pickalto_products`. Metadata doc: `sync_metadata/latest`.
- Price format (Argentine): `$ 99.990,00` — dollar sign, space, period as thousands separator, comma as decimal, always 2 decimals.
- Pricelist discovery by name (no hardcoded IDs): search active pricelists where name contains `"Tienda Nube"` but not `"Promo"` for normal price; contains both for promo. Take highest `id` (most recent month).
- Railway project root: `C:\Users\Usuario\LETT COMERCIAL Dropbox\JOAQUIN DI LERNIA\DEV-JOAQUIN-DI-LERNIA\DEV-ALTORANCHO\odoo-sync-server\`
- Frontend project root: `C:\Users\Usuario\LETT COMERCIAL Dropbox\JOAQUIN DI LERNIA\DEV-JOAQUIN-DI-LERNIA\DEV-ALTORANCHO\pick-alto\`

---

## File Map

**New files (odoo-sync-server/):**
- `package.json` — deps + scripts
- `.env.example` — all required env vars documented
- `.gitignore` — excludes `.env`, `node_modules`
- `format.mjs` — price formatting and field mapping logic
- `odoo.mjs` — Odoo JSON-RPC client (auth, callKw, fetchAll paginated)
- `firebase.mjs` — Firebase Admin SDK init, batchWrite, setMetadata
- `sync.mjs` — orchestrates full sync: find pricelists → fetch items → fetch products → build docs → write Firestore
- `index.mjs` — Express server, `/api/sync` and `/api/status` endpoints, node-cron schedule
- `test/format.test.mjs` — unit tests for format.mjs

**Modified files (pick-alto/src/):**
- `src/AdminPanel.jsx` — add sync button + status section
- `src/AdminPanel.css` — styles for sync section
- `.env` (pick-alto root) — add `VITE_SYNC_URL`, `VITE_SYNC_SECRET`

---

## Task 1: Scaffold odoo-sync-server

**Files:**
- Create: `../odoo-sync-server/package.json`
- Create: `../odoo-sync-server/.gitignore`
- Create: `../odoo-sync-server/.env.example`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir "../odoo-sync-server"
cd "../odoo-sync-server"
```

Create `package.json`:
```json
{
  "name": "odoo-sync-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.mjs",
    "dev": "node --watch index.mjs",
    "test": "node --test test/**/*.test.mjs",
    "sync": "node sync.mjs"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "firebase-admin": "^12.0.0",
    "node-cron": "^3.0.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 4: Create .env.example**

```
ODOO_URL=https://lett.exemax.ar
ODOO_DB=odoo
ODOO_LOGIN=dashboard.api@lettcomercial.com
ODOO_PASSWORD=ByAlto336
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
SYNC_SECRET=change-this-to-a-random-32-char-string
SYNC_INTERVAL_HOURS=6
PORT=3000
```

- [ ] **Step 5: Create .env from .env.example**

Copy `.env.example` to `.env`. Fill in:
- `FIREBASE_PROJECT_ID`: from Firebase console → Project Settings → General → Project ID (currently visible in `pick-alto/src/firebase.js` as `VITE_FIREBASE_PROJECT_ID`)
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`: Firebase console → Project Settings → Service Accounts → Generate New Private Key → download JSON → copy `client_email` and `private_key`
- `SYNC_SECRET`: any random string (e.g., run `node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"`)

- [ ] **Step 6: Create test directory**

```bash
mkdir test
```

- [ ] **Step 7: Commit**

```bash
git init
git add package.json .gitignore .env.example
git commit -m "feat: scaffold odoo-sync-server"
```

---

## Task 2: format.mjs — Price formatting

**Files:**
- Create: `../odoo-sync-server/format.mjs`
- Create: `../odoo-sync-server/test/format.test.mjs`

**Interfaces:**
- Produces:
  - `formatARS(amount: number): string` — formats number as `"$ 99.990,00"`
  - `buildProduct(sku, name, templateId, tnPrice, promoPrice): object` — builds Firebase document

- [ ] **Step 1: Write the failing tests**

Create `test/format.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatARS, buildProduct } from '../format.mjs';

test('formatARS formats whole number', () => {
  assert.equal(formatARS(99990), '$ 99.990,00');
});

test('formatARS formats with decimals', () => {
  assert.equal(formatARS(143790), '$ 143.790,00');
});

test('formatARS formats small number', () => {
  assert.equal(formatARS(8990), '$ 8.990,00');
});

test('buildProduct sin promo', () => {
  const p = buildProduct('ALF001BN', 'ALFOMBRA GRANDE', 38349, 99990, null);
  assert.equal(p.Name, 'ALF001BN');
  assert.equal(p.Precio, '$ 99.990,00');
  assert.equal(p.Descuento, 'NO');
  assert.equal(p.Efecivo, '$ 79.992,00');
  assert.ok(!p.Pdesceunto);
  assert.ok(!p.Porcentaje);
  assert.equal(p.img, 'https://lett.exemax.ar/web/image/product.template/38349/image_512');
});

test('buildProduct con promo', () => {
  const p = buildProduct('ALF001BN', 'ALFOMBRA GRANDE', 38349, 99990, 65994);
  assert.equal(p.Descuento, 'SI');
  assert.equal(p.Pdesceunto, '$ 65.994,00');
  assert.equal(p.Porcentaje, '34%');
});

test('buildProduct sin imagen', () => {
  const p = buildProduct('ALF001BN', 'ALFOMBRA', null, 99990, null);
  assert.ok(!p.img);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/format.test.mjs
```

Expected: `Error: Cannot find module '../format.mjs'`

- [ ] **Step 3: Implement format.mjs**

```js
const ODOO_URL = process.env.ODOO_URL || 'https://lett.exemax.ar';

export function formatARS(amount) {
  return '$ ' + Number(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildProduct(sku, name, templateId, tnPrice, promoPrice) {
  const hasPromo = promoPrice !== null && promoPrice < tnPrice;
  const discountPct = hasPromo
    ? Math.round((tnPrice - promoPrice) / tnPrice * 100)
    : null;

  const doc = {
    Name:        sku,
    Description: name,
    MODELO:      name,
    Precio:      formatARS(tnPrice),
    Efecivo:     formatARS(tnPrice * 0.80),
    Descuento:   hasPromo ? 'SI' : 'NO',
  };

  if (hasPromo) {
    doc.Pdesceunto = formatARS(promoPrice);
    doc.Porcentaje = `${discountPct}%`;
  }

  if (templateId) {
    doc.img = `${ODOO_URL}/web/image/product.template/${templateId}/image_512`;
  }

  return doc;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/format.test.mjs
```

Expected: `# tests 6`, `# pass 6`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add format.mjs test/format.test.mjs
git commit -m "feat: add price formatting and product field mapping"
```

---

## Task 3: odoo.mjs — Odoo JSON-RPC client

**Files:**
- Create: `../odoo-sync-server/odoo.mjs`

**Interfaces:**
- Produces:
  - `authenticate(): Promise<void>` — authenticates, stores session cookie internally
  - `callKw(model, method, args, kwargs): Promise<any>` — single RPC call
  - `fetchAll(model, domain, fields, pageSize?): Promise<any[]>` — paginated fetch, returns all records

- [ ] **Step 1: Create odoo.mjs**

```js
import 'dotenv/config';

const BASE_URL = process.env.ODOO_URL;
const DB       = process.env.ODOO_DB;
const LOGIN    = process.env.ODOO_LOGIN;
const PASSWORD = process.env.ODOO_PASSWORD;

let sessionCookie = '';

async function rpc(endpoint, params) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method:  'POST',
    headers,
    signal:  AbortSignal.timeout(30_000),
    body:    JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
  });

  const sc = res.headers.get('set-cookie');
  if (sc) {
    const m = sc.match(/session_id=([^;]+)/);
    if (m) sessionCookie = `session_id=${m[1]}`;
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`Odoo RPC error: ${json.error.data?.message || JSON.stringify(json.error)}`);
  }
  return json.result;
}

export async function authenticate() {
  sessionCookie = '';
  const result = await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });
  if (!result?.uid) throw new Error('Odoo authentication failed — check credentials');
  console.log(`[odoo] authenticated uid=${result.uid}`);
}

export async function callKw(model, method, args = [], kwargs = {}) {
  return rpc('/web/dataset/call_kw', {
    model, method, args,
    kwargs: { context: { lang: 'es_AR' }, ...kwargs },
  });
}

export async function fetchAll(model, domain, fields, pageSize = 1000) {
  const results = [];
  let offset = 0;
  while (true) {
    const page = await callKw(model, 'search_read', [domain], { fields, limit: pageSize, offset });
    results.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return results;
}
```

- [ ] **Step 2: Smoke-test against real Odoo**

Create a temporary test file to verify (delete after):
```js
// test-odoo-smoke.mjs
import { authenticate, fetchAll } from './odoo.mjs';
await authenticate();
const pl = await fetchAll('product.pricelist', [['active', '=', true]], ['id', 'name'], 100);
console.log('Pricelists:', pl.map(p => `[${p.id}] ${p.name}`).join('\n'));
```

```bash
node test-odoo-smoke.mjs
```

Expected: list of pricelists including "Tienda Nube | Mayo 2026" and "Tienda Nube Promocional | Mayo 2026". Delete the file after verifying.

- [ ] **Step 3: Commit**

```bash
git add odoo.mjs
git commit -m "feat: add Odoo JSON-RPC client with paginated fetch"
```

---

## Task 4: firebase.mjs — Firebase Admin SDK

**Files:**
- Create: `../odoo-sync-server/firebase.mjs`

**Interfaces:**
- Produces:
  - `batchWrite(docs: Array<{id: string, data: object}>): Promise<{written: number}>` — writes to `pickalto_products`, 500/batch
  - `deleteStale(activeSkus: Set<string>): Promise<{deleted: number}>` — removes docs whose IDs are not in activeSkus
  - `setMetadata(data: object): Promise<void>` — writes to `sync_metadata/latest`
  - `getMetadata(): Promise<object|null>` — reads `sync_metadata/latest`

- [ ] **Step 1: Create firebase.mjs**

```js
import 'dotenv/config';
import admin from 'firebase-admin';

let db;

function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    db = admin.firestore();
  }
  return db;
}

const PRODUCTS_COL  = 'pickalto_products';
const METADATA_COL  = 'sync_metadata';
const METADATA_DOC  = 'latest';
const BATCH_SIZE    = 500;

export async function batchWrite(docs) {
  const firestore = getDb();
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = firestore.batch();
    for (const { id, data } of docs.slice(i, i + BATCH_SIZE)) {
      batch.set(firestore.collection(PRODUCTS_COL).doc(id), data);
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, docs.length - i);
    console.log(`[firebase] written ${written}/${docs.length}`);
  }
  return { written };
}

export async function deleteStale(activeSkus) {
  const firestore = getDb();
  const snap = await firestore.collection(PRODUCTS_COL).select().get();
  const toDelete = snap.docs.map(d => d.id).filter(id => !activeSkus.has(id));
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = firestore.batch();
    for (const id of toDelete.slice(i, i + BATCH_SIZE)) {
      batch.delete(firestore.collection(PRODUCTS_COL).doc(id));
    }
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
  }
  if (deleted > 0) console.log(`[firebase] deleted ${deleted} stale products`);
  return { deleted };
}

export async function setMetadata(data) {
  const firestore = getDb();
  await firestore.collection(METADATA_COL).doc(METADATA_DOC).set({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function getMetadata() {
  const firestore = getDb();
  const snap = await firestore.collection(METADATA_COL).doc(METADATA_DOC).get();
  return snap.exists ? snap.data() : null;
}
```

- [ ] **Step 2: Smoke-test Firebase connection**

Create temporary test file (delete after):
```js
// test-firebase-smoke.mjs
import { getMetadata, setMetadata } from './firebase.mjs';
await setMetadata({ test: true, message: 'firebase connection ok' });
const meta = await getMetadata();
console.log('Metadata:', meta);
```

```bash
node test-firebase-smoke.mjs
```

Expected: prints `Metadata:` with `test: true` and a timestamp. Delete the file after.

- [ ] **Step 3: Commit**

```bash
git add firebase.mjs
git commit -m "feat: add Firebase Admin SDK batch write helpers"
```

---

## Task 5: sync.mjs — Core sync logic

**Files:**
- Create: `../odoo-sync-server/sync.mjs`

**Interfaces:**
- Consumes: `authenticate`, `callKw`, `fetchAll` from `./odoo.mjs`; `batchWrite`, `deleteStale`, `setMetadata` from `./firebase.mjs`; `buildProduct` from `./format.mjs`
- Produces: `runSync(): Promise<SyncResult>` where `SyncResult = { synced, skipped, deleted, durationMs, pricelists: { tnId, promoId } }`

- [ ] **Step 1: Create sync.mjs**

```js
import 'dotenv/config';
import { authenticate, callKw, fetchAll } from './odoo.mjs';
import { batchWrite, deleteStale, setMetadata } from './firebase.mjs';
import { buildProduct } from './format.mjs';

async function findPricelists() {
  const all = await fetchAll(
    'product.pricelist',
    [['active', '=', true]],
    ['id', 'name'],
    200
  );

  const tn = all
    .filter(p => p.name.includes('Tienda Nube') && !p.name.toLowerCase().includes('promo'))
    .sort((a, b) => b.id - a.id)[0];

  const promo = all
    .filter(p => p.name.includes('Tienda Nube') && p.name.toLowerCase().includes('promo'))
    .sort((a, b) => b.id - a.id)[0];

  if (!tn)    throw new Error('No active "Tienda Nube" pricelist found');
  if (!promo) throw new Error('No active "Tienda Nube Promo" pricelist found');

  console.log(`[sync] TN pricelist: [${tn.id}] ${tn.name}`);
  console.log(`[sync] Promo pricelist: [${promo.id}] ${promo.name}`);
  return { tnId: tn.id, promoId: promo.id };
}

async function fetchPriceMap(plId) {
  const items = await fetchAll(
    'product.pricelist.item',
    [['pricelist_id', '=', plId], ['compute_price', '=', 'fixed']],
    ['product_tmpl_id', 'fixed_price'],
    1000
  );
  const map = new Map();
  for (const item of items) {
    if (item.product_tmpl_id) {
      const tmplId = item.product_tmpl_id[0];
      map.set(tmplId, item.fixed_price);
    }
  }
  return map;
}

async function fetchProductMap() {
  const products = await fetchAll(
    'product.template',
    [['active', '=', true], ['default_code', '!=', false]],
    ['id', 'name', 'default_code', 'image_1920'],
    1000
  );
  const map = new Map();
  for (const p of products) {
    map.set(p.id, {
      sku:      p.default_code.trim(),
      name:     p.name.trim(),
      hasImage: !!p.image_1920,
    });
  }
  return map;
}

export async function runSync() {
  const start = Date.now();
  console.log('[sync] starting...');

  await authenticate();
  const { tnId, promoId } = await findPricelists();

  const [tnPrices, promoPrices, productMap] = await Promise.all([
    fetchPriceMap(tnId),
    fetchPriceMap(promoId),
    fetchProductMap(),
  ]);

  console.log(`[sync] TN items: ${tnPrices.size}, Promo items: ${promoPrices.size}, Products: ${productMap.size}`);

  const docs    = [];
  let   skipped = 0;

  for (const [tmplId, tnPrice] of tnPrices) {
    const product = productMap.get(tmplId);
    if (!product) { skipped++; continue; }

    const promoPrice = promoPrices.get(tmplId) ?? null;
    const data = buildProduct(
      product.sku,
      product.name,
      product.hasImage ? tmplId : null,
      tnPrice,
      promoPrice
    );
    docs.push({ id: product.sku, data });
  }

  console.log(`[sync] building ${docs.length} products (skipped ${skipped})`);

  const activeSkus   = new Set(docs.map(d => d.id));
  const [{ written }, { deleted }] = await Promise.all([
    batchWrite(docs),
    deleteStale(activeSkus),
  ]);

  const durationMs = Date.now() - start;
  const result = { synced: written, skipped, deleted, durationMs, pricelists: { tnId, promoId } };

  await setMetadata({
    ok:          true,
    synced:      written,
    skipped,
    deleted,
    durationMs,
    tnPricelist:  tnId,
    promoPricelist: promoId,
  });

  console.log(`[sync] done in ${durationMs}ms — synced: ${written}, deleted: ${deleted}, skipped: ${skipped}`);
  return result;
}

// Allow running standalone: node sync.mjs
if (process.argv[1].endsWith('sync.mjs')) {
  runSync().then(r => { console.log(r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Run standalone sync against real Odoo + Firebase**

```bash
node sync.mjs
```

Expected output (approximately):
```
[odoo] authenticated uid=2798
[sync] TN pricelist: [286] [DESC0-GRAL] Tienda Nube | Mayo 2026
[sync] Promo pricelist: [287] [DESC0-GRAL] Tienda Nube Promocional | Mayo 2026
[sync] TN items: 3838, Promo items: 3646, Products: 7251
[sync] building 3750 products (skipped 88)
[firebase] written 500/3750
...
[firebase] written 3750/3750
[sync] done in 15000ms — synced: 3750, deleted: X, skipped: 88
```

- [ ] **Step 3: Verify data in Firebase console**

Open Firebase console → Firestore → `pickalto_products`. Confirm a product like `IME005AO` exists with `Precio: "$ 99.990,00"`, `Efecivo`, and `img` fields.

- [ ] **Step 4: Commit**

```bash
git add sync.mjs
git commit -m "feat: add core sync orchestrator"
```

---

## Task 6: index.mjs — Express server + cron

**Files:**
- Create: `../odoo-sync-server/index.mjs`

**Interfaces:**
- Consumes: `runSync` from `./sync.mjs`; `getMetadata` from `./firebase.mjs`
- Produces: HTTP server on `PORT` with `/api/sync` and `/api/status`

- [ ] **Step 1: Create index.mjs**

```js
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import cron    from 'node-cron';
import { runSync }     from './sync.mjs';
import { getMetadata } from './firebase.mjs';

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.SYNC_SECRET;
const HOURS  = parseInt(process.env.SYNC_INTERVAL_HOURS || '6', 10);

app.use(cors());
app.use(express.json());

function requireToken(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

let syncRunning = false;

app.post('/api/sync', requireToken, async (req, res) => {
  if (syncRunning) return res.status(409).json({ ok: false, error: 'Sync already running' });
  syncRunning = true;
  try {
    const result = await runSync();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[server] sync error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    syncRunning = false;
  }
});

app.get('/api/status', requireToken, async (req, res) => {
  try {
    const meta = await getMetadata();
    res.json({ ok: true, running: syncRunning, lastSync: meta });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));

// Cron: every HOURS hours, starting from :00
cron.schedule(`0 */${HOURS} * * *`, () => {
  if (syncRunning) { console.log('[cron] sync already running, skipping'); return; }
  console.log('[cron] starting scheduled sync');
  syncRunning = true;
  runSync()
    .then(r => console.log('[cron] sync complete:', r))
    .catch(e => console.error('[cron] sync error:', e.message))
    .finally(() => { syncRunning = false; });
});

console.log(`[server] cron scheduled every ${HOURS}h`);
```

- [ ] **Step 2: Start server and test endpoints**

In one terminal:
```bash
node index.mjs
```
Expected: `[server] listening on :3000`

In another terminal (replace TOKEN with your SYNC_SECRET value):
```bash
curl -X GET http://localhost:3000/api/status \
  -H "Authorization: Bearer TOKEN"
```
Expected: `{"ok":true,"running":false,"lastSync":{...}}`

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer TOKEN"
```
Expected: starts sync, returns `{"ok":true,"synced":...}` after ~15s.

- [ ] **Step 3: Test 401 on bad token**

```bash
curl -X GET http://localhost:3000/api/status \
  -H "Authorization: Bearer wrong-token"
```
Expected: `{"ok":false,"error":"Unauthorized"}` with HTTP 401.

- [ ] **Step 4: Commit**

```bash
git add index.mjs
git commit -m "feat: add Express server with sync endpoint and cron schedule"
```

---

## Task 7: AdminPanel frontend — Sync button + status

**Files:**
- Modify: `pick-alto/src/AdminPanel.jsx` — add sync section
- Modify: `pick-alto/src/AdminPanel.css` — add sync section styles
- Modify: `pick-alto/.env` — add VITE_SYNC_URL + VITE_SYNC_SECRET

**Note:** `VITE_SYNC_SECRET` in the frontend is a read-only trigger token. It is not the Firebase admin key. It only allows triggering a sync — no destructive access.

- [ ] **Step 1: Add env vars to pick-alto/.env**

In `pick-alto/.env`, add:
```
VITE_SYNC_URL=http://localhost:3000
VITE_SYNC_SECRET=same-value-as-odoo-sync-server-.env-SYNC_SECRET
```
(After Railway deploy, update `VITE_SYNC_URL` to the Railway URL.)

- [ ] **Step 2: Add sync section to AdminPanel.jsx**

Open `src/AdminPanel.jsx`. The existing import at the top is:
```jsx
import { useState, useEffect } from 'react';
```
No changes needed to the import line.

Add a new state variable block after the existing `const [showCurrentData, setShowCurrentData] = useState(false);`:
```jsx
const [syncStatus, setSyncStatus]   = useState(null);   // null | 'loading' | 'success' | 'error'
const [syncResult, setSyncResult]   = useState(null);
const [lastSync,   setLastSync]     = useState(null);
```

Add a function to load last sync info after the existing `loadProducts` function:
```jsx
const loadSyncStatus = async () => {
  try {
    const url    = import.meta.env.VITE_SYNC_URL;
    const secret = import.meta.env.VITE_SYNC_SECRET;
    if (!url || !secret) return;
    const res  = await fetch(`${url}/api/status`, { headers: { Authorization: `Bearer ${secret}` } });
    const data = await res.json();
    if (data.ok && data.lastSync) setLastSync(data.lastSync);
  } catch (_) {}
};
```

Update the existing `useEffect` that calls `loadProducts()` to also call `loadSyncStatus()`:
```jsx
useEffect(() => {
  loadProducts();
  loadSyncStatus();
}, []);
```

Add a `triggerSync` function after `loadSyncStatus`:
```jsx
const triggerSync = async () => {
  const url    = import.meta.env.VITE_SYNC_URL;
  const secret = import.meta.env.VITE_SYNC_SECRET;
  if (!url || !secret) {
    setMessage({ text: 'Sync no configurado (VITE_SYNC_URL / VITE_SYNC_SECRET faltantes)', type: 'error' });
    return;
  }
  setSyncStatus('loading');
  setSyncResult(null);
  try {
    const res  = await fetch(`${url}/api/sync`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
    const data = await res.json();
    if (data.ok) {
      setSyncStatus('success');
      setSyncResult(data);
      setMessage({ text: `Sync completado: ${data.synced} productos actualizados`, type: 'success' });
      await loadProducts();
      await loadSyncStatus();
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
  } catch (err) {
    setSyncStatus('error');
    setMessage({ text: `Error en sync: ${err.message}`, type: 'error' });
  }
};
```

Add the sync section inside the `return` JSX, before the "Zona de Peligro" card:
```jsx
{/* Sync desde Odoo */}
<div className="card sync-card">
  <h2>🔄 Sincronizar desde Odoo</h2>
  {lastSync && (
    <p className="sync-last">
      Último sync:{' '}
      {lastSync.updatedAt?.toDate
        ? lastSync.updatedAt.toDate().toLocaleString('es-AR')
        : 'hace un momento'}
      {' — '}{lastSync.synced} productos
    </p>
  )}
  <button
    onClick={triggerSync}
    disabled={syncStatus === 'loading'}
    className="btn btn-sync"
  >
    {syncStatus === 'loading' ? '⏳ Sincronizando...' : '🔄 Sincronizar ahora'}
  </button>
  {syncResult && syncStatus === 'success' && (
    <div className="sync-result">
      <span>✅ {syncResult.synced} productos</span>
      <span>🗑️ {syncResult.deleted} eliminados</span>
      <span>⏱️ {(syncResult.durationMs / 1000).toFixed(1)}s</span>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add styles to AdminPanel.css**

Append to the end of `src/AdminPanel.css`:
```css
.sync-card { border-left: 3px solid #6366f1; }

.sync-last {
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.btn-sync {
  background: #6366f1;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}
.btn-sync:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sync:not(:disabled):hover { background: #4f46e5; }

.sync-result {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 0.9rem;
  color: #374151;
}
```

- [ ] **Step 4: Test manually**

Ensure `odoo-sync-server` is running (`node index.mjs`). Open the pick-alto dev server (`npm run dev`). Navigate to `/#/admin`. The "Sincronizar desde Odoo" section should show. Click the button — it should sync and show the result.

- [ ] **Step 5: Commit**

```bash
cd pick-alto
git add src/AdminPanel.jsx src/AdminPanel.css
git commit -m "feat: add Odoo sync button and status to AdminPanel"
```

---

## Task 8: Railway deployment

**Files:**
- Create: `../odoo-sync-server/railway.json` (optional health check config)

- [ ] **Step 1: Create GitHub repo for odoo-sync-server**

1. Go to github.com → New repository → name: `odoo-sync-server` → private → Create.
2. In the `odoo-sync-server` directory:
```bash
git remote add origin https://github.com/YOUR_USER/odoo-sync-server.git
git push -u origin main
```

- [ ] **Step 2: Connect Railway**

1. Go to railway.app → New Project → Deploy from GitHub → select `odoo-sync-server`.
2. Railway auto-detects Node.js and runs `npm start`.

- [ ] **Step 3: Set environment variables in Railway**

In Railway → project → Variables, add all variables from `.env.example` with real values:
```
ODOO_URL=https://lett.exemax.ar
ODOO_DB=odoo
ODOO_LOGIN=dashboard.api@lettcomercial.com
ODOO_PASSWORD=ByAlto336
FIREBASE_PROJECT_ID=<from Firebase console>
FIREBASE_CLIENT_EMAIL=<from service account JSON>
FIREBASE_PRIVATE_KEY=<from service account JSON — paste the full key including BEGIN/END lines>
SYNC_SECRET=<same random token from .env>
SYNC_INTERVAL_HOURS=6
PORT=3000
```

- [ ] **Step 4: Verify Railway deploy**

Wait for Railway to show "Active" status. Copy the Railway public URL (e.g., `https://odoo-sync-server-production.up.railway.app`).

```bash
curl https://odoo-sync-server-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_SYNC_SECRET"
```
Expected: `{"ok":true,"running":false,"lastSync":{...}}`

- [ ] **Step 5: Update pick-alto frontend env**

In `pick-alto/.env`:
```
VITE_SYNC_URL=https://odoo-sync-server-production.up.railway.app
VITE_SYNC_SECRET=same-token-as-Railway
```

Rebuild and redeploy to Hostinger:
```bash
cd pick-alto
npm run build
```
Upload the `dist/` folder to Hostinger as usual.

- [ ] **Step 6: Final end-to-end test**

Open the live site → AdminPanel → click "Sincronizar desde Odoo". Verify it completes successfully and products update in the app.

- [ ] **Step 7: Commit pick-alto env changes**

```bash
cd pick-alto
git add .env
git commit -m "feat: configure Railway sync URL for production"
```
