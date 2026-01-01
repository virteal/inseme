/**
 * packages/brique-cyrnea/src/lib/playlistManager.js
 * Gestion de la playlist participative
 */

export const INITIAL_PLAYLIST = [
  { id: 1, title: "L'Orchestra", artist: "Canta u Populu Corsu" },
  { id: 2, title: "Get Lucky", artist: "Daft Punk" },
];

export function voteForTrack(trackId) {
  console.log(`Vote pour le morceau ${trackId}`);
  return true;
}
