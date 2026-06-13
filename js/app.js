import { keys, read, write, setTheme, toast } from "./storage.js";
import { artistDisplay, buildArtistRegistry, getLibrary, getSong, loadAssetSongs, slugify, sortSongs, uniqueBy } from "./library.js";
import { filterSongs } from "./search.js";
import { Visualizer } from "./visualization.js";
import { Player } from "./player.js";
import { QueueManager } from "./queue.js";
import { PlaylistManager } from "./playlist.js";

const $ = (id) => document.getElementById(id);
let songs = getLibrary();
let filtered = [...songs];
let viewMode = "grid";
let favorites = read(keys.favorites, []);
let recent = read(keys.recent, []);
let followedArtists = read(keys.followedArtists, []);
let draggedQueueIndex = null;
let draggedPlaylist = null;
let artists = buildArtistRegistry(songs);
let albums = buildAlbumRegistry(songs);
let activeView = "home";
let contextMenuState = null;
let contextMenuCloseTimer = null;

const audio = $("audio");
const visualizer = new Visualizer(audio, $("visualizer"));
const queue = new QueueManager(renderQueue);
const playlists = new PlaylistManager(renderPlaylists);
const player = new Player({
  audio,
  songs,
  queue,
  visualizer,
  onChange: renderPlayer,
  onRecent: addRecent
});

const icons = {
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
  previous: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM9 12l9-7v14z"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM6 5l9 7-9 7z"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5h-2V6.4l-3.9 3.9-1.4-1.4L17.6 5H16zM4 7h3.3c1.3 0 2.5.5 3.4 1.4l6.9 6.9H21v2h-5.1l-6.6-6.6A2.8 2.8 0 0 0 7.3 9H4zm0 8h3.3c.8 0 1.5-.3 2.1-.9l1.3-1.3 1.4 1.4-1.3 1.3A4.8 4.8 0 0 1 7.3 17H4zm13.6-8.6L15.5 4.3 16.9 3l4.1 4.1-4.1 4.1-1.4-1.4z"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.2l-2-2L15.6 3 21 8l-5.4 5-1.4-2 2-2H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5zm10 10H7.8l2 2L8.4 21 3 16l5.4-5 1.4 2-2 2H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5z"/></svg>`,
  repeatOne: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.2l-2-2L15.6 3 21 8l-5.4 5-1.4-2 2-2H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5zm10 10H7.8l2 2L8.4 21 3 16l5.4-5 1.4 2-2 2H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5z"/><path d="M12 9h2v6h-2v-3.5l-1 .6-.8-1.4z"/></svg>`,
  volume: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zm12.5-.6a5 5 0 0 1 0 7.2l-1.4-1.4a3 3 0 0 0 0-4.4zM18.9 6a8 8 0 0 1 0 12l-1.4-1.4a6 6 0 0 0 0-9.2z"/></svg>`,
  muted: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zm12.7 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z"/></svg>`,
  queue: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm13.5-1.8V10h2v4.2l2.2-2.2 1.3 1.4-4.5 4.5-4.5-4.5 1.3-1.4z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-9.3-8.3C.8 9.4 2.7 5.5 6.4 5.1c2-.2 3.6.8 4.6 2.2 1-1.4 2.6-2.4 4.6-2.2 3.7.4 5.6 4.3 3.7 7.6C19 16.6 12 21 12 21zm0-2.4c2.5-1.7 5-3.9 6-6.9 1.1-2.1-.1-4.3-2.6-4.6-1.7-.2-2.9 1-3.6 2.4h-1.6C9.5 8.1 8.3 6.9 6.6 7.1c-2.5.3-3.7 2.5-2.6 4.6 1 3 3.5 5.2 6 6.9z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4zm12.6 1.4L6.4 19 5 17.6 17.6 5z"/></svg>`,
  playSmall: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-2 6h10l-.7 12H7.7z"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h2v2H9zm4 0h2v2h-2zM9 11h2v2H9zm4 0h2v2h-2zM9 16h2v2H9zm4 0h2v2h-2z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`
};

async function init() {
  setTheme(read(keys.theme, "dark"));
  document.body.dataset.view = "home";
  renderTransportIcons();
  renderSkeletons();
  bindEvents();
  await loadAssetSongs();
  setTimeout(() => {
    $("loadingSkeleton").classList.add("hidden");
    renderAll();
  }, 520);
  showView(viewFromHash(), false);
  window.addEventListener("popstate", () => showView(viewFromHash(), false));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function bindEvents() {
  $("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  document.querySelector(".brand[href='#home']")?.addEventListener("click", (event) => {
    event.preventDefault();
    showView("home");
  });
  $("globalSearch").addEventListener("input", handleSearchInput);
  $("globalSearch").addEventListener("keydown", handleSearchKeydown);
  $("genreFilter").addEventListener("change", applyFilters);
  $("clearSearch").addEventListener("click", () => {
    $("globalSearch").value = "";
    $("genreFilter").value = "all";
    hideSearchSuggestions();
    applyFilters();
    if (activeView === "search") renderSearchResults("");
  });
  $("sortSelect").addEventListener("change", applyFilters);
  document.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => {
    viewMode = button.dataset.viewMode;
    document.querySelectorAll("[data-view-mode]").forEach((item) => item.classList.toggle("active", item === button));
    renderSongs();
  }));
  document.querySelectorAll(".nav-link[data-view]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    showView(link.dataset.view);
  }));
  $("playTrending").addEventListener("click", () => {
    const first = sortSongs(songs, "trending")[0];
    if (first) player.load(first.id);
  });
  $("createPlaylistHero").addEventListener("click", openCreatePlaylist);
  $("newPlaylist").addEventListener("click", openCreatePlaylist);
  $("savePlaylistName").addEventListener("click", savePlaylistFromModal);
  $("contextMenu").addEventListener("click", (event) => event.stopPropagation());
  $("clearQueueDrawer").addEventListener("click", () => queue.clear());
  $("queueToggle").addEventListener("click", () => setQueueOpen(!$("queueDrawer").classList.contains("open")));
  $("closeQueueDrawer").addEventListener("click", () => setQueueOpen(false));
  $("queueBackdrop").addEventListener("click", () => setQueueOpen(false));
  $("playPauseBtn").addEventListener("click", () => player.toggle());
  $("nextBtn").addEventListener("click", () => player.next());
  $("prevBtn").addEventListener("click", () => player.previous());
  $("shuffleBtn").addEventListener("click", (event) => {
    player.shuffle = !player.shuffle;
    event.currentTarget.classList.toggle("active", player.shuffle);
    renderTransportIcons();
    toast(player.shuffle ? "Shuffle on" : "Shuffle off");
  });
  $("repeatBtn").addEventListener("click", (event) => {
    const mode = player.toggleRepeat();
    event.currentTarget.classList.toggle("active", mode !== "off");
    renderTransportIcons();
  });
  $("muteBtn").addEventListener("click", toggleMute);
  $("volumeSlider").value = audio.volume;
  $("volumeSlider").addEventListener("input", (event) => {
    audio.volume = Number(event.target.value);
    audio.muted = false;
    renderPlayer(player.current);
  });
  $("speedSelect").addEventListener("change", (event) => audio.playbackRate = Number(event.target.value));
  $("progressBar").addEventListener("input", (event) => {
    if (audio.duration) audio.currentTime = (Number(event.target.value) / 1000) * audio.duration;
  });
  $("likeCurrent").addEventListener("click", () => player.current && toggleFavorite(player.current.id));
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateProgress);
  document.addEventListener("keydown", handleKeys);
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#contextMenu") && !event.target.closest(".menu-trigger")) closeContextMenu();
    if (!event.target.closest(".search-wrap")) hideSearchSuggestions();
  });
}

