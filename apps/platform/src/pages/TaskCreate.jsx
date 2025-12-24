import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { DEFAULT_WORKFLOW_STATES } from "../lib/taskMetadata";
import TaskForm from "../components/tasks/TaskForm";
import SiteFooter from "../components/layout/SiteFooter";
import { buildTaskContent } from "../lib/taskHelpers";

function toIsoDate(dateString) {
  if (!dateString) {
    return null;
  }

  try {
    return new Date(`${dateString}T00:00:00Z`).toISOString();
  } catch (error) {
    console.warn("Unable to parse due date", error);
    return null;
  }
}

export default function TaskCreate() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useCurrentUser();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!projectId) {
        setError("Projet introuvable");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const { data: projectData, error: projectError } = await getSupabase()
          .from("groups")
          .select("*")
          .eq("id", projectId)
          .single();

        if (projectError) {
          throw projectError;
        }

        const type = projectData?.metadata?.type;
        if (type !== "task_project") {
          throw new Error("Ce groupe ne correspond pas à un projet de tâches.");
        }

        setProject(projectData);

        const { data: memberRows, error: membersError } = await getSupabase()
          .from("group_members")
          .select("*, users(id, display_name, metadata)")
          .eq("group_id", projectId);

        if (membersError) {
          throw membersError;
        }

        setMembers(memberRows || []);
      } catch (err) {
        console.error("Error loading project", err);
        setError(err.message || "Impossible de charger le projet.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  const workflowStates = useMemo(() => {
    return project?.metadata?.project_details?.workflow_states?.length
      ? project.metadata.project_details.workflow_states
      : DEFAULT_WORKFLOW_STATES;
  }, [project]);

  const isMember = currentUser && members.some((member) => member.user_id === currentUser.id);

  const initialValues = useMemo(
    () => ({
      title: "",
      description: "",
      status: workflowStates[0] || DEFAULT_WORKFLOW_STATES[0],
      priority: "medium",
      dueDate: "",
      labels: [],
      assignees: currentUser ? [currentUser.id] : [],
      estimate: "",
    }),
    [workflowStates, currentUser]
  );

  const handleSubmit = async (formValues) => {
    if (!currentUser) {
      setError("Vous devez être connecté pour créer une tâche.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const taskMetadata = {
        schemaVersion: 1,
        type: "task",
        group_id: projectId,
        task_details: {
          status: formValues.status || workflowStates[0] || DEFAULT_WORKFLOW_STATES[0],
          priority: formValues.priority || "medium",
          due_date: toIsoDate(formValues.dueDate),
          labels: Array.isArray(formValues.labels) ? formValues.labels : [],
          assignees: Array.isArray(formValues.assignees) ? formValues.assignees : [],
          estimate: formValues.estimate || null,
        },
        status_history: [],
      };

      const content = buildTaskContent(formValues.title, formValues.description);

      const { data: task, error: createError } = await getSupabase()
        .from("posts")
        .insert({
          author_id: currentUser.id,
          content,
          metadata: taskMetadata,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      navigate(`/tasks/${projectId}/task/${task.id}`);
    } catch (err) {
      console.error("Error creating task", err);
      setError(err.message || "Impossible de créer la tâche.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 border border-red-200  mb-4">{error}</div>
        <Link to={`/tasks/${projectId}`} className="text-primary-600 hover:underline">
          ← Retour au projet
        </Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const canCreate = Boolean(currentUser && isMember);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <Link to={`/tasks/${projectId}`} className="text-gray-500 hover:underline">
          ← Retour au projet
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Nouvelle tâche</h1>
        <p className="text-gray-600 mt-2">Ajoutez une carte au tableau « {project.name} ».</p>
      </div>

      {!canCreate && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800  p-4">
          Vous devez être membre du projet pour créer des tâches.
        </div>
      )}

      {canCreate && (
        <TaskForm
          project={project}
          members={members}
          workflowStates={workflowStates}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Créer la tâche"
        />
      )}

      <SiteFooter />
    </div>
  );
}
