import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getMetadata } from "../lib/metadata";
import TaskProjectCard from "../components/tasks/TaskProjectCard";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Task Projects Page
 *
 * Lists all task management projects
 */
export default function TaskProjectsPage() {
  const { currentUser } = useCurrentUser();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, my-projects, archived

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);

      // Fetch groups with metadata.type = 'task_project'
      const { data, error } = await getSupabase()
        .from("groups")
        .select("*, group_members(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter for task projects
      const taskProjects = data.filter((group) => {
        const type = getMetadata(group, "type");
        return type === "task_project";
      });

      // For each project, get task counts
      const projectsWithStats = await Promise.all(
        taskProjects.map(async (project) => {
          // Get all tasks (posts) for this project
          const { data: tasks, error: tasksError } = await getSupabase()
            .from("posts")
            .select("metadata")
            .eq("metadata->>group_id", project.id);

          if (tasksError) {
            console.error("Error fetching tasks:", tasksError);
            return project;
          }

          // Count tasks by status
          const stats = {
            todo: 0,
            in_progress: 0,
            review: 0,
            done: 0,
            blocked: 0,
          };

          tasks?.forEach((task) => {
            const status = task.metadata?.task_details?.status || "todo";
            if (stats[status] !== undefined) {
              stats[status]++;
            }
          });

          // Add stats to project metadata
          return {
            ...project,
            metadata: {
              ...project.metadata,
              task_stats: stats,
            },
          };
        })
      );

      setProjects(projectsWithStats);
    } catch (err) {
      console.error("Error loading task projects:", err);
      setError("Impossible de charger les projets");
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter((project) => {
    if (filter === "all") return true;

    const projectDetails = getMetadata(project, "project_details", {});

    if (filter === "archived") {
      return projectDetails.archived === true;
    }

    if (filter === "my-projects") {
      // Check if current user is a member or creator
      return project.created_by === currentUser?.id;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-bauhaus text-gray-900">Projets de Tâches</h1>
          <p className="text-gray-600 mt-2">
            Organisez le travail citoyen avec des tableaux Kanban
          </p>
        </div>

        {currentUser && (
          <Link
            to="/tasks/new"
            className="bg-primary-600 text-white px-6 py-3  font-bold hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Créer un projet
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
            filter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Tous les projets
        </button>
        {currentUser && (
          <button
            onClick={() => setFilter("my-projects")}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
              filter === "my-projects"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Mes projets
          </button>
        )}
        <button
          onClick={() => setFilter("archived")}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
            filter === "archived"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Archivés
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">Chargement des projets...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 text-center">
          {error}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50  border border-gray-200 border-dashed">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 mb-4">Aucun projet trouvé</p>
          {currentUser && filter === "all" && (
            <Link to="/tasks/new" className="text-primary-600 font-bold hover:underline">
              Créez le premier projet de tâches !
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <TaskProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
