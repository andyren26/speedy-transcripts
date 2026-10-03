"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/AuthShell";
import { usePageMeta } from "@/lib/use-page-meta";

export default function ForgotPasswordPage() {
  usePageMeta({
    title: "忘記密碼 — Video Speed Reader",
    description: "輸入你的電子郵件，我們會寄送重設密碼的連結。",
  });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Rate limits and malformed input are real errors; anything else shows the same
    // "check your inbox" message so the page never reveals whether an account exists.
    if (error && (error.status === 429 || error.status === 400)) {
      setError(
        error.status === 429 ? "寄送太頻繁了，請稍候幾分鐘再試。" : `無法寄送：${error.message}`,
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        title="請查看你的信箱"
        subtitle="如果這個電子郵件有註冊過帳號，重設密碼的連結已經寄出。"
        backTo="/sign-in"
        backLabel="回到登入"
      >
        <div className="mt-7 flex items-start gap-3 rounded-lg bg-surface-bright px-4 py-3 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
          <p>
            信件已寄到 <span className="font-medium text-foreground">{email.trim()}</span>
            。點信裡的連結就能設定新密碼。沒收到的話，請檢查垃圾郵件匣，或稍候幾分鐘再試一次。
          </p>
        </div>
        <Button variant="glass" className="mt-6 h-11 w-full" onClick={() => setSent(false)}>
          重新寄送
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="忘記密碼"
      subtitle="輸入你註冊時用的電子郵件，我們會寄一封重設密碼的連結給你。"
      backTo="/sign-in"
      backLabel="回到登入"
    >
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm">
          電子郵件
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            className="mt-2 h-11 bg-surface-bright"
            placeholder="you@company.com"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button disabled={busy} variant="hero" className="h-11 w-full">
          {busy ? <Loader2 className="animate-spin" /> : "寄送重設連結"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        想起密碼了？
        <Link href="/sign-in" className="font-semibold text-secondary hover:text-foreground">
          登入
        </Link>
      </p>
    </AuthShell>
  );
}
