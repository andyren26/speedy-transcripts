# Speedy Transcripts

Build a SaaS landing page + authenticated app shell for Video Speed Reader, a product that turns any video into an accurate transcript in three minutes, targeted at content creators, educators, and engineers who record long-form video and need a fast, clean transcript to repurpose into blog posts, course notes, or searchable archives.

## Stack

- Vite + React single-page app, routed client-side with React Router
- Supabase (project `xnexaxtdjoiajpdckkby`) for auth and data
- Hosted on Vercel as static files (`vite build` → `dist/`, SPA fallback in `vercel.json`)

## Environment

The Supabase browser client reads these at build time (see `.env`):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://xnexaxtdjoiajpdckkby.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) |

Only publishable keys belong here. Never put a service-role or secret key in a `VITE_` variable — it is bundled into the browser.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/andyren26/speedy-transcripts.git
cd speedy-transcripts
npm i
npm run dev
```
