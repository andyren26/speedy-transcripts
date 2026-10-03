<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- This is a Next.js 16 App Router app. Routes live in `app/` (thin wrappers); the page UIs are client components in `src/views/`. Public: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`. Protected: `/app` (auth checked on the server in `app/app/page.tsx`). Supabase auth uses `@supabase/ssr` with cookie sessions: browser client `src/lib/supabase/client.ts`, server client `src/lib/supabase/server.ts` (`await cookies()`), and `middleware.ts` refreshes the session. Styles: `app/globals.css` (Tailwind 4 via `@tailwindcss/postcss`).
