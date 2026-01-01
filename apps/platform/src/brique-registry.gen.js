// GÉNÉRÉ AUTOMATIQUEMENT PAR COP-HOST COMPILER
// Ne pas modifier manuellement

/**
 * Registre des briques disponibles et leurs configurations
 */
export const BRIQUES = [
  {
    "id": "wiki",
    "name": "Wiki Collaboratif",
    "feature": "wiki",
    "routes": [
      {
        "path": "/wiki",
        "component": "./src/pages/Wiki.jsx",
        "protected": false
      },
      {
        "path": "/wiki/new",
        "component": "./src/pages/WikiCreate.jsx",
        "protected": true
      },
      {
        "path": "/wiki/dashboard",
        "component": "./src/pages/WikiDashboard.jsx",
        "protected": true
      },
      {
        "path": "/wiki/:slug",
        "component": "./src/pages/WikiPage.jsx",
        "protected": false
      },
      {
        "path": "/wiki/:slug/edit",
        "component": "./src/pages/WikiEdit.jsx",
        "protected": true
      }
    ],
    "menuItems": [
      {
        "id": "main-wiki",
        "label": "Wiki",
        "path": "/wiki",
        "icon": "Book",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_wiki",
          "description": "Rechercher des informations dans le Wiki global ou spécifique à la salle. Utilise cet outil pour trouver des précédents, des définitions ou des règles archivées.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Le terme ou la question à rechercher."
              },
              "scope": {
                "type": "string",
                "enum": [
                  "global",
                  "room"
                ],
                "description": "L'étendue de la recherche."
              }
            },
            "required": [
              "query"
            ]
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "propose_wiki_page",
          "description": "Proposer la création ou la mise à jour d'une page Wiki. Utilise cet outil pour synthétiser des décisions de réunion, créer un compte-rendu ou archiver une information importante.",
          "parameters": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "Le titre de la page Wiki."
              },
              "content": {
                "type": "string",
                "description": "Le contenu Markdown de la page."
              },
              "summary": {
                "type": "string",
                "description": "Un bref résumé (1-2 phrases) de l'objectif de la page."
              },
              "is_room_specific": {
                "type": "boolean",
                "description": "Si vrai, la page sera liée uniquement à cette salle."
              }
            },
            "required": [
              "title",
              "content"
            ]
          }
        }
      }
    ],
    "configSchema": {
      "wiki_storage_bucket": {
        "type": "string",
        "default": "wiki-content"
      }
    }
  },
  {
    "id": "tasks",
    "name": "Projets & Actions",
    "feature": "projects",
    "routes": [
      {
        "path": "/projects",
        "component": "./src/pages/ProjectList.jsx",
        "protected": false
      },
      {
        "path": "/projects/kanban/:id",
        "component": "./src/pages/KanbanBoardPage.jsx",
        "protected": true
      },
      {
        "path": "/projects/mission/:id",
        "component": "./src/pages/MissionDetail.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-projects",
        "label": "Projets",
        "path": "/projects",
        "icon": "CheckSquare",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "list_projects",
          "description": "Lister les projets et missions en cours.",
          "parameters": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "enum": [
                  "active",
                  "completed",
                  "all"
                ]
              }
            }
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "get_my_tasks",
          "description": "Obtenir les tâches assignées à l'utilisateur courant.",
          "parameters": {
            "type": "object",
            "properties": {
              "limit": {
                "type": "number"
              }
            }
          }
        }
      }
    ],
    "configSchema": {}
  },
  {
    "id": "ophelia",
    "name": "Ophélia - Chat Vocal",
    "feature": "vocal_chat",
    "routes": [
      {
        "path": "/chat",
        "component": "./components/chat/OpheliaChat.jsx",
        "protected": false
      },
      {
        "path": "/ophelia",
        "component": "./InsemeRoom.jsx",
        "protected": false
      },
      {
        "path": "/ophelia/:roomName",
        "component": "./InsemeRoom.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-ophelia-chat",
        "label": "Ophélia Chat",
        "path": "/chat",
        "icon": "ChatTeardropText",
        "position": "header"
      },
      {
        "id": "main-ophelia-vocal",
        "label": "Ophélia Vocal",
        "path": "/ophelia",
        "icon": "Microphone",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "create_inseme_room",
          "description": "Créer une nouvelle session Inseme avec Ophélia.",
          "parameters": {
            "type": "object",
            "properties": {
              "room_name": {
                "type": "string",
                "description": "Nom de la salle"
              },
              "mode": {
                "type": "string",
                "enum": [
                  "consensus",
                  "debate",
                  "workshop"
                ]
              }
            }
          }
        }
      }
    ],
    "configSchema": {
      "default_room": {
        "type": "string"
      },
      "enable_vocal": {
        "type": "boolean"
      },
      "ophelia_voice": {
        "type": "string"
      }
    }
  },
  {
    "id": "map",
    "name": "Carte Citoyenne",
    "feature": "map",
    "routes": [
      {
        "path": "/map",
        "component": "./src/pages/MapPage.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-map",
        "label": "Carte",
        "path": "/map",
        "icon": "Map",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_map_places",
          "description": "Rechercher des lieux ou des points d'intérêt sur la carte.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Nom du lieu ou type (ex: Mairie, École)."
              },
              "limit": {
                "type": "number",
                "description": "Nombre de résultats (défaut: 5)."
              }
            }
          }
        }
      }
    ],
    "configSchema": {
      "map_default_lat": {
        "type": "string"
      },
      "map_default_lng": {
        "type": "string"
      },
      "map_default_zoom": {
        "type": "number"
      }
    }
  },
  {
    "id": "democracy",
    "name": "Gouvernance Citoyenne",
    "feature": "democracy",
    "routes": [
      {
        "path": "/democracy",
        "component": "./src/pages/DemocracyDashboard.jsx",
        "protected": false
      },
      {
        "path": "/propositions",
        "component": "./src/pages/PropositionList.jsx",
        "protected": false
      },
      {
        "path": "/propositions/new",
        "component": "./src/pages/PropositionCreate.jsx",
        "protected": true
      },
      {
        "path": "/consultations",
        "component": "./src/pages/ConsultationList.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-democracy",
        "label": "Gouvernance",
        "path": "/democracy",
        "icon": "Scale",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_propositions",
          "description": "Rechercher des propositions citoyennes soumis au vote.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string"
              },
              "status": {
                "type": "string",
                "enum": [
                  "active",
                  "closed",
                  "draft"
                ]
              }
            }
          }
        }
      }
    ],
    "configSchema": {}
  },
  {
    "id": "group",
    "name": "Gestion des Groupes",
    "feature": "group",
    "routes": [
      {
        "path": "/groups",
        "component": "./src/pages/GroupList.jsx",
        "protected": true
      },
      {
        "path": "/groups/:id",
        "component": "./src/pages/GroupDetail.jsx",
        "protected": false
      },
      {
        "path": "/groups/:id/admin",
        "component": "./src/pages/GroupAdmin.jsx",
        "protected": true
      }
    ],
    "menuItems": [
      {
        "id": "main-groups",
        "label": "Groupes",
        "path": "/groups",
        "icon": "Users",
        "position": "sidebar"
      }
    ],
    "configSchema": {}
  },
  {
    "id": "fil",
    "name": "Le Fil",
    "feature": "fil",
    "routes": [
      {
        "path": "/fil",
        "component": "./src/pages/FilFeed.jsx",
        "protected": false
      },
      {
        "path": "/fil/new",
        "component": "./src/pages/FilSubmissionForm.jsx",
        "protected": true
      },
      {
        "path": "/fil/:id",
        "component": "./src/pages/FilItemDetail.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-fil",
        "label": "Le Fil",
        "path": "/fil",
        "icon": "Lightning",
        "position": "sidebar"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "read_fil",
          "description": "Obtenir les dernières actualités du Fil.",
          "parameters": {
            "type": "object",
            "properties": {
              "limit": {
                "type": "number",
                "description": "Nombre d'items (défaut: 5)."
              },
              "period": {
                "type": "string",
                "enum": [
                  "day",
                  "week",
                  "all"
                ],
                "description": "Période temporelle."
              }
            }
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "post_to_fil",
          "description": "Publier un lien ou une info sur le Fil.",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string",
                "description": "L'URL à partager."
              },
              "title": {
                "type": "string",
                "description": "Titre optionnel."
              },
              "content": {
                "type": "string",
                "description": "Description optionnelle."
              }
            },
            "required": [
              "url"
            ]
          }
        }
      }
    ]
  },
  {
    "id": "cyrnea",
    "name": "Cyrnea",
    "routes": [
      {
        "path": "/bar",
        "component": "./src/pages/BarmanDashboard.jsx",
        "protected": true
      },
      {
        "path": "/q",
        "component": "./src/pages/ClientMiniApp.jsx",
        "protected": false
      }
    ]
  },
  {
    "id": "communes",
    "name": "Communes & Consultations",
    "feature": "communes",
    "routes": [
      {
        "path": "/consultation/barometre",
        "component": "./src/pages/ConsultationDemocratieLocale.jsx",
        "protected": false
      }
    ]
  },
  {
    "id": "blog",
    "name": "Gestion des Blogs",
    "feature": "blog",
    "routes": [
      {
        "path": "/blog",
        "component": "./src/pages/BlogHome.jsx",
        "protected": false
      },
      {
        "path": "/blog/new",
        "component": "./src/pages/BlogEditor.jsx",
        "protected": true
      },
      {
        "path": "/blog/:slug",
        "component": "./src/pages/BlogPost.jsx",
        "protected": false
      },
      {
        "path": "/blog/:slug/edit",
        "component": "./src/pages/BlogEditor.jsx",
        "protected": true
      },
      {
        "path": "/gazette",
        "component": "./src/pages/GazettePage.jsx",
        "protected": false
      },
      {
        "path": "/gazette/:name",
        "component": "./src/pages/GazettePage.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-blog",
        "label": "Interventions",
        "path": "/blog",
        "icon": "Newspaper",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "read_blog_posts",
          "description": "Rechercher des articles de blog ou des tribunes.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Termes de recherche (titre/contenu)."
              },
              "limit": {
                "type": "number",
                "description": "Nombre maximum de résultats (défaut: 5)."
              }
            }
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "get_blog_post",
          "description": "Lire le contenu complet d'un article de blog.",
          "parameters": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "L'identifiant du post."
              }
            },
            "required": [
              "id"
            ]
          }
        }
      }
    ],
    "configSchema": {}
  },
  {
    "id": "actes",
    "name": "Actes Administratifs",
    "feature": "administrative_acts",
    "routes": [
      {
        "path": "/actes",
        "component": "./src/pages/ActesHome.jsx",
        "protected": false
      },
      {
        "path": "/actes/dashboard",
        "component": "./src/pages/ActesDashboard.jsx",
        "protected": true
      },
      {
        "path": "/actes/list",
        "component": "./src/pages/ActesList.jsx",
        "protected": false
      },
      {
        "path": "/actes/new",
        "component": "./src/pages/ActeForm.jsx",
        "protected": true
      },
      {
        "path": "/actes/:id",
        "component": "./src/pages/ActeDetail.jsx",
        "protected": false
      },
      {
        "path": "/demandes",
        "component": "./src/pages/DemandesList.jsx",
        "protected": false
      },
      {
        "path": "/demandes/new",
        "component": "./src/pages/DemandeForm.jsx",
        "protected": true
      },
      {
        "path": "/demandes/:id",
        "component": "./src/pages/DemandeDetail.jsx",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-actes",
        "label": "Actes",
        "path": "/actes",
        "icon": "FileText",
        "position": "header"
      },
      {
        "id": "main-demandes",
        "label": "Demandes",
        "path": "/demandes",
        "icon": "Clipboard",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_actes",
          "description": "Rechercher des actes administratifs publiés.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string"
              },
              "year": {
                "type": "number"
              },
              "type": {
                "type": "string"
              }
            }
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "get_demande_status",
          "description": "Obtenir le statut d'une demande administrative.",
          "parameters": {
            "type": "object",
            "properties": {
              "demande_id": {
                "type": "string"
              }
            },
            "required": [
              "demande_id"
            ]
          }
        }
      }
    ],
    "configSchema": {
      "municipality_name": {
        "type": "string"
      },
      "publication_delay_days": {
        "type": "number"
      }
    }
  }
];

