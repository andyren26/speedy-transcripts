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

- This is a plain Vite + React SPA using React Router (`src/App.tsx`). Routes: public `/` for marketing, `/sign-in` and `/sign-up` for email or Google access, and protected `/app` (guarded by `RequireAuth`) for the product shell. There is no SSR or server code; `vercel.json` rewrites every path to `index.html` so deep links resolve client-side.
