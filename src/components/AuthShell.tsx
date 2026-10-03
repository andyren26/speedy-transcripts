import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

/** Shared card layout for the sign-in, forgot-password and reset-password pages. */
export function AuthShell({
  title,
  subtitle,
  backTo = "/",
  backLabel = "回到首頁",
  children,
}: {
  title: string;
  subtitle: string;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="absolute -left-48 -top-48 size-[560px] rounded-full bg-primary/25 blur-[130px]"
      />
      <div
        aria-hidden
        className="absolute -bottom-48 -right-48 size-[560px] rounded-full bg-secondary/15 blur-[130px]"
      />
      <div className="relative w-full max-w-md">
        <Link
          to={backTo}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <div className="brand-gradient grid size-11 place-items-center rounded-xl font-display font-bold text-primary-foreground">
            V
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </section>
      </div>
    </main>
  );
}
