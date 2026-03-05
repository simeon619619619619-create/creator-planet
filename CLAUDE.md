# Founders Club

All-in-one platform for mentors, coaches, and course creators. Replaces Discord+Kajabi+Calendly+Skool+Zapier. (React 19 + TypeScript + Vite + Supabase + Stripe + Gemini AI)

## Quick Start
```bash
npm install && npm run dev   # Dev server
npm run build                # Production build
```

## Key Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npx supabase functions deploy <name>` | Deploy edge function |
| `npx supabase functions deploy <name> --no-verify-jwt` | Deploy webhook receiver |

## Project Structure
> Deep dive: [docs/architecture.md](docs/architecture.md)

```
src/features/    # Feature modules (billing, courses, community, team, etc.)
src/shared/      # Reusable UI (Avatar, Logo, Sidebar)
src/core/        # Types, Supabase client
src/i18n/        # en.json + bg.json (default: Bulgarian)
supabase/functions/  # Edge functions with _shared/ utilities
```

## Architecture Pointers
> Deep dive: [docs/architecture.md](docs/architecture.md)

- **Feature modules**: `src/features/<name>/` with components/, hooks/, pages/
- **Profile ID ≠ User ID**: ALL FKs reference `profiles.id`, NOT `auth.users.id` — use `profile.id` from `useAuth()`
- **Billing**: Wallet model — platform collects 100%, tracks balances, pays out via Connect → [docs/billing.md](docs/billing.md)
- **i18n**: All text via `t('key')`. Verify BOTH `en.json` + `bg.json` after UI changes
- **Edge functions**: Deploy via CLI (MCP can't resolve `_shared/` imports)

## Environment & MCP
> Details: [docs/environment.md](docs/environment.md) | [docs/mcp-config.md](docs/mcp-config.md)

- **Supabase**: `ilntxxutxbygjuixrzng` (FC) — MCP has service_role access
- **Stripe**: New account TBD — products not yet created
- **Vercel**: https://creator-planet.vercel.app (will change)
- **DB direct access**: Use CLI pooler from `supabase db dump --dry-run`, then `SET ROLE postgres`

## Rules & Style
- TypeScript strict mode, `import type` for type-only imports
- Use `??` never `||` for numeric fallbacks (falsy zero bug)
- RLS policies: ALWAYS include `TO authenticated` or `TO anon`
- Webhook functions: ALWAYS deploy with `--no-verify-jwt`
- Currency: Always integer cents in DB (€30 = 3000)
- i18n plurals: `_one`/`_other` suffixes (i18next v21+)

## Gotchas (Top 5)
> Full list: [docs/gotchas.md](docs/gotchas.md)

1. **Profile ID vs User ID** — `profile.id` for DB ops, never `user.id`
2. **RLS `TO` clause** — omitting defaults to `PUBLIC` which authenticated users can't use
3. **`||` vs `??`** — `0 || fallback` silently returns fallback (broke Exclusive plan fees)
4. **Edge function `--no-verify-jwt`** — webhooks get 401 at gateway without it
5. **i18n both locales** — missing keys in bg.json shows raw key text to Bulgarian users

## Skills
Custom skills in `.claude/skills/`: billing-integration, stripe-integration, stripe-webhooks, stripe-best-practices

## Discovery Log (Recent)
> Full log: [docs/discovery-log.md](docs/discovery-log.md)

- [2026-03-05] CC → FC database migration (20 tables imported, modules/lessons still missing)
- [2026-03-05] Full rebrand: Creator Club → Founders Club
- [2026-02-14] Stripe webhook 401 fix, discount codes, dual pricing, billing settings
- [2026-01-28] RLS policy role bug fix
- [2026-01-24] Team member system review

## Active Context
Database migrated from CC to FC Supabase. Still missing: modules, lessons, events, event_attendees, lesson_progress, quiz_attempts (need MCP on CC to extract — RLS blocks anon key). Schema differences exist (CC has extra columns). Stripe account not yet configured on FC.
