# Woven Jewels

Woven Jewels is a React and Vite storefront that keeps the existing visual design and customer flow. Supabase provides order storage, admin authentication, and private payment-proof uploads.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. From this folder, install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

3. Vite opens the React storefront. The collections, story, product, order-summary, checkout, payment, and admin pages remain available at their existing `.html` paths.

## Connect Supabase

1. Create a Supabase project dedicated to Woven Jewels.
2. Run `supabase/migrations/20261118153000_payment_orders.sql` in the Supabase SQL editor. It creates product prices, order functions and policies, the admin allowlist, and a private payment-proof bucket.
3. Run `supabase/migrations/20261124010000_admin_crm.sql` after the first migration. It adds protected order activity and fulfillment-stage tracking for the CRM.
4. Run `supabase/migrations/20261124230000_order_rejections.sql` after the CRM migration. It enables the admin-only rejection action for orders that have not yet been accepted, records each required rejection reason in the order timeline, and asks PostgREST to reload its schema cache.
5. Invite `wisha0007@gmail.com` in Supabase Authentication and set a unique password through Supabase's invite/password-reset flow. Passwords and service-role keys must never be placed in frontend code or source control.
6. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Supabase project URL and public anon/publishable key. Never use a service-role key.
7. Set the Supabase Site URL and allowed redirect URLs to include the deployed storefront origin and `/admin.html` (include the local Vite origin for local testing).
8. Set the actual payment-account fields in `.env.local`. Set `VITE_PAYMENT_ACCOUNT_READY=true` only after verifying the bank/provider, account title, and account number/IBAN. The application intentionally disables real order submission until these details are provided.
9. Restart Vite after changing environment variables.

The database recalculates product prices and order totals server-side. If prices change, update the seeded products in the migration and the catalog in `src/data/products.js`. Shipping is Rs. 200. Payment is 50% advance and 50% cash on delivery. Payment screenshots are JPG, PNG, or WebP up to 5 MB; they are stored privately and manually checked by an admin. There is no automatic bank-transfer verification.

The admin CRM includes an order pipeline, customer directory with purchase totals and order history, protected internal order notes, fulfillment-stage updates, payment-proof review, dashboard metrics, search/filter, and CSV export. Rejecting is limited to not-yet-accepted orders and requires a reason. If an advance was approved, rejection does not process a refund; the admin must handle it manually. CRM notes and fulfillment history require the second migration, and order rejection requires the third.

## Prepare a Vercel deployment

1. Make sure this project directory is committed and pushed to the branch you intend to deploy. In Vercel, import the repository and set its **Root Directory** to `woven_jewels_website`.
2. Use `npm run build` as the build command and `dist` as the output directory. These values are also in `vercel.json`.
3. Configure these Vercel environment variables for Preview and Production: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `VITE_PAYMENT_ACCOUNT_READY`, `VITE_PAYMENT_BANK_NAME`, `VITE_PAYMENT_ACCOUNT_TITLE`, and `VITE_PAYMENT_ACCOUNT_NUMBER`. The `VITE_*` values are included in browser code. Use only Supabase's publishable/anon key; never put a service-role key or password in Vercel frontend variables.
4. Configure Supabase Auth's Site URL and redirect allowlist for the deployed domain and `/admin.html`. Remove obsolete preview and localhost URLs from Production settings. Allow the deployed origin in Supabase's API/CORS settings if the project dashboard exposes that control; CORS is not a substitute for database RLS.
5. Apply all three database migrations in order and verify that the admin account is invited, RLS is enabled, payment-proof storage is private, and the admin-only RPCs work.
6. Configure appropriate Auth and API rate limits in the Supabase project dashboard; this static frontend cannot enforce server-side limits. Review rate-limit settings again after launch.
7. Verify the Vercel deployment response headers. `vercel.json` sets a CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. The CSP permits inline style attributes because the interactive hero uses positioned inline styles; it does not permit inline scripts.
8. Smoke-test browsing, hero drag-and-drop, cart, required checkout fields, payment proof upload, admin sign-in, order review, rejection, and fulfillment on a Preview deployment before promoting it to Production. Do not submit a real payment during testing.

## One-time demo-order cleanup

The cleanup is deliberately not part of the migration sequence and is never run by a deployment. After confirming the Supabase project selector is the intended Woven Jewels project and backing up anything you may need, run `supabase/maintenance/clear_demo_orders.sql` in that project's SQL Editor. It deletes every row from `public.wj_orders`; related CRM activity is deleted by the table's foreign-key cascade. Confirm the result reports `remaining_orders = 0`. Payment-proof objects are stored separately: delete demo objects from the private `wj-payment-proofs` bucket using Supabase Storage after confirming they are all disposable. This SQL file has not been run automatically.

## Build and preview

```sh
npm run build
npm run preview
```

The original HTML/JavaScript pages and scripts are retained in `legacy-static/` as a reference during the React migration. They are not used by the React application.
