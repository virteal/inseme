import React, { useState } from "react";
import { Link } from "react-router-dom";
import SiteFooter from "../components/layout/SiteFooter";
import { getSupabase } from "../lib/supabase";
import { BOT_NAME } from "../constants";

// Catégories de communautés (niches)
const COMMUNITY_CATEGORIES = [
  {
    id: "municipalities",
    emoji: "🏛️",
    title: "Communes & Collectivités",
    subtitle: "36 000 communes en France",
    niches: [
      { id: "municipality", label: "Commune", icon: "🏘️", market: "36 000" },
      { id: "intercommunality", label: "Intercommunalité (EPCI)", icon: "🗺️", market: "1 250" },
      { id: "department", label: "Département", icon: "📍", market: "101" },
      { id: "region", label: "Région", icon: "🌍", market: "18" },
    ],
  },
  {
    id: "associations",
    emoji: "🤝",
    title: "Associations & ONG",
    subtitle: "1,5 million d'associations actives",
    niches: [
      { id: "association", label: "Association loi 1901", icon: "🏛️", market: "1 500 000" },
      { id: "foundation", label: "Fondation", icon: "🎗️", market: "5 000" },
      { id: "ong", label: "ONG / Humanitaire", icon: "🌍", market: "1 500" },
      { id: "political_party", label: "Parti politique", icon: "🗳️", market: "500" },
    ],
  },
  {
    id: "education",
    emoji: "🎓",
    title: "Éducation & Recherche",
    subtitle: "Écoles, universités, labos",
    niches: [
      { id: "school", label: "École / Collège / Lycée", icon: "🏫", market: "60 000" },
      { id: "university", label: "Université / Grande école", icon: "🎓", market: "400" },
      { id: "student_union", label: "Syndicat étudiant / BDE", icon: "📚", market: "3 000" },
      { id: "research_lab", label: "Laboratoire de recherche", icon: "🔬", market: "1 200" },
    ],
  },
  {
    id: "companies",
    emoji: "🏢",
    title: "Entreprises & Coopératives",
    subtitle: "CSE, gouvernance participative",
    niches: [
      { id: "cse", label: "CSE / Comité d'entreprise", icon: "👥", market: "45 000" },
      { id: "cooperative", label: "Coopérative / SCOP / SCIC", icon: "🤲", market: "3 500" },
      { id: "startup", label: "Startup / Scale-up", icon: "🚀", market: "25 000" },
      { id: "esn", label: "ESS / Entreprise à mission", icon: "💚", market: "10 000" },
    ],
  },
  {
    id: "neighborhoods",
    emoji: "🏠",
    title: "Habitat & Quartiers",
    subtitle: "Copropriétés, conseils de quartier",
    niches: [
      { id: "copropriete", label: "Copropriété / Syndic", icon: "🏢", market: "740 000" },
      { id: "neighborhood", label: "Conseil de quartier", icon: "🏘️", market: "2 000" },
      { id: "hlm", label: "Bailleur social / HLM", icon: "🏗️", market: "700" },
      { id: "ecovillage", label: "Écovillage / Habitat participatif", icon: "🌱", market: "500" },
    ],
  },
  {
    id: "professional",
    emoji: "⚖️",
    title: "Ordres & Syndicats",
    subtitle: "Professions réglementées",
    niches: [
      { id: "ordre", label: "Ordre professionnel", icon: "⚖️", market: "30" },
      { id: "syndicat", label: "Syndicat professionnel", icon: "✊", market: "500" },
      { id: "federation", label: "Fédération sportive", icon: "⚽", market: "115" },
      { id: "chambre", label: "Chambre consulaire (CCI, CMA)", icon: "🏛️", market: "200" },
    ],
  },
  {
    id: "health",
    emoji: "🏥",
    title: "Santé & Social",
    subtitle: "Établissements, mutuelles",
    niches: [
      { id: "hospital", label: "Hôpital / Clinique", icon: "🏥", market: "3 000" },
      { id: "mutuelle", label: "Mutuelle / Assurance", icon: "🛡️", market: "500" },
      { id: "ehpad", label: "EHPAD / Maison de retraite", icon: "👴", market: "7 500" },
      { id: "cpts", label: "CPTS / Maison de santé", icon: "🩺", market: "2 000" },
    ],
  },
  {
    id: "online",
    emoji: "🌐",
    title: "Communautés en ligne",
    subtitle: "Discord, forums, DAO",
    niches: [
      { id: "discord", label: "Serveur Discord", icon: "💬", market: "∞" },
      { id: "forum", label: "Forum / Communauté web", icon: "🌐", market: "∞" },
      { id: "dao", label: "DAO / Organisation décentralisée", icon: "🔗", market: "10 000" },
      { id: "opensource", label: "Projet open source", icon: "💻", market: "∞" },
    ],
  },
];

