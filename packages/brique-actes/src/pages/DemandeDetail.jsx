// src/pages/actes/DemandeDetail.jsx
// ============================================================================
// Détail d'une demande administrative avec historique des réponses
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import { useSupabase } from "../../contexts/SupabaseContext";
import SiteFooter from "../../components/layout/SiteFooter";

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_LABELS = {
  CRPA_COMMUNICATION: {
    label: "Communication de documents (CRPA)",
    emoji: "📬",
    color: "bg-blue-100 text-blue-800",
  },
  CRPA_RECLAMATION: {
    label: "Réclamation (CRPA)",
    emoji: "📋",
    color: "bg-orange-100 text-orange-800",
  },
  CADA_SAISINE: { label: "Saisine CADA", emoji: "⚖️", color: "bg-purple-100 text-purple-800" },
  RECOURS_GRACIEUX: {
    label: "Recours gracieux",
    emoji: "🤝",
    color: "bg-green-100 text-green-800",
  },
  RECOURS_HIERARCHIQUE: {
    label: "Recours hiérarchique",
    emoji: "📊",
    color: "bg-indigo-100 text-indigo-800",
  },
  DROIT_ERREUR: { label: "Droit à l'erreur", emoji: "🔄", color: "bg-teal-100 text-teal-800" },
  AUTRE: { label: "Autre demande", emoji: "📄", color: "bg-slate-100 text-slate-800" },
};

const STATUS_BADGES = {
  BROUILLON: {
    label: "Brouillon",
    emoji: "📝",
    class: "bg-slate-100 text-slate-600 border-slate-200",
  },
  EN_COURS: { label: "En cours", emoji: "⏳", class: "bg-blue-100 text-blue-800 border-blue-200" },
  REPONDUE: {
    label: "Répondue",
    emoji: "✅",
    class: "bg-green-100 text-green-800 border-green-200",
  },
  REJET_EXPLICITE: {
    label: "Rejet explicite",
    emoji: "❌",
    class: "bg-red-100 text-red-800 border-red-200",
  },
  REJET_IMPLICITE: {
    label: "Rejet implicite",
    emoji: "⚠️",
    class: "bg-orange-100 text-orange-800 border-orange-200",
  },
  CLASSEE: { label: "Classée", emoji: "📁", class: "bg-slate-100 text-slate-600 border-slate-200" },
};

const RESPONSE_TYPES = {
  ACCUSÉ_RECEPTION: { label: "Accusé de réception", emoji: "📨" },
  REPONSE_PARTIELLE: { label: "Réponse partielle", emoji: "📑" },
  REPONSE_COMPLETE: { label: "Réponse complète", emoji: "✅" },
  DEMANDE_PRECISION: { label: "Demande de précision", emoji: "❓" },
  REFUS: { label: "Refus", emoji: "❌" },
  ORIENTATION: { label: "Orientation", emoji: "➡️" },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const badge = STATUS_BADGES[status] || {
    label: status,
    emoji: "❓",
    class: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${badge.class} font-medium`}
    >
      {badge.emoji} {badge.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const info = TYPE_LABELS[type] || {
    label: type,
    emoji: "📄",
    color: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${info.color} font-medium`}
    >
      {info.emoji} {info.label}
    </span>
  );
};

const InfoRow = ({ label, value, className = "" }) => (
  <div className={`py-2 border-b border-slate-100 last:border-0 ${className}`}>
    <div className="text-xs font-medium text-slate-500 mb-0.5">{label}</div>
    <div className="text-slate-800">
      {value || <span className="text-slate-400">Non renseigné</span>}
    </div>
  </div>
);

const DeadlineDisplay = ({ demande }) => {
  if (!demande.date_limite_reponse) {
    return <span className="text-slate-400">Non définie</span>;
  }

  const deadline = new Date(demande.date_limite_reponse);
  const now = new Date();
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const formattedDate = deadline.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (demande.status === "REPONDUE" || demande.status === "CLASSEE") {
    return <span className="text-green-600">✓ {formattedDate}</span>;
  }

  if (daysLeft < 0) {
    return (
      <div className="text-red-600">
        <div className="font-bold">
          ⛔ Délai dépassé de {Math.abs(daysLeft)} jour{Math.abs(daysLeft) > 1 ? "s" : ""}
        </div>
        <div className="text-sm">Échéance: {formattedDate}</div>
      </div>
    );
  }

  if (daysLeft <= 7) {
    return (
      <div className="text-orange-600">
        <div className="font-bold">
          ⚠️ {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}
        </div>
        <div className="text-sm">Échéance: {formattedDate}</div>
      </div>
    );
  }

  return (
    <div className="text-green-600">
      <div>{formattedDate}</div>
      <div className="text-sm text-slate-500">{daysLeft} jours restants</div>
    </div>
  );
};

