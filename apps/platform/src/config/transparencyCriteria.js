// Configuration des critères de transparence par type de communauté

export const TRANSPARENCY_CRITERIA = {
  municipality: {
    title: "Transparence Municipale",
    description: "Évaluation de la transparence démocratique de votre commune",
    externalLink: "https://lepp.fr/transparence",
    criteria: [
      {
        id: "retransmission",
        label: "Retransmission des séances du conseil municipal",
        description: "Les séances sont-elles diffusées en direct ou enregistrées ?",
        weight: 20,
      },
      {
        id: "publication_rapide",
        label: "Publication rapide des comptes-rendus",
        description: "Les comptes-rendus sont-ils publiés dans la semaine suivant la séance ?",
        weight: 15,
      },
      {
        id: "open_data",
        label: "Open data des délibérations",
        description: "Les délibérations sont-elles disponibles en format ouvert ?",
        weight: 15,
      },
      {
        id: "calendrier_annuel",
        label: "Calendrier annuel des séances",
        description: "Le calendrier des séances est-il publié à l'avance ?",
        weight: 10,
      },
      {
        id: "parole_public",
        label: "Temps de parole pour le public",
        description: "Les citoyens peuvent-ils s'exprimer lors des séances ?",
        weight: 15,
      },
      {
        id: "budget_participatif",
        label: "Budget participatif",
        description: "Existe-t-il un mécanisme de budget participatif ?",
        weight: 10,
      },
      {
        id: "consultation_citoyenne",
        label: "Consultations citoyennes",
        description: "Des consultations citoyennes sont-elles organisées régulièrement ?",
        weight: 15,
      },
    ],
  },

  association: {
    title: "Transparence Associative",
    description: "Évaluation de la transparence démocratique de votre association",
    externalLink: "https://lepp.fr/association",
    criteria: [
      {
        id: "publication_ca",
        label: "Publication des comptes-rendus du CA",
        description: "Les comptes-rendus du conseil d'administration sont-ils publiés ?",
        weight: 20,
      },
      {
        id: "transparence_budget",
        label: "Transparence budgétaire",
        description: "Le budget et les comptes sont-ils accessibles aux adhérents ?",
        weight: 20,
      },
      {
        id: "charte_publique",
        label: "Charte et statuts publics",
        description: "La charte et les statuts sont-ils facilement accessibles ?",
        weight: 15,
      },
      {
        id: "election_bureau",
        label: "Processus d'élection transparent",
        description: "Le processus d'élection du bureau est-il clairement défini ?",
        weight: 15,
      },
      {
        id: "participation_membres",
        label: "Mécanismes de participation des membres",
        description: "Les membres peuvent-ils participer aux décisions importantes ?",
        weight: 15,
      },
      {
        id: "rapport_activite",
        label: "Rapport d'activité annuel",
        description: "Un rapport d'activité détaillé est-il publié chaque année ?",
        weight: 15,
      },
    ],
  },

  school: {
    title: "Transparence Scolaire",
    description: "Évaluation de la transparence démocratique de votre établissement",
    externalLink: "https://lepp.fr/education",
    criteria: [
      {
        id: "conseil_ecole",
        label: "Comptes-rendus des conseils d'école",
        description: "Les comptes-rendus sont-ils communiqués aux parents ?",
        weight: 20,
      },
      {
        id: "calendrier_reunions",
        label: "Calendrier des réunions",
        description: "Le calendrier des réunions est-il communiqué à l'avance ?",
        weight: 15,
      },
      {
        id: "participation_parents",
        label: "Participation des parents",
        description: "Les parents peuvent-ils participer aux décisions ?",
        weight: 20,
      },
      {
        id: "participation_eleves",
        label: "Participation des élèves",
        description: "Les élèves ont-ils des représentants dans les instances ?",
        weight: 15,
      },
      {
        id: "politique_harcelement",
        label: "Politique anti-harcèlement",
        description: "Une politique claire contre le harcèlement est-elle en place ?",
        weight: 15,
      },
      {
        id: "communication_projets",
        label: "Communication sur les projets",
        description: "Les projets pédagogiques sont-ils communiqués ?",
        weight: 15,
      },
    ],
  },

  company: {
    title: "Transparence d'Entreprise",
    description: "Évaluation de la transparence démocratique de votre entreprise",
    externalLink: "https://lepp.fr/entreprise",
    criteria: [
      {
        id: "decisions_board",
        label: "Transparence des décisions du comité de direction",
        description: "Les décisions importantes sont-elles communiquées ?",
        weight: 20,
      },
      {
        id: "politique_ethique",
        label: "Politique d'éthique",
        description: "Une politique d'éthique claire est-elle en place ?",
        weight: 15,
      },
      {
        id: "diversite_inclusion",
        label: "Diversité et inclusion",
        description: "Des mesures de diversité et inclusion sont-elles mises en place ?",
        weight: 15,
      },
      {
        id: "remontee_collaborateurs",
        label: "Mécanismes de remontée des collaborateurs",
        description: "Les collaborateurs peuvent-ils faire remonter leurs préoccupations ?",
        weight: 20,
      },
      {
        id: "roadmap_publique",
        label: "Roadmap produit publique",
        description: "La roadmap produit est-elle partagée avec les équipes ?",
        weight: 15,
      },
      {
        id: "formation_continue",
        label: "Politique de formation continue",
        description: "Une politique de formation continue est-elle en place ?",
        weight: 15,
      },
    ],
  },

  cooperative: {
    title: "Transparence Coopérative",
    description: "Évaluation de la transparence démocratique de votre coopérative",
    externalLink: "https://lepp.fr/cooperative",
    criteria: [
      {
        id: "ag_regulieres",
        label: "Assemblées générales régulières",
        description: "Les AG sont-elles organisées régulièrement ?",
        weight: 20,
      },
      {
        id: "vote_democratique",
        label: "Processus de vote démocratique",
        description: "Chaque coopérateur a-t-il une voix égale ?",
        weight: 20,
      },
      {
        id: "transparence_financiere",
        label: "Transparence financière",
        description: "Les comptes sont-ils présentés clairement aux coopérateurs ?",
        weight: 20,
      },
      {
        id: "participation_decisions",
        label: "Participation aux décisions stratégiques",
        description: "Les coopérateurs participent-ils aux décisions importantes ?",
        weight: 20,
      },
      {
        id: "formation_cooperateurs",
        label: "Formation des coopérateurs",
        description: "Des formations sur la coopération sont-elles proposées ?",
        weight: 10,
      },
      {
        id: "rapport_social",
        label: "Rapport social annuel",
        description: "Un rapport social détaillé est-il publié ?",
        weight: 10,
      },
    ],
  },

  online_community: {
    title: "Transparence Communautaire",
    description: "Évaluation de la transparence démocratique de votre communauté en ligne",
    externalLink: "https://lepp.fr/communaute",
    criteria: [
      {
        id: "regles_claires",
        label: "Règles de la communauté claires",
        description: "Les règles sont-elles clairement définies et accessibles ?",
        weight: 20,
      },
      {
        id: "moderation_transparente",
        label: "Modération transparente",
        description: "Les décisions de modération sont-elles expliquées ?",
        weight: 20,
      },
      {
        id: "election_moderateurs",
        label: "Élection des modérateurs",
        description: "Les modérateurs sont-ils élus par la communauté ?",
        weight: 15,
      },
      {
        id: "feedback_membres",
        label: "Mécanismes de feedback des membres",
        description: "Les membres peuvent-ils donner leur avis sur la gouvernance ?",
        weight: 15,
      },
      {
        id: "decisions_collectives",
        label: "Processus de décision collective",
        description: "Les décisions importantes impliquent-elles la communauté ?",
        weight: 15,
      },
      {
        id: "rapport_activite_communaute",
        label: "Rapport d'activité de la communauté",
        description: "Un bilan régulier de l'activité est-il partagé ?",
        weight: 15,
      },
    ],
  },
};

// Fonction pour obtenir les critères de la communauté actuelle
export const getCommunityTransparencyCriteria = (communityType) => {
  return TRANSPARENCY_CRITERIA[communityType] || TRANSPARENCY_CRITERIA.municipality;
};

// Fonction pour calculer le score de transparence
export const calculateTransparencyScore = (responses, communityType) => {
  const criteria = getCommunityTransparencyCriteria(communityType);
  let totalWeight = 0;
  let weightedScore = 0;

  criteria.criteria.forEach((criterion) => {
    const response = responses[criterion.id];
    if (response !== undefined) {
      totalWeight += criterion.weight;
      weightedScore += response ? criterion.weight : 0;
    }
  });

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
};
