import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function FacebookDeletionStatus() {
  const query = useQuery();
  const code = query.get("code");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    fetch(`/api/facebook-deletion-status?code=${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        setStatus(data);
      })
      .catch((err) => setError(err.message || "Erreur"))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="page-title">Statut de la demande de suppression (Facebook)</h1>

      {!code && (
        <div className="mt-4">
          <p>
            Veuillez fournir le code de confirmation que Facebook vous a envoyé en paramètre `code`.
          </p>
          <p>
            Exemple:{" "}
            <a href="/oauth/facebook/deletion-status?code=VOTRE_CODE">
              /oauth/facebook/deletion-status?code=VOTRE_CODE
            </a>
          </p>
        </div>
      )}

      {code && (
        <div className="mt-4">
          {loading && <div>Chargement du statut...</div>}
          {error && <div className="text-accent">Erreur: {error}</div>}
          {status && (
            <div className="theme-card mt-4">
              <div>
                <strong>Code:</strong> {status.confirmation_code}
              </div>
              <div>
                <strong>Statut:</strong> {status.status}
              </div>
              {status.requested_at && (
                <div>
                  <strong>Demandé le:</strong> {new Date(status.requested_at).toLocaleString()}
                </div>
              )}
              {status.facebook_user_id && (
                <div>
                  <strong>Facebook ID:</strong> {status.facebook_user_id}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <p>
          Si vous n'avez pas de code, consultez les{" "}
          <a href="/oauth/facebook/deletion-instructions">instructions</a>.
        </p>
      </div>
    </div>
  );
}
