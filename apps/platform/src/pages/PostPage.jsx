import { useCurrentUser } from "../lib/useCurrentUser";
import PostView from "../components/social/PostView";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Page détail d'un article
 */
export default function PostPage() {
  const { currentUser, userStatus } = useCurrentUser();

  // If you want to add auth-required UI, you can use userStatus here
  return (
    <>
      <PostView currentUser={currentUser} />
      <SiteFooter />
    </>
  );
}