function renderAll() {
  songs = getLibrary();
  artists = buildArtistRegistry(songs);
  albums = buildAlbumRegistry(songs);
  hydrateDefaultPlaylists();
  player.setSongs(songs);
  renderFilters();
  renderCategories();
  applyFilters();
  renderFavorites();
  renderArtists();
  renderAlbums();
  renderTrending();
  renderRecent();
  renderQueue();
  renderPlaylists();
  renderPlayer(player.current);
}

function hydrateDefaultPlaylists() {
  if (!songs.length || !playlists.playlists.length) return;
  const validIds = new Set(songs.map((song) => song.id));
  let changed = false;
  playlists.playlists.forEach((playlist, index) => {
    const ids = playlist.songIds.filter((id) => validIds.has(id));
    if (!ids.length && /late night mix|focus flow/i.test(playlist.name)) {
      playlist.songIds = songs.slice(index * 5, index * 5 + 5).map((song) => song.id);
      changed = true;
    } else if (ids.length !== playlist.songIds.length) {
      playlist.songIds = ids;
      changed = true;
    }
  });
  if (changed) playlists.save(false);
}

function renderSkeletons() {
  $("loadingSkeleton").innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton"></div>`).join("");
}

function renderFilters() {
  $("genreFilter").innerHTML = `<option value="all">All genres</option>${uniqueBy("genre").map((genre) => `<option>${escapeHtml(genre)}</option>`).join("")}`;
}

function renderCategories() {
  const artistList = [...artists.values()].sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name));
  const groups = [
    ...uniqueBy("genre").slice(0, 7).map((name) => ["Genre", name]),
    ...artistList.slice(0, 6).map((artist) => ["Artist", artist.name, artist.songCount]),
    ...uniqueBy("album").slice(0, 5).map((name) => ["Album", name])
  ];
  $("categoryStrip").innerHTML = groups.map(([type, name, count]) => `<button class="category-chip" data-category="${escapeHtml(name)}"><strong>${type}</strong><br>${escapeHtml(name)}${count ? ` . ${count}` : ""}</button>`).join("");
  $("categoryStrip").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    $("globalSearch").value = button.dataset.category;
    hideSearchSuggestions();
    applyFilters();
  }));
}

function viewFromHash() {
  const view = (location.hash || "#home").slice(1).split("?")[0];
  return ["home", "library", "favorites", "artists", "albums", "playlists", "search"].includes(view) ? view : "home";
}

function showView(view, updateHash = true) {
  activeView = view;
  document.body.dataset.view = view;
  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("active-view", section.id === view);
  });
  document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  $("sidebar").classList.remove("open");
  hideSearchSuggestions();
  document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "playlists") renderPlaylists();
  if (view === "albums") renderAlbums();
  if (view === "search") renderSearchResults($("globalSearch").value);
  if (updateHash && location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
}

function handleSearchInput() {
  applyFilters();
  renderSearchSuggestions();
}

function handleSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    openSearchPage($("globalSearch").value);
  }
  if (event.key === "Escape") hideSearchSuggestions();
}

function openSearchPage(query) {
  const term = query.trim();
  if (term) {
    const searches = [term, ...read(keys.searches, []).filter((item) => item !== term)].slice(0, 8);
    write(keys.searches, searches);
  }
  hideSearchSuggestions();
  showView("search");
  renderSearchResults(term);
}

function renderSearchSuggestions() {
  const term = $("globalSearch").value.trim();
  const menu = $("searchSuggestions");
  if (!term) {
    hideSearchSuggestions();
    return;
  }
  const suggestions = getSearchSuggestions(term);
  if (!suggestions.length) {
    hideSearchSuggestions();
    return;
  }
  menu.innerHTML = suggestions.map((item) => {
    const label = item.type === "artist" ? item.artist.name : item.song.title;
    const image = item.type === "artist" ? item.artist.image : item.song.cover;
    const meta = item.type === "artist" ? `${item.artist.songCount} song${item.artist.songCount === 1 ? "" : "s"}` : artistDisplay(item.song);
    return `<button class="suggestion-item" data-suggestion-type="${item.type}" data-suggestion-id="${item.id}" role="option">
      <img src="${image}" alt="">
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(meta)}</small></span>
      <small>${item.type === "artist" ? "Artist" : "Song"}</small>
    </button>`;
  }).join("");
  menu.classList.remove("hidden");
  menu.querySelectorAll("[data-suggestion-id]").forEach((button) => button.addEventListener("click", () => {
    const suggestion = suggestions.find((item) => item.id === button.dataset.suggestionId && item.type === button.dataset.suggestionType);
    if (!suggestion) return;
    $("globalSearch").value = suggestion.type === "artist" ? suggestion.artist.name : suggestion.song.title;
    openSearchPage($("globalSearch").value);
  }));
}

function hideSearchSuggestions() {
  $("searchSuggestions")?.classList.add("hidden");
}

function getSearchSuggestions(query) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const matchedSongs = songs
    .filter((song) => song.title.toLowerCase().includes(term) || artistDisplay(song).toLowerCase().includes(term))
    .sort((a, b) => searchRank(a.title, term) - searchRank(b.title, term) || a.title.localeCompare(b.title))
    .slice(0, 4)
    .map((song) => ({ type: "song", id: song.id, song }));
  const matchedArtists = [...artists.values()]
    .filter((artist) => artist.name.toLowerCase().includes(term) || artist.relatedSongs.some((song) => song.title.toLowerCase().includes(term)))
    .sort((a, b) => searchRank(a.name, term) - searchRank(b.name, term) || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((artist) => ({ type: "artist", id: artist.id, artist }));
  return [...matchedSongs, ...matchedArtists].slice(0, 5);
}

