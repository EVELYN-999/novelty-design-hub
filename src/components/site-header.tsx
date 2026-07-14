import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, LogOut, Radio, ShieldCheck, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/election.functions";


export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
      setUserEmail(s?.user?.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const getMeFn = useServerFn(getMe);
  const me = useQuery({
    queryKey: ["me", userId],
    queryFn: () => getMeFn(),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const isAdmin = me.data?.isAdmin ?? false;

  const nav: { to: string; label: string }[] = [{ to: "/", label: "Overview" }];
  if (userId) {
    nav.push({ to: "/dashboard", label: "Dashboard" });
    nav.push({ to: "/vote", label: "Cast Vote" });
    if (isAdmin) nav.push({ to: "/admin", label: "Admin" });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }


  return (
    <header className="w-full border-b border-line bg-bg sticky top-0 z-40">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-line-dim label">
          <Radio size={12} className="text-accent animate-pulse" />
          <span>Election Node — Secure Ballot System</span>
        </div>
        <div className="px-5 lg:px-10 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="mono text-accent text-xl">◼</span>
            <span className="font-display text-2xl md:text-3xl font-black tracking-tight leading-none">
              ELECTION<span className="text-accent">/</span>NODE
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-4 py-2 label hover:text-accent hover:bg-bg-2 transition-colors"
                activeProps={{ className: "px-4 py-2 label-on bg-bg-2" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            {userId ? (
              <button onClick={signOut} className="btn ml-2" title="Sign out">
                <LogOut size={14} /> Sign out
              </button>
            ) : (
              <Link to="/auth" className="btn-primary ml-2">Sign in</Link>
            )}
          </nav>
          <button className="md:hidden btn" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-line px-5 py-3 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="px-2 py-3 label"
                activeProps={{ className: "px-2 py-3 label-on" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            {userId ? (
              <button onClick={signOut} className="btn mt-2 justify-start">
                <LogOut size={14} /> Sign out
              </button>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="btn-primary mt-2">Sign in</Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-bg">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-8 flex flex-wrap justify-between gap-4 label">
        <span>ELECTION/NODE · Secure Ballot System</span>
        <span>Built on hash-verified records</span>
      </div>
    </footer>
  );
}
