"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/AuthShell";
import { usePageMeta } from "@/lib/use-page-meta";

type LinkState = "checking" | "ready" | "invalid";

/** Reads an error Supabase put in the URL (e.g. an expired link) before the client clears it. */
function linkErrorFromUrl(): string | null {
  const params = new URLSearchParams(
    window.location.hash.slice(1) || window.location.search.slice(1),
  );
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  return code === "otp_expired"
    ? "這個重設連結已經過期或被用過了。"
    : (params.get("error_description") ?? "這個重設連結無效。");
}

export default function ResetPasswordPage() {
  usePageMeta({
    title: "設定新密碼 — Video Speed Reader",
    description: "為你的 Video Speed Reader 帳號設定新密碼。",
  });
  const router = useRouter();
  const [linkError] = useState(linkErrorFromUrl);
  const [state, setState] = useState<LinkState>(linkError ? "invalid" : "checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (linkError) return;
    let active = true;
    // The recovery link signs the user in; the client picks the token up from the URL.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setState("ready");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setState((s) => (session ? "ready" : s === "checking" ? "invalid" : s));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [linkError]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("兩次輸入的密碼不一樣。");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(
        error.code === "same_password"
          ? "新密碼不能跟舊密碼一樣。"
          : `無法更新密碼：${error.message}`,
      );
      return;
    }
    router.replace("/app");
  }

  if (state === "checking") {
    return (
      <AuthShell title="設定新密碼" subtitle="正在確認你的重設連結…">
        <div className="mt-7 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (state === "invalid") {
    return (
      <AuthShell
        title="連結無法使用"
        subtitle={linkError ?? "這個重設連結無效或已經過期。"}
        backTo="/sign-in"
        backLabel="回到登入"
      >
        <Button asChild variant="hero" className="mt-7 h-11 w-full">
          <Link href="/forgot-password">重新寄送重設連結</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="設定新密碼" subtitle="請輸入新的密碼，完成後會直接幫你登入。">
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm">
          新密碼
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
            autoComplete="new-password"
            className="mt-2 h-11 bg-surface-bright"
            placeholder="至少 8 個字元"
          />
        </label>
        <label className="block text-sm">
          再輸入一次新密碼
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            className="mt-2 h-11 bg-surface-bright"
          />
        </label>
        {message && (
          <p
            role="alert"
            className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-destructive"
          >
            {message}
          </p>
        )}
        <Button disabled={busy} variant="hero" className="h-11 w-full">
          {busy ? <Loader2 className="animate-spin" /> : "更新密碼"}
        </Button>
      </form>
    </AuthShell>
  );
}
