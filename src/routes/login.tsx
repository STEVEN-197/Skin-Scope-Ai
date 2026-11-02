import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

// SECURITY FIX (FINDING-007): Client-side rate limiting for login attempts.
// Tracks failed attempts in memory and enforces a lockout period.
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SkinScope AI" },
      { name: "description", content: "Sign in to your SkinScope AI account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  // SECURITY FIX (FINDING-007): Track failed login attempts to enforce lockout.
  const failedAttempts = useRef(0);
  const lockedUntil = useRef<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Countdown timer for lockout display.
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = lockedUntil.current ? Math.max(0, lockedUntil.current - Date.now()) : 0;
      setLockoutRemaining(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Check lockout before attempting login.
    if (lockedUntil.current && Date.now() < lockedUntil.current) {
      const remaining = Math.ceil((lockedUntil.current - Date.now()) / 1000);
      toast.error(`Too many failed attempts. Please wait ${remaining}s before trying again.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setSubmitting(false);

      if (error) {
        console.error("Sign in error:", error);
        failedAttempts.current += 1;
        if (failedAttempts.current >= MAX_ATTEMPTS) {
          lockedUntil.current = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutRemaining(LOCKOUT_DURATION_MS);
          toast.error("Too many failed attempts. Account temporarily locked for 5 minutes.");
          failedAttempts.current = 0;
          return;
        }
        const message = error.message.toLowerCase().includes("invalid login credentials")
          ? "Couldn't sign in. Check your email/password, and if you just signed up, confirm your email first."
          : error.message;
        toast.error(message);
        return;
      }

      // Reset rate-limit counters on success.
      failedAttempts.current = 0;
      lockedUntil.current = null;
      toast.success("Signed in — taking you to your dashboard.");

      if (data?.session) {
        // Immediately synchronize state so dashboard layout doesn't bounce back
        setSession(data.session);
        navigate({ to: "/dashboard" });

        // Fallback navigation in case client router doesn't change window URL in WebViews
        setTimeout(() => {
          if (!window.location.pathname.startsWith("/dashboard")) {
            window.location.href = "/dashboard";
          }
        }, 200);
      }
    } catch (err: any) {
      setSubmitting(false);
      console.error("Sign in unexpected error:", err);
      toast.error(err?.message || "An unexpected error occurred during sign in.");
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation email sent.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo />
            <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue your analysis</p>
          </div>
          {lockoutRemaining > 0 && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Account locked. Try again in {Math.ceil(lockoutRemaining / 1000)}s.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || lockoutRemaining > 0}
              className="w-full bg-gradient-hero text-primary-foreground hover:opacity-95"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 space-y-3 text-center text-sm text-muted-foreground">
            <p>
              New to SkinScope?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
            <p className="text-xs">If you just signed up, confirm your email before signing in.</p>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending}
              className="font-medium text-primary transition-opacity hover:underline disabled:opacity-60"
            >
              {resending ? "Sending confirmation…" : "Resend confirmation email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
