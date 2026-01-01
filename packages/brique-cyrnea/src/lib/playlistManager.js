/**
 * packages/brique-cyrnea/src/lib/playlistManager.js
 * Gestion de la playlist participative avec intégration Temps-Réel (Supabase)
 */
import { supabase } from "@inseme/cop-host";

export async function getPlaylist(roomId) {
  const { data, error } = await supabase
    .from('inseme_rooms')
    .select('settings')
    .eq('id', roomId)
    .single();
    
  return data?.settings?.playlist || [];
}

export async function voteForTrack(roomId, trackId) {
  // Récupère la playlist actuelle
  const playlist = await getPlaylist(roomId);
  const updatedPlaylist = playlist.map(track => {
    if (track.id === trackId) {
      return { ...track, votes: (track.votes || 0) + 1 };
    }
    return track;
  });

  // Met à jour les settings de la room
  const { error } = await supabase
    .from('inseme_rooms')
    .update({ settings: { playlist: updatedPlaylist } })
    .eq('id', roomId);

  return !error;
}
