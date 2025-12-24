import { useCurrentUser } from "../lib/useCurrentUser";
import GroupDetail from "../components/social/GroupDetail";

/**
 * Page détail d'un groupe
 */
export default function GroupPage() {
  const { currentUser, userStatus } = useCurrentUser();

  // If you want to add auth-required UI, you can use userStatus here
  return <GroupDetail currentUser={currentUser} />;
}
