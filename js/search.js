export function filterSongs(songs, query, genre) {
  const term = query.trim().toLowerCase();
  return songs.filter((song) => {
    const matchesGenre = genre === "all" || song.genre === genre;
    const haystack = song.searchText || `${song.title} ${song.artist} ${song.artists?.join(" ") || ""} ${song.album} ${song.genre}`.toLowerCase();
    return matchesGenre && (!term || haystack.includes(term));
  });
}
