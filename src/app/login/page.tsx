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
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputCls =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 transition-all";

  const resolveUsername = useCallback(async (uname: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/resolve-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
      });
      if (!res.ok) return null;
      const { email: resolvedEmail } = await res.json();
      return resolvedEmail;
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        if (isSignUp) {
          if (!email.trim() || !username.trim() || !password) return;
          const { error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(),
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
          const val = identifier.trim();
          if (!val || !password) return;
          const isEmail = val.includes("@");
          const loginEmail = isEmail ? val : await resolveUsername(val);
          if (!loginEmail) {
            throw new Error("user not found");
          }
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
          });
          if (signInErr) throw signInErr;
          router.push("/");
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(
          msg === "user not found"
            ? "No account found with that username or email"
            : msg.replace(/^[A-Z]/, (c) => c.toLowerCase()),
        );
      } finally {
        setLoading(false);
      }
    },
    [email, password, username, identifier, isSignUp, supabase, router, resolveUsername],
  );

  return (
    <div className="login-animated-bg relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-950 via-indigo-950/40 to-zinc-950">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]"></div>
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-600/10 blur-[120px]"></div>
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/5 blur-[100px]"></div>

      {/* Glass card */}
      <m.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Sparkles className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Puzzle</h1>
          <p className="text-sm text-zinc-400">Fast, real-time messaging</p>
        </div>

        <AnimatePresence mode="wait">
          <m.form
            key={isSignUp ? "signup" : "login"}
            initial={{ opacity: 0, x: isSignUp ? 12 : -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isSignUp ? -12 : 12 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {/* Sign In: single identifier field */}
            {!isSignUp && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className={inputCls}
                />
              </div>
            )}

            {/* Sign Up: username + email */}
            {isSignUp && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
              </>
            )}

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder={isSignUp ? "Create password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className={inputCls + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <m.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400"
              >
                {error}
              </m.p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create account" : "Sign in"}
                  <ArrowRight className="ml-1.5 size-4" />
                </>
              )}
            </Button>

            {/* Toggle */}
            <p className="text-center text-xs text-zinc-500">
              {isSignUp ? "Already have an account?" : "Don\'t have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp((v) => !v);
                  setError("");
                }}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </m.form>
        </AnimatePresence>
      </m.div>

      {/* Bottom branding */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1">
        <p className="text-xs text-zinc-600">Puzzle &middot; End-to-end encrypted messaging</p>
        <p className="text-[10px] text-zinc-700">Built with Next.js &amp; Supabase</p>
      </div>
    </div>
  );
}
