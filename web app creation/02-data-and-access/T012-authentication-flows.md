# T012 — Authentication Flows

## Status

Done

## Depends on

`T010`, `T011`.

## Unblocks

`T013`, `T014`, `T040`, `T051`.

## Goal

Provide secure sign-in and session handling for the dashboard and extension.

## Owned paths

- Auth pages and hooks
- Auth callback handling
- Session provider
- Auth-related Edge Function helpers

## Implementation steps

1. Add email or magic-link sign-in.
2. Add GitHub OAuth configuration for identity where available.
3. Persist and refresh sessions securely.
4. Protect authenticated routes.
5. Add sign-out and session-expiry behavior.
6. Document provider setup without committing secrets.

## Acceptance criteria

- [x] Unauthenticated users cannot access protected project data.
- [x] Sessions survive a page reload.
- [x] Expired sessions recover or redirect safely.
- [x] Sign-out clears client state.
- [x] Extension authentication can reuse the approved flow.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `make test` passed all workspace gates and twenty-three Vitest tests covering
  public/auth/protected routing, loading state, controlled sign-out, and
  placeholder credential handling.
- The Supabase client is configured with `persistSession`, automatic token
  refresh, and URL callback detection. Auth state events move the provider to
  authenticated, signed-out, or safe error redirect states.
- The local callback route is `/auth/callback`; magic-link and GitHub OAuth
  redirects use the current origin and this path. No access token or session
  object is written to logs.
- `corepack pnpm --filter @projectpulse/web build` completed with the real
  Supabase client bundled into the Vite application.

## Handoff

- Browser auth lives in `apps/web/src/app/auth-client.ts` and
  `auth-context.tsx`; the client uses `@supabase/supabase-js` `2.118.0` with
  persistent browser storage, automatic refresh, and `detectSessionInUrl`.
- `/auth/login` sends magic links with `signInWithOtp` and offers GitHub OAuth;
  `/auth/callback` exchanges the OAuth/magic-link code for a session. The
  protected route renders a loading state while resolving the persisted session
  and redirects signed-out or expired sessions to login with a safe message.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only browser auth
  variables. Copy the local publishable key from `corepack pnpm run
  supabase:status` into an untracked `.env`; never use or expose
  `SUPABASE_SERVICE_ROLE_KEY` in the web bundle.
- Session state is owned by Supabase Auth's browser storage and event listener;
  sign-out calls `auth.signOut()` and clears provider state. Auth errors are
  rendered without logging tokens or raw session payloads.
- The extension can reuse the `/auth/callback` browser flow in T051; this task
  does not add extension-specific token transport.
- T013 is now unblocked for membership-aware RLS policies. T014, T040, and T051
  remain downstream of those access/auth contracts.

## Commit

`T012: implement authentication flows`