function searchRank(value, term) {
  const lower = String(value).toLowerCase();
  if (lower === term) return 0;
  if (lower.startsWith(term)) return 1;
  return lower.includes(term) ? 2 : 3;
}

function renderSearchResults(query) {
  const term = query.trim();
  $("searchTitle").textContent = term ? `Search results for "${term}"` : "Search results";
  const songMatches = term ? sortSongs(filterSongs(songs, term, "all"), "title") : [];
  const artistMatches = term ? getSearchArtists(term, songMatches) : [];
  const playlistMatches = term ? getSearchPlaylists(term) : [];
  const albumMatches = term ? getSearchAlbums(term, songMatches) : [];
  const topResult = getTopResult(term, songMatches, artistMatches, playlistMatches, albumMatches);

  $("searchTopResult").innerHTML = topResult ? topResultCard(topResult) : empty("Search your library", "Find local songs, artists, albums, and playlists.");
  bindTopResultActions($("searchTopResult"), topResult);

  $("searchSongs").innerHTML = songMatches.length ? renderSongRows(songMatches) : empty("No matching songs", "Try a song title, artist name, or partial match.");
  bindTrackActions($("searchSongs"));
  $("searchArtists").innerHTML = artistMatches.length ? artistMatches.map(artistCard).join("") : empty("No related artists");
  $("searchArtists").querySelectorAll("[data-artist-card]").forEach((button) => button.addEventListener("click", () => openArtist(button.dataset.artistCard)));
  $("searchPlaylistsPanel").classList.toggle("hidden", playlistMatches.length === 0);
  $("searchPlaylists").innerHTML = playlistMatches.map(playlistSearchCard).join("");
  $("searchPlaylists").querySelectorAll("[data-search-playlist]").forEach((button) => button.addEventListener("click", () => {
    playlists.selectedId = button.dataset.searchPlaylist;
    showView("playlists");
    renderPlaylists();
  }));
}

function getSearchArtists(query, songMatches) {
  const term = query.trim().toLowerCase();
  const songIds = new Set(songMatches.map((song) => song.id));
  return [...artists.values()]
    .filter((artist) => artist.name.toLowerCase().includes(term) || artist.relatedSongs.some((song) => songIds.has(song.id)))
    .sort((a, b) => searchRank(a.name, term) - searchRank(b.name, term) || a.name.localeCompare(b.name));
}

function getSearchPlaylists(query) {
  const term = query.trim().toLowerCase();
  return playlists.playlists
    .map((playlist) => ({ ...playlist, tracks: playlist.songIds.map(getSong).filter(Boolean) }))
    .filter((playlist) => playlist.name.toLowerCase().includes(term) || playlist.tracks.some((song) => song.searchText?.includes(term)));
}

function getSearchAlbums(query, songMatches) {
  const term = query.trim().toLowerCase();
  const songIds = new Set(songMatches.map((song) => song.id));
  return [...albums.values()]
    .filter((album) => album.name.toLowerCase().includes(term) || album.songs.some((song) => songIds.has(song.id)))
    .sort((a, b) => searchRank(a.name, term) - searchRank(b.name, term) || a.name.localeCompare(b.name));
}

function getTopResult(term, songMatches, artistMatches, playlistMatches, albumMatches) {
  if (!term) return null;
  if (songMatches.length) return { type: "song", item: songMatches[0] };
  if (artistMatches.length) return { type: "artist", item: artistMatches[0] };
  if (albumMatches.length) return { type: "album", item: albumMatches[0] };
  if (playlistMatches.length) return { type: "playlist", item: playlistMatches[0] };
  return null;
}

function topResultCard(result) {
  if (result.type === "song") {
    const song = result.item;
    return `<article class="top-result-card" data-top-type="song" data-top-id="${song.id}">
      <img src="${song.cover}" alt="${escapeHtml(song.album)} cover">
      <div>
        <span class="top-result-type">Song</span>
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(artistDisplay(song))}</p>
        <div class="top-result-actions">
          <button class="primary-button" data-top-action="play" type="button">Play</button>
          <button class="icon-button micro menu-trigger" data-top-action="menu" aria-label="More options for ${escapeHtml(song.title)}" title="More options" type="button">${icons.more}</button>
        </div>
      </div>
    </article>`;
  }
  if (result.type === "artist") {
    const artist = result.item;
    return `<article class="top-result-card" data-top-type="artist" data-top-id="${artist.id}">
      <img class="round-media" src="${artist.image}" alt="${escapeHtml(artist.name)}">
      <div>
        <span class="top-result-type">Artist</span>
        <h3>${escapeHtml(artist.name)}</h3>
        <p>${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</p>
        <div class="top-result-actions">
          <button class="primary-button" data-top-action="open" type="button">Open</button>
        </div>
      </div>
    </article>`;
  }
  if (result.type === "album") {
    const album = result.item;
    return `<article class="top-result-card" data-top-type="album" data-top-id="${album.id}">
      <img src="${album.cover}" alt="${escapeHtml(album.name)} cover">
      <div>
        <span class="top-result-type">Album</span>
        <h3>${escapeHtml(album.name)}</h3>
        <p>${escapeHtml(album.artistText)} . ${album.songCount} song${album.songCount === 1 ? "" : "s"}</p>
        <div class="top-result-actions">
          <button class="primary-button" data-top-action="open" type="button">Open</button>
        </div>
      </div>
    </article>`;
  }
  const playlist = result.item;
  const tracks = playlist.tracks || playlist.songIds.map(getSong).filter(Boolean);
  const cover = tracks[0]?.cover || "https://picsum.photos/seed/nospotify-playlist/240/240";
  return `<article class="top-result-card" data-top-type="playlist" data-top-id="${playlist.id}">
    <img src="${cover}" alt="">
    <div>
      <span class="top-result-type">Playlist</span>
      <h3>${escapeHtml(playlist.name)}</h3>
      <p>${tracks.length} song${tracks.length === 1 ? "" : "s"}</p>
      <div class="top-result-actions">
        <button class="primary-button" data-top-action="open" type="button">Open</button>
      </div>
    </div>
  </article>`;
}

function bindTopResultActions(root, result) {
  if (!root || !result) return;
  root.querySelectorAll("[data-top-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = button.dataset.topAction;
    if (result.type === "song") {
      const song = result.item;
      if (action === "play") player.load(song.id);
      if (action === "menu") openItemMenu(event, { type: "song", id: song.id, source: "top-result" });
      return;
    }
    if (result.type === "artist") openArtist(result.item.id);
    if (result.type === "album") openAlbum(result.item.id);
    if (result.type === "playlist") {
      playlists.selectedId = result.item.id;
      showView("playlists");
      renderPlaylists();
    }
  }));
}

