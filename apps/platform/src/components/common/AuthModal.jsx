import { useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { ANONYMOUS_EMAIL } from "../../lib/permissions";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.client.js";

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useCurrentUser();

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (refreshUser) {
        console.log("[DIAG] AuthModal: calling refreshUser");
        try {
          await refreshUser(data.user);
        } catch (refreshErr) {
          console.error("[DIAG] AuthModal: refreshUser failed", refreshErr);
        }
      }

      console.log("[DIAG] AuthModal: onSuccess called after signIn");
      onSuccess?.();
      console.log("[DIAG] AuthModal: onClose called after signIn");
      onClose();
    } catch (err) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { error } = await getSupabase().auth.signInWithPassword({
        email: ANONYMOUS_EMAIL,
        password: "Anonymous",
      });
      if (error) throw error;

      if (refreshUser) {
        try {
          await refreshUser();
        } catch (e) {
          console.error(e);
        }
      }

      console.log("[DIAG] AuthModal: onSuccess called after anonymous signIn");
      onSuccess?.();
      console.log("[DIAG] AuthModal: onClose called after anonymous signIn");
      onClose();
    } catch (err) {
      setError(err.message || "Erreur de connexion anonyme");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });
      if (error) throw error;
      console.log("Starting Facebook OAuth redirect", data);
    } catch (err) {
      setError(err.message || "Erreur de connexion Facebook");
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });
      if (error) throw error;
      console.log("Starting GitHub OAuth redirect", data);
    } catch (err) {
      setError(err.message || "Erreur de connexion GitHub");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      if (!displayName) {
        setError("Veuillez entrer un nom d'affichage");
        setLoading(false);
        return;
      }

      const { data, error } = await getSupabase().auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: insertError } = await supabase.from("users").upsert({
          id: data.user.id,
          display_name: displayName,
        });

        if (insertError) {
          console.error("Erreur cr\u00e9ation user dans table users:", insertError);
          throw insertError;
        }
      }

      if (refreshUser) {
        try {
          await refreshUser();
        } catch (e) {
          console.error(e);
        }
      }

      console.log("[DIAG] AuthModal: onSuccess called after signUp");
      onSuccess?.();
      console.log("[DIAG] AuthModal: onClose called after signUp");
      onClose();
    } catch (err) {
      setError(err.message || "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bauhaus-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-bauhaus-black border-3 border-bauhaus-white shadow-[8px_8px_0px_0px_#F0F0F0] p-8 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-bauhaus-white font-bauhaus  tracking-wide">
            {mode === "signin" ? "Connexion" : "Créer un compte"}
          </h2>
          <button
            onClick={onClose}
            className="text-bauhaus-white hover:text-bauhaus-red transition-colors font-bold text-2xl"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-bauhaus-white font-bold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-3 border-bauhaus-white bg-bauhaus-black text-bauhaus-white focus:outline-none focus:shadow-[4px_4px_0px_0px_#2D58B8] focus:border-bauhaus-blue transition-all font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-bauhaus-white font-bold mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-3 border-bauhaus-white bg-bauhaus-black text-bauhaus-white focus:outline-none focus:shadow-[4px_4px_0px_0px_#2D58B8] focus:border-bauhaus-blue transition-all font-medium"
              required
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-bauhaus-white font-bold mb-2">Nom d'affichage</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border-3 border-bauhaus-white bg-bauhaus-black text-bauhaus-white focus:outline-none focus:shadow-[4px_4px_0px_0px_#2D58B8] focus:border-bauhaus-blue transition-all font-medium"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-bauhaus-white p-3 text-red-700">{error}</div>
          )}

          {mode === "signin" ? (
            <button
              onClick={handleSignIn}
              className="w-full py-3 px-6 bg-bauhaus-blue text-bauhaus-white font-bold border-3 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              disabled={loading}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          ) : (
            <button
              onClick={handleSignUp}
              className="w-full py-3 px-6 bg-bauhaus-red text-bauhaus-white font-bold border-3 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              disabled={loading}
            >
              {loading ? "Inscription..." : "S'inscrire"}
            </button>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-bauhaus-black text-gray-400">Ou</span>
            </div>
          </div>

          {facebookAppId && (
            <button
              type="button"
              onClick={handleFacebookSignIn}
              className="w-full py-3 px-6 bg-[#1877F2] text-white font-bold border-3 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2 mb-3"
              disabled={loading}
            >
              Se connecter avec Facebook
            </button>
          )}

          <button
            type="button"
            onClick={handleGitHubSignIn}
            className="w-full py-3 px-6 bg-gray-800 text-white font-bold border-3 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2 mb-3"
            disabled={loading}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Se connecter avec GitHub
          </button>

          <button
            type="button"
            onClick={handleAnonymousSignIn}
            className="w-full py-3 px-6 bg-bauhaus-yellow text-bauhaus-black font-bold border-3 border-bauhaus-white shadow-[4px_4px_0px_0px_#F0F0F0] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2"
            disabled={loading}
          >
            Se connecter anonymement
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-bauhaus-blue font-bold hover:underline"
          >
            {mode === "signin" ? "Créer un compte" : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
