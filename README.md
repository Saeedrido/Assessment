# T-World Module Service

A TypeScript content platform where reading earns tokens: content is stored in
MongoDB, summaries are produced by a pluggable AI provider, and every token
movement is written to an append-only ledger. A React console sits on top of
the API.

- **Backend** — Node 20, Express 4, Mongoose, Zod, Pino. Layered as
  route → validator → controller → service → repository/model.
- **Frontend** — React 19, Vite, Tailwind, TanStack Query, React Router.
- **Storage** — MongoDB, which must be a replica set (the token ledger uses
  multi-document transactions).

---

## Quick start

```bash
npm install
cp backend/.env.example backend/.env      # then edit MONGODB_URI
npm run db:memory                          # or point at your own replica set
npm run seed                               # prints the x-user-id values to use
npm run dev                                # API on :4000, console on :5173
```

Open <http://localhost:5173>. The console discovers the seeded accounts itself,
so there is nothing to paste in.

> **Database.** The service writes several documents per logical operation and
> wraps them in transactions, so a standalone `mongod` will not work. Use
> `npm run db:memory` (an in-memory replica set, data is discarded on exit), a
> local `mongod --replSet rs0`, or MongoDB Atlas. `npm run db:memory` prints the
> exact URI to paste into `MONGODB_URI`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Backend and console together |
| `npm run dev:backend` / `npm run dev:frontend` | One side only |
| `npm run db:memory` | In-memory MongoDB replica set (dev only) |
| `npm run seed` | Idempotent demo users and content |
| `npm test` | Backend test suite (Vitest) |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run lint` | ESLint over the whole repo |
| `npm run build` | Compile backend, build the console |

---

## Architecture

```
backend/src
  routes/       thin HTTP layer: path, validation, auth guard, controller
  validators/   Zod schemas; the only place request shapes are defined
  controllers/  translate service results into responses
  services/     business rules and transaction boundaries
  repositories/ data access, one per aggregate
  models/       Mongoose schemas, indexes and schema-level invariants
  ai/           provider interface, mock and OpenAI implementations
  media/        storage providers: mock, Cloudinary, S3
  web3/         signature verification, mock chain
  middlewares/  auth, error handling, rate limiting, request logging
```

Two rules are worth stating because most of the code follows from them:

1. **Controllers never touch Mongoose.** They read the validated request and
   call a service. Everything interesting happens in services.
2. **Provider-backed work is injected.** The AI, media and web3 providers are
   resolved through factories, so tests substitute a deterministic
   implementation and the mock providers work with no credentials.

### Token economy

All balances live in `users.tokenBalance` and every change is appended to
`token_transactions`. The two writes share a transaction, so the balance can
never move without a matching ledger row. Each row stores `balanceBefore`,
`amount` and `balanceAfter`, and the schema rejects any row where
`balanceAfter !== balanceBefore + amount` — the ledger is verifiable by an
auditor without trusting the application.

```
EARN     tokens credited (an AI run that produced a summary)
SPEND    tokens consumed by a service (an AI request) and its refund
CONVERT  tokens exchanged for a mock on-chain asset
WITHDRAW a conversion being paid out to an address
```

Amounts are always signed from the user's point of view, so a service cannot
accidentally pass a positive number to a debit.

Balances are updated with a single conditional update
(`{ tokenBalance: { $gte: -amount } }`), so two concurrent requests cannot both
spend the same tokens. Conversion, withdrawal status changes
(`SUCCESS → PROCESSING → WITHDRAWN`) and AI rewards all use it.

### AI summarisation

`POST /content/:id/ai/summarize` charges `AI_REQUEST_COST` (default 1) before
the provider is called, then pays `AI_SUCCESS_REWARD` (default 5) on success.
A failed or timed-out run **refunds the cost in full**, so nobody is billed for
a summary they did not receive, and a request the user cannot afford is
rejected with 422 before the provider runs.

The provider call is wrapped in a timeout (`AI_TIMEOUT_MS`, default 5000). A
run is always persisted — `SUCCESS`, `FAILED` or `TIMEOUT` — so usage is
auditable, and `AI_PROMPT_VERSION` is stored per run to keep old summaries
reproducible after a prompt change.

`AI_PROVIDER=mock` (default) needs no credentials and simulates latency.
`AI_PROVIDER=openai` requires `OPENAI_API_KEY`; without one the factory fails
loudly rather than silently falling back to a mock.

### Media

Uploads go to a staging provider and are promoted into permanent storage
afterwards, which keeps large files off the critical path. Promotion writes
the destination before deleting the staged copy, and the status transition is
idempotent, so retrying cannot produce two copies or lose the file.

Default `MEDIA_UPLOAD_PROVIDER=mock` and `MEDIA_PROMOTION_PROVIDER=mock` keep
the feature runnable offline. Cloudinary (staging) and any S3-compatible
service (permanent) are configured through environment variables only.

---

## API

Base URL `http://localhost:4000/api/v1`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness, no identity needed |
| `POST` | `/content` | Admin only |
| `GET` | `/content` | Paginated, `q` full-text search, repeatable `tag` |
| `GET` | `/content/:id` | |
| `POST` | `/content/:id/ai/summarize` | Charges tokens, rewards on success |
| `GET` | `/content/:id/ai/runs` | Run history for one item |
| `GET` | `/ai/runs` | Run history across all content |
| `GET` | `/tokens/balance` | |
| `GET` | `/tokens/history` | Ledger, filterable by `type` |
| `POST` | `/tokens/convert` | `{ toAsset, amount }` |
| `POST` | `/tokens/withdraw` | `{ conversionId }` |
| `GET` | `/tokens/conversions` | |
| `POST` | `/media/upload` | Admin only, multipart `file` |
| `GET` | `/media` | |
| `GET` | `/media/:id` | |
| `POST` | `/media/:id/promote` | Admin only, idempotent |
| `GET` | `/users/me` | |
| `GET` | `/users` | Admin only |
| `GET` | `/users/:id` | Admin only |
| `POST` | `/web3/verify-signature` | `{ message, signature, expectedAddress }` |
| `GET` | `/dev/seed-users` | Loopback only, dev only |