function applyFilters() {
  const query = $("globalSearch").value;
  filtered = sortSongs(filterSongs(songs, query, $("genreFilter").value), $("sortSelect").value);
  renderSongs();
  if (activeView === "search") renderSearchResults(query);
}

function renderSongs() {
  const grid = $("songGrid");
  grid.className = `song-grid ${viewMode === "list" ? "list-mode" : ""}`;
  grid.innerHTML = filtered.map(songCard).join("");
  bindSongActions(grid);
  $("emptyState").classList.toggle("hidden", filtered.length > 0);
}

function songCard(song) {
  const isLiked = favorites.includes(song.id);
  const liked = isLiked ? "liked" : "";
  const artistLinks = song.artists.map((artist, index) => `<button class="artist-link" data-action="artist" data-artist-id="${song.artistIds[index]}">${escapeHtml(artist)}</button>`).join(" . ");
  return `
    <article class="song-card" data-song-id="${song.id}" draggable="true">
      <button class="icon-button micro menu-trigger song-menu-button" data-action="menu" aria-label="More options for ${escapeHtml(song.title)}" title="More options" type="button">${icons.more}</button>
      <div class="cover-wrap">
        <img src="${song.cover}" alt="${escapeHtml(song.album)} cover">
        <button class="play-overlay" data-action="play" aria-label="Play ${escapeHtml(song.title)}" type="button">Play</button>
      </div>
      <div class="song-meta">
        <h3>${escapeHtml(song.title)}</h3>
        <p>${artistLinks} . ${escapeHtml(song.album)}</p>
        <p>${escapeHtml(song.genre)}</p>
      </div>
      <div class="card-actions">
        <button class="heart-button ${liked}" data-action="like" aria-label="${isLiked ? "Remove from favorites" : "Like"} ${escapeHtml(song.title)}" aria-pressed="${isLiked}" type="button">${icons.heart}</button>
        <button class="tiny-button" data-action="queue" type="button">Queue</button>
        <button class="tiny-button" data-action="next" type="button">Play Next</button>
      </div>
    </article>`;
}

function bindSongActions(root) {
  root.querySelectorAll(".song-card").forEach((card) => {
    const id = card.dataset.songId;
    card.addEventListener("dragstart", () => card.classList.add("dragging"));
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "play") player.load(id);
      if (action === "like") toggleFavorite(id);
      if (action === "queue") queue.add(id);
      if (action === "next") queue.add(id, true);
      if (action === "menu") openItemMenu(event, { type: "song", id });
      if (action === "artist") openArtist(event.target.dataset.artistId);
    });
  });
}

function renderFavorites() {
  const liked = songs.filter((song) => favorites.includes(song.id));
  $("favoritesGrid").innerHTML = liked.length ? renderSongRows(sortSongs(liked, "title")) : empty("No favorites yet", "Like songs to collect them here.");
  bindTrackActions($("favoritesGrid"));
}

function renderArtists() {
  const sorted = [...artists.values()].sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name));
  $("artistGrid").innerHTML = sorted.map(artistCard).join("");
  $("artistGrid").querySelectorAll("[data-artist-card]").forEach((button) => button.addEventListener("click", () => openArtist(button.dataset.artistCard)));
}

function artistCard(artist) {
  return `<button class="artist-card" data-artist-card="${artist.id}">
    <img src="${artist.image}" alt="${escapeHtml(artist.name)}">
    <strong>${escapeHtml(artist.name)}</strong>
    <span>${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</span>
  </button>`;
}

function openArtist(artistId) {
  const artist = artists.get(artistId);
  if (!artist) return;
  const profile = $("artistProfile");
  const isFollowing = followedArtists.includes(artist.id);
  const popularSongs = sortSongs(artist.relatedSongs, "trending").slice(0, 5);
  const allSongs = sortSongs(artist.relatedSongs, "title");
  profile.classList.remove("hidden");
  profile.innerHTML = `
    <div class="detail-hero artist artist-banner" style="--artist-banner: url('${artist.image}')">
      <img src="${artist.image}" alt="${escapeHtml(artist.name)}">
      <div class="artist-profile-copy">
        <p class="eyebrow">Artist</p>
        <h1>${escapeHtml(artist.name)}</h1>
        <p class="detail-meta">${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</p>
        <button class="secondary-button follow-artist-button ${isFollowing ? "following" : ""}" data-follow-artist="${artist.id}" type="button">${isFollowing ? "Following" : "Follow"}</button>
      </div>
    </div>
    <section class="artist-song-section">
      <div class="section-head compact-head artist-song-head">
        <div>
          <p class="eyebrow">Artist Picks</p>
          <h2>Popular Songs</h2>
        </div>
      </div>
      <div class="track-table artist-song-list">${renderSongRows(popularSongs)}</div>
    </section>
    <section class="artist-song-section">
      <div class="section-head compact-head artist-song-head">
        <div>
          <p class="eyebrow">Discography</p>
          <h2>All Songs</h2>
        </div>
      </div>
      <div class="track-table artist-song-list">${renderSongRows(allSongs)}</div>
    </section>`;
  bindTrackActions(profile);
  profile.querySelector("[data-follow-artist]")?.addEventListener("click", () => toggleFollowArtist(artist.id));
  showView("artists");
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildAlbumRegistry(songList = songs) {
  const registry = new Map();
  songList.forEach((song) => {
    const id = albumId(song.album);
    if (!registry.has(id)) {
      registry.set(id, {
        id,
        name: song.album,
        cover: song.cover,
        songs: [],
        artistNames: new Set(),
        duration: 0
      });
    }
    const album = registry.get(id);
    album.songs.push(song);
    album.duration += durationOf(song);
    song.artists.forEach((artist) => album.artistNames.add(artist));
  });
  return new Map([...registry].map(([id, album]) => {
    const artistNames = [...album.artistNames];
    return [id, {
      ...album,
      artistNames,
      artistText: artistNames.slice(0, 3).join(" . ") || "Various Artists",
      songCount: album.songs.length
    }];
  }));
}

function albumId(name) {
  return slugify(name) || "album";
}

function renderAlbums() {
  const sorted = [...albums.values()].sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name));
  $("albumGrid").innerHTML = sorted.map(albumCard).join("");
  $("albumGrid").querySelectorAll("[data-album-card]").forEach((button) => button.addEventListener("click", () => openAlbum(button.dataset.albumCard)));
}

