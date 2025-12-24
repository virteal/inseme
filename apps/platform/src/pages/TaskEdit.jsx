import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { DEFAULT_WORKFLOW_STATES } from "../lib/taskMetadata";
import TaskForm from "../components/tasks/TaskForm";
import SiteFooter from "../components/layout/SiteFooter";
import {
  buildTaskContent,
  getTaskBodyFromPost,
  getTaskDetails,
  getTaskTitleFromPost,
} from "../lib/taskHelpers";
import { appendOrMergeLastModifiedBy } from "../lib/socialMetadata";
import { getDisplayName } from "../lib/userDisplay";

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

export default function TaskEdit() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useCurrentUser();

  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!projectId || !taskId) {
        setError("Paramètres invalides");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          { data: projectData, error: projectError },
          { data: taskData, error: taskError },
          { data: memberRows, error: membersError },
        ] = await Promise.all([
          getSupabase().from("groups").select("*").eq("id", projectId).single(),
          getSupabase().from("posts").select("*").eq("id", taskId).single(),
          getSupabase()
            .from("group_members")
            .select("*, users(id, display_name, metadata)")
            .eq("group_id", projectId),
        ]);

        if (projectError) throw projectError;
        if (taskError) throw taskError;
        if (membersError) throw membersError;

        if (projectData?.metadata?.type !== "task_project") {
          throw new Error("Projet invalide pour la gestion des tâches.");
        }

        const taskProjectId = taskData?.metadata?.group_id;
        if (taskProjectId !== projectId) {
          throw new Error("Cette tâche n'appartient pas à ce projet.");
        }

        setProject(projectData);
        setTask(taskData);
        setMembers(memberRows || []);
      } catch (err) {
        console.error("Error loading task", err);
        setError(err.message || "Impossible de charger la tâche.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId, taskId]);

  const workflowStates = useMemo(
    () =>
      project?.metadata?.project_details?.workflow_states?.length
        ? project.metadata.project_details.workflow_states
        : DEFAULT_WORKFLOW_STATES,
    [project]
  );

  const initialValues = useMemo(() => {
    if (!task) {
      return {};
    }
    const details = getTaskDetails(task);
    return {
      title: getTaskTitleFromPost(task),
      description: getTaskBodyFromPost(task),
      status: details.status,
      priority: details.priority,
      dueDate: details.due_date,
      labels: details.labels || [],
      assignees: details.assignees || [],
      estimate: details.estimate || "",
    };
  }, [task]);

  const isMember = currentUser && members.some((member) => member.user_id === currentUser.id);

  const handleSubmit = async (formValues) => {
    if (!currentUser) {
      setError("Vous devez être connecté.");
      return;
    }

    if (!task) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const currentDetails = getTaskDetails(task);
      const previousStatus = currentDetails.status;
      const nextStatus = formValues.status || previousStatus;

      let statusHistory = Array.isArray(task.metadata?.status_history)
        ? [...task.metadata.status_history]
        : [];

      if (previousStatus && nextStatus && previousStatus !== nextStatus) {
        statusHistory = [
          ...statusHistory,
          {
            status: nextStatus,
            from: previousStatus,
            changed_by: currentUser.id,
            changed_at: new Date().toISOString(),
            comment_id: null,
          },
        ];
      }

      let updatedMetadata = {
        ...task.metadata,
        status_history: statusHistory,
        task_details: {
          ...currentDetails,
          status: nextStatus,
          priority: formValues.priority || currentDetails.priority,
          due_date: toIsoDate(formValues.dueDate),
          labels: Array.isArray(formValues.labels) ? formValues.labels : [],
          assignees: Array.isArray(formValues.assignees) ? formValues.assignees : [],
          estimate: formValues.estimate || null,
        },
      };

      // Stamp lastModifiedBy for audit trail
      updatedMetadata = appendOrMergeLastModifiedBy(updatedMetadata, {
        id: currentUser.id,
        displayName: getDisplayName(currentUser),
      });

      const content = buildTaskContent(formValues.title, formValues.description);

      const { data: updatedTask, error: updateError } = await getSupabase()
        .from("posts")
        .update({
          content,
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setTask(updatedTask);
      navigate(`/tasks/${projectId}/task/${taskId}`);
    } catch (err) {
      console.error("Error updating task", err);
      setError(err.message || "Impossible de mettre à jour la tâche.");
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
        <div className="bg-red-50 text-red-700 p-4 border border-red-200 rounded mb-4">{error}</div>
        <Link to={`/tasks/${projectId}`} className="text-primary-600 hover:underline">
          &larr; Retour au projet
        </Link>
      </div>
    );
  }

  if (!project || !task) {
    return null;
  }

  if (!isMember) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800  p-4">
          Vous devez être membre du projet pour modifier cette tâche.
        </div>
        <Link
          to={`/tasks/${projectId}/task/${taskId}`}
          className="text-primary-600 hover:underline"
        >
          &larr; Retourner à la tâche
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <Link to={`/tasks/${projectId}/task/${taskId}`} className="text-gray-500 hover:underline">
          &larr; Retour à la tâche
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Modifier la tâche</h1>
        <p className="text-gray-600 mt-2">
          Mettez à jour les détails avant de retourner sur le tableau.
        </p>
      </div>

      <TaskForm
        project={project}
        members={members}
        workflowStates={workflowStates}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Mettre à jour la tâche"
      />

      <SiteFooter />
    </div>
  );
}
