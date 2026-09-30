import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Chrome, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — Veloce" }, { name: "description", content: "Sign in or create your Veloce transcription workspace." },
    { property: "og:title", content: "Sign in — Veloce" }, { property: "og:description", content: "Sign in or create your Veloce transcription workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}), component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>{ if(data.user) navigate({to:"/workspace",replace:true}); }); },[navigate]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage(""); if(mode==="signin"){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message);else navigate({to:"/workspace"});}else{const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)setMessage(error.message);else setMessage(data.session?"Account ready.":"Check your email to confirm your account.");}setBusy(false);}
  async function google(){setBusy(true);setMessage("");const result=await lovable.auth.signInWithOAuth("google",{redirect_uri:window.location.origin});if(result.error){setMessage(result.error.message);setBusy(false);return;}if(!result.redirected)navigate({to:"/workspace"});}
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12"><div aria-hidden className="absolute -left-48 -top-48 size-[560px] rounded-full bg-primary/25 blur-[130px]"/><div aria-hidden className="absolute -bottom-48 -right-48 size-[560px] rounded-full bg-secondary/15 blur-[130px]"/><div className="relative w-full max-w-md"><a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>Back to Veloce</a><section className="glass-panel rounded-2xl p-6 sm:p-8"><div className="brand-gradient grid size-11 place-items-center rounded-xl font-display font-bold text-primary-foreground">V</div><h1 className="mt-6 font-display text-3xl font-semibold">{mode==="signin"?"Welcome back":"Create your workspace"}</h1><p className="mt-2 text-sm text-muted-foreground">Transcripts ready before your coffee is.</p><Button onClick={google} disabled={busy} variant="glass" className="mt-7 h-11 w-full"><Chrome/>Continue with Google</Button><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>or continue with email<span className="h-px flex-1 bg-border"/></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="mt-2 h-11 bg-surface-bright" placeholder="you@company.com"/></label><label className="block text-sm">Password<Input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required className="mt-2 h-11 bg-surface-bright" placeholder="At least 8 characters"/></label>{message&&<p role="status" className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-muted-foreground">{message}</p>}<Button disabled={busy} variant="hero" className="h-11 w-full">{busy?<Loader2 className="animate-spin"/>:mode==="signin"?"Sign in":"Create account"}</Button></form><p className="mt-6 text-center text-sm text-muted-foreground">{mode==="signin"?"New to Veloce? ":"Already have an account? "}<button className="font-semibold text-secondary hover:text-foreground" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("");}}>{mode==="signin"?"Create an account":"Sign in"}</button></p></section></div></main>;
}