import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AuthModal from "../components/common/AuthModal";
import { useSupabase } from "../contexts/SupabaseContext";

const PUBLIC_NASA_URL = "https://cogentia.fractavolta.com/ops/console/?view=fix-bugs-first";
const CONTROL_ENDPOINT = "/api/nasa/control";

export default function NasaPage() {
  const { session, loading } = useSupabase();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [control, setControl] = useState(null);
  const [error, setError] = useState(null);

  const refreshControl = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setControl(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      const response = await fetch(CONTROL_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setControl(body);
    } catch (requestError) {
      setControl(null);
      setError(requestError.message || "nasa_control_unavailable");
    }
  }, [session?.access_token]);

  useEffect(() => {
    refreshControl();
  }, [refreshControl]);

  const connected = Boolean(session?.access_token);
  const accessClass = control?.access_class || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-4xl px-4 py-12">
        <header className="border-b border-slate-800 pb-8">
          <p className="text-sm font-medium text-emerald-400">John · jhn.baronsmariani.org</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">La Nasa</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            A transparent Fractanet surface: public facts are readable by anyone; operational acts
            require an authenticated John session and an explicit operator authorization.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Public</p>
            <h2 className="mt-2 text-xl font-semibold">Read-only Fractanet</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Fleet-level status and Fix Bugs First are public projections. They expose neither
              credentials, private node identities, nor controls that can change state.
            </p>
            <a
              className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              href={PUBLIC_NASA_URL}
            >
              Open public Fix Bugs First
            </a>
          </article>

          <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Private work
            </p>
            <h2 className="mt-2 text-xl font-semibold">Operator workspace</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {loading
                ? "Checking the John session…"
                : !connected
                  ? "Sign in with your John account to request operator access."
                  : accessClass === "principal"
                    ? "Your session is recognized as the Principal. The action bridge is intentionally not deployed yet."
                    : accessClass === "delegate"
                      ? "Your session is recognized as a mandated delegate. The action bridge is intentionally not deployed yet."
                      : "You are signed in, but this identity is neither the Principal nor an approved delegate."}
            </p>
            {!connected && !loading ? (
              <button
                className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
                onClick={() => setShowAuthModal(true)}
              >
                Sign in to John
              </button>
            ) : null}
            {connected ? (
              <button
                className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
                onClick={refreshControl}
              >
                Refresh access
              </button>
            ) : null}
            {error ? (
              <p className="mt-3 text-xs text-amber-300">Private boundary: {error}</p>
            ) : null}
          </article>
        </section>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
          <h2 className="font-semibold text-slate-100">Boundary in this increment</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              The browser sends only the current Supabase access token to John’s same-origin control
              endpoint.
            </li>
            <li>
              The server verifies that token, recognizes one Principal subject, then admits only
              explicitly listed delegates.
            </li>
            <li>
              No Fracta credential, service-role key, or write capability is included in the public
              site or this page.
            </li>
          </ul>
        </section>

        <p className="mt-8 text-sm text-slate-400">
          <Link className="text-emerald-400 hover:underline" to="/">
            Back to John
          </Link>
        </p>
      </main>
      {showAuthModal ? (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={refreshControl} />
      ) : null}
    </div>
  );
}
