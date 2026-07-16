import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureProfile } from "@/lib/election.functions";
import { sendWelcomeEmail } from "@/lib/email";
import { SiteHeader } from "@/components/site-header";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign up · Election/Node" },
      { name: "description", content: "Create an account or sign in to vote." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const ensureProfileFn = useServerFn(ensureProfile);
  const sendWelcomeEmailFn = useServerFn(sendWelcomeEmail);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setErr(null);
    setSuccess(null);
    setEmail("");
    setPassword("");
    setFullName("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
          // Email confirmation is enabled — tell user to confirm
          setSuccess("Account created! Check your email to confirm, then sign in.");
          switchMode("signin");
          setLoading(false);
          return;
        }

        // No email confirmation needed — session is live
        await ensureProfileFn({ data: { fullName } });
        sendWelcomeEmailFn({ data: { email, fullName } }).catch(() => null);
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign in failed. Please try again.");

        await ensureProfileFn({ data: { fullName: "" } });
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (e2: unknown) {
      const raw = e2 instanceof Error ? e2.message : String(e2);
      const msg = raw === "{}" || raw.trim() === "" ? "Something went wrong. Please try again." : raw;
      if (msg.includes("Invalid login credentials")) {
        setErr("Incorrect email or password. Please try again.");
      } else if (msg.includes("User already registered")) {
        setErr("An account with this email already exists. Sign in instead.");
      } else if (msg.includes("Password should be")) {
        setErr("Password must be at least 6 characters.");
      } else if (msg.includes("rate limit")) {
        setErr("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="panel p-8">
          <div className="label">{mode === "signup" ? "Create account" : "Sign in"}</div>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight">
            {mode === "signup" ? "Join the register" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-fg-dim">
            {mode === "signup"
              ? "Create an account. The admin will issue you a voting ticket."
              : "Sign in with your email and password to access your dashboard."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label block mb-2">Full name</label>
                <input
                  className="field"
                  required
                  maxLength={120}
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="label block mb-2">Email</label>
              <input
                className="field"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-2">Password</label>
              <div className="relative">
                <input
                  className="field pr-12"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-dim hover:text-fg"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {err && (
              <div className="border border-danger p-3 text-sm text-danger">{err}</div>
            )}
            {success && (
              <div className="border border-ok p-3 text-sm text-ok">{success}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-fg-dim">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button className="text-accent underline" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button className="text-accent underline" onClick={() => switchMode("signup")}>
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>
        <Link to="/" className="block text-center mt-6 label hover:text-accent">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
