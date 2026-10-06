import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** Contact address shown on the policy pages. */
export const SUPPORT_EMAIL = "support@mail.valuetrack66.com";

export const LEGAL_LINKS = [
  { href: "/terms", label: "服務條款" },
  { href: "/privacy", label: "隱私權政策" },
  { href: "/refund", label: "退款政策" },
] as const;

/** Footer row of policy links, shared by the landing page and the policy pages. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="政策" className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground hover:underline">
          {l.label}
        </Link>
      ))}
      <Link href="/support" className="hover:text-foreground hover:underline">
        聯絡客服
      </Link>
    </nav>
  );
}

/** Layout for /terms, /privacy and /refund: readable single column, public (no sign-in). */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="brand-gradient grid size-9 place-items-center rounded-lg font-display text-sm font-bold text-primary-foreground">
              V
            </span>
            <span className="font-display font-semibold">Video Speed Reader</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            回到首頁
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">最後更新日期：{updated}</p>
        {intro && <div className="mt-6 leading-7 text-foreground/90">{intro}</div>}
        <div className="mt-8 space-y-8">{children}</div>
        <p className="mt-12 rounded-xl border border-border bg-card/50 p-4 text-sm leading-6 text-muted-foreground">
          對本頁內容有任何疑問，請透過
          <Link href="/support" className="mx-1 font-medium text-primary hover:underline">
            聯絡客服
          </Link>
          或來信
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mx-1 font-medium text-primary hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          與我們聯繫。
        </p>
      </article>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Video Speed Reader</span>
          <LegalLinks />
        </div>
      </footer>
    </main>
  );
}

/** A numbered section with a heading. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-foreground/90">{children}</div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground">{children}</ul>;
}
