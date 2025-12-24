// src/pages/consultations/ConsultationDemocratieLocale.jsx
// Consultation nationale fédérée : Baromètre de la démocratie locale
// Les réponses sont stockées localement ET synchronisées vers la base nationale

import { useState, useEffect, useCallback } from "react";
import ConsultationLayout, {
  PieChartSection,
  BarChartSection,
  ScoreSection,
} from "../../components/consultations/ConsultationLayout";
import { ShareCallToAction, ShareButton } from "../../components/consultations/ShareConsultation";
import { CITY_NAME, MOVEMENT_NAME, COMMUNITY_NAME, IS_NATIONAL_HUB } from "../../constants";
import {
  getConsultationBySlug,
  submitConsultationResponse,
  getConsultationStats,
  getNationalStats,
  compareWithNational,
  hasAlreadyResponded,
  generateSessionId,
  validateResponses,
  saveDraft,
  loadDraft,
  clearDraft,
  formatDraftDate,
} from "../../lib/consultations";
import { useCurrentUser } from "../../lib/useCurrentUser";

const CONSULTATION_SLUG = "democratie-locale-2024";

export default function ConsultationDemocratieLocale() {
  const { currentUser } = useCurrentUser();

  // État du formulaire
  const [formData, setFormData] = useState({
    // Connaissance
    connaissanceEnjeuxLocaux: "",
    participationConseil: "",
    suiviDeliberations: "",
    // Transparence
    satisfactionTransparence: 3,
    accesInformation: "",
    qualiteCommunication: "",
    // Participation
    satisfactionDemocratie: 3,
    sentimentEcoute: "",
    opportunitesParticipation: "",
    favorableReferendum: "",
    // Numérique
    usageSiteWeb: "",
    demarchesEnLigne: "",
    ouvertureOpenData: "",
    // Profil
    tailleCommune: "",
    age: "",
    dureeHabitation: "",
  });

  const [consultation, setConsultation] = useState(null);
  const [localStats, setLocalStats] = useState(null);
  const [nationalStats, setNationalStats] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [draftInfo, setDraftInfo] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Charger la consultation
  useEffect(() => {
    async function load() {
      const data = await getConsultationBySlug(CONSULTATION_SLUG);
      if (data) {
        setConsultation(data);
      }
    }
    load();
  }, []);

  // Charger le brouillon
  useEffect(() => {
    const draft = loadDraft(CONSULTATION_SLUG);
    if (draft && !alreadyResponded) {
      setFormData((prev) => ({ ...prev, ...draft.responses }));
      setDraftInfo(draft);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 5000);
    }
  }, [alreadyResponded]);

  // Sauvegarde auto du brouillon
  const saveDraftDebounced = useCallback(() => {
    if (!alreadyResponded && !submitted) {
      const saved = saveDraft(CONSULTATION_SLUG, formData);
      if (saved) {
        setDraftInfo({ savedAt: new Date().toISOString() });
      }
    }
  }, [formData, alreadyResponded, submitted]);

  useEffect(() => {
    const timer = setTimeout(saveDraftDebounced, 2000);
    return () => clearTimeout(timer);
  }, [formData, saveDraftDebounced]);

  // Vérifier si déjà répondu
  useEffect(() => {
    async function check() {
      if (!consultation?.id) return;
      const hasResponded = await hasAlreadyResponded(consultation.id, {
        userId: currentUser?.id,
        sessionId,
      });
      setAlreadyResponded(hasResponded);
    }
    check();
  }, [consultation?.id, currentUser?.id, sessionId]);

  // Charger les statistiques
  useEffect(() => {
    async function loadStats() {
      if (!consultation?.id) return;

      // Stats locales
      const local = await getConsultationStats(consultation.id);
      setLocalStats(local);

      // Stats nationales
      const national = await getNationalStats(CONSULTATION_SLUG);
      setNationalStats(national);
    }
    loadStats();
  }, [consultation?.id, submitted]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (alreadyResponded) {
      setError("Vous avez déjà participé à cette consultation.");
      return;
    }

    // Validation
    if (consultation?.schema) {
      const { valid, errors } = validateResponses(formData, consultation.schema);
      setValidationErrors(errors);
      if (!valid) {
        setError(`Veuillez corriger les ${errors.length} erreur(s) dans le formulaire.`);
        return;
      }
    }

    setFormLoading(true);
    setError("");
    setValidationErrors([]);

    try {
      const result = await submitConsultationResponse(consultation.id, formData, {
        userId: currentUser?.id,
        sessionId,
        syncToNational: true, // Toujours synchroniser vers la base nationale
      });

      if (!result.success) {
        if (result.error === "duplicate") {
          setError("Vous avez déjà participé à cette consultation.");
          setAlreadyResponded(true);
        } else {
          throw new Error(result.error || "Erreur lors de l'envoi");
        }
        setFormLoading(false);
        return;
      }

      // Succès
      clearDraft(CONSULTATION_SLUG);
      setDraftInfo(null);
      setSubmitted(true);
      setAlreadyResponded(true);

      setTimeout(async () => {
        // Recharger les stats
        const local = await getConsultationStats(consultation.id);
        setLocalStats(local);
        const national = await getNationalStats(CONSULTATION_SLUG);
        setNationalStats(national);

        setSubmitted(false);
        setFormLoading(false);
      }, 2000);
    } catch (err) {
      console.error("Erreur soumission:", err);
      setError("Erreur lors de l'envoi. Veuillez réessayer.");
      setFormLoading(false);
    }
  };

  // Rendu des questions par section
  const renderQuestion = (q) => {
    const value = formData[q.id];
    const fieldError = validationErrors.find((e) => e.field === q.id);

    if (q.type === "radio") {
      return (
        <div key={q.id} className={`question-group ${fieldError ? "field-invalid" : ""}`}>
          <label className="form-label">{q.label}</label>
          <div className="choice-group">
            {q.options.map((opt) => (
              <label key={opt} className="choice-label">
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={value === opt}
                  onChange={handleInputChange}
                  disabled={alreadyResponded}
                />
                {opt}
              </label>
            ))}
          </div>
          {fieldError && <span className="field-error">{fieldError.message}</span>}
        </div>
      );
    }

    if (q.type === "scale") {
      return (
        <div key={q.id} className={`question-group ${fieldError ? "field-invalid" : ""}`}>
          <label className="form-label">{q.label}</label>
          <div className="scale-group">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="scale-option">
                <input
                  type="radio"
                  name={q.id}
                  value={n}
                  checked={parseInt(value) === n}
                  onChange={handleInputChange}
                  disabled={alreadyResponded}
                />
                <span className="scale-value">{n}</span>
              </label>
            ))}
          </div>
          <div className="scale-labels">
            <span>Très insatisfait</span>
            <span>Très satisfait</span>
          </div>
          {fieldError && <span className="field-error">{fieldError.message}</span>}
        </div>
      );
    }

    if (q.type === "select") {
      return (
        <div key={q.id} className={`question-group ${fieldError ? "field-invalid" : ""}`}>
          <label className="form-label">{q.label}</label>
          <select
            name={q.id}
            value={value}
            onChange={handleInputChange}
            disabled={alreadyResponded}
          >
            <option value="">-- Choisir --</option>
            {q.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {fieldError && <span className="field-error">{fieldError.message}</span>}
        </div>
      );
    }

    return null;
  };

  // Contenu du formulaire
  const formContent = consultation?.schema ? (
    <>
      <div className="consultation-header">
        <h1 className="page-title">Baromètre de la démocratie locale</h1>
        <ShareButton
          consultation={{ slug: CONSULTATION_SLUG, title: "Baromètre de la démocratie locale" }}
          scope="national"
          stats={nationalStats?.global}
        />
      </div>
      <p className="section-description">
        Consultation nationale fédérée — Vos réponses contribuent à {COMMUNITY_NAME} et à la base
        nationale
      </p>

      {IS_NATIONAL_HUB && (
        <div className="consultation-hub-banner">
          🏛️ Cette instance ({COMMUNITY_NAME}) est le hub national qui agrège les réponses de toutes
          les communes.
        </div>
      )}

      {draftRestored && draftInfo && (
        <div className="consultation-draft-banner">
          <span>📝 Brouillon restauré (sauvegardé {formatDraftDate(draftInfo.savedAt)})</span>
          <button
            type="button"
            onClick={() => {
              clearDraft(CONSULTATION_SLUG);
              setDraftInfo(null);
              setDraftRestored(false);
              window.location.reload();
            }}
            className="draft-clear-btn"
          >
            Recommencer
          </button>
        </div>
      )}

      {draftInfo && !draftRestored && !alreadyResponded && !submitted && (
        <div className="consultation-autosave-indicator">💾 Sauvegardé automatiquement</div>
      )}

      {error && <div className="consultation-error-banner">{error}</div>}

      {alreadyResponded && !submitted && (
        <>
          <div className="consultation-info-banner">
            <p>✅ Vous avez déjà participé à cette consultation. Merci !</p>
            <p>Consultez les résultats locaux et la comparaison nationale ci-dessous.</p>
          </div>
          <ShareCallToAction
            consultation={{ slug: CONSULTATION_SLUG, title: "Baromètre de la démocratie locale" }}
            scope="national"
            stats={nationalStats?.global}
            message="Merci pour votre participation ! Partagez cette consultation pour amplifier la voix des citoyens."
          />
        </>
      )}

      <div className="landing-content">
        {consultation.schema.sections.map((section) => (
          <div key={section.id} className="question-set">
            <h2 className="section-title">{section.title}</h2>
            {section.optional && <p className="section-optional">(Section optionnelle)</p>}
            {section.questions.map(renderQuestion)}
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={formLoading || alreadyResponded}
          className="btn btn-primary submit-btn"
        >
          {formLoading
            ? "Envoi en cours..."
            : alreadyResponded
              ? "Vous avez déjà participé"
              : "Envoyer ma contribution"}
        </button>
      </div>
    </>
  ) : (
    <div className="loading">Chargement de la consultation...</div>
  );

  // Contenu des résultats
  const resultsContent = (
    <div className="results-container">
      <h2 className="section-title">Résultats — {COMMUNITY_NAME}</h2>

      {localStats && localStats.totalResponses > 0 ? (
        <>
          <p className="stats-summary">
            {localStats.totalResponses} réponse{localStats.totalResponses > 1 ? "s" : ""} locale
            {localStats.totalResponses > 1 ? "s" : ""}
          </p>

          {/* Satisfaction démocratie locale */}
          <ScoreSection
            title="Satisfaction démocratie locale"
            score={localStats.byField?.satisfactionDemocratie?._average || 0}
            maxScore={5}
            description="Note moyenne sur 5"
          />

          {/* Satisfaction transparence */}
          <ScoreSection
            title="Satisfaction transparence"
            score={localStats.byField?.satisfactionTransparence?._average || 0}
            maxScore={5}
            description="Note moyenne sur 5"
          />

          {/* Participation conseil */}
          {localStats.byField?.participationConseil && (
            <PieChartSection
              title="Participation au conseil municipal"
              data={Object.entries(localStats.byField.participationConseil.values).map(
                ([name, value]) => ({ name, value })
              )}
            />
          )}

          {/* Sentiment d'écoute */}
          {localStats.byField?.sentimentEcoute && (
            <BarChartSection
              title="Sentiment d'être écouté par les élus"
              data={Object.entries(localStats.byField.sentimentEcoute.values).map(
                ([name, value]) => ({ name, value })
              )}
            />
          )}
        </>
      ) : (
        <p className="no-results">Aucune réponse locale pour le moment.</p>
      )}

      {/* Comparaison nationale */}
      {nationalStats && nationalStats.communeCount > 1 && (
        <div className="national-comparison">
          <h2 className="section-title">
            Comparaison nationale
            <button onClick={() => setShowComparison(!showComparison)} className="toggle-btn">
              {showComparison ? "Masquer" : "Afficher"}
            </button>
          </h2>

          {showComparison && (
            <>
              <p className="stats-summary">
                {nationalStats.global.totalResponses} réponses de {nationalStats.communeCount}{" "}
                commune{nationalStats.communeCount > 1 ? "s" : ""}
              </p>

              {/* Tableau comparatif */}
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Indicateur</th>
                    <th>{COMMUNITY_NAME}</th>
                    <th>Moyenne nationale</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Satisfaction démocratie</td>
                    <td>
                      {(localStats?.byField?.satisfactionDemocratie?._average || 0).toFixed(1)}/5
                    </td>
                    <td>
                      {(
                        nationalStats.global.byField?.satisfactionDemocratie?._average || 0
                      ).toFixed(1)}
                      /5
                    </td>
                    <td
                      className={
                        (localStats?.byField?.satisfactionDemocratie?._average || 0) >=
                        (nationalStats.global.byField?.satisfactionDemocratie?._average || 0)
                          ? "positive"
                          : "negative"
                      }
                    >
                      {(
                        (localStats?.byField?.satisfactionDemocratie?._average || 0) -
                        (nationalStats.global.byField?.satisfactionDemocratie?._average || 0)
                      ).toFixed(1)}
                    </td>
                  </tr>
                  <tr>
                    <td>Satisfaction transparence</td>
                    <td>
                      {(localStats?.byField?.satisfactionTransparence?._average || 0).toFixed(1)}/5
                    </td>
                    <td>
                      {(
                        nationalStats.global.byField?.satisfactionTransparence?._average || 0
                      ).toFixed(1)}
                      /5
                    </td>
                    <td
                      className={
                        (localStats?.byField?.satisfactionTransparence?._average || 0) >=
                        (nationalStats.global.byField?.satisfactionTransparence?._average || 0)
                          ? "positive"
                          : "negative"
                      }
                    >
                      {(
                        (localStats?.byField?.satisfactionTransparence?._average || 0) -
                        (nationalStats.global.byField?.satisfactionTransparence?._average || 0)
                      ).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Classement des communes */}
              <h3>Réponses par commune</h3>
              <ul className="commune-list">
                {Object.entries(nationalStats.byCommune)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([commune, stats]) => (
                    <li key={commune} className={commune === COMMUNITY_NAME ? "current" : ""}>
                      <span className="commune-name">{commune}</span>
                      <span className="commune-count">
                        {stats.count} réponse{stats.count > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Partage en fin de résultats */}
      <ShareCallToAction
        consultation={{ slug: CONSULTATION_SLUG, title: "Baromètre de la démocratie locale" }}
        scope="national"
        stats={nationalStats?.global}
        message="Plus de communes participantes = des comparaisons plus significatives. Partagez !"
      />
    </div>
  );

  return <ConsultationLayout formContent={formContent} resultsContent={resultsContent} />;
}