// Types de leads (simplifiés)
const LEAD_TYPES = [
  {
    id: "liste_electorale",
    emoji: "🗳️",
    title: "Liste électorale",
    subtitle: "Municipales 2026",
    description: "Démontrez votre engagement concret pour la transparence avant même d'être élu",
    cta: "Engager ma liste",
    color: "blue",
    category: "municipalities",
  },
  {
    id: "maire_elu",
    emoji: "🏛️",
    title: "Maire / Élu(e)",
    subtitle: "Déjà en fonction",
    description: "Passez à l'action et ouvrez les données de votre commune aux citoyens",
    cta: "Déployer pour ma commune",
    color: "green",
    category: "municipalities",
  },
  {
    id: "association_leader",
    emoji: "🤝",
    title: "Dirigeant d'association",
    subtitle: "Président, trésorier...",
    description: "Offrez à vos adhérents une gouvernance exemplaire et transparente",
    cta: "Essayer pour mon asso",
    color: "purple",
    category: "associations",
  },
  {
    id: "cse_member",
    emoji: "👥",
    title: "Élu CSE / RH",
    subtitle: "Entreprise",
    description: "Facilitez le dialogue social avec une plateforme transparente",
    cta: "Découvrir pour mon CSE",
    color: "teal",
    category: "companies",
  },
  {
    id: "syndic_copro",
    emoji: "🏢",
    title: "Syndic / Copropriétaire",
    subtitle: "Copropriété",
    description: "Simplifiez les AG et rendez les comptes accessibles à tous",
    cta: "Moderniser ma copro",
    color: "amber",
    category: "neighborhoods",
  },
  {
    id: "university_member",
    emoji: "🎓",
    title: "Université / Étudiant",
    subtitle: "CA, CVU, BDE, syndicat",
    description: "Gouvernance universitaire transparente : conseils, budgets, élections étudiantes",
    cta: "Essayer pour mon campus",
    color: "cyan",
    category: "education",
  },
  {
    id: "collectif_citoyen",
    emoji: "✊",
    title: "Collectif citoyen",
    subtitle: "Association, comité",
    description: "Portez la transparence dans votre organisation, quel qu'elle soit",
    cta: "Lancer l'initiative",
    color: "rose",
    category: "all",
  },
  {
    id: "community_leader",
    emoji: "🌐",
    title: "Leader de communauté",
    subtitle: "Discord, forum, DAO...",
    description: "Gouvernance transparente pour votre communauté en ligne",
    cta: "Essayer Ophélia",
    color: "indigo",
    category: "online",
  },
  {
    id: "citoyen_engage",
    emoji: "🙋",
    title: "Curieux / Explorateur",
    subtitle: "Individuel",
    description: "Vous voulez voir ce qu'Ophélia peut faire ? Explorez !",
    cta: "Je découvre",
    color: "orange",
    category: "all",
  },
];

