"use client";

import { type FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { m, AnimatePresence } from "framer-motion";
import {
  Lock,
  ArrowRight,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const APP_DOMAIN = "puzzle.app";

/* ------------------------------------------------------------------ */
/*  Login Page                                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* Derive a hidden email from the username */
  const toEmail = (u: string) => `${u.toLowerCase().trim()}@${APP_DOMAIN}`;

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        if (isSignUp) {
          if (!username.trim() || !password) return;
          const { error: signUpErr } = await supabase.auth.signUp({
            email: toEmail(username),
            password,
            options: {
              data: { name: username.trim() },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (signUpErr) throw signUpErr;
          router.push("/");
          router.refresh();
        } else {
          if (!username.trim() || !password) return;
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: toEmail(username),
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
    },
    [username, password, isSignUp, supabase, router],
  );

  return (
    <div className="login-animated-bg relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-950 via-amber-950/30 to-zinc-950">
      {/* Ambient glow orbs */}
      <div className="floating-shape-1 pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[140px]"></div>
      <div className="floating-shape-2 pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-yellow-600/10 blur-[140px]"></div>
      <div className="floating-shape-3 pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-500/5 blur-[120px]"></div>

      {/* Glass card */}
      <m.div
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-3xl border border-amber-400/[0.12] bg-white/[0.03] p-8 shadow-2xl shadow-amber-900/10 backdrop-blur-2xl"
      >
        {/* Top shimmer line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"></div>

        {/* Logo */}
        <m.div
          className="mb-8 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-xl shadow-amber-500/25">
            <Sparkles className="size-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">Puzzle</h1>
            <p className="mt-1 text-sm font-light tracking-wide text-amber-200/60">Fast, real-time messaging</p>
          </div>
        </m.div>

        <AnimatePresence mode="wait">
          <m.form
            key={isSignUp ? "signup" : "login"}
            initial={{ opacity: 0, x: isSignUp ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isSignUp ? -16 : 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
          >
            {/* Username */}
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-amber-400/40 transition-colors group-focus-within:text-amber-400/80" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-xl border border-amber-400/[0.1] bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-amber-400/10 transition-all duration-300"
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-amber-400/40 transition-colors group-focus-within:text-amber-400/80" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder={isSignUp ? "Create password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-amber-400/[0.1] bg-white/[0.04] py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-amber-400/10 transition-all duration-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-amber-300 transition-colors duration-200"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <m.p
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  className="overflow-hidden text-xs font-medium text-red-400/90"
                >
                  {error}
                </m.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <m.div whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 py-3.5 text-sm font-bold text-zinc-900 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:via-yellow-400 hover:to-orange-400 disabled:opacity-50 transition-all duration-300"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? "Create account" : "Sign in"}
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </m.div>

            {/* Toggle */}
            <p className="pt-1 text-center text-sm text-zinc-400">
              {isSignUp ? "Already have an account?" : "Don\u2019t have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setIsSignUp((v) => !v); setError(""); }}
                className="font-medium text-amber-400/80 hover:text-amber-300 transition-colors duration-200"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </m.form>
        </AnimatePresence>

        {/* Bottom shimmer line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent"></div>
      </m.div>

      {/* Bottom branding */}
      <m.div
        className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        <p className="text-xs font-medium tracking-wide text-amber-200/30">Puzzle</p>
        <p className="text-[10px] text-zinc-600">Built with Next.js &amp; Supabase</p>
      </m.div>
    </div>
  );
}