function albumCard(album) {
  return `<button class="album-card" data-album-card="${album.id}">
    <img src="${album.cover}" alt="${escapeHtml(album.name)} cover">
    <h3>${escapeHtml(album.name)}</h3>
    <p>${escapeHtml(album.artistText)}</p>
    <p>${album.songCount} song${album.songCount === 1 ? "" : "s"}</p>
  </button>`;
}

function openAlbum(albumIdValue) {
  const album = albums.get(albumIdValue);
  if (!album) return;
  const profile = $("albumProfile");
  const tracks = sortSongs(album.songs, "title");
  profile.classList.remove("hidden");
  profile.innerHTML = `
    <div class="detail-hero album-detail-hero">
      <img src="${album.cover}" alt="${escapeHtml(album.name)} cover">
      <div>
        <p class="eyebrow">Album</p>
        <h1>${escapeHtml(album.name)}</h1>
        <p class="detail-meta">${escapeHtml(album.artistText)} . ${album.songCount} song${album.songCount === 1 ? "" : "s"} . ${formatLongDuration(album.duration)}</p>
      </div>
    </div>
    <div class="track-table album-track-table">${renderSongRows(tracks)}</div>`;
  bindTrackActions(profile);
  showView("albums");
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleFollowArtist(artistId) {
  const artist = artists.get(artistId);
  if (!artist) return;
  const isFollowing = followedArtists.includes(artistId);
  followedArtists = isFollowing ? followedArtists.filter((id) => id !== artistId) : [...followedArtists, artistId];
  write(keys.followedArtists, followedArtists);
  const button = document.querySelector(`[data-follow-artist="${artistId}"]`);
  if (button) {
    button.textContent = isFollowing ? "Follow" : "Following";
    button.classList.toggle("following", !isFollowing);
  }
  renderPlaylists();
  toast(isFollowing ? `Unfollowed ${artist.name}` : `Following ${artist.name}`);
}

function renderTrending() {
  $("trendingGrid").innerHTML = sortSongs(songs, "trending").slice(0, 8).map(songCard).join("");
  bindSongActions($("trendingGrid"));
}

function renderRecent() {
  const items = recent.map(getSong).filter(Boolean);
  $("recentGrid").innerHTML = items.length ? items.map(songCard).join("") : empty("No plays yet", "Start a song and it will appear here.");
  bindSongActions($("recentGrid"));
}

function renderQueue() {
  const items = queue.items.map(getSong).filter(Boolean);
  const [nextSong, ...remaining] = items;
  $("queueCurrent").innerHTML = player.current ? queueItem(player.current, null, "current") : empty("Nothing playing", "Choose a track to start listening.");
  $("queueNext").innerHTML = nextSong ? queueItem(nextSong, 0, "next") : empty("No song queued", "Add a song or use Play Next from any track.");
  $("queueRemaining").innerHTML = remaining.length ? remaining.map((song, index) => queueItem(song, index + 1, "remaining")).join("") : empty("No remaining songs");
  $("queueToggle").dataset.count = queue.items.length ? String(queue.items.length) : "";
  $("queueToggle").classList.toggle("has-items", queue.items.length > 0);
  $("queueDrawer").querySelectorAll(".queue-item").forEach((item) => {
    if (item.dataset.index !== undefined) {
      item.addEventListener("dragstart", () => {
        draggedQueueIndex = Number(item.dataset.index);
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item.addEventListener("dragover", (event) => event.preventDefault());
      item.addEventListener("drop", () => queue.reorder(draggedQueueIndex, Number(item.dataset.index)));
    }
    item.querySelector("[data-remove]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      queue.remove(item.dataset.id);
    });
    item.querySelector("[data-queue-action='menu']")?.addEventListener("click", (event) => openItemMenu(event, { type: "song", id: item.dataset.id, source: "queue" }));
  });
}

function queueItem(song, index, state = "remaining") {
  const draggable = index === null ? "false" : "true";
  const indexAttr = index === null ? "" : `data-index="${index}"`;
  const marker = state === "next" ? `<span class="queue-next-badge">Plays next</span>` : "";
  const remove = state === "current" ? "" : `<button class="icon-button micro" data-remove aria-label="Remove ${escapeHtml(song.title)}" title="Remove" type="button">${icons.close}</button>`;
  const handle = index === null ? "" : `<span class="drag-handle" aria-hidden="true">${icons.grip}</span>`;
  return `<div class="queue-item queue-item-${state}" data-id="${song.id}" ${indexAttr} draggable="${draggable}">
    <img src="${song.cover}" alt="">
    <div><strong>${escapeHtml(song.title)}</strong><p>${escapeHtml(artistDisplay(song))}</p>${marker}</div>
    <div class="queue-actions">
      ${handle}
      ${remove}
      <button class="icon-button micro menu-trigger queue-menu-button" data-queue-action="menu" aria-label="More options for ${escapeHtml(song.title)}" title="More options" type="button">${icons.more}</button>
    </div>
  </div>`;
}

function renderPlaylists() {
  const followedArtistList = followedArtists.map((id) => artists.get(id)).filter(Boolean);
  const suggestedArtists = [...artists.values()].sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name)).slice(0, 6);
  const libraryArtists = followedArtistList.length ? followedArtistList : suggestedArtists;
  const createdPlaylists = playlists.playlists.filter((playlist) => playlist.created);
  $("playlistList").innerHTML = `
    ${playlistNavGroup("Saved playlists", playlists.playlists)}
    <div class="playlist-nav-group">
      <p class="queue-label">${followedArtistList.length ? "Followed artists" : "Suggested artists"}</p>
      ${libraryArtists.length ? libraryArtists.map((artist) => `<button class="playlist-item artist-library-item" data-artist-card="${artist.id}">
        <img src="${artist.image}" alt="">
        <span><strong>${escapeHtml(artist.name)}</strong><br><small>Artist . ${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</small></span>
      </button>`).join("") : empty("No followed artists")}
    </div>
    ${playlistNavGroup("Created playlists", createdPlaylists, "No created playlists yet")}
  `;
  document.querySelectorAll("[data-select-playlist]").forEach((button) => button.addEventListener("click", () => {
    playlists.selectedId = button.dataset.selectPlaylist;
    showView("playlists");
    renderPlaylists();
  }));
  $("playlistList").querySelectorAll("[data-artist-card]").forEach((button) => button.addEventListener("click", () => openArtist(button.dataset.artistCard)));
  renderPlaylistDetail();
}

function playlistNavGroup(title, list, emptyTitle = "No playlists") {
  return `<div class="playlist-nav-group">
    <p class="queue-label">${escapeHtml(title)}</p>
    ${list.length ? list.map((pl) => {
      const tracks = pl.songIds.map(getSong).filter(Boolean);
      const first = tracks[0];
      return `<button class="playlist-item ${pl.id === playlists.selectedId ? "active" : ""}" data-select-playlist="${pl.id}">
        <img src="${first?.cover || "https://picsum.photos/seed/nospotify-playlist/120/120"}" alt="">
        <span><strong>${escapeHtml(pl.name)}</strong><br><small>Playlist . ${tracks.length} song${tracks.length === 1 ? "" : "s"}</small></span>
      </button>`;
    }).join("") : empty(emptyTitle)}
  </div>`;
}

function renderPlaylistDetail() {
  const playlist = playlists.get();
  if (!playlist) {
    $("playlistDetail").innerHTML = empty("Select a playlist");
    return;
  }
  const tracks = playlist.songIds.map(getSong).filter(Boolean);
  const cover = tracks[0]?.cover || "https://picsum.photos/seed/nospotify-playlist/480/480";
  const totalDuration = tracks.reduce((sum, song) => sum + durationOf(song), 0);
  $("playlistDetail").innerHTML = `
    <div class="detail-hero playlist-hero">
      <img src="${cover}" alt="">
      <div>
        <p class="eyebrow">Playlist</p>
        <h1>${escapeHtml(playlist.name)}</h1>
        <p class="detail-meta">${tracks.length} song${tracks.length === 1 ? "" : "s"} . ${formatLongDuration(totalDuration)}</p>
      </div>
    </div>
    <div class="detail-actions">
      <button class="primary-button" data-playlist-play="${playlist.id}" type="button">Play</button>
      <div class="control-row">
        <button class="secondary-button" id="renamePlaylist">Rename</button>
        <button class="secondary-button" id="deletePlaylist">Delete</button>
      </div>
    </div>
    <div class="track-table playlist-track-table" data-playlist-drop="${playlist.id}">
      ${tracks.length ? renderSongRows(tracks, { removable: true, playlistId: playlist.id }) : empty("Drop songs here", "Drag library songs into this playlist or use More.")}
    </div>`;
  $("playlistDetail").querySelector("[data-playlist-play]")?.addEventListener("click", () => {
    const first = tracks[0];
    if (first) player.load(first.id);
  });
  $("renamePlaylist").addEventListener("click", () => openRenamePlaylist(playlist.id));
  $("deletePlaylist").addEventListener("click", () => playlists.delete(playlist.id));
  bindTrackActions($("playlistDetail"), playlist.id);
  const dropZone = $("playlistDetail").querySelector("[data-playlist-drop]");
  dropZone.addEventListener("dragover", (event) => event.preventDefault());
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    const card = document.querySelector(".song-card.dragging");
    const songId = card?.dataset.songId || draggedPlaylist?.songId;
    if (songId) playlists.addSong(playlist.id, songId);
  });
}

