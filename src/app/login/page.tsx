"use client";

import { type FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { m, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Login Page                                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [mode, setMode] = useState<"credentials" | "magic">("credentials");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  /* ---- Credentials submit ---------------------------------------- */
  const handleCredentials = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || (!isSignUp && !password)) return;
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() || undefined } },
        });
        if (signUpErr) throw signUpErr;
        /* After email confirmation, they'll be redirected back */
        setError("");
        setMagicSent(true); // reuse the success state
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg.replace(/^[A-Z]/, (c) => c.toLowerCase()));
    } finally {
      setLoading(false);
    }
  }, [email, password, name, isSignUp, supabase, router]);

  /* ---- Magic link submit ------------------------------------------ */
  const handleMagicLink = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg.replace(/^[A-Z]/, (c) => c.toLowerCase()));
    } finally {
      setLoading(false);
    }
  }, [email, supabase]);

  /* ---- Render ---------------------------------------------------- */
  return (
    <div className="login-animated-bg relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-950 via-purple-950/50 to-zinc-950">
      {/* Ambient glow orbs - animated */}
      <div className="floating-shape-1 pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />
      <div className="floating-shape-2 pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="floating-shape-3 pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[100px]" />
      {/* Additional subtle floating shapes */}
      <div className="floating-shape-2 pointer-events-none absolute left-1/4 bottom-1/4 h-48 w-48 rounded-full bg-violet-600/10 blur-[80px]" />
      <div className="floating-shape-1 pointer-events-none absolute right-1/4 top-1/4 h-32 w-32 rounded-full bg-indigo-500/15 blur-[60px]" />

      {/* Glass card */}
      <m.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Sparkles className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Puzzle</h1>
          <p className="text-sm text-zinc-400">Fast, real-time messaging</p>
        </div>

        <AnimatePresence mode="wait">
          {/* ---- Success state (email sent) ---- */}
          {magicSent ? (
            <m.div
              key="success"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
                <Mail className="size-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-white">Check your inbox</p>
              <p className="text-xs text-zinc-400">We sent a {isSignUp ? "confirmation" : "magic link"} to <span className="text-zinc-300">{email}</span></p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setError(""); }}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Use a different email
              </button>
            </m.div>
          ) : (
            /* ---- Auth form ---- */
            <m.div
              key="form"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            >
              {/* Mode tabs */}
              <div className="mb-6 flex rounded-xl bg-white/[0.06] p-1">
                {(["credentials", "magic"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setMode(tab); setError(""); }}
                    className={cn(
                      "relative flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                      mode === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {mode === tab && (
                      <m.div
                        layoutId="auth-tab"
                        className="absolute inset-0 rounded-lg bg-white/[0.1]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">
                      {tab === "credentials" ? "Password" : "Magic Link"}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {mode === "credentials" ? (
                  <m.form
                    key="cred-form"
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    onSubmit={handleCredentials}
                    className="flex flex-col gap-4"
                  >
                    {isSignUp && (
                      <div className="relative">
                        <Sparkles className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Display name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 transition-all"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={isSignUp ? "Create password" : "Password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3 pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    {error && (
                      <m.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400">{error}</m.p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : <>{isSignUp ? "Create account" : "Sign in"} <ArrowRight className="ml-1.5 size-4" /></>}
                    </Button>

                    <p className="text-center text-xs text-zinc-500">
                      {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                      <button type="button" onClick={() => { setIsSignUp((v) => !v); setError(""); }} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                        {isSignUp ? "Sign in" : "Sign up"}
                      </button>
                    </p>
                  </m.form>
                ) : (
                  <m.form
                    key="magic-form"
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    onSubmit={handleMagicLink}
                    className="flex flex-col gap-4"
                  >
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 transition-all"
                      />
                    </div>

                    {error && (
                      <m.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400">{error}</m.p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : <>{"Send magic link"} <ArrowRight className="ml-1.5 size-4" /></>}
                    </Button>

                    <p className="text-center text-xs text-zinc-500">
                      We'll send you a sign-in link — no password needed.
                    </p>
                  </m.form>
                )}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>

      {/* Bottom branding */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1">
        <p className="text-xs text-zinc-600">
          Puzzle &middot; End-to-end encrypted messaging
        </p>
        <p className="text-[10px] text-zinc-700">
          Built with Next.js &amp; Supabase
        </p>
      </div>
    </div>
  );
}
