import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import FilItemCard from "../components/FilItemCard";
import { MarkdownViewer } from "@inseme/ui";

export default function FilItemDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
     getSupabase().auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  useEffect(() => {
    async function load() {
       const { data, error } = await getSupabase()
         .from("posts")
         .select("*, users:author_id(display_name), reactions(user_id, emoji)")
         .eq("id", id)
         .single();
       
       if (data) {
          // Enrich vote
          const userReaction = data.reactions?.find(
            (r) => r.user_id === currentUser?.id && (r.emoji === "+1" || r.emoji === "-1")
          );
          const userVote = userReaction ? (userReaction.emoji === "+1" ? 1 : -1) : 0;
          setPost({ ...data, user_vote: userVote });
       }
       setLoading(false);
    }
    if (currentUser !== undefined) load(); // Wait for auth check to finish (undefined -> null/obj) logic simplified here
    else load();
  }, [id, currentUser?.id]);

  if (loading) return <div className="p-8">Chargement...</div>;
  if (!post) return <div className="p-8">Item introuvable.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Link to="/fil" className="text-gray-500 hover:underline mb-4 block">← Retour au Fil</Link>
      
      <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 mb-4">
         <FilItemCard post={post} currentUserId={currentUser?.id} />
         
         {post.content && (
            <div className="mt-4 pt-4 border-t prose dark:prose-invert">
               <MarkdownViewer content={post.content} />
            </div>
         )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-center text-gray-500">
         <p>Espace commentaires à venir...</p>
      </div>
    </div>
  );
}
