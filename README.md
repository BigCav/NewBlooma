# Aster & Co

Salon booking, checkout and back-office. Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS) + Windcave.

## Layout
- `supabase/migrations/` run in order: core_schema, security_rls, business_functions (all already applied to the Aster and Co project).
- `app/` the Next.js app. Copy `app/.env.example` to `app/.env.local` and fill it in.

## Run
    cd app && npm install && npm run dev

## Deploy (Vercel)
Import the `app` folder as the project root, add every variable from `.env.example`, deploy.

## Security notes
- Every table has Row Level Security; staff only ever see their own salon. Public booking, manage-booking, review and offer
  links go through the server with the service role and unguessable tokens.
- Payment credentials are AES-256-GCM encrypted (APP_ENCRYPTION_KEY) in a table the browser cannot read.
- Windcave results are always re-checked with Windcave server-side before a sale is marked paid.
- No localStorage or sessionStorage anywhere.

## Tests

- `npm run check` type-checks and runs the unit tests (dates and time zones, redirects, phone and price inputs, email layout and escaping).
- `npm run test:db` runs the database tests in `supabase/tests` (tenant isolation, roles and money, booking rules). It needs `TEST_DATABASE_URL`, pointing at a copy of the database, and rolls back everything it creates.
- GitHub runs the type check and unit tests on every push (`.github/workflows/test.yml`); the database tests join in once a `TEST_DATABASE_URL` repository secret exists.
