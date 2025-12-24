// src/pages/consultations/ConsultationsHome.jsx
// Page d'accueil principale de la plateforme
// Structure : En-tête + Fil d'actualités + Consultation (foldable) + Accès rapides

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CONSULTATIONS } from "./index";
import {
  CONSULTATION_SCOPES,
  COMMUNITY_NAME,
  MOVEMENT_NAME,
  CITY_NAME,
  CITY_TAGLINE,
  HASHTAG,
} from "../../constants";
import { extractPetitionsFromConsultation } from "../../lib/petitions";
import { PetitionLinks } from "../../components/common/PetitionLink";
import {
  getActiveConsultations,
  hasAlreadyResponded,
  generateSessionId,
  getConsultationStats,
} from "../../lib/consultations";
import { useCurrentUser } from "../../lib/useCurrentUser";
import FilNewsFeed from "../../components/fil/FilNewsFeed";
import GestureHeaderMenu from "../../components/layout/GestureHeaderMenu";
import SiteFooter from "../../components/layout/SiteFooter";
import "./ConsultationsHome.css";

/**
 * Carte d'accès rapide vers une fonctionnalité
 */
function QuickAccessCard({ to, icon, title, description }) {
  return (
    <Link to={to} className="quick-access-card">
      <span className="quick-access-icon">{icon}</span>
      <span className="quick-access-title">{title}</span>
      <span className="quick-access-desc">{description}</span>
    </Link>
  );
}

/**
 * Page d'accueil principale
 * - En-tête avec hashtag et ville
 * - Fil d'actualités (5 derniers items)
 * - Section consultation repliable (foldable)
 * - Accès rapides aux autres fonctionnalités
 */