// Niveaux de maturité
const MATURITY_LEVELS = [
  {
    level: 1,
    name: "Intéressé",
    description: "Je veux en savoir plus",
    icon: "🌱",
    actions: ["Recevoir la documentation", "Être recontacté"],
  },
  {
    level: 2,
    name: "Convaincu",
    description: "Je veux m'engager publiquement",
    icon: "🌿",
    actions: ["Signer la charte transparence", "Afficher le badge sur ma com"],
  },
  {
    level: 3,
    name: "Actif",
    description: "Je déploie une instance",
    icon: "🌳",
    actions: ["Créer mon instance", "Former mon équipe"],
  },
  {
    level: 4,
    name: "Exemplaire",
    description: "Je publie des données concrètes",
    icon: "🏆",
    actions: ["Publier les données", "Répondre aux citoyens"],
  },
];

// Engagements de la charte
const CHARTER_COMMITMENTS = [
  "Publier sur Internet l'ordre du jour des conseils municipaux 7 jours avant",
  "Diffuser sur Internet les délibérations sous 48h après le conseil",
  "Rendre accessible le budget communal de manière lisible",
  "Répondre aux questions citoyennes sous 15 jours",
  "Publier les déclarations d'intérêts des élus",
  "Ouvrir les données des marchés publics",
  "Permettre le signalement citoyen d'anomalies",
  "Organiser au moins 2 consultations citoyennes par an",
];

