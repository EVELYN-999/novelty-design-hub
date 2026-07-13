import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureProfile } from "@/lib/election.functions";
import { SiteHeader } from "@/components/site-header";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Election/Node" },
      { name: "description", content: "Sign in or create an account to vote." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ensureProfileFn = useServerFn(ensureProfile);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        // Try to sign in (works if email confirm is disabled or auto-confirmed)
        const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
        if (sErr) {
          setErr("Account created. Check your email to confirm, then sign in.");
          setMode("signin"); setLoading(false); return;
        }
        await ensureProfileFn({ data: { fullName } });
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureProfileFn({ data: { fullName: "" } }).catch(() => {});
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally { setLoading(false); }
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
              : "Sign in with your email and password to see your ticket and vote."}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label block mb-2">Full name</label>
                <input className="field" required maxLength={120}
                  value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="label block mb-2">Email</label>
              <input className="field" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-2">Password</label>
              <input className="field" type="password" required minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <div className="border border-danger p-3 text-sm text-danger">{err}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-fg-dim">
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <button className="text-accent underline" onClick={() => setMode("signin")}>Sign in</button>
              </>
            ) : (
              <>New here?{" "}
                <button className="text-accent underline" onClick={() => setMode("signup")}>Create an account</button>
              </>
            )}
          </div>
        </div>
        <Link to="/" className="block text-center mt-6 label hover:text-accent">← Back to home</Link>
      </main>
    </div>
  );
}
