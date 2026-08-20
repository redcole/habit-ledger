# Habit Ledger

A small React habit tracker. Each habit gets a ledger row with a current
streak (drawn as tally marks), a best streak, and a 70-day heatmap.

Habits can be tracked two ways:

- **Signed out (guest mode):** data saves to the browser's `localStorage` —
  works instantly, no setup, but stays on that one browser/device.
- **Signed in:** data syncs to a [Supabase](https://supabase.com) account,
  so the same habits show up wherever you sign in — different browser,
  different device, doesn't matter.

## One-time setup: Supabase

You need a free Supabase project for the account/sync features to work. The
app still works in guest mode without this — it just won't offer sign-in
until it's configured.

1. Create a project at [supabase.com](https://supabase.com) (free tier is
   plenty for this).
2. In your new project, go to **SQL Editor**, paste in the contents of
   `supabase-schema.sql` (included in this project), and run it. This
   creates the `habits` table and locks it down so each account can only
   see its own data.
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon/public key**.
4. In this project folder, copy `.env.example` to a new file named
   `.env.local`, and paste those two values in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. By default, Supabase requires email confirmation before a new account
   can sign in. For quick local testing you can turn this off under
   **Authentication → Providers → Email → Confirm email** — leave it on for
   a real deployment so people confirm their address first.

`.env.local` is already git-ignored, so your keys won't get committed.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Build for deployment

```bash
npm install
npm run build
```

This produces a `dist/` folder containing static HTML/CSS/JS.

**Important:** the Supabase URL/key need to be available at *build time*
(Vite bakes `VITE_...` env vars into the built files). If you're deploying
through Vercel's dashboard/CLI rather than just uploading `dist/` by hand,
add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment
Variables in your Vercel project settings (Project → Settings →
Environment Variables) so they're present when Vercel runs the build.
If you build locally with `.env.local` and upload the resulting `dist/`
folder directly, that already has the values baked in and no extra Vercel
config is needed.

## Deploying `dist/`

Any static file host works — there's no server to run, since Supabase
handles the backend. See the Vercel steps above, or for your own webserver:

```bash
scp -r dist/* user@yourserver:/var/www/habit-ledger/
```

## Notes

- Guest-mode data lives only in the browser that created it.
- The first time a guest signs in (or signs up) with existing local habits,
  the app offers to copy them into the new account — nothing is deleted
  until you confirm that.
- Everything is plain CSS (`src/index.css`) — no Tailwind or component
  library — so it's easy to re-theme by editing the variables at the top of
  that file. Both a light and dark theme are included (toggle in the
  header).

