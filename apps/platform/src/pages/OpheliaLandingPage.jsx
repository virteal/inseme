import React from "react";
import { Link } from "react-router-dom";

const GITHUB_MAIN_REPO = "https://github.com/JeanHuguesRobert/survey";
const GITHUB_COP_CORE = "https://github.com/JeanHuguesRobert/survey/tree/main/packages/cop-core";

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: 0,
    background: "radial-gradient(circle at top, #0f172a 0, #020617 55%, #000 100%)",
    color: "#e5e7eb",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  },
  wrapper: {
    maxWidth: "1040px",
    margin: "0 auto",
    padding: "32px 16px 64px 16px",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "48px",
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    background: "conic-gradient(from 140deg, #f97316, #facc15, #22c55e, #0ea5e9, #f97316)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "16px",
    color: "#020617",
  },
  logoText: {
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontSize: "14px",
    color: "#e5e7eb",
  },
  navLinks: {
    display: "flex",
    gap: "16px",
    fontSize: "14px",
  },
  navLink: {
    color: "#9ca3af",
    textDecoration: "none",
  },
  navLinkEmph: {
    color: "#e5e7eb",
    textDecoration: "none",
    fontWeight: 500,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2.2fr)",
    gap: "40px",
    alignItems: "center",
    marginBottom: "72px",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#9ca3af",
    marginBottom: "16px",
  },
  heroTitle: {
    fontSize: "40px",
    lineHeight: 1.1,
    fontWeight: 800,
    margin: "0 0 16px 0",
  },
  heroHighlight: {
    backgroundImage: "linear-gradient(to right, #f97316, #facc15, #22c55e, #0ea5e9)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  heroSubtitle: {
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#9ca3af",
    marginBottom: "24px",
  },
  heroMeta: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "24px",
  },
  heroButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "16px",
  },
  primaryButton: {
    padding: "10px 18px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    backgroundImage: "linear-gradient(135deg, #f97316, #facc15, #22c55e, #0ea5e9)",
    color: "#020617",
  },
  secondaryButton: {
    padding: "9px 17px",
    borderRadius: "999px",
    border: "1px solid rgba(148, 163, 184, 0.7)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    backgroundColor: "transparent",
    color: "#e5e7eb",
  },
  heroFootnote: {
    fontSize: "11px",
    color: "#6b7280",
  },
  heroCard: {
    borderRadius: "24px",
    padding: "20px",
    background:
      "radial-gradient(circle at top left, rgba(248, 250, 252, 0.08) 0, rgba(15, 23, 42, 0.96) 40%, rgba(15, 23, 42, 1) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.5)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.6)",
  },
  heroCardTitle: {
    fontSize: "13px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: "10px",
  },
  heroCardQuote: {
    fontSize: "14px",
    color: "#e5e7eb",
    marginBottom: "16px",
  },
  heroCardTagline: {
    fontSize: "12px",
    color: "#9ca3af",
    marginBottom: "6px",
  },
  heroCardList: {
    listStyle: "none",
    paddingLeft: 0,
    margin: 0,
    fontSize: "12px",
    color: "#9ca3af",
    display: "grid",
    gap: "4px",
  },
  tagDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "radial-gradient(circle, #f97316 0, #facc15 35%, #22c55e 70%, #0ea5e9 100%)",
    marginRight: "6px",
  },
  section: {
    marginBottom: "56px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
  },
  sectionKicker: {
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#6b7280",
  },
  sectionLead: {
    fontSize: "14px",
    color: "#9ca3af",
    maxWidth: "640px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "18px",
  },
  card: {
    borderRadius: "18px",
    border: "1px solid rgba(55, 65, 81, 0.9)",
    background: "linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.98))",
    padding: "16px",
  },
  cardLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#6b7280",
    marginBottom: "6px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "6px",
  },
  cardText: {
    fontSize: "13px",
    color: "#9ca3af",
  },
  columns2: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
    gap: "20px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "13px",
    color: "#9ca3af",
  },
  footer: {
    marginTop: "40px",
    paddingTop: "20px",
    borderTop: "1px solid rgba(31, 41, 55, 1)",
    fontSize: "11px",
    color: "#6b7280",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "8px",
  },
  footerLinks: {
    display: "flex",
    gap: "12px",
  },
  footerLink: {
    color: "#9ca3af",
    textDecoration: "none",
  },
  // Simple responsive rule: degrade to one column on small screens
  responsiveWrapper: {
    // applied via inline style merge using window width if you voulez aller plus loin
  },
};