const ResponseCard = ({ response }) => {
  const typeInfo = RESPONSE_TYPES[response.type_reponse] || {
    label: response.type_reponse,
    emoji: "📄",
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeInfo.emoji}</span>
          <span className="font-medium text-slate-700">{typeInfo.label}</span>
        </div>
        <div className="text-sm text-slate-500">
          {response.date_reponse
            ? new Date(response.date_reponse).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : new Date(response.created_at).toLocaleDateString("fr-FR")}
        </div>
      </div>
      <div className="p-4">
        {response.resume && (
          <div className="mb-3">
            <div className="text-xs font-medium text-slate-500 mb-1">Résumé</div>
            <p className="text-slate-700">{response.resume}</p>
          </div>
        )}
        {response.contenu && (
          <div className="mb-3">
            <div className="text-xs font-medium text-slate-500 mb-1">Contenu</div>
            <p className="text-slate-700 whitespace-pre-wrap">{response.contenu}</p>
          </div>
        )}
        {response.reference_courrier && (
          <div className="text-sm text-slate-500">Réf: {response.reference_courrier}</div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demande, setDemande] = useState(null);
  const [responses, setResponses] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    const fetchDemande = async () => {
      if (!getSupabase() || !id) {
        setError("Configuration manquante ou ID invalide.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch demande with related data
        const { data: demandeData, error: demandeError } = await getSupabase()
          .from("demande_admin")
          .select(
            `
            *,
            acte:acte_id (id, numero_interne, objet_court, type_acte, date_acte),
            collectivite:collectivite_id (id, nom, code_insee)
          `
          )
          .eq("id", id)
          .single();

        if (demandeError) throw demandeError;
        if (!demandeData) throw new Error("Demande non trouvée");

        setDemande(demandeData);

        // Fetch responses
        const { data: responsesData, error: responsesError } = await getSupabase()
          .from("reponse_admin")
          .select("*")
          .eq("demande_id", id)
          .order("date_reponse", { ascending: false });

        if (responsesError) throw responsesError;
        setResponses(responsesData || []);

        // Fetch proofs linked to this demande
        const { data: proofsData } = await getSupabase()
          .from("proof_link")
          .select(
            `
            proof:proof_id (id, type, label, url_fichier, date_constat, verified_at)
          `
          )
          .eq("demande_admin_id", id);

        setProofs((proofsData || []).map((pl) => pl.proof).filter(Boolean));

        // Fetch deadlines for this demande
        const { data: deadlinesData } = await getSupabase()
          .from("deadline_instance")
          .select(
            `
            *,
            template:template_id (label_fr, description)
          `
          )
          .eq("demande_admin_id", id)
          .order("due_date", { ascending: true });

        setDeadlines(deadlinesData || []);
      } catch (err) {
        console.error("[DemandeDetail] Error:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchDemande();
  }, [id]);

  // Legal info based on type
  const getLegalInfo = (type) => {
    const infos = {
      CRPA_COMMUNICATION: {
        title: "Communication de documents (CRPA)",
        articles: "Art. L311-1 à L311-9 CRPA",
        delai: "1 mois (art. R311-12 CRPA)",
        recours: "Saisine CADA possible en cas de refus ou silence",
      },
      CRPA_RECLAMATION: {
        title: "Réclamation administrative",
        articles: "Art. L112-3 CRPA",
        delai: "Pas de délai légal impératif",
        recours: "Recours gracieux ou contentieux selon les cas",
      },
      CADA_SAISINE: {
        title: "Saisine de la CADA",
        articles: "Art. L342-1 CRPA",
        delai: "Avis CADA sous 1 mois",
        recours: "Décision du maire sous 2 mois après avis CADA",
      },
      RECOURS_GRACIEUX: {
        title: "Recours gracieux",
        articles: "Art. L411-2 CRPA",
        delai: "2 mois pour une réponse",
        recours: "Silence = rejet implicite (ouvre droit au TA)",
      },
      RECOURS_HIERARCHIQUE: {
        title: "Recours hiérarchique",
        articles: "Contrôle de légalité préfectoral",
        delai: "2 mois pour transmission au Préfet",
        recours: "Déféré préfectoral possible",
      },
      DROIT_ERREUR: {
        title: "Droit à l'erreur",
        articles: "Art. L123-1 et L123-2 CRPA",
        delai: "Régularisation possible",
        recours: "Pas de sanction si bonne foi",
      },
    };
    return infos[type] || null;
  };

  const legalInfo = demande ? getLegalInfo(demande.type) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-500">Chargement de la demande...</p>
        </div>
      </div>
    );
  }

  if (error || !demande) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Erreur</h1>
          <p className="text-slate-600 mb-4">{error || "Demande introuvable"}</p>
          <Link to="/demandes" className="text-blue-600 hover:text-blue-800">
            ← Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            <Link to="/demandes" className="hover:text-blue-600">
              Demandes
            </Link>
            <span>/</span>
            <span className="text-slate-700">Détail</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TypeBadge type={demande.type} />
                <StatusBadge status={demande.status} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {demande.objet || "Demande sans objet"}
              </h1>
              {demande.collectivite && (
                <p className="text-slate-500 mt-1">{demande.collectivite.nom}</p>
              )}
            </div>

            {user && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/demandes/${id}/modifier`)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => navigate(`/demandes/${id}/reponse`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  ➕ Ajouter réponse
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                📋 Détails de la demande
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <InfoRow
                  label="Date d'envoi"
                  value={
                    demande.date_envoi
                      ? new Date(demande.date_envoi).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : null
                  }
                />
                <InfoRow label="Référence d'envoi" value={demande.reference_envoi} />
                <InfoRow label="Méthode d'envoi" value={demande.method_envoi} />
                <InfoRow
                  label="Date limite de réponse"
                  value={<DeadlineDisplay demande={demande} />}
                />
              </div>

              {demande.motifs && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    Motifs / Fondements juridiques
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{demande.motifs}</p>
                </div>
              )}

              {demande.metadata && Object.keys(demande.metadata).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500 mb-1">Métadonnées</div>
                  <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(demande.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Linked acte */}
            {demande.acte && (
              <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">📑 Acte concerné</h2>
                <Link
                  to={`/actes/${demande.acte.id}`}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {demande.acte.numero_interne || "Sans numéro"}
                    </div>
                    <div className="text-sm text-slate-600">
                      {demande.acte.objet_court || "Sans objet"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {demande.acte.type_acte} • {demande.acte.date_acte}
                    </div>
                  </div>
                  <span className="text-blue-600">Voir →</span>
                </Link>
              </div>
            )}

            {/* Responses */}
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  💬 Réponses ({responses.length})
                </h2>
                {user && (
                  <button
                    onClick={() => navigate(`/demandes/${id}/reponse`)}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    ➕ Ajouter
                  </button>
                )}
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>Aucune réponse enregistrée</p>
                  {demande.status === "EN_COURS" && (
                    <p className="text-sm mt-1">
                      Délai: <DeadlineDisplay demande={demande} />
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {responses.map((response) => (
                    <ResponseCard key={response.id} response={response} />
                  ))}
                </div>
              )}
            </div>

            {/* Proofs */}
            {proofs.length > 0 && (
              <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">📎 Preuves liées</h2>
                <div className="space-y-2">
                  {proofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {proof.type === "SCREENSHOT"
                            ? "🖼️"
                            : proof.type === "PDF"
                              ? "📄"
                              : proof.type === "EMAIL"
                                ? "📧"
                                : "📎"}
                        </span>
                        <div>
                          <div className="font-medium text-slate-700">
                            {proof.label || proof.type}
                          </div>
                          {proof.date_constat && (
                            <div className="text-xs text-slate-500">
                              Constaté le {new Date(proof.date_constat).toLocaleDateString("fr-FR")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {proof.verified_at && (
                          <span className="text-green-500" title="Vérifié">
                            ✅
                          </span>
                        )}
                        {proof.url_fichier && (
                          <a
                            href={proof.url_fichier}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Voir →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Legal info */}
            {legalInfo && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-indigo-800 mb-3">⚖️ Cadre juridique</h3>
                <div className="space-y-2 text-sm text-indigo-700">
                  <div>
                    <strong>Articles:</strong> {legalInfo.articles}
                  </div>
                  <div>
                    <strong>Délai légal:</strong> {legalInfo.delai}
                  </div>
                  <div>
                    <strong>Recours:</strong> {legalInfo.recours}
                  </div>
                </div>
              </div>
            )}

            {/* Deadlines */}
            {deadlines.length > 0 && (
              <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">⏰ Échéances</h3>
                <div className="space-y-2">
                  {deadlines.map((deadline) => {
                    const dueDate = new Date(deadline.due_date);
                    const now = new Date();
                    const isOverdue = dueDate < now && !deadline.achieved_at;

                    return (
                      <div
                        key={deadline.id}
                        className={`p-2 rounded ${
                          deadline.achieved_at
                            ? "bg-green-50 border border-green-200"
                            : isOverdue
                              ? "bg-red-50 border border-red-200"
                              : "bg-slate-50 border border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {deadline.template?.label_fr || "Échéance"}
                          </span>
                          {deadline.achieved_at ? (
                            <span className="text-green-600 text-xs">✅</span>
                          ) : isOverdue ? (
                            <span className="text-red-600 text-xs font-bold">⛔</span>
                          ) : (
                            <span className="text-blue-600 text-xs">⏳</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {dueDate.toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">📅 Chronologie</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5"></div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">Création</div>
                    <div className="text-xs text-slate-500">
                      {new Date(demande.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>
                {demande.date_envoi && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">Envoi</div>
                      <div className="text-xs text-slate-500">
                        {new Date(demande.date_envoi).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                )}
                {responses.map((response) => (
                  <div key={response.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {RESPONSE_TYPES[response.type_reponse]?.label || "Réponse"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {response.date_reponse
                          ? new Date(response.date_reponse).toLocaleDateString("fr-FR")
                          : new Date(response.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                ))}
                {demande.status === "CLASSEE" && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-600 mt-1.5"></div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">Classée</div>
                      <div className="text-xs text-slate-500">
                        {new Date(demande.updated_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">🔗 Actions</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-50 text-slate-700">
                  📤 Exporter en PDF
                </button>
                <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-50 text-slate-700">
                  📧 Envoyer un rappel
                </button>
                {demande.status === "EN_COURS" && (
                  <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-red-50 text-red-600">
                    ⚠️ Signaler rejet implicite
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