/**
 * Mappage des composants pour lazy-loading
 */
export const BRIQUE_COMPONENTS = {
  "wiki:/wiki": () => import("./../../../packages/brique-wiki/src/pages/Wiki.jsx"),
  "wiki:/wiki/new": () => import("./../../../packages/brique-wiki/src/pages/WikiCreate.jsx"),
  "wiki:/wiki/dashboard": () => import("./../../../packages/brique-wiki/src/pages/WikiDashboard.jsx"),
  "wiki:/wiki/:slug": () => import("./../../../packages/brique-wiki/src/pages/WikiPage.jsx"),
  "wiki:/wiki/:slug/edit": () => import("./../../../packages/brique-wiki/src/pages/WikiEdit.jsx"),
  "tasks:/projects": () => import("./../../../packages/brique-tasks/src/pages/ProjectList.jsx"),
  "tasks:/projects/kanban/:id": () => import("./../../../packages/brique-tasks/src/pages/KanbanBoardPage.jsx"),
  "tasks:/projects/mission/:id": () => import("./../../../packages/brique-tasks/src/pages/MissionDetail.jsx"),
  "ophelia:/chat": () => import("./../../../packages/brique-ophelia/components/chat/OpheliaChat.jsx"),
  "ophelia:/ophelia": () => import("./../../../packages/brique-ophelia/InsemeRoom.jsx"),
  "ophelia:/ophelia/:roomName": () => import("./../../../packages/brique-ophelia/InsemeRoom.jsx"),
  "map:/map": () => import("./../../../packages/brique-map/src/pages/MapPage.jsx"),
  "democracy:/democracy": () => import("./../../../packages/brique-kudocracy/src/pages/DemocracyDashboard.jsx"),
  "democracy:/propositions": () => import("./../../../packages/brique-kudocracy/src/pages/PropositionList.jsx"),
  "democracy:/propositions/new": () => import("./../../../packages/brique-kudocracy/src/pages/PropositionCreate.jsx"),
  "democracy:/consultations": () => import("./../../../packages/brique-kudocracy/src/pages/ConsultationList.jsx"),
  "group:/groups": () => import("./../../../packages/brique-group/src/pages/GroupList.jsx"),
  "group:/groups/:id": () => import("./../../../packages/brique-group/src/pages/GroupDetail.jsx"),
  "group:/groups/:id/admin": () => import("./../../../packages/brique-group/src/pages/GroupAdmin.jsx"),
  "fil:/fil": () => import("./../../../packages/brique-fil/src/pages/FilFeed.jsx"),
  "fil:/fil/new": () => import("./../../../packages/brique-fil/src/pages/FilSubmissionForm.jsx"),
  "fil:/fil/:id": () => import("./../../../packages/brique-fil/src/pages/FilItemDetail.jsx"),
  "cyrnea:/bar": () => import("./../../../packages/brique-cyrnea/src/pages/BarmanDashboard.jsx"),
  "cyrnea:/q": () => import("./../../../packages/brique-cyrnea/src/pages/ClientMiniApp.jsx"),
  "communes:/consultation/barometre": () => import("./../../../packages/brique-communes/src/pages/ConsultationDemocratieLocale.jsx"),
  "blog:/blog": () => import("./../../../packages/brique-blog/src/pages/BlogHome.jsx"),
  "blog:/blog/new": () => import("./../../../packages/brique-blog/src/pages/BlogEditor.jsx"),
  "blog:/blog/:slug": () => import("./../../../packages/brique-blog/src/pages/BlogPost.jsx"),
  "blog:/blog/:slug/edit": () => import("./../../../packages/brique-blog/src/pages/BlogEditor.jsx"),
  "blog:/gazette": () => import("./../../../packages/brique-blog/src/pages/GazettePage.jsx"),
  "blog:/gazette/:name": () => import("./../../../packages/brique-blog/src/pages/GazettePage.jsx"),
  "actes:/actes": () => import("./../../../packages/brique-actes/src/pages/ActesHome.jsx"),
  "actes:/actes/dashboard": () => import("./../../../packages/brique-actes/src/pages/ActesDashboard.jsx"),
  "actes:/actes/list": () => import("./../../../packages/brique-actes/src/pages/ActesList.jsx"),
  "actes:/actes/new": () => import("./../../../packages/brique-actes/src/pages/ActeForm.jsx"),
  "actes:/actes/:id": () => import("./../../../packages/brique-actes/src/pages/ActeDetail.jsx"),
  "actes:/demandes": () => import("./../../../packages/brique-actes/src/pages/DemandesList.jsx"),
  "actes:/demandes/new": () => import("./../../../packages/brique-actes/src/pages/DemandeForm.jsx"),
  "actes:/demandes/:id": () => import("./../../../packages/brique-actes/src/pages/DemandeDetail.jsx"),
};
