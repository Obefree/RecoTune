export type { BuiltinCatalogUpgradeResult } from '../db/songLibrary';
export {
  initSongLibrary,
  listSongs,
  listUserSongs,
  getSongById,
  upsertUserSong,
  deleteUserSong,
  getFavoriteIds,
  setFavorite,
  isUserSongId,
} from '../db/songLibrary';
export { searchSongsSmart, filterSongsQuick, type SmartSearchHit } from '../db/searchSongsSmart';
export { BUILTIN_SEED_VERSION, CHORD_LIBRARY_BUILD } from '../db/songLibrary';
