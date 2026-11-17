# SJP Property CRM

Phone-first CRM for a one-person real-estate dealership (Jind / Hisar).
Next.js 15 + Supabase. Hindi / English.

**Features:** contacts (owner / broker / buyer, several roles per person), listings with source
tracking (direct owner or broker; the same plot can be linked to several brokers), duplicate
warnings, WhatsApp share built only from public fields, commissions with payments
(received and pending are calculated, never typed).

## Run locally

```bash
npm install
npm run db:start        # local Supabase in Docker; applies supabase/migrations
cp .env.example .env.local   # fill with the keys printed by db:start
npm run seed            # Jind/Hisar test data (local only)
npm run build && npm start   # http://localhost:3000
```

Test logins after seeding: `admin@sjp.test / sjp-admin-123`, `staff@sjp.test / sjp-staff-123`,
`outsider@sjp.test / outsider-123` (signed in but not on the team, so it sees nothing).

## Go live (hosted Supabase + Vercel)

1. Create a Supabase project. Run both files in `supabase/migrations/` in order (SQL editor, or `supabase db push`).
2. In **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up" and keep **Email** enabled.
3. Add the owner's login (this runs locally with the service-role key in `.env.local`):
   `node scripts/add-user.mjs papa@example.com 'StrongPassword' "Papa" admin`
4. Set the business row once in the SQL editor:
   `insert into business_settings (business_name, public_phone, default_city) values ('SJP Properties', '+91XXXXXXXXXX', 'Jind');`
5. Deploy to Vercel with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Do **not** put the service-role key in Vercel.
6. On the phone, open the site in Chrome → menu → "Add to Home screen".

## Privacy design

- No owner or broker details are stored as text on a listing. People live in `contacts` and are linked by foreign keys.
- The share screen reads only the `public_property_card` view. `lib/share.ts` also copies out an
  allow-list of fields, so private data can't reach the message even by mistake (unit-tested).
  The plot number is shown only when the toggle is turned on.
- Row-level security: only users listed in `team_members` can read or write anything. Only the admin
  can delete commissions or payments, or change settings. Photos are in a private bucket and are
  shrunk and stripped of GPS data on the phone before upload.

## Tests

```bash
npm test            # unit: phone normalisation, ₹ lakh/crore, share-message privacy
npm run test:rls    # API with real logins: anon / outsider / staff / admin
npm run test:e2e    # browser walkthrough of every screen (needs app running + seed)
npm run test:perf   # load time with low-end-phone emulation
```
