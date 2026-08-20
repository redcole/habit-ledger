# Habit Ledger

A small React habit tracker. Each habit gets a ledger row with a current
streak (drawn as tally marks), a best streak, and a 70-day heatmap. Data is
saved to the browser's `localStorage`, so it persists between visits on the
same device/browser — there's no backend or account system.

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

This produces a `dist/` folder containing static HTML/CSS/JS — that's the
entire deployable app.

## Deploying `dist/`

Any static file host works, since there's no backend. A few options:

- **Netlify / Vercel / Cloudflare Pages**: connect the repo (or drag-and-drop
  the `dist/` folder in Netlify's dashboard) — they'll build and host it
  automatically.
- **Your own webserver (nginx, Apache, etc.)**: copy the contents of `dist/`
  to your web root, e.g.:
  ```bash
  scp -r dist/* user@yourserver:/var/www/habit-ledger/
  ```
  Point your server at that directory. No special server config is needed
  since it's plain static files (the app already sets `base: './'` in
  `vite.config.js` so it works from a subdirectory too).
- **GitHub Pages**: push `dist/` to a `gh-pages` branch, or use the
  `actions/deploy-pages` GitHub Action.

## Notes

- Habit data lives only in the browser that created it — clearing browser
  data or switching devices means a fresh ledger. If you later want habits
  synced across devices, that would need a small backend/database, which
  isn't included here.
- Everything is plain CSS (`src/index.css`) — no Tailwind or component
  library — so it's easy to re-theme by editing the variables at the top of
  that file.
