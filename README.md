# SpendWise — Expense Dashboard (React + Vite + Supabase)

Accounts, expenses, categories, budgets, notifications, receipts and settings — all stored in your Supabase (PostgreSQL) database
and protected per user by Row Level Security.

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — deploy to Netlify / Vercel / Cloudflare Pages
```
`.env` already contains your project URL and **publishable** key (safe in a browser app).
**Never** put the `service_role` / secret key in this project.

## One-time Supabase setup
1. Run `spendwise-schema.sql` in the SQL Editor (done).
2. Authentication → URL Configuration: set **Site URL** to where the app runs (e.g. `http://localhost:5173`, later your live domain)
   and add the same address under **Redirect URLs** — needed for email-confirmation and password-reset links.
3. Authentication → Providers → Email: "Confirm email" on = users must click an emailed link before first login (recommended for production).

## Deploying
Add the same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your host's environment settings, then build.

## Notes
- Every write is optimistic (instant UI) and saved in the background; if one fails you get an error toast and the screen re-syncs.
- The PIN app-lock is per device (stored only in this browser as a hash); it locks the screen, it does not encrypt data.
- Settings → Data & exports can import expenses saved by the earlier offline version, restore a JSON backup, or load sample data.
- `npm run build -- --mode mock` builds an offline demo that uses a fake in-browser backend (for testing only).