export default function OpheliaLandingPage() {
  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={styles.page}>
      <main style={styles.wrapper}>
        {/* Navigation */}
        <header style={styles.nav}>
          <div style={styles.logoArea}>
            <div style={styles.logoCircle}>O</div>
            <div>
              <div style={styles.logoText}>Ophélia</div>
              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                Transparence, IA, démocratie directe
              </div>
            </div>
          </div>
          <nav style={styles.navLinks}>
            <button
              type="button"
              style={{ ...styles.navLink, background: "none", border: "none" }}
              onClick={() => handleScrollTo("mission")}
            >
              Mission
            </button>
            <button
              type="button"
              style={{ ...styles.navLink, background: "none", border: "none" }}
              onClick={() => handleScrollTo("features")}
            >
              Fonctionnalités
            </button>
            <Link to="/engagement">Rejoindre</Link>
            <button
              type="button"
              style={{ ...styles.navLink, background: "none", border: "none" }}
              onClick={() => handleScrollTo("about")}
            >
              À propos
            </button>
            <a href={GITHUB_MAIN_REPO} style={styles.navLinkEmph}>
              GitHub
            </a>
          </nav>
        </header>

        {/* Hero */}
        <section style={styles.hero}>
          <div>
            <div style={styles.heroBadge}>
              <span>Plateforme civique</span>
              <span>·</span>
              <span>Open source</span>
            </div>
            <h1 style={styles.heroTitle}>
              L’IA <span style={styles.heroHighlight}>au service de la souveraineté citoyenne</span>
              .
            </h1>
            <p style={styles.heroSubtitle}>
              Ophélia ingère, structure et explique les documents publics d’une commune ou d’une
              communauté. Elle transforme des PDF illisibles en décisions compréhensibles,
              discutables et contrôlables par tous.
            </p>
            <p style={styles.heroMeta}>
              Gratuit, auto-hébergeable, conçu pour les communes, associations, collectifs et
              communautés qui prennent la transparence au sérieux.
            </p>
            <div style={styles.heroButtons}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => handleScrollTo("features")}
              >
                Explorer les fonctionnalités
              </button>
              <a href={GITHUB_MAIN_REPO} style={{ textDecoration: "none" }}>
                <button type="button" style={styles.secondaryButton}>
                  Voir le code sur GitHub
                </button>
              </a>
            </div>
            <div style={styles.heroFootnote}>
              Développé par Jean-Hugues Noël Robert. IA comme infrastructure civique, pas comme
              gadget marketing.
            </div>
          </div>

          <aside style={styles.heroCard}>
            <div style={styles.heroCardTitle}>À propos du projet</div>
            <p style={styles.heroCardQuote}>
              « Ophélia n’est pas une app de plus. C’est une couche d’IA au service du peuple, pour
              que les citoyens accèdent enfin à la même information que les élus, au même moment,
              dans un format exploitable. »
            </p>
            <div style={styles.heroCardTagline}>Ophélia relie :</div>
            <ul style={styles.heroCardList}>
              <li>
                <span style={styles.tagDot} />
                Transparence documentaire (Survey)
              </li>
              <li>
                <span style={styles.tagDot} />
                Démocratie liquide (Kudocracy)
              </li>
              <li>
                <span style={styles.tagDot} />
                Jumeau numérique et mémoire civique
              </li>
            </ul>
          </aside>
        </section>

        {/* Mission */}
        <section id="mission" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>Mission</div>
              <h2 style={styles.sectionTitle}>
                Mettre fin à l’opacité locale, une commune après l’autre
              </h2>
            </div>
            <p style={styles.sectionLead}>
              Les communes, associations et institutions reposent sur trois fragilités : opacité,
              capture du pouvoir et asymétrie d’information. Ophélia est conçue pour attaquer
              précisément ces trois points.
            </p>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <div style={styles.cardLabel}>1 · Transparence</div>
              <div style={styles.cardTitle}>Même information, même moment</div>
              <p style={styles.cardText}>
                Tous les documents publics sont ingérés, horodatés, classés et rendus consultables
                par thème, séance, budget, projet. Plus de PDF cachés au fond d’un intranet.
              </p>
            </div>
            <div style={styles.card}>
              <div style={styles.cardLabel}>2 · Lisibilité</div>
              <div style={styles.cardTitle}>L’IA comme traducteur civique</div>
              <p style={styles.cardText}>
                Ophélia résume, explique, compare les délibérations, budgets, appels d’offres. Elle
                produit une vue intelligible pour des citoyens qui n’ont pas de temps à perdre.
              </p>
            </div>
            <div style={styles.card}>
              <div style={styles.cardLabel}>3 · Pouvoir d’agir</div>
              <div style={styles.cardTitle}>Du constat à l’action</div>
              <p style={styles.cardText}>
                L’outil intègre consultation, débat structuré, mandats impératifs et suivi des
                engagements. Il ne s’agit pas de « commenter », mais de peser réellement sur les
                décisions.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>Fonctionnalités</div>
              <h2 style={styles.sectionTitle}>Une infrastructure, pas un gadget</h2>
            </div>
            <p style={styles.sectionLead}>
              Ophélia est pensée comme une brique durable : ingestion de données, moteur d’IA,
              interface citoyenne et API pour applications civiques tierces.
            </p>
          </div>

          <div style={styles.columns2}>
            <div style={styles.card}>
              <div style={styles.cardLabel}>Côté citoyens</div>
              <h3 style={styles.cardTitle}>Ce que voit et fait le public</h3>
              <ul style={styles.list}>
                <li>Recherche plein texte sur toutes les délibérations.</li>
                <li>Fiches simplifiées par projet, budget, chantier.</li>
                <li>Questions directes à l’IA sur les décisions locales.</li>
                <li>Consultations, sondages, votes consultatifs ou normatifs.</li>
                <li>Historique des engagements et des votes des élus.</li>
              </ul>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>Côté technique</div>
              <h3 style={styles.cardTitle}>Ce que l’admin contrôle</h3>
              <ul style={styles.list}>
                <li>Ingestion automatique de PDF, scans, sites, flux.</li>
                <li>Indexation vectorielle pour l’IA (RAG) et recherche.</li>
                <li>Connecteurs vers Supabase, Netlify, et autres backends.</li>
                <li>API pour intégrer d’autres apps civiques en surcouche.</li>
                <li>Déploiement auto-hébergeable, contrôlé localement.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>À propos</div>
              <h2 style={styles.sectionTitle}>Qui conçoit Ophélia, et pour quoi faire</h2>
            </div>
          </div>

          <div style={styles.columns2}>
            <div>
              <p style={styles.sectionLead}>
                Ophélia est conçue par Jean-Hugues Noël Robert, informaticien et entrepreneur
                expérimenté, aujourd’hui consacré à un écosystème civique mêlant démocratie directe,
                mémoire familiale et transmission de valeurs.
              </p>
              <p style={{ ...styles.sectionLead, marginTop: "12px" }}>
                L’objectif n’est pas de vendre un « produit SaaS de plus », mais de stabiliser une
                infrastructure civique réutilisable : communes, associations, coopératives,
                collectifs, tout ce qui ressemble à un peuple local qui veut se gouverner lui-même.
              </p>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>Écosystème</div>
              <h3 style={styles.cardTitle}>Les briques associées</h3>
              <ul style={styles.list}>
                <li>Kudocracy : démocratie liquide et mandats impératifs.</li>
                <li>Survey : transparence documentaire et audit citoyen.</li>
                <li>
                  Fondation Barons Mariani & Les Amis de Malou : ancrage patrimonial et lutte contre
                  le suicide.
                </li>
                <li>
                  Offhellia.com : déclinaison SaaS, multi-communautés, pour mutualiser l’effort.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <div>© {new Date().getFullYear()} Ophélia · Projet civique open source.</div>
          <div style={styles.footerLinks}>
            <a href={GITHUB_MAIN_REPO} style={styles.footerLink}>
              GitHub
            </a>

            <Link to="/cop-core" style={styles.footerLink}>
              dont COP v0.2
            </Link>

            <button
              type="button"
              style={{
                ...styles.footerLink,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() => handleScrollTo("about")}
            >
              À propos du fondateur
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