export default function ConsultationsHome() {
  const { currentUser } = useCurrentUser();
  const [sessionId] = useState(() => generateSessionId());

  // État replié/déplié de la section consultation (persisté)
  const [isConsultationOpen, setIsConsultationOpen] = useState(() => {
    const saved = localStorage.getItem("consultationSectionOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persister l'état replié/déplié
  useEffect(() => {
    localStorage.setItem("consultationSectionOpen", JSON.stringify(isConsultationOpen));
  }, [isConsultationOpen]);

  // État des consultations depuis la base de données
  const [dbConsultations, setDbConsultations] = useState([]);
  const [participationStatus, setParticipationStatus] = useState({});
  const [consultationStats, setConsultationStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Consultation "à la une" (aléatoire mais stable pendant la session)
  const featuredConsultation = useMemo(() => {
    if (CONSULTATIONS.length === 0) return null;
    // Utiliser une seed basée sur la date pour avoir la même consultation "à la une" pendant 24h
    const today = new Date().toDateString();
    const seed = today.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = seed % CONSULTATIONS.length;
    return CONSULTATIONS[index];
  }, []);

  // Charger les données depuis la base
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        // Récupérer les consultations actives depuis la DB
        const active = await getActiveConsultations();
        setDbConsultations(active);

        // Vérifier le statut de participation pour chaque consultation
        const statusPromises = active.map(async (consultation) => {
          const hasResponded = await hasAlreadyResponded(consultation.id, {
            userId: currentUser?.id,
            sessionId,
          });
          return { id: consultation.id, slug: consultation.slug, hasResponded };
        });

        const statuses = await Promise.all(statusPromises);
        const statusMap = {};
        statuses.forEach(({ slug, hasResponded }) => {
          statusMap[slug] = hasResponded;
        });
        setParticipationStatus(statusMap);

        // Récupérer les stats pour chaque consultation
        const statsPromises = active.map(async (consultation) => {
          const stats = await getConsultationStats(consultation.id);
          return { slug: consultation.slug, stats };
        });

        const allStats = await Promise.all(statsPromises);
        const statsMap = {};
        allStats.forEach(({ slug, stats }) => {
          statsMap[slug] = stats;
        });
        setConsultationStats(statsMap);
      } catch (err) {
        console.error("Erreur chargement consultations:", err);
      }

      setLoading(false);
    }

    loadData();
  }, [currentUser?.id, sessionId]);

  // Fusionner les données du catalogue avec celles de la DB
  const enrichedConsultations = useMemo(() => {
    return CONSULTATIONS.map((catalogItem) => {
      const dbItem = dbConsultations.find((db) => db.slug === catalogItem.slug);
      return {
        ...catalogItem,
        ...dbItem,
        hasResponded: participationStatus[catalogItem.slug] || false,
        stats: consultationStats[catalogItem.slug] || null,
      };
    });
  }, [dbConsultations, participationStatus, consultationStats]);

  // Consultation à la une enrichie
  const enrichedFeatured = enrichedConsultations.find((c) => c.slug === featuredConsultation?.slug);

  // Autres consultations (sans la featured)
  const otherConsultations = enrichedConsultations.filter(
    (c) => c.slug !== featuredConsultation?.slug
  );

  // Fonction pour obtenir l'URL d'une consultation
  const getConsultationUrl = (slug) => {
    if (slug === "quasquara-2024") return "/consultation";
    return `/consultation/${slug.replace("-2024", "").replace("-2025", "")}`;
  };

  // Fonction pour obtenir l'icône du scope
  const getScopeInfo = (scope) => {
    return CONSULTATION_SCOPES[scope] || CONSULTATION_SCOPES.local;
  };

  if (loading) {
    return (
      <div className="app-shell">
        <a href="#mainContent" className="skip-link">
          Aller au contenu principal
        </a>
        <GestureHeaderMenu />
        <main id="mainContent" className="consultations-home">
          <div className="loading-container">
            <p>Chargement...</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a href="#mainContent" className="skip-link">
        Aller au contenu principal
      </a>
      <GestureHeaderMenu />
      <main id="mainContent" className="consultations-home">
        {/* En-tête principal avec hashtag */}
        <header className="home-hero">
          <div className="hero-content">
            <div className="hero-hashtag">{HASHTAG}</div>
            <div className="hero-divider"></div>
            <div className="hero-city">
              {String(CITY_NAME).toUpperCase()}
              <br />
              <span className="hero-tagline">{CITY_TAGLINE}</span>
            </div>
          </div>
        </header>

        {/* Fil d'actualités */}
        <section className="news-section">
          <FilNewsFeed limit={5} />
        </section>

        {/* Section Consultations (repliable) */}
        <section className="consultation-section">
          <button
            type="button"
            onClick={() => setIsConsultationOpen((open) => !open)}
            className="section-toggle"
            aria-expanded={isConsultationOpen}
          >
            <span>📊 Consultations citoyennes {MOVEMENT_NAME}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`toggle-icon ${isConsultationOpen ? "open" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isConsultationOpen && (
            <div className="consultation-content">
              {/* Consultation à la une */}
              {enrichedFeatured && (
                <div className="featured-section">
                  <h3 className="subsection-label">✨ À la une</h3>
                  <article
                    className={`featured-card ${enrichedFeatured.hasResponded ? "responded" : ""}`}
                  >
                    <div className="featured-content">
                      <div className="featured-badges">
                        <span
                          className="scope-badge"
                          style={{ background: getScopeInfo(enrichedFeatured.scope).color }}
                        >
                          {getScopeInfo(enrichedFeatured.scope).icon}{" "}
                          {getScopeInfo(enrichedFeatured.scope).label}
                        </span>
                        {enrichedFeatured.hasResponded && (
                          <span className="responded-badge">✓ Vous avez participé</span>
                        )}
                      </div>

                      <h4 className="featured-title">{enrichedFeatured.title}</h4>
                      <p className="featured-description">{enrichedFeatured.description}</p>

                      {enrichedFeatured.stats && (
                        <p className="featured-stats">
                          {enrichedFeatured.stats.totalResponses || 0} participation
                          {enrichedFeatured.stats.totalResponses > 1 ? "s" : ""}
                        </p>
                      )}

                      <Link to={getConsultationUrl(enrichedFeatured.slug)} className="featured-cta">
                        {enrichedFeatured.hasResponded ? "Voir les résultats" : "Participer"}
                      </Link>

                      <PetitionLinks
                        petitions={extractPetitionsFromConsultation(enrichedFeatured)}
                      />
                    </div>

                    <div className="featured-visual">
                      <div className="visual-placeholder">
                        <span className="visual-icon">📊</span>
                      </div>
                    </div>
                  </article>
                </div>
              )}

              {/* Autres consultations */}
              {otherConsultations.length > 0 && (
                <div className="other-section">
                  <h3 className="subsection-label">📋 Autres consultations en cours</h3>
                  <div className="consultations-grid">
                    {otherConsultations.map((consultation) => (
                      <ConsultationCard
                        key={consultation.slug}
                        consultation={consultation}
                        url={getConsultationUrl(consultation.slug)}
                        scopeInfo={getScopeInfo(consultation.scope)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {enrichedConsultations.length === 0 && (
                <div className="no-consultations">
                  <p>Aucune consultation en cours pour le moment.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Accès rapides aux fonctionnalités */}
        <section className="quick-access-section">
          <h2 className="section-label">🚀 Accès rapides</h2>
          <div className="quick-access-grid">
            <QuickAccessCard
              to="/kudocracy"
              icon="🗳️"
              title="Propositions"
              description="Votez et proposez des idées"
            />
            <QuickAccessCard
              to="/wiki"
              icon="📖"
              title="Wiki"
              description="Base de connaissances collaborative"
            />
            <QuickAccessCard
              to="/social"
              icon="☕"
              title="Café Pertitellu"
              description="Discussions et échanges"
            />
            <QuickAccessCard
              to="/gazette"
              icon="📰"
              title="La Gazette"
              description="Actualités locales"
            />
            <QuickAccessCard to="/bob" icon="🤖" title="Ophélia" description="Assistant IA" />
            <QuickAccessCard
              to="/incidents"
              icon="🚨"
              title="Incidents"
              description="Signaler un problème"
            />
            <QuickAccessCard
              to="/agenda"
              icon="📆"
              title="Agenda"
              description="Événements à venir"
            />
            <QuickAccessCard
              to="/transparence"
              icon="🔍"
              title="Transparence"
              description="Observatoire municipal"
            />
          </div>
        </section>

        {/* Informations sur le système */}
        <section className="info-section">
          <h2 className="section-label">ℹ️ À propos des consultations</h2>
          <div className="info-content">
            <p>
              Les consultations citoyennes permettent de recueillir l'avis des habitants sur des
              sujets importants. Vos réponses sont confidentielles et contribuent à une meilleure
              prise de décision démocratique.
            </p>
            <div className="scope-legend">
              <h3>Types de consultations :</h3>
              <ul>
                <li>
                  <span
                    className="scope-icon"
                    style={{ background: CONSULTATION_SCOPES.local.color }}
                  >
                    {CONSULTATION_SCOPES.local.icon}
                  </span>
                  <strong>Locale</strong> — Concerne uniquement {COMMUNITY_NAME}
                </li>
                <li>
                  <span
                    className="scope-icon"
                    style={{ background: CONSULTATION_SCOPES.regional.color }}
                  >
                    {CONSULTATION_SCOPES.regional.icon}
                  </span>
                  <strong>Régionale</strong> — À l'échelle de la région
                </li>
                <li>
                  <span
                    className="scope-icon"
                    style={{ background: CONSULTATION_SCOPES.national.color }}
                  >
                    {CONSULTATION_SCOPES.national.icon}
                  </span>
                  <strong>Nationale</strong> — Permet de comparer avec d'autres communes
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Carte de consultation (pour la grille)
 */
function ConsultationCard({ consultation, url, scopeInfo }) {
  const petitions = extractPetitionsFromConsultation(consultation);

  return (
    <article className={`consultation-card ${consultation.hasResponded ? "responded" : ""}`}>
      <div className="card-header">
        <span className="scope-badge small" style={{ background: scopeInfo.color }}>
          {scopeInfo.icon}
        </span>
        {consultation.hasResponded && (
          <span className="responded-indicator" title="Vous avez participé">
            ✓
          </span>
        )}
      </div>

      <h3 className="card-title">{consultation.title}</h3>
      <p className="card-description">{consultation.description}</p>

      {consultation.stats && (
        <p className="card-stats">
          {consultation.stats.totalResponses || 0} réponse
          {consultation.stats.totalResponses > 1 ? "s" : ""}
        </p>
      )}

      <Link to={url} className="card-link">
        {consultation.hasResponded ? "Voir les résultats →" : "Participer →"}
      </Link>

      {/* Pétitions en version compacte */}
      <PetitionLinks petitions={petitions} compact />
    </article>
  );
}
