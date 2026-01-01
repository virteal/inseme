import { Link } from "react-router-dom";
import { useState } from "react";
import { getSupabase } from "@inseme/cop-host";

export default function FilItemCard({ post, currentUserId, onVote }) {
  const [loading, setLoading] = useState(false);

  const metadata = post.metadata || {};
  const title = metadata.title || metadata.external_url || "Sans titre";
  const score = metadata.fil_score || 0;
  const commentCount = metadata.fil_comment_count || 0;
  const externalUrl = metadata.external_url;
  const userVote = post.user_vote || 0;

  // Extract domain from URL
  const getDomain = (url) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return null;
    }
  };

  const domain = getDomain(externalUrl);

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}j`;
  };

  async function handleVote(value) {
    if (!currentUserId) return alert("Connectez-vous pour voter");
    setLoading(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch("/api/fil/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          voteValue: userVote === value ? 0 : value, 
        }),
      });

      if (!response.ok) throw new Error("Vote failed");
      const data = await response.json();
      
      if (onVote) onVote(post.id, { score: data.score, userVote: userVote === value ? 0 : value });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex flex-col items-center pt-1 min-w-[24px]">
         <button 
           onClick={() => !loading && handleVote(1)} 
           className={`text-sm ${userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
         >
           ▲
         </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
           {externalUrl ? (
             <a href={externalUrl} target="_blank" rel="noopener" className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 truncate block">
               {title}
             </a>
           ) : (
             <Link to={`/fil/${post.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 truncate block">
               {title}
             </Link>
           )}
           {domain && <span className="text-xs text-gray-500">({domain})</span>}
        </div>
        
        <div className="text-xs text-gray-500 flex items-center gap-2">
           <span>{score} points</span>
           <span>•</span>
           <span>par {post.users?.display_name || 'Anonyme'}</span>
           <span>•</span>
           <span>{timeAgo(post.created_at)}</span>
           <span>•</span>
           <Link to={`/fil/${post.id}`} className="hover:underline">{commentCount} commentaires</Link>
        </div>
      </div>
    </div>
  );
}
