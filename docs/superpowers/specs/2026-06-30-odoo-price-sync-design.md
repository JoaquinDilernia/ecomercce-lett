# Odoo → Firebase Price Sync

## Overview

Automatic sync of product prices from Odoo into Firebase Firestore, so the pick-alto app (barcode scanner / price checker) always shows up-to-date prices without manual JSON uploads.

## Architecture

```
Railway (Node.js Express)
  ├── node-cron: runs sync every 6 hours
  ├── POST /api/sync  (token-protected, for AdminPanel button)
  └── GET  /api/status (last sync info)
        │
        ├── Odoo (lett.exemax.ar) — reads pricelists + products
        └── Firebase Firestore   — writes pickalto_products + sync_metadata
```

Frontend (Hostinger, React) gets a "Sincronizar desde Odoo" button in AdminPanel that calls the Railway endpoint.

## Sync Flow

1. Authenticate to Odoo via JSON-RPC (`/web/session/authenticate`), capturing the session cookie.
2. Find active pricelists dynamically by name:
   - **TN**: `product.pricelist` where name contains `"Tienda Nube"` but NOT `"Promo"`, take highest ID.
   - **TN Promo**: same but name contains both `"Tienda Nube"` AND `"Promo"`, take highest ID.
3. Fetch all pricelist items for both (paginated, 1000/page) from `product.pricelist.item`, fields: `product_tmpl_id`, `fixed_price`.
4. Fetch all active product templates with SKU from `product.template`, fields: `id`, `name`, `default_code`, `image_1920` presence flag.
5. Build map `templateId → { sku, name, hasImage }`.
6. For each TN pricelist item, merge with Promo price and product info.
7. Compute derived fields (Efectivo, Descuento, Porcentaje).
8. Write to Firestore in batches of 500 using Firebase Admin SDK.
9. Save `sync_metadata` document with timestamp, counts, pricelist IDs used.

## Data Mapping

| Firebase field | Source | Logic |
|---|---|---|
| `Name` | `product.template.default_code` | SKU as-is |
| `Description` | `product.template.name` | Product name |
| `MODELO` | `product.template.name` | Same as Description |
| `Precio` | pricelist TN `fixed_price` | Formatted `$ 99.990,00` |
| `Pdesceunto` | pricelist Promo `fixed_price` | Formatted, only if exists |
| `Descuento` | TN vs Promo comparison | `"SI"` if Promo < TN, else `"NO"` |
| `Porcentaje` | `(TN - Promo) / TN * 100` | e.g. `"34%"`, only when Descuento=SI |
| `Efecivo` | `TN * 0.80` | Formatted |
| `img` | Odoo public URL | `{ODOO_URL}/web/image/product.template/{id}/image_512` — only if product has image |

Price formatting: `$ 99.990,00` (Argentine locale, period as thousands separator, comma as decimal).

## Project Structure (Railway repo)

```
odoo-sync-server/
├── index.mjs          — Express server + cron setup
├── sync.mjs           — core sync logic (callable standalone)
├── odoo.mjs           — Odoo JSON-RPC client
├── firebase.mjs       — Firebase Admin SDK init + batch write helpers
├── format.mjs         — price formatting, field mapping
├── package.json
└── .env               — secrets (not committed)
```

## API Endpoints (Railway)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/sync` | `Authorization: Bearer {SYNC_SECRET}` | Trigger sync now |
| `GET` | `/api/status` | `Authorization: Bearer {SYNC_SECRET}` | Last sync metadata |

Response format for `/api/sync`:
```json
{ "ok": true, "synced": 3412, "skipped": 426, "durationMs": 8200, "pricelists": { "tn": 286, "promo": 287 } }
```

## Environment Variables

```
ODOO_URL=https://lett.exemax.ar
ODOO_DB=odoo
ODOO_LOGIN=dashboard.api@lettcomercial.com
ODOO_PASSWORD=ByAlto336
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
SYNC_SECRET=<random 32-char token>
SYNC_INTERVAL_HOURS=6
PORT=3000
```

## AdminPanel Changes

- Add "Sincronizar desde Odoo" button (calls `POST /api/sync`).
- Show last sync info read from `sync_metadata` Firestore document (timestamp, count synced).
- Button shows loading state while sync runs; shows success/error result.
- Store `VITE_SYNC_URL` and `VITE_SYNC_SECRET` in frontend `.env`.

## Error Handling

- **Auth fail**: throw, abort sync, log error to `sync_metadata`.
- **No pricelist found**: throw with clear message ("No active Tienda Nube pricelist found").
- **Firestore write error**: log + continue with next batch (partial sync is better than no sync).
- **Product with no TN price**: skip silently (not included in Firestore).
- **Network timeout**: default 30s timeout on all Odoo calls.

## Deployment

1. Create new repo `odoo-sync-server`, connect to Railway.
2. Add environment variables in Railway dashboard.
3. Railway auto-deploys on push to main.
4. Add `VITE_SYNC_URL` + `VITE_SYNC_SECRET` to Hostinger frontend build.
