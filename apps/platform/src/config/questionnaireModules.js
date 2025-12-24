// Configuration des modules de questionnaire par type de communauté

export const QUESTIONNAIRE_MODULES = {
  municipality: {
    title: "Démocratie municipale",
    modules: [
      {
        id: "local_issues",
        title: "Enjeux locaux",
        questions: [
          {
            id: "connaissanceEnjeuxLocaux",
            label: "Connaissez-vous les principaux enjeux de votre commune ?",
            type: "radio",
            options: ["Très bien", "Assez bien", "Peu", "Pas du tout"],
          },
          {
            id: "participationConseil",
            label: "Avez-vous déjà assisté à une séance du conseil municipal ?",
            type: "radio",
            options: ["Oui, régulièrement", "Oui, occasionnellement", "Une fois", "Jamais"],
          },
        ],
      },
      {
        id: "transparency",
        title: "Transparence municipale",
        questions: [
          {
            id: "satisfactionTransparence",
            label: "Comment évaluez-vous la transparence de votre mairie ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"],
          },
        ],
      },
      {
        id: "democracy_satisfaction",
        title: "Satisfaction démocratique",
        questions: [
          {
            id: "satisfactionDemocratie",
            label:
              "Sur une échelle de 1 à 5, comment évaluez-vous le fonctionnement démocratique de votre commune ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
          },
        ],
      },
    ],
  },

  association: {
    title: "Démocratie associative",
    modules: [
      {
        id: "governance",
        title: "Gouvernance associative",
        questions: [
          {
            id: "connaissanceStatuts",
            label: "Connaissez-vous les statuts de votre association ?",
            type: "radio",
            options: ["Très bien", "Assez bien", "Peu", "Pas du tout"],
          },
          {
            id: "participationAG",
            label: "Participez-vous aux assemblées générales ?",
            type: "radio",
            options: ["Toujours", "Souvent", "Parfois", "Jamais"],
          },
        ],
      },
      {
        id: "transparency",
        title: "Transparence associative",
        questions: [
          {
            id: "satisfactionTransparence",
            label: "Comment évaluez-vous la transparence de votre association ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"],
          },
        ],
      },
      {
        id: "democracy_satisfaction",
        title: "Satisfaction démocratique",
        questions: [
          {
            id: "satisfactionDemocratie",
            label:
              "Sur une échelle de 1 à 5, comment évaluez-vous le fonctionnement démocratique de votre association ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
          },
        ],
      },
    ],
  },

  school: {
    title: "Démocratie scolaire",
    modules: [
      {
        id: "participation",
        title: "Participation éducative",
        questions: [
          {
            id: "connaissanceProjetEcole",
            label: "Connaissez-vous le projet d'établissement ?",
            type: "radio",
            options: ["Très bien", "Assez bien", "Peu", "Pas du tout"],
          },
          {
            id: "participationConseil",
            label: "Participez-vous aux conseils d'école/établissement ?",
            type: "radio",
            options: ["Toujours", "Souvent", "Parfois", "Jamais"],
          },
        ],
      },
      {
        id: "transparency",
        title: "Transparence scolaire",
        questions: [
          {
            id: "satisfactionTransparence",
            label: "Comment évaluez-vous la transparence de votre établissement ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"],
          },
        ],
      },
      {
        id: "democracy_satisfaction",
        title: "Satisfaction démocratique",
        questions: [
          {
            id: "satisfactionDemocratie",
            label:
              "Sur une échelle de 1 à 5, comment évaluez-vous le fonctionnement démocratique de votre établissement ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
          },
        ],
      },
    ],
  },

  company: {
    title: "Démocratie d'entreprise",
    modules: [
      {
        id: "workplace_democracy",
        title: "Démocratie au travail",
        questions: [
          {
            id: "connaissanceValeurs",
            label: "Connaissez-vous les valeurs et la mission de votre entreprise ?",
            type: "radio",
            options: ["Très bien", "Assez bien", "Peu", "Pas du tout"],
          },
          {
            id: "participationDecisions",
            label: "Êtes-vous consulté sur les décisions qui vous concernent ?",
            type: "radio",
            options: ["Toujours", "Souvent", "Parfois", "Jamais"],
          },
        ],
      },
      {
        id: "transparency",
        title: "Transparence d'entreprise",
        questions: [
          {
            id: "satisfactionTransparence",
            label: "Comment évaluez-vous la transparence de votre entreprise ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"],
          },
        ],
      },
      {
        id: "democracy_satisfaction",
        title: "Satisfaction démocratique",
        questions: [
          {
            id: "satisfactionDemocratie",
            label:
              "Sur une échelle de 1 à 5, comment évaluez-vous le fonctionnement démocratique de votre entreprise ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
          },
        ],
      },
    ],
  },

  online_community: {
    title: "Démocratie communautaire",
    modules: [
      {
        id: "community_governance",
        title: "Gouvernance communautaire",
        questions: [
          {
            id: "connaissanceRegles",
            label: "Connaissez-vous les règles de votre communauté ?",
            type: "radio",
            options: ["Très bien", "Assez bien", "Peu", "Pas du tout"],
          },
          {
            id: "participationDecisions",
            label: "Participez-vous aux décisions communautaires ?",
            type: "radio",
            options: ["Toujours", "Souvent", "Parfois", "Jamais"],
          },
        ],
      },
      {
        id: "transparency",
        title: "Transparence communautaire",
        questions: [
          {
            id: "satisfactionTransparence",
            label: "Comment évaluez-vous la transparence de votre communauté ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"],
          },
        ],
      },
      {
        id: "democracy_satisfaction",
        title: "Satisfaction démocratique",
        questions: [
          {
            id: "satisfactionDemocratie",
            label:
              "Sur une échelle de 1 à 5, comment évaluez-vous le fonctionnement démocratique de votre communauté ?",
            type: "scale",
            min: 1,
            max: 5,
            labels: ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
          },
        ],
      },
    ],
  },
};

// Fonction pour obtenir les modules de questionnaire de la communauté actuelle
export const getCommunityQuestionnaireModules = (communityType) => {
  return QUESTIONNAIRE_MODULES[communityType] || QUESTIONNAIRE_MODULES.municipality;
};

// Fonction pour générer l'état initial du formulaire basé sur les modules
export const generateInitialFormState = (communityType) => {
  const modules = getCommunityQuestionnaireModules(communityType);
  const initialState = {};

  modules.modules.forEach((module) => {
    module.questions.forEach((question) => {
      if (question.type === "scale") {
        initialState[question.id] = 3; // Valeur par défaut au milieu de l'échelle
      } else if (question.type === "radio") {
        initialState[question.id] = "";
      }
    });
  });

  return initialState;
};
