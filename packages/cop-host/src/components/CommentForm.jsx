import { useState } from "react";

/**
 * Formulaire de saisie de commentaire
 */
export default function CommentForm({
  onSubmit,
  onCancel = null,
  placeholder = "Votre commentaire...",
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!content.trim()) {
      alert("Le commentaire ne peut pas être vide");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(content);
      setContent(""); // Reset form
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300   focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        rows={3}
        disabled={submitting}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="px-4 py-2 bg-primary-600 text-bauhaus-white hover:bg-primary-700 disabled:bg-gray-400 text-sm font-medium"
        >
          {submitting ? "Envoi..." : "Commenter"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-200 hover:bg-gray-300 text-sm"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
