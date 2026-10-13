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