Every response uses one envelope:

```jsonc
{ "success": true,  "message": "...", "data": { } }
{ "success": true,  "message": "...", "data": [ ], "meta": { "page": 1, "totalItems": 42 } }
{ "success": false, "errorCode": "VALIDATION_ERROR", "message": "...", "details": [ ] }
```

`errorCode` is a stable machine-readable string; match on it rather than on
`message`.

A ready-to-import collection is in
[`postman/T-World.Module.Service.postman_collection.json`](postman/T-World.Module.Service.postman_collection.json).
It covers every endpoint, saves ids into collection variables as you go, and
refuses to send a request before `userId` is set.

---

## Authentication

There is no password. Requests are identified by an `x-user-id` header, which
is only honoured when all of the following hold:

- `NODE_ENV` is not `production`,
- `AUTH_DEV_ENABLED=true`,
- the request comes from a loopback address.

This exists so the console and the Postman collection work locally. **It is not
authentication.** Before deploying, replace
`backend/src/middlewares/user-context.middleware.ts` with real token verification and
set `AUTH_DEV_ENABLED=false`; the route guard will then reject every request
until you do. Role checks (`requireAdmin`) sit behind it and stay as they are.

`GET /api/v1/dev/seed-users` is mounted before the auth middleware for the same
reason — the console needs to know which accounts exist. It answers 404 in
production and when dev auth is disabled.

---

## Configuration

`backend/.env` is read at startup and validated by `config/env.ts`, which fails
fast with a specific message rather than letting a typo surface later. See
[`backend/.env.example`](backend/.env.example) for all 36 variables; the ones
that usually matter:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | — | Must be a replica set |
| `AI_PROVIDER` | `mock` | `mock` or `openai` |
| `AI_REQUEST_COST` | `1` | Charged per summary request, refunded on failure |
| `AI_SUCCESS_REWARD` | `5` | Paid when a run produces a summary |
| `AI_TIMEOUT_MS` | `5000` | Provider call ceiling |
| `RATE_TOKENS_PER_MOCK_USDT` | `100` | Exchange rate |
| `RATE_TOKENS_PER_MOCK_ETH` | `20000` | Exchange rate |
| `MEDIA_UPLOAD_PROVIDER` | `mock` | `mock` or `cloudinary` |
| `MEDIA_PROMOTION_PROVIDER` | `mock` | `mock` or `s3` |
| `CORS_ORIGINS` | localhost:5173 | Comma-separated allowed origins |

---

## Tests

```bash
npm test
```

82 tests over five suites, run against a real MongoDB replica set
(`mongodb-memory-server`) rather than a mock, so transactions, unique indexes
and query behaviour are genuinely exercised. Nothing external is required:
the AI, media and web3 providers are all stubbed.

| Suite | Covers |
| --- | --- |
| `content.api.test.ts` | CRUD, search, tags, pagination, duplicate titles, roles |
| `token.api.test.ts` | Ledger integrity, concurrent spends, conversion, withdrawal |
| `ai.api.test.ts` | Rewards, cost, refunds, timeouts, insufficient balance, run history |
| `media.api.test.ts` | Upload, promotion, idempotency, validation, failure handling |
| `user.api.test.ts` | Current user, admin directory, web3 verification, seed |

`npm run test:coverage` prints a summary and writes an HTML report to
`backend/coverage/index.html`.

---

## Notes and limitations

- `MOCK_USDT` and `MOCK_ETH` are placeholders. Conversion writes a deterministic
  mock transaction hash; no real chain is contacted.
- Signature verification defaults to a mock provider that always verifies. Set
  the real provider and contract before using it to gate anything.
- Withdrawal pays out in the same process. A production build would hand the
  payout to a queue and reconcile asynchronously.
- The ledger is append-only in application code, but nothing prevents someone
  with database access from editing it. For tamper-evidence, hash-chain the
  entries or move the ledger to a write-restricted account.
- The console has no test suite. Its behaviour was verified end to end against
  a running API, including the AI charge/refund path and identity switching,
  but there is no automated regression net for the UI yet.
