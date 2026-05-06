# Aretae Sommelier — Project Constitution

This file is loaded into every Claude Code session at the repo root. Treat it as the constitution: rules here override generic defaults. Keep it short and accurate — if something here drifts from reality, fix the file (or the code) before relying on it.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4
- **Backend:** Next.js route handlers under `src/app/api/`, Firebase (Auth, Firestore, Storage)
- **AI:** Vercel AI Gateway primary, with Google Gemini direct as fallback; uses `ai` + `@ai-sdk/google` SDK packages, server-side only
- **Hosting:** Vercel (production = `main` branch). PWA via `next-pwa`.
- **Testing:** Vitest unit tests in `src/lib/__tests__/`, Playwright E2E in `e2e/`
- **Goal:** iOS App Store launch (PWA-first, native shell later)

## Canonical paths

| Concern | Canonical file(s) | Notes |
|---|---|---|
| Firebase client SDK | `src/lib/firebase.ts` | Browser-safe; uses `NEXT_PUBLIC_FIREBASE_*` env vars |
| Firebase Admin SDK | `src/lib/firebase-admin.ts` | Server-only; exports `getAdminFirestore()`, `getAdminAuth()` |
| AI gateway client | `src/lib/ai-gateway-client.ts` | Primary AI path; handles fallback chain + response Zod validation |
| AI service (direct) | `src/lib/ai-service.ts` | Direct Gemini calls; Zod schemas for wine label / lookup parsing |
| AI route auth | `src/lib/api-auth.ts` | Bearer-token / Firebase ID-token verification for API routes |
| AI rate limiting | `src/lib/ai-rate-limit.ts` | Per-endpoint limits, Firestore-backed with in-memory fallback |
| AI observability | `src/lib/observability.ts` | `createAIRouteMonitor()` — wrap every AI route |
| Input validation | `src/lib/validation.ts` | Custom validators (no zod for HTTP input yet) |
| Wine domain logic | `src/lib/wine-service.ts`, `src/lib/drinkingWindow.ts` | |
| Type definitions | `src/types/wine.ts` | Wine, WineType enum, CellarWineSummary |
| Firestore + Storage rules | `firebase.rules.md` | Default-deny; user-scoped read/write |
| AI routes | `src/app/api/chat/`, `src/app/api/analyze-wine/`, `src/app/api/drinking-window/`, `src/app/api/wine/lookup/` | |
| Other routes | `src/app/api/wine/vivino/` | |
| Pages | `src/app/cellar/`, `src/app/cellar/[id]/`, `src/app/signin/`, `src/app/signup/`, `src/app/stats/`, `src/app/share-menu/` | |

## Security rules (non-negotiable)

- Server-side AI keys (`GEMINI_API_KEY`, `AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN`) **never** carry a `NEXT_PUBLIC_` prefix and **never** appear in client bundles. All AI calls go through `src/lib/ai-gateway-client.ts` or `src/lib/ai-service.ts`, which are imported only from `src/app/api/**`.
- Firebase Admin SDK (`src/lib/firebase-admin.ts`) is server-only — never import it from a Client Component, page component, or any file under `src/components/`.
- `FIREBASE_SERVICE_ACCOUNT_KEY` and any `serviceAccount*.json` / `*-credentials*.json` files are never committed. Store in Vercel env vars; locally in `.env.local` (gitignored).
- `.env`, `.env.local`, `.env.development.local`, `.env.production.local` are gitignored. `.env.example` is the only env file that may be committed.
- Firestore and Storage rules are default-deny. Every collection/path has an explicit `allow read, write: if ...` tied to `request.auth.uid`. Never add a public read or public write.
- User prompts and wine photos may contain personal data. Do not log raw prompts to `console.log`, Vercel Analytics events, or any third-party telemetry. The `observability.ts` monitor logs metadata (status, route, model) but not payloads — keep it that way.
- Wine photos are stored under `/wine-photos/{userId}/` in Firebase Storage and scoped to that user. Do not introduce shared/public buckets without explicit consent flag in Firestore.

## Architecture patterns

- **AI routes** must call `consumeAIRateLimit()` (from `ai-rate-limit.ts`) and wrap with `createAIRouteMonitor()` (from `observability.ts`). Both already happen in existing routes — match the pattern.
- **AI calls** prefer the gateway client (`ai-gateway-client.ts`) for resilience; fall back to `ai-service.ts` only when the gateway is bypassed intentionally.
- **Firebase reads/writes** use the typed exports from `firebase.ts` (client) or the helpers from `firebase-admin.ts` (server). Don't re-instantiate `initializeApp` elsewhere.
- **Route handlers** validate input with `src/lib/validation.ts` helpers (or zod, if you introduce it consistently). Always wrap handler bodies in `try/catch` and return structured errors via `src/lib/error-utils.ts`.
- **React Components** under `src/components/` are presentational. Data fetching happens in route handlers, server components, or context providers (`AuthContext`, `WineMenuContext`).
- **Auth state** flows through `src/contexts/AuthContext.tsx`. Don't read Firebase auth directly inside leaf components.

## Quality gates

- TypeScript strict mode is on. Avoid `any`; if unavoidable, justify it inline with a one-line comment explaining the constraint.
- `npm run lint` (ESLint via `eslint-config-next`) must pass. There is no Prettier — ESLint formatting rules are the source of truth.
- `npm run test:unit` (Vitest) must pass. New `src/lib/*.ts` files get a sibling test under `src/lib/__tests__/`.
- E2E tests (`npm run test:e2e`) cover the main flows: auth, wine CRUD, sommelier chat, filters, navigation. If you add a user-visible flow, add coverage there.
- Smoke-test `/cellar`, `/cellar/[id]`, sommelier chat, and wine analyze before merging to `main`.

## Workflow

- Branch from `main` → PR → review → merge → Vercel auto-deploys to production. No direct commits to `main`.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- Worktrees live under `.claude/worktrees/`. The canonical clone is `C:\Users\AlfThielMetelius\Repos\Aretae-Sommelier`.
- Push every branch to `origin` — never leave commits worktree-local across sessions.

## Don'ts

- Don't add dependencies without checking bundle size and license.
- Don't call external AI APIs from the client. Ever.
- Don't store wine photos without an explicit consent flag in Firestore.
- Don't bypass `consumeAIRateLimit` on AI routes — even for "internal" or "admin" endpoints.
- Don't widen Firestore/Storage rules to satisfy a failing query. Fix the query or the data shape.
- Don't introduce a second AI client wrapper. Extend `ai-gateway-client.ts` instead.
