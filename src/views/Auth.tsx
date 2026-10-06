"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Chrome, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/lib/use-page-meta";
import { MeadowGround, MeadowSky } from "@/components/Meadow";


export default function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  usePageMeta({ title: mode==="signin"?"Sign in — Video Speed Reader":"Sign up — Video Speed Reader", description: "登入或建立你的 Video Speed Reader 逐字稿工作區。" });
  const router = useRouter();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{ setMessage(""); },[mode]);
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>{ if(data.user) router.replace("/app"); }); },[router]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage(""); if(mode==="signin"){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message);else router.push("/app");}else{const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/app`}});if(error)setMessage(error.message);else setMessage(data.session?"Account ready.":"Check your email to confirm your account.");}setBusy(false);}
  async function google(){setBusy(true);setMessage("");const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/app`}});if(error){setMessage(error.message);setBusy(false);}}
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12"><MeadowSky/><MeadowGround className="h-32 sm:h-44"/><div className="relative w-full max-w-md"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>回到首頁</Link><section className="glass-panel rounded-2xl p-6 sm:p-8"><div className="brand-gradient grid size-11 place-items-center rounded-xl font-display font-bold text-primary-foreground">V</div><h1 className="mt-6 font-display text-3xl font-semibold">{mode==="signin"?"歡迎回來":"建立你的工作區"}</h1><p className="mt-2 text-sm text-muted-foreground">上傳影片，幾分鐘內拿到逐字稿。</p><Button onClick={google} disabled={busy} variant="glass" className="mt-7 h-11 w-full"><Chrome/>使用 Google 繼續</Button><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>或使用電子郵件<span className="h-px flex-1 bg-border"/></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm">電子郵件<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="mt-2 h-11 bg-surface-bright" placeholder="you@company.com"/></label><div className="text-sm"><div className="flex items-center justify-between"><label htmlFor="password">密碼</label>{mode==="signin"&&<Link href="/forgot-password" className="text-xs font-medium text-secondary hover:text-foreground">忘記密碼？</Link>}</div><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete={mode==="signin"?"current-password":"new-password"} className="mt-2 h-11 bg-surface-bright" placeholder="至少 8 個字元"/></div>{message&&<p role="status" className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-muted-foreground">{message}</p>}<Button disabled={busy} variant="hero" className="h-11 w-full">{busy?<Loader2 className="animate-spin"/>:mode==="signin"?"登入":"建立帳號"}</Button></form>{mode==="signup"&&<p className="mt-4 text-center text-xs leading-5 text-muted-foreground">建立帳號（含使用 Google 登入）即表示你同意<Link href="/terms" className="mx-0.5 text-secondary underline hover:text-foreground">服務條款</Link>與<Link href="/privacy" className="mx-0.5 text-secondary underline hover:text-foreground">隱私權政策</Link>。</p>}<p className="mt-6 text-center text-sm text-muted-foreground">{mode==="signin"?"還沒有帳號?":"已經有帳號?"}<button className="font-semibold text-secondary hover:text-foreground" onClick={()=>router.push(mode==="signin"?"/sign-up":"/sign-in")}>{mode==="signin"?"建立帳號":"登入"}</button></p></section></div></main>;
}