export default function TransparenceLanding() {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedMaturity, setSelectedMaturity] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    maturity: 1,
    name: "",
    email: "",
    phone: "",
    commune: "",
    communeInsee: "",
    organization: "",
    message: "",
    acceptCharter: false,
    acceptContact: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Enregistrer le lead
      const { error } = await getSupabase()
        .from("transparency_leads")
        .insert({
          lead_type: formData.type || selectedType,
          maturity_level: formData.maturity || selectedMaturity,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          commune_name: formData.commune,
          commune_insee: formData.communeInsee || null,
          organization_name: formData.organization || null,
          message: formData.message || null,
          accepted_charter: formData.acceptCharter,
          accepted_contact: formData.acceptContact,
          source: "landing_page",
          metadata: {
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
          },
        });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("Erreur:", err);
      alert("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <ThankYouPage formData={formData} selectedType={selectedType} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section - Ophélia */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800"></div>
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center text-white">
            {/* Logo Ophélia */}
            <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur px-5 py-3 rounded-full mb-6">
              <span className="text-3xl">🔮</span>
              <span className="text-xl font-bold">{BOT_NAME || "Ophélia"}</span>
              <span className="px-2 py-0.5 bg-emerald-400 text-emerald-900 text-xs font-bold rounded-full">
                100% Gratuit
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              La Transparence
              <br />
              <span className="text-yellow-300">pour toutes les communautés.</span>
            </h1>

            <p className="text-xl md:text-2xl text-indigo-100 max-w-3xl mx-auto mb-4">
              Communes, associations, copropriétés, entreprises, communautés en ligne...
            </p>
            <p className="text-lg text-indigo-200 max-w-2xl mx-auto mb-8">
              <strong className="text-white">{BOT_NAME}</strong> est une plateforme open source de
              transparence adaptée à toutes les formes de gouvernance collective.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#niches"
                className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition shadow-lg"
              >
                🔍 Trouver mon cas d'usage
              </a>
              <a
                href="#engagement"
                className="px-8 py-4 bg-white/10 backdrop-blur text-white font-medium rounded-lg hover:bg-white/20 transition border border-white/30"
              >
                Je m'engage →
              </a>
            </div>

            {/* Badge Municipales */}
            <div className="mt-8 inline-flex items-center gap-2 text-sm text-indigo-200">
              <span className="animate-pulse">🔴</span>
              <span>
                Municipales 2026 : <strong className="text-white">engagez-vous maintenant</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </header>

      {/* Niches / Catégories Section */}
      <section className="py-16 -mt-8 relative z-10" id="niches">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Ophélia s'adapte à votre organisation</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Chaque communauté a ses propres règles de gouvernance. Ophélia parle votre langage.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {COMMUNITY_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition"
              >
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{cat.emoji}</span>
                    <div>
                      <h3 className="font-bold">{cat.title}</h3>
                      <p className="text-xs text-gray-500">{cat.subtitle}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {cat.niches.map((niche) => (
                      <li key={niche.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{niche.icon}</span>
                          <span>{niche.label}</span>
                        </span>
                        <span className="text-xs text-gray-400">{niche.market}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">
              Votre type d'organisation n'est pas listé ?{" "}
              <a href="#formulaire" className="text-indigo-600 underline">
                Contactez-nous
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600">2M+</div>
              <div className="text-gray-500">Organisations potentielles</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600">100%</div>
              <div className="text-gray-500">Gratuit & Open Source</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600">10+</div>
              <div className="text-gray-500">Types de gouvernance</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-600">24h</div>
              <div className="text-gray-500">Pour déployer</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-gray-50" id="probleme">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Le problème de la transparence municipale</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              En France, l'accès aux informations communales reste difficile pour les citoyens
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
              <div className="text-3xl mb-4">📄</div>
              <h3 className="font-bold text-lg mb-2">Délibérations inaccessibles</h3>
              <p className="text-gray-600">
                Les comptes-rendus de conseil municipal sont souvent publiés en PDF illisibles, des
                semaines après les décisions.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
              <div className="text-3xl mb-4">💰</div>
              <h3 className="font-bold text-lg mb-2">Budgets opaques</h3>
              <p className="text-gray-600">
                Les budgets communaux sont présentés dans un jargon comptable incompréhensible pour
                le citoyen moyen.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
              <div className="text-3xl mb-4">🏗️</div>
              <h3 className="font-bold text-lg mb-2">Urbanisme invisible</h3>
              <p className="text-gray-600">
                Les permis de construire, modifications du PLU et projets d'aménagement sont
                découverts trop tard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section - Ophélia Features */}
      <section className="py-16" id="comment">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-indigo-600 font-medium mb-4">
              <span className="text-2xl">🔮</span>
              <span>Propulsé par {BOT_NAME}</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Une IA au service de la transparence</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {BOT_NAME} comprend votre organisation et répond aux questions de vos membres 24/7.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🗺️</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Données géographiques (Communes)</h3>
                    <p className="text-gray-600">
                      PLU, permis de construire, risques naturels, transactions immobilières.
                      Intégration Géoportail native.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Chatbot intelligent ({BOT_NAME})</h3>
                    <p className="text-gray-600">
                      Vos membres posent leurs questions en langage naturel.
                      {BOT_NAME} répond avec les sources officielles.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Score de transparence</h3>
                    <p className="text-gray-600">
                      Métrique automatique et comparable. Montrez vos progrès, identifiez les axes
                      d'amélioration.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔔</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Alertes & Notifications</h3>
                    <p className="text-gray-600">
                      Vos membres sont informés des nouvelles décisions. Signalements et suivi des
                      résolutions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-100">
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold">Score de Transparence</h3>
                <p className="text-gray-600">Exemple pour une commune</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Délibérations publiées</span>
                    <span className="font-bold text-emerald-600">95%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "95%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Questions répondues</span>
                    <span className="font-bold text-emerald-600">88%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "88%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Budget lisible</span>
                    <span className="font-bold text-yellow-600">72%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-yellow-500 rounded-full" style={{ width: "72%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Données ouvertes</span>
                    <span className="font-bold text-emerald-600">100%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-emerald-500 rounded-full"
                      style={{ width: "100%" }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-4xl font-bold text-indigo-600">89/100</div>
                <div className="text-gray-500">Score global</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Types d'engagement Section */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white" id="engagement">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Qui peut utiliser {BOT_NAME} ?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              La transparence n'attend pas. Choisissez votre profil et lancez-vous.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {LEAD_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedType(type.id);
                  setFormData((f) => ({ ...f, type: type.id }));
                  setShowForm(true);
                  document.getElementById("formulaire")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-lg ${
                  selectedType === type.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-3xl mb-3">{type.emoji}</div>
                <h3 className="font-bold text-base">{type.title}</h3>
                <div className="text-xs text-gray-500 mb-2">{type.subtitle}</div>
                <p className="text-gray-600 text-sm mb-3">{type.description}</p>
                <span className="inline-block px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">
                  {type.cta}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Niveaux de maturité */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Votre parcours vers la transparence</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Avancez à votre rythme, chaque étape compte
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {MATURITY_LEVELS.map((level, idx) => (
              <div
                key={level.level}
                className={`relative p-6 rounded-xl border-2 ${
                  selectedMaturity === level.level
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {idx < MATURITY_LEVELS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gray-300"></div>
                )}
                <div className="text-4xl mb-4">{level.icon}</div>
                <div className="text-sm text-gray-500">Niveau {level.level}</div>
                <h3 className="font-bold text-lg">{level.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{level.description}</p>
                <ul className="text-sm space-y-1">
                  {level.actions.map((action, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charte de transparence */}
      <section className="py-16 bg-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">🏅 La Charte {BOT_NAME}</h2>
            <p className="text-xl text-indigo-200">
              8 principes universels de transparence, adaptés à votre type d'organisation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {CHARTER_COMMITMENTS.map((commitment, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white/10 rounded-lg p-4">
                <span className="text-yellow-400 text-xl">✓</span>
                <span>{commitment}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => {
                setShowForm(true);
                setFormData((f) => ({ ...f, acceptCharter: true }));
                document.getElementById("formulaire")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition"
            >
              Signer la charte →
            </button>
          </div>
        </div>
      </section>

      {/* Formulaire */}
      <section className="py-16" id="formulaire">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              {showForm ? "Votre engagement" : "Passez à l'action"}
            </h2>
            <p className="text-gray-600">
              Remplissez ce formulaire pour démarrer votre démarche transparence
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            {/* Type de structure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vous êtes *</label>
              <div className="grid grid-cols-2 gap-3">
                {LEAD_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, type: type.id }))}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      formData.type === type.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xl mr-2">{type.emoji}</span>
                    <span className="font-medium">{type.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Niveau de maturité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Votre niveau d'engagement *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MATURITY_LEVELS.map((level) => (
                  <button
                    key={level.level}
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, maturity: level.level }))}
                    className={`p-3 rounded-lg border-2 text-center transition ${
                      formData.maturity === level.level
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-2xl">{level.icon}</div>
                    <div className="text-sm font-medium">{level.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Informations personnelles */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="jean@exemple.fr"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commune *</label>
                <input
                  type="text"
                  required
                  value={formData.commune}
                  onChange={(e) => setFormData((f) => ({ ...f, commune: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Corte"
                />
              </div>
            </div>

            {(formData.type === "liste_electorale" || formData.type === "collectif_citoyen") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la liste / organisation
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData((f) => ({ ...f, organization: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Liste Corte Transparente"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message (optionnel)
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData((f) => ({ ...f, message: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Décrivez votre projet, vos motivations..."
              />
            </div>

            {/* Engagements */}
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptCharter}
                  onChange={(e) => setFormData((f) => ({ ...f, acceptCharter: e.target.checked }))}
                  className="mt-1"
                />
                <span className="text-sm">
                  <strong>Je m'engage à respecter la Charte Transparence</strong>
                  <br />
                  <span className="text-gray-500">
                    8 engagements concrets pour une gestion municipale ouverte
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptContact}
                  onChange={(e) => setFormData((f) => ({ ...f, acceptContact: e.target.checked }))}
                  className="mt-1"
                />
                <span className="text-sm">
                  J'accepte d'être recontacté pour accompagner ma démarche
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !formData.type ||
                !formData.name ||
                !formData.email ||
                !formData.commune
              }
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Envoi en cours..." : "🚀 Je m'engage pour la transparence"}
            </button>

            <p className="text-xs text-center text-gray-500">
              Vos données sont traitées par l'association C.O.R.S.I.C.A. conformément au RGPD.
              <br />
              <Link to="/legal/privacy" className="underline">
                Politique de confidentialité
              </Link>
            </p>
          </form>
        </div>
      </section>

      {/* Niches prometteuses - Highlight */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">🎯 Cas d'usage à fort potentiel</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Certaines niches sont particulièrement adaptées à {BOT_NAME}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Université de Corse - Cas pilote */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-cyan-500 ring-2 ring-cyan-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎓</div>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-full">
                  PILOTE
                </span>
              </div>
              <h3 className="font-bold text-xl mb-2">Universités</h3>
              <p className="text-gray-600 mb-4">
                <strong>Université de Corse</strong> à Corte : 5 000 étudiants, conseils, budgets,
                vie étudiante. Premier campus pilote {BOT_NAME} !
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ Délibérations du CA accessibles</li>
                <li>✓ Budget universitaire lisible</li>
                <li>✓ Élections étudiantes transparentes</li>
                <li>✓ Vie associative campus</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="font-bold text-xl mb-2">Copropriétés</h3>
              <p className="text-gray-600 mb-4">
                <strong>740 000 copros</strong> en France. Les AG sont conflictuelles ? Ophélia rend
                les comptes accessibles.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ PV d'AG automatiques</li>
                <li>✓ Suivi travaux et dépenses</li>
                <li>✓ Q&A avec le syndic</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-emerald-500">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-bold text-xl mb-2">CSE</h3>
              <p className="text-gray-600 mb-4">
                <strong>45 000 CSE</strong> en France. Budget social transparent, confiance
                retrouvée.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ Budget ASC transparent</li>
                <li>✓ Procès-verbaux</li>
                <li>✓ Consultations salariés</li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="font-bold text-xl mb-2">Associations</h3>
              <p className="text-gray-600 mb-4">
                <strong>1,5 million</strong> d'assos. Cotisations, subventions : où va l'argent ?
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ Comptes lisibles</li>
                <li>✓ Votes en ligne</li>
                <li>✓ Engagement membres</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <a
              href="#formulaire"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              Demander une démo pour mon organisation →
            </a>
          </div>
        </div>
      </section>

      {/* Multi-instances par commune */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Plusieurs listes, plusieurs instances</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pendant les campagnes électorales, chaque liste peut déployer sa propre instance. Les
              citoyens comparent les engagements <strong>concrets</strong>.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 bg-gray-50 border-b">
              <h3 className="font-bold text-lg">🗳️ Exemple : Municipales à Corte (2026)</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">A</span>
                    </div>
                    <div>
                      <div className="font-bold">Liste A - Corte Avenir</div>
                      <div className="text-sm text-gray-500">transparence-corte-a.fr</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Délibérations publiées</span>
                      <span className="font-bold text-green-600">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Questions répondues</span>
                      <span className="font-bold text-green-600">45</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Score transparence</span>
                      <span className="font-bold text-green-600">87/100</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-bold">B</span>
                    </div>
                    <div>
                      <div className="font-bold">Liste B - Renouveau</div>
                      <div className="text-sm text-gray-500">transparence-corte-b.fr</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Délibérations publiées</span>
                      <span className="font-bold text-yellow-600">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Questions répondues</span>
                      <span className="font-bold text-yellow-600">18</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Score transparence</span>
                      <span className="font-bold text-yellow-600">62/100</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-4 border-dashed border-gray-300 bg-gray-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-400 font-bold">?</span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-400">Liste C</div>
                      <div className="text-sm text-gray-400">Pas encore engagée</div>
                    </div>
                  </div>
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-3">
                      Cette liste n'a pas encore déployé d'instance transparence
                    </p>
                    <span className="text-gray-400 text-xs">Promesses sans preuves ?</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Le principe :</strong> Les électeurs peuvent comparer les listes non
                  pas sur leurs promesses, mais sur leurs{" "}
                  <strong>actes concrets de transparence</strong> pendant la campagne. Une liste qui
                  ne joue pas le jeu de la transparence avant l'élection le fera-t-elle après ?
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>

          <div className="space-y-4">
            <details className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer">
              <summary className="font-bold">C'est vraiment gratuit ?</summary>
              <p className="mt-3 text-gray-600">
                Oui, 100% gratuit. Le projet est porté par l'association C.O.R.S.I.C.A. et financé
                uniquement par des dons. Le code est open source (MIT), vous pouvez l'auditer.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer">
              <summary className="font-bold">Combien de temps pour déployer une instance ?</summary>
              <p className="mt-3 text-gray-600">
                Entre 24h et 48h pour une instance de base. Nous vous accompagnons dans la
                configuration et la formation de votre équipe.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer">
              <summary className="font-bold">Qui gère les données ?</summary>
              <p className="mt-3 text-gray-600">
                Vous restez maître de vos données. Chaque instance est indépendante, hébergée en
                France (UE). Vous pouvez exporter toutes vos données à tout moment.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer">
              <summary className="font-bold">
                Plusieurs listes peuvent avoir une instance sur la même commune ?
              </summary>
              <p className="mt-3 text-gray-600">
                Oui ! Pendant les campagnes électorales, chaque liste peut déployer sa propre
                instance pour démontrer son engagement. Après l'élection, la liste élue peut
                conserver son instance comme plateforme officielle de la mairie.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer">
              <summary className="font-bold">
                Je suis un simple citoyen, je peux quand même agir ?
              </summary>
              <p className="mt-3 text-gray-600">
                Absolument ! Vous pouvez déployer une instance citoyenne pour votre commune, même
                sans mandat électif. Vous contribuez à la transparence locale et montrez l'exemple
                aux élus.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-6">🔮</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Prêt à adopter {BOT_NAME} ?</h2>
          <p className="text-xl text-indigo-100 mb-8">
            Rejoignez le mouvement pour une gouvernance transparente et participative.
            <br />
            <strong className="text-white">Gratuit. Open Source. Pour tous.</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#formulaire"
              className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition"
            >
              🚀 Demander une démo
            </a>
            <a
              href="https://www.helloasso.com/associations/corsica"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white/10 backdrop-blur text-white font-medium rounded-lg hover:bg-white/20 transition border border-white/30"
            >
              💚 Soutenir par un don
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

// Page de remerciement après soumission
function ThankYouPage({ formData, selectedType }) {
  const typeInfo = LEAD_TYPES.find((t) => t.id === formData.type) || LEAD_TYPES[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-4">Merci pour votre engagement !</h1>
        <p className="text-xl text-gray-600 mb-8">
          Votre demande a bien été enregistrée. Nous vous recontacterons sous 48h.
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-left mb-8">
          <h2 className="font-bold text-lg mb-4">Récapitulatif</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">
                {typeInfo.emoji} {typeInfo.title}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Niveau</span>
              <span className="font-medium">
                {MATURITY_LEVELS[formData.maturity - 1]?.icon}{" "}
                {MATURITY_LEVELS[formData.maturity - 1]?.name}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Commune</span>
              <span className="font-medium">{formData.commune}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{formData.email}</span>
            </div>
            {formData.acceptCharter && (
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Charte</span>
                <span className="font-medium text-green-600">✓ Signée</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">En attendant, vous pouvez :</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://github.com/JeanHuguesRobert/survey"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              ⭐ Voir le code source
            </a>
            <a
              href="https://www.helloasso.com/associations/corsica"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              💚 Faire un don
            </a>
            <Link to="/" className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
