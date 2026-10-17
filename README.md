# Ladies Fancy Store

Ladies Fancy Store is a static HTML, CSS, and JavaScript storefront served by a
Node.js/Express backend. The backend exposes the API and connects to MongoDB.

## Project structure

- `frontend/` - Storefront pages, styles, browser JavaScript, and product seed
  data.
- `backend/` - Express entry point at `backend/server.js`, API routes,
  middleware, MongoDB models, tests, and `package.json`.
- `images/` - Shared static images and the local-development product image
  directory at `images/products/`.
- `docs/` - Static-site copy of storefront pages and assets.

## Local development

Prerequisites: Node.js, npm, and a local MongoDB instance. In PowerShell:

```powershell
Set-Location backend
npm install
$env:JWT_SECRET = Read-Host "Set JWT_SECRET for this session"
npm run dev
```

Open `http://localhost:5000`. Express serves the frontend and `/api` from the
same origin. When `MONGO_URI` is unset locally, the backend uses its existing
local MongoDB default. Set `MONGO_URI` to use a different local database. The
backend can also be started with `npm start`. Run the backend tests from
`backend/` with `npm test`.

## Configuration

Set configuration in the backend process environment or an untracked
`backend/.env` file. Never commit secret values.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Required | Signs and verifies authentication tokens. |
| `MONGO_URI` | Required in production; optional locally | MongoDB connection URI. |
| `FRONTEND_ORIGIN` | Required in production | Exact HTTP(S) origin allowed by the CORS policy. |
| `PRODUCT_IMAGE_DIR` | Optional | Directory for uploaded product images; defaults to `images/products/` in the project. In production, configure this to a persistent writable mount. |
| `PORT` | Optional | HTTP listen port; defaults to `5000`. |

## Deployment architecture

Deploy the `backend/` Node.js application as the web service. It serves the
static `frontend/` files, API routes under `/api`, and images on the same
domain. Configure production `JWT_SECRET`, `MONGO_URI`, and `FRONTEND_ORIGIN`
in the host's environment settings. `FRONTEND_ORIGIN` must be the exact
frontend origin, without a path or trailing slash.

Use a managed MongoDB service and provide its connection URI through
`MONGO_URI`. Attach a writable persistent disk to the backend and set
`PRODUCT_IMAGE_DIR` to the mounted directory (for example, a host-provided
mount path followed by `/product-images`). The application serves files from
that directory at the existing `/images/products/<filename>` URLs. Keep that
mount available across restarts and redeployments; existing project images
continue to be served from `images/`.

Do not commit `.env` files, credentials, or database connection strings.