function playlistSearchCard(playlist) {
  const tracks = playlist.tracks || playlist.songIds.map(getSong).filter(Boolean);
  const cover = tracks[0]?.cover || "https://picsum.photos/seed/nospotify-playlist/240/240";
  return `<button class="playlist-search-card" data-search-playlist="${playlist.id}">
    <img src="${cover}" alt="">
    <span><strong>${escapeHtml(playlist.name)}</strong><small>${tracks.length} song${tracks.length === 1 ? "" : "s"}</small></span>
  </button>`;
}

function renderSongRows(tracks, options = {}) {
  return `<div class="track-row header">
    <span>#</span>
    <span>Title</span>
    <span class="track-album">Album</span>
    <span class="track-time">Duration</span>
    <span></span>
  </div>
  ${tracks.map((song, index) => songRow(song, index, options)).join("")}`;
}

function renderTrackTable(tracks, options = {}) {
  return renderSongRows(tracks, options);
}

function songRow(song, index, options = {}) {
  const active = player.current?.id === song.id ? "active" : "";
  const removeButton = options.removable ? `<button class="icon-button micro" data-track-action="remove" aria-label="Remove ${escapeHtml(song.title)}" title="Remove">${icons.close}</button>` : "";
  const queueButton = options.queueable ? `<button class="icon-button micro" data-track-action="queue" aria-label="Add ${escapeHtml(song.title)} to queue" title="Add to queue">${icons.queue}</button>` : "";
  const isLiked = favorites.includes(song.id);
  const likeButton = options.likeable === false ? "" : `<button class="heart-button micro ${isLiked ? "liked" : ""}" data-track-action="like" aria-label="${isLiked ? "Remove from favorites" : "Like"} ${escapeHtml(song.title)}" aria-pressed="${isLiked}" title="${isLiked ? "Remove from favorites" : "Like"}" type="button">${icons.heart}</button>`;
  const menuButton = `<button class="icon-button micro menu-trigger track-menu-button" data-track-action="menu" aria-label="More options for ${escapeHtml(song.title)}" title="More options" type="button">${icons.more}</button>`;
  return `<div class="track-row song-row-item ${active}" data-track-song="${song.id}" data-song-id="${song.id}" data-playlist-id="${options.playlistId || ""}" draggable="true">
    <span class="track-number">${index + 1}</span>
    <button class="track-title" data-track-action="play" type="button">
      <img src="${song.cover}" alt="">
      <span><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(artistDisplay(song))}</small></span>
    </button>
    <span class="track-album">${escapeHtml(song.album)}</span>
    <span class="track-time">${format(durationOf(song))}</span>
    <span class="track-actions">${queueButton}${likeButton}${removeButton}${menuButton}</span>
  </div>`;
}

function bindTrackActions(root, playlistId = null) {
  root.querySelectorAll("[data-track-song]").forEach((row) => {
    row.addEventListener("dragstart", () => {
      draggedPlaylist = { songId: row.dataset.trackSong };
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      draggedPlaylist = null;
      row.classList.remove("dragging");
    });
  });
  root.querySelectorAll("[data-track-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const row = button.closest("[data-track-song]");
    const songId = row?.dataset.trackSong;
    if (!songId) return;
    if (button.dataset.trackAction === "menu") {
      openItemMenu(event, { type: "song", id: songId, source: "track", playlistId: playlistId || row.dataset.playlistId || null });
      return;
    }
    if (button.dataset.trackAction === "play") player.load(songId);
    if (button.dataset.trackAction === "queue") queue.add(songId);
    if (button.dataset.trackAction === "like") toggleFavorite(songId);
    if (button.dataset.trackAction === "remove") playlists.removeSong(playlistId || row.dataset.playlistId, songId);
  }));
}

function openItemMenu(event, item) {
  event.stopPropagation();
  const trigger = event.target.closest(".menu-trigger") || event.currentTarget;
  const fallbackRect = {
    left: event.clientX,
    right: event.clientX,
    top: event.clientY,
    bottom: event.clientY
  };
  contextMenuState = {
    item,
    anchorRect: trigger?.getBoundingClientRect ? trigger.getBoundingClientRect() : fallbackRect
  };
  renderContextMenu(menuOptionsForItem(item));
}

