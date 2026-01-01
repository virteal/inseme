export default {
    id: "tasks",
    name: "Projets & Actions",
    feature: "projects",
    routes: [
      {
        path: "/projects",
        component: "./src/pages/ProjectList.jsx",
        protected: false,
      },
      {
        path: "/projects/kanban/:id",
        component: "./src/pages/KanbanBoardPage.jsx",
        protected: true,
      },
      {
        path: "/projects/mission/:id",
        component: "./src/pages/MissionDetail.jsx",
        protected: false,
      },
    ],
    menuItems: [
      {
        id: "main-projects",
        label: "Projets",
        path: "/projects",
        icon: "CheckSquare", 
        position: "header",
      },
    ],
    tools: [
        {
            type: "function",
            function: {
              name: "list_projects",
              description: "Lister les projets et missions en cours.",
              parameters: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["active", "completed", "all"] }
                }
              }
            }
        },
        {
            type: "function",
            function: {
              name: "get_my_tasks",
              description: "Obtenir les tâches assignées à l'utilisateur courant.",
              parameters: {
                type: "object",
                properties: {
                  limit: { type: "number" }
                }
              }
            }
        }
    ],
    configSchema: {}
  };
  
