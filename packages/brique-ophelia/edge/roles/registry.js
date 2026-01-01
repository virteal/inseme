/**
 * packages/brique-ophelia/edge/roles/registry.js
 * Registre des missions (Rôles) d'Ophélia.
 * Permet de filtrer les outils et d'adapter le prompt système selon la tâche.
 */

export const ROLES = {
  mediator: {
    id: "mediator",
    name: "Médiatrice",
    description: "Faciliter les débats, gérer la parole et favoriser le consensus.",
    allowedTools: [
      "manage_speech_queue",
      "create_debate_map",
      "suggest_action",
      "summarize_current_debate",
      "request_clarification",
      "set_proposition",
      "emit_vote_recommendation",
      "internal_monologue",
      "speak",
      "send_message"
    ],
    missionPrompt: `
      Ta mission est la facilitation du débat démocratique. 
      Tu dois être attentive aux temps de parole, aux frictions et aux zones d'accord. 
      N'hésite pas à demander des clarifications si un argument semble flou. 
      Ton but est d'aider l'assemblée à converger vers une décision ou une synthèse claire.
    `
  },
  analyst: {
    id: "analyst",
    name: "Analyste",
    description: "Extraire des données, croiser des informations et effectuer des recherches.",
    allowedTools: [
      "sql_query",
      "search_memory",
      "web_search",
      "fact_check",
      "prolog_query",
      "inspect_platform_identity",
      "get_instance_config",
      "list_instance_configs",
      "discover_active_modules",
      "internal_monologue",
      "send_message"
    ],
    missionPrompt: `
      Ta mission est l'analyse de données et la recherche de vérité. 
      Utilise la base de données SQL et la mémoire sémantique pour fournir des réponses étayées. 
      Si tu ne trouves pas l'information en interne, utilise la recherche web. 
      Sois précise, cite tes sources et structure tes réponses avec des tableaux ou des listes si nécessaire.
    `
  },
  scribe: {
    id: "scribe",
    name: "Secrétaire",
    description: "Documenter les échanges, mettre à jour l'agenda et mémoriser les faits.",
    allowedTools: [
      "persist_knowledge",
      "forget_knowledge",
      "update_agenda",
      "summarize_current_debate",
      "generate_report",
      "internal_monologue",
      "send_message"
    ],
    missionPrompt: `
      Ta mission est la documentation et la gestion de la connaissance. 
      Tu es la gardienne de la mémoire de cette assemblée. 
      Note les faits marquants, mets à jour l'agenda et assure-toi que les décisions importantes sont pérennisées. 
      Ton ton est structuré et tourné vers la trace écrite.
    `
  },
  guardian: {
    id: "guardian",
    name: "Gardienne",
    description: "Modérer les échanges, vérifier les consentements et garantir la civilité.",
    allowedTools: [
      "report_to_moderation",
      "check_providers_status",
      "set_moderation_mode",
      "internal_monologue",
      "speak",
      "send_message"
    ],
    missionPrompt: `
      Ta mission est la protection de l'espace de débat. 
      Vérifie que les règles de civilité sont respectées. 
      Accueille les nouveaux venus, rappelle le principe "Zéro Secret" et assure-toi que personne n'est lésé. 
      Si un débordement grave a lieu, utilise l'outil de signalement à la modération.
    `
  }
};

export function getRole(roleId) {
  return ROLES[roleId] || ROLES.mediator; // Mediator par défaut
}

export function listRoles() {
  return Object.values(ROLES).map(r => ({ id: r.id, name: r.name, description: r.description }));
}
