// src/pages/actes/ActeForm.jsx
// ============================================================================
// Formulaire de création/modification d'un acte municipal
// Versionné: chaque modification crée une nouvelle version
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import { useSupabase } from "../../contexts/SupabaseContext";
import SiteFooter from "../../components/layout/SiteFooter";

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPES_ACTE = [
  { value: "DELIBERATION", label: "Délibération", description: "Décision du conseil municipal" },
  { value: "ARRETE", label: "Arrêté", description: "Décision individuelle du maire" },
  { value: "DECISION", label: "Décision", description: "Décision administrative" },
  { value: "PV", label: "Procès-verbal", description: "Compte-rendu de séance" },
  { value: "AUTRE", label: "Autre", description: "Autre type d'acte" },
];

const STATUTS_JURIDIQUES = [
  {
    value: "NON_TRANSMIS",
    label: "Non transmis",
    description: "Pas encore transmis à la préfecture",
  },
  {
    value: "EN_ATTENTE_CONTROLE",
    label: "En attente de contrôle",
    description: "Transmis, en attente d'avis",
  },
  { value: "EXECUTOIRE", label: "Exécutoire", description: "Validé et en vigueur" },
  { value: "SUSPENDU", label: "Suspendu", description: "Suspendu suite à un recours" },
  { value: "ANNULE", label: "Annulé", description: "Annulé par le TA ou le maire" },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FormField = ({ label, required, help, error, children }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {help && <p className="text-xs text-slate-500">{help}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const RadioOption = ({ name, value, currentValue, label, description, onChange }) => (
  <label
    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
      currentValue === value
        ? "border-blue-500 bg-blue-50"
        : "border-slate-200 hover:border-slate-300"
    }`}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={currentValue === value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-0.5"
    />
    <div>
      <div className="font-medium text-slate-800">{label}</div>
      {description && <div className="text-xs text-slate-500">{description}</div>}
    </div>
  </label>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabase();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [collectivites, setCollectivites] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    collectivite_id: "",
    type_acte: "DELIBERATION",
    numero_interne: "",
    numero_actes: "",
    date_acte: "",
    objet_court: "",
    objet_complet: "",
    statut_juridique: "NON_TRANSMIS",
    transmission_declared: "",
    transmission_confirmed: "",
    date_publication: "",
    url_document: "",
    notes: "",
    mandat_id: "",
  });

  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});
  const [mandats, setMandats] = useState([]);

  // Fetch collectivites and mandats on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!getSupabase()) return;

      // Fetch collectivites
      const { data: collData } = await getSupabase()
        .from("collectivite")
        .select("id, nom, code_insee")
        .order("nom");

      setCollectivites(collData || []);

      // Fetch mandats (to link actes to specific roles)
      const { data: mandatData } = await getSupabase()
        .from("mandats")
        .select(
          `
          id_mandat, 
          role, 
          user:users(display_name)
        `
        )
        .order("role");

      setMandats(mandatData || []);

      // Set default collectivite if only one
      if (collData?.length === 1 && !isEditing) {
        setFormData((prev) => ({ ...prev, collectivite_id: collData[0].id }));
      }
    };

    fetchInitialData();
  }, [isEditing]);

  // Fetch existing acte if editing
  useEffect(() => {
    const fetchActe = async () => {
      if (!isEditing || !getSupabase() || !id) return;

      setLoadingData(true);

      try {
        const { data, error: fetchError } = await getSupabase()
          .from("v_actes_current")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Acte non trouvé");

        // Populate form
        const populated = {
          collectivite_id: data.collectivite_id || "",
          type_acte: data.type_acte || "DELIBERATION",
          numero_interne: data.numero_interne || "",
          numero_actes: data.numero_actes || "",
          date_acte: data.date_acte || "",
          objet_court: data.objet_court || "",
          objet_complet: data.objet_complet || "",
          statut_juridique: data.statut_juridique || "NON_TRANSMIS",
          transmission_declared: data.transmission_declared || "",
          transmission_confirmed: data.transmission_confirmed || "",
          date_publication: data.date_publication || "",
          url_document: data.url_document || "",
          mandat_id: data.mandat_id || "",
          notes: "",
        };

        setFormData(populated);
        setOriginalData(populated);
      } catch (err) {
        console.error("[ActeForm] Error fetching:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoadingData(false);
      }
    };

    fetchActe();
  }, [id, isEditing]);

  // Handle field change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.collectivite_id) {
      newErrors.collectivite_id = "Veuillez sélectionner une collectivité";
    }
    if (!formData.type_acte) {
      newErrors.type_acte = "Veuillez sélectionner un type";
    }
    if (!formData.date_acte) {
      newErrors.date_acte = "La date de l'acte est requise";
    }
    if (!formData.objet_court || formData.objet_court.length < 5) {
      newErrors.objet_court = "L'objet doit faire au moins 5 caractères";
    }
    if (isEditing && !formData.notes) {
      newErrors.notes = "Veuillez indiquer le motif de modification";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;
    if (!user?.id) {
      setError("Vous devez être connecté");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        // Use versioned update RPC
        const changes = {};
        Object.keys(formData).forEach((key) => {
          if (key !== "notes" && formData[key] !== originalData?.[key]) {
            changes[key] = formData[key];
          }
        });

        if (Object.keys(changes).length === 0) {
          setError("Aucune modification détectée");
          setLoading(false);
          return;
        }

        const { error: updateError } = await getSupabase().rpc("update_acte_versioned", {
          p_acte_id: id,
          p_user_id: user.id,
          p_change_reason: formData.notes,
          p_changes: changes,
        });

        if (updateError) throw updateError;

        setSuccess(true);
        setTimeout(() => navigate(`/actes/${id}`), 1500);
      } else {
        // Create new acte
        const insertData = {
          collectivite_id: formData.collectivite_id,
          type_acte: formData.type_acte,
          numero_interne: formData.numero_interne || null,
          numero_actes: formData.numero_actes || null,
          date_acte: formData.date_acte,
          objet_court: formData.objet_court,
          objet_complet: formData.objet_complet || null,
          statut_juridique: formData.statut_juridique,
          transmission_declared: formData.transmission_declared || null,
          transmission_confirmed: formData.transmission_confirmed || null,
          date_publication: formData.date_publication || null,
          url_document: formData.url_document || null,
          mandat_id: formData.mandat_id || null,
          metadata: {
            notes: formData.notes,
            last_edited_at: new Date().toISOString(),
          },
          created_by: user.id,
          version: 1,
          is_current: true,
        };

        const { data, error: insertError } = await getSupabase()
          .from("actes")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError) throw insertError;

        setSuccess(true);
        setTimeout(() => navigate(`/actes/${data.id}`), 1500);
      }
    } catch (err) {
      console.error("[ActeForm] Submit error:", err);
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  // Check if form has changes
  const hasChanges =
    isEditing &&
    originalData &&
    Object.keys(formData).some((key) => {
      if (key === "notes") return false;
      return formData[key] !== originalData[key];
    });

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            <Link to="/actes/liste" className="hover:text-blue-600">
              Actes
            </Link>
            <span>/</span>
            <span className="text-slate-700">{isEditing ? "Modifier" : "Nouveau"}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? "✏️ Modifier l'acte" : "➕ Nouvel acte municipal"}
          </h1>
          {isEditing && (
            <p className="text-slate-500 mt-1">
              ⚠️ Chaque modification crée une nouvelle version (traçabilité totale)
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
              ✅ Acte {isEditing ? "modifié" : "créé"} avec succès ! Redirection...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Basic info */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">📋 Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Collectivité" required error={errors.collectivite_id}>
                <select
                  value={formData.collectivite_id}
                  onChange={(e) => handleChange("collectivite_id", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isEditing}
                >
                  <option value="">Sélectionner...</option>
                  {collectivites.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} ({c.code_insee})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Mandat associé"
                help="Associer cet acte à un élu ou un mandat spécifique"
              >
                <select
                  value={formData.mandat_id}
                  onChange={(e) => handleChange("mandat_id", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun mandat spécifique</option>
                  {mandats.map((m) => (
                    <option key={m.id_mandat} value={m.id_mandat}>
                      {m.user?.display_name} - {m.role}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date de l'acte" required error={errors.date_acte}>
                <input
                  type="date"
                  value={formData.date_acte}
                  onChange={(e) => handleChange("date_acte", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Numéro interne" help="Numéro de référence interne">
                <input
                  type="text"
                  value={formData.numero_interne}
                  onChange={(e) => handleChange("numero_interne", e.target.value)}
                  placeholder="DEL-2024-001"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Numéro @CTES" help="Numéro officiel de télétransmission">
                <input
                  type="text"
                  value={formData.numero_actes}
                  onChange={(e) => handleChange("numero_actes", e.target.value)}
                  placeholder="02A-123-456789"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          </div>

          {/* Type */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">📂 Type d'acte</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TYPES_ACTE.map((type) => (
                <RadioOption
                  key={type.value}
                  name="type_acte"
                  value={type.value}
                  currentValue={formData.type_acte}
                  label={type.label}
                  description={type.description}
                  onChange={(v) => handleChange("type_acte", v)}
                />
              ))}
            </div>
            {errors.type_acte && <p className="text-xs text-red-600 mt-2">{errors.type_acte}</p>}
          </div>

          {/* Object */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">📝 Objet de l'acte</h2>

            <FormField
              label="Objet court"
              required
              error={errors.objet_court}
              help="Titre synthétique (max 200 caractères)"
            >
              <input
                type="text"
                value={formData.objet_court}
                onChange={(e) => handleChange("objet_court", e.target.value)}
                maxLength={200}
                placeholder="Ex: Approbation du budget primitif 2024"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-slate-400 text-right">
                {formData.objet_court.length}/200
              </div>
            </FormField>

            <FormField label="Objet complet" help="Description détaillée (optionnel)">
              <textarea
                value={formData.objet_complet}
                onChange={(e) => handleChange("objet_complet", e.target.value)}
                rows={4}
                placeholder="Description complète de l'acte, contexte, références..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">⚖️ Statut juridique</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STATUTS_JURIDIQUES.map((statut) => (
                <RadioOption
                  key={statut.value}
                  name="statut_juridique"
                  value={statut.value}
                  currentValue={formData.statut_juridique}
                  label={statut.label}
                  description={statut.description}
                  onChange={(v) => handleChange("statut_juridique", v)}
                />
              ))}
            </div>
          </div>

          {/* Transmission */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📤 Transmission préfectorale
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Transmission déclarée" help="Date déclarée par la mairie">
                <input
                  type="date"
                  value={formData.transmission_declared}
                  onChange={(e) => handleChange("transmission_declared", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Transmission confirmée" help="Date confirmée par accusé réception">
                <input
                  type="date"
                  value={formData.transmission_confirmed}
                  onChange={(e) => handleChange("transmission_confirmed", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Date de publication" help="Date de publication officielle">
                <input
                  type="date"
                  value={formData.date_publication}
                  onChange={(e) => handleChange("date_publication", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Lien vers le document" help="URL du document officiel">
                <input
                  type="url"
                  value={formData.url_document}
                  onChange={(e) => handleChange("url_document", e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          </div>

          {/* Notes (required for editing) */}
          {isEditing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-4">
                📝 Motif de modification
              </h2>

              <FormField
                label="Raison de cette modification"
                required
                error={errors.notes}
                help="Cette information sera conservée dans l'historique des versions"
              >
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  placeholder="Ex: Correction d'une erreur de date, mise à jour suite à accusé de réception..."
                  className="w-full border border-yellow-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                />
              </FormField>

              {hasChanges && (
                <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                  <div className="text-sm font-medium text-yellow-800 mb-2">
                    Modifications détectées:
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {Object.keys(formData).map((key) => {
                      if (key === "notes" || formData[key] === originalData?.[key]) return null;
                      return (
                        <li key={key}>
                          • <strong>{key}</strong>: {String(originalData?.[key] || "vide")} →{" "}
                          {String(formData[key] || "vide")}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <Link
              to={isEditing ? `/actes/${id}` : "/actes/liste"}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              ← Annuler
            </Link>

            <button
              type="submit"
              disabled={loading || (isEditing && !hasChanges)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                loading || (isEditing && !hasChanges)
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Enregistrement...
                </span>
              ) : isEditing ? (
                "💾 Sauvegarder (nouvelle version)"
              ) : (
                "✅ Créer l'acte"
              )}
            </button>
          </div>
        </form>
      </div>

      <SiteFooter />
    </div>
  );
}