function menuOptionsForItem(item) {
  if (item.type === "song") return songMenuOptions(item.id);
  if (item.type === "artist") return [{ label: "View Artist", command: "view-artist" }];
  if (item.type === "playlist") return [{ label: "View Playlist", command: "view-playlist" }];
  if (item.type === "album") return [{ label: "View Album", command: "view-album" }];
  return [];
}

function songMenuOptions(songId) {
  const song = getSong(songId);
  if (!song) return [];
  return [
    { label: "Add to Playlist", command: "playlist-picker" },
    { label: "Add to Queue", command: "queue" },
    { label: "Go to Artist", command: "artist" },
    { label: "Go to Album", command: "album" },
    { label: favorites.includes(songId) ? "Remove From Favorites" : "Like Song", command: "favorite" },
    { label: "Copy Song Name", command: "copy" },
    { label: "View Song Details", command: "details" }
  ];
}

function renderContextMenu(options, title = "") {
  const menu = $("contextMenu");
  clearTimeout(contextMenuCloseTimer);
  menu.classList.remove("hidden", "closing");
  menu.innerHTML = `
    ${title ? `<div class="context-menu-title">${escapeHtml(title)}</div>` : ""}
    ${options.length ? options.map(menuOption).join("") : `<div class="context-menu-empty">No actions available</div>`}`;
  positionContextMenu();
  menu.querySelectorAll("[data-menu-cmd]").forEach((button) => button.addEventListener("click", () => {
    runContextCommand(button.dataset.menuCmd, contextMenuState?.item);
  }));
}

function menuOption(option) {
  const meta = option.meta ? `<small>${escapeHtml(option.meta)}</small>` : "";
  return `<button class="context-menu-item" data-menu-cmd="${option.command}" type="button" ${option.disabled ? "disabled" : ""}>
    <span>${escapeHtml(option.label)}</span>${meta}
  </button>`;
}

function positionContextMenu() {
  const menu = $("contextMenu");
  const anchor = contextMenuState?.anchorRect || { left: 12, right: 12, top: 12, bottom: 12 };
  const margin = 8;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  let left = anchor.right - rect.width;
  if (left < margin) left = anchor.left;
  let top = anchor.bottom + 8;
  if (top + rect.height > window.innerHeight - margin) top = anchor.top - rect.height - 8;
  menu.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
  menu.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
}

function runContextCommand(command, item) {
  if (!item) return closeContextMenu();
  if (command === "playlist-picker") {
    renderPlaylistPicker(item.id);
    return;
  }
  if (item.type === "artist" && command === "view-artist") {
    closeContextMenu();
    openArtist(item.id);
    return;
  }
  if (item.type === "playlist" && command === "view-playlist") {
    closeContextMenu();
    playlists.selectedId = item.id;
    showView("playlists");
    renderPlaylists();
    return;
  }
  if (item.type === "album" && command === "view-album") {
    closeContextMenu();
    openAlbum(item.id);
    return;
  }
  if (item.type !== "song") return closeContextMenu();
  const song = getSong(item.id);
  if (!song) return closeContextMenu();
  closeContextMenu();
  if (command === "queue") queue.add(song.id);
  if (command === "artist") openArtist(song.artistIds[0]);
  if (command === "album") openAlbum(albumId(song.album));
  if (command === "favorite") toggleFavorite(song.id);
  if (command === "copy") copySongName(song);
  if (command === "details") showSongDetails(song);
}

function renderPlaylistPicker(songId) {
  const menu = $("contextMenu");
  const playlistOptions = playlists.playlists.map((playlist) => {
    const count = playlist.songIds.length;
    return `<button class="context-menu-item playlist-choice" data-playlist-id="${playlist.id}" type="button">
      <span>${escapeHtml(playlist.name)}</span><small>${count} song${count === 1 ? "" : "s"}</small>
    </button>`;
  }).join("");
  clearTimeout(contextMenuCloseTimer);
  menu.classList.remove("hidden", "closing");
  menu.innerHTML = `
    <div class="context-menu-header">
      <button class="context-back-button" data-menu-cmd="back" type="button">Back</button>
      <span>Your Playlists</span>
    </div>
    ${playlistOptions || `<div class="context-menu-empty">No playlists yet</div>`}`;
  positionContextMenu();
  menu.querySelector("[data-menu-cmd='back']")?.addEventListener("click", () => renderContextMenu(menuOptionsForItem({ type: "song", id: songId })));
  menu.querySelectorAll("[data-playlist-id]").forEach((button) => button.addEventListener("click", () => {
    addSongToPlaylist(button.dataset.playlistId, songId);
    closeContextMenu();
  }));
}

function addSongToPlaylist(playlistId, songId) {
  const playlist = playlists.get(playlistId);
  if (!playlist) return;
  const alreadyAdded = playlist.songIds.includes(songId);
  if (!alreadyAdded) {
    playlist.songIds.push(songId);
    playlists.save(false);
  }
  toast(alreadyAdded ? `Song is already in ${playlist.name}` : `Song added to ${playlist.name}`);
}

function closeContextMenu() {
  const menu = $("contextMenu");
  if (!menu || menu.classList.contains("hidden")) return;
  menu.classList.add("closing");
  contextMenuState = null;
  clearTimeout(contextMenuCloseTimer);
  contextMenuCloseTimer = setTimeout(() => {
    menu.classList.add("hidden");
    menu.classList.remove("closing");
    menu.innerHTML = "";
  }, 120);
}

function copySongName(song) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(song.title).then(() => toast("Song name copied")).catch(() => copyTextFallback(song.title));
    return;
  }
  copyTextFallback(song.title);
}

function copyTextFallback(value) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.focus();
  field.select();
  const success = document.execCommand("copy");
  field.remove();
  toast(success ? "Song name copied" : "Could not copy song name");
}

function showSongDetails(song) {
  const modal = $("songDetailsModal");
  const body = $("songDetailsBody");
  if (!modal || !body) {
    toast(`${song.title} by ${artistDisplay(song)}`);
    return;
  }
  body.innerHTML = `
    <div class="song-details-head">
      <img src="${song.cover}" alt="">
      <div>
        <p class="eyebrow">Song details</p>
        <h2>${escapeHtml(song.title)}</h2>
        <p>${escapeHtml(artistDisplay(song))}</p>
      </div>
    </div>
    <dl class="song-details-list">
      <div><dt>Album</dt><dd>${escapeHtml(song.album)}</dd></div>
      <div><dt>Genre</dt><dd>${escapeHtml(song.genre)}</dd></div>
      <div><dt>Duration</dt><dd>${format(durationOf(song))}</dd></div>
      <div><dt>Status</dt><dd>${favorites.includes(song.id) ? "Liked" : "Not liked"}</dd></div>
    </dl>`;
  if (modal.open) modal.close();
  modal.showModal();
}

