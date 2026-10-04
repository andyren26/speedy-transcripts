"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const POLL_MS = 2000;
const MAX_TRIES = 15; // ~30 seconds

/**
 * Re-renders the server page every few seconds until the webhook's purchase row
 * shows up (the server page then stops rendering this component).
 */
export default function AwaitCredit({ credits }: { credits: number | null }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= MAX_TRIES) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [tries, router]);

  if (tries >= MAX_TRIES) {
    return (
      <p className="mt-3 text-muted-foreground">
        付款已完成，點數入帳比平常久一點。請稍後到點數頁查看；如果幾分鐘後還沒入帳，請聯絡我們。
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      正在將{credits ? ` ${credits} 點` : "點數"}加入你的帳戶…
    </p>
  );
}
