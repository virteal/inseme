import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import { MarkdownViewer } from "@inseme/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function BlogPost() {
  const { slug } = useParams(); // Typically UUID in this system
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPost() {
      try {
        const { data, error } = await getSupabase()
          .from("posts")
          .select("*, author:users(display_name)")
          .eq("id", slug)
          .single();

        if (error) throw error;
        setPost(data);
      } catch (err) {
        console.error("Error loading blog post:", err);
        setError("Article introuvable ou erreur de chargement.");
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [slug]);

  if (loading) return <div className="p-12 text-center text-gray-500">Chargement de l'article...</div>;
  if (error) return <div className="p-12 text-center text-red-500">{error}</div>;
  if (!post) return <div className="p-12 text-center text-gray-500">Article introuvable.</div>;

  const { content, created_at, metadata } = post;
  const title = metadata?.title || "Sans titre";
  const subtitle = metadata?.subtitle;
  const authorName = post.author?.display_name || "Anonyme";

  // Logic from GazettePost.jsx for styling
  const sanitizedContent = content ? content.replace(/\u202F|\u00A0/g, " ") : "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/blog" className="text-indigo-600 hover:underline">
          ← Retour aux articles
        </Link>
      </div>

      <article className="bg-white dark:bg-gray-900 rounded-lg p-1 md:p-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-serif text-gray-900 dark:text-gray-100 mb-4 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <h2 className="text-xl md:text-2xl font-serif text-gray-600 dark:text-gray-400 italic mb-6">
              {subtitle}
            </h2>
          )}
          <div className="flex items-center justify-center text-sm text-gray-500 font-sans border-t border-b border-gray-100 dark:border-gray-800 py-3">
             <span className="mr-2">Par {authorName}</span>
             <span className="mx-2">•</span>
             <span>{format(new Date(created_at), "d MMMM yyyy", { locale: fr })}</span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert font-serif mx-auto text-justify gazette-article-content">
           <style>{`
             .gazette-article-content p:first-of-type::first-letter {
                float: left;
                font-family: serif;
                font-size: 3.5rem;
                line-height: 0.8;
                padding-right: 0.2rem;
                font-weight: bold;
                color: var(--color-primary-600, #4f46e5);
             }
           `}</style>
           <MarkdownViewer content={sanitizedContent} />
        </div>
      </article>

      {/* Editor Link if authorized (simple check, backend enforces rules) */}
      <div className="mt-8 text-center">
        <Link to={`/blog/${post.id}/edit`} className="text-sm text-gray-400 hover:text-gray-600">
          [Modifier cet article]
        </Link>
      </div>
    </div>
  );
}