function toggleFavorite(id) {
  favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
  write(keys.favorites, favorites);
  toast(favorites.includes(id) ? "Added to favorites" : "Removed from favorites");
  renderAll();
  syncFavoriteButtons();
}

function addRecent(id) {
  recent = [id, ...recent.filter((item) => item !== id)].slice(0, 12);
  write(keys.recent, recent);
  renderRecent();
}

function renderPlayer(song) {
  renderTransportIcons();
  syncPlayingRows();
  if (!song) {
    renderQueue();
    return;
  }
  $("playerCover").src = song.cover;
  $("playerTitle").textContent = song.title;
  $("playerArtist").textContent = artistDisplay(song);
  $("likeCurrent").classList.toggle("liked", favorites.includes(song.id));
  $("likeCurrent").setAttribute("aria-pressed", String(favorites.includes(song.id)));
  $("lyricsTitle").textContent = song.title;
  $("lyricsText").textContent = song.lyrics || "Lyrics are not available for this track.";
  $("volumeSlider").value = audio.volume;
  renderQueue();
}

function syncFavoriteButtons() {
  document.querySelectorAll("[data-track-action='like']").forEach((button) => {
    const songId = button.closest("[data-track-song]")?.dataset.trackSong;
    const song = getSong(songId);
    const isLiked = favorites.includes(songId);
    button.classList.toggle("liked", isLiked);
    button.setAttribute("aria-pressed", String(isLiked));
    if (song) button.setAttribute("aria-label", `${isLiked ? "Remove from favorites" : "Like"} ${song.title}`);
    button.title = isLiked ? "Remove from favorites" : "Like";
  });
  document.querySelectorAll(".song-card [data-action='like']").forEach((button) => {
    const songId = button.closest("[data-song-id]")?.dataset.songId;
    const song = getSong(songId);
    const isLiked = favorites.includes(songId);
    button.classList.toggle("liked", isLiked);
    button.setAttribute("aria-pressed", String(isLiked));
    if (song) button.setAttribute("aria-label", `${isLiked ? "Remove from favorites" : "Like"} ${song.title}`);
  });
  $("likeCurrent")?.classList.toggle("liked", Boolean(player.current && favorites.includes(player.current.id)));
}

function syncPlayingRows() {
  document.querySelectorAll("[data-track-song]").forEach((row) => {
    row.classList.toggle("active", player.current?.id === row.dataset.trackSong);
  });
}

function updateProgress() {
  $("currentTime").textContent = format(audio.currentTime);
  $("duration").textContent = Number.isFinite(audio.duration) ? format(audio.duration) : "0:00";
  $("progressBar").value = audio.duration ? String((audio.currentTime / audio.duration) * 1000) : "0";
  renderTransportIcons();
}

function format(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function durationOf(song) {
  return Number(song?.duration || 0);
}

function formatLongDuration(seconds = 0) {
  if (!seconds) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours) return `${hours} hr ${mins} min`;
  return `${mins} min`;
}

function setQueueOpen(open) {
  $("queueDrawer").classList.toggle("open", open);
  $("queueDrawer").setAttribute("aria-hidden", open ? "false" : "true");
  $("queueBackdrop").classList.toggle("hidden", !open);
  $("queueToggle").classList.toggle("active", open);
  if (open) renderQueue();
}

function setIcon(button, iconName, label) {
  if (!button) return;
  button.innerHTML = icons[iconName] || "";
  button.setAttribute("aria-label", label);
  button.title = label;
}

function renderTransportIcons() {
  setIcon($("shuffleBtn"), "shuffle", "Shuffle");
  setIcon($("prevBtn"), "previous", "Previous track");
  setIcon($("playPauseBtn"), audio.paused ? "play" : "pause", audio.paused ? "Play" : "Pause");
  setIcon($("nextBtn"), "next", "Next track");
  setIcon($("repeatBtn"), player?.repeat === "one" ? "repeatOne" : "repeat", player?.repeat === "one" ? "Repeat one" : "Repeat");
  setIcon($("muteBtn"), audio.muted || audio.volume === 0 ? "muted" : "volume", audio.muted || audio.volume === 0 ? "Unmute" : "Mute");
  setIcon($("queueToggle"), "queue", queue.items.length ? `Open queue, ${queue.items.length} song${queue.items.length === 1 ? "" : "s"} queued` : "Open queue");
  setIcon($("closeQueueDrawer"), "close", "Close queue");
  setIcon($("likeCurrent"), "heart", "Like current song");
  $("shuffleBtn")?.classList.toggle("active", Boolean(player?.shuffle));
  $("repeatBtn")?.classList.toggle("active", Boolean(player?.repeat && player.repeat !== "off"));
}

function toggleMute() {
  audio.muted = !audio.muted;
  renderPlayer(player.current);
}

function handleKeys(event) {
  if (event.key === "Escape") {
    closeContextMenu();
    setQueueOpen(false);
    hideSearchSuggestions();
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); player.toggle(); }
  if (event.code === "ArrowRight") audio.currentTime = Math.min((audio.duration || 0), audio.currentTime + 5);
  if (event.code === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
  if (event.key.toLowerCase() === "m") toggleMute();
  if (event.code === "ArrowUp") { event.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.05); renderPlayer(player.current); }
  if (event.code === "ArrowDown") { event.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.05); renderPlayer(player.current); }
}

function openCreatePlaylist() {
  $("playlistModalTitle").textContent = "Create playlist";
  $("playlistNameInput").value = "";
  $("playlistModal").dataset.mode = "create";
  $("playlistModal").showModal();
}

function openRenamePlaylist(id) {
  $("playlistModalTitle").textContent = "Rename playlist";
  $("playlistNameInput").value = playlists.get(id)?.name || "";
  $("playlistModal").dataset.mode = "rename";
  $("playlistModal").dataset.id = id;
  $("playlistModal").showModal();
}

function savePlaylistFromModal(event) {
  event.preventDefault();
  const name = $("playlistNameInput").value.trim() || "Untitled Playlist";
  if ($("playlistModal").dataset.mode === "rename") playlists.rename($("playlistModal").dataset.id, name);
  else playlists.create(name);
  $("playlistModal").close();
}

function empty(title, body = "") {
  return `<div class="empty-state"><h3>${escapeHtml(title)}</h3>${body ? `<p>${escapeHtml(body)}</p>` : ""}</div>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();
