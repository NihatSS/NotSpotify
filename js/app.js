import { keys, read, write, setTheme, toast, currentUser } from "./storage.js";
import { artistDisplay, buildArtistRegistry, getLibrary, getSong, loadAssetSongs, sortSongs, uniqueBy } from "./library.js";
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
let draggedQueueIndex = null;
let draggedPlaylist = null;
let artists = buildArtistRegistry(songs);

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

async function init() {
  setTheme(read(keys.theme, "dark"));
  renderSkeletons();
  renderUser();
  bindEvents();
  await loadAssetSongs();
  setTimeout(() => {
    $("loadingSkeleton").classList.add("hidden");
    renderAll();
  }, 520);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function bindEvents() {
  $("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("themeToggle").addEventListener("click", () => setTheme(document.body.classList.contains("light-theme") ? "dark" : "light"));
  $("globalSearch").addEventListener("input", applyFilters);
  $("genreFilter").addEventListener("change", applyFilters);
  $("clearSearch").addEventListener("click", () => {
    $("globalSearch").value = "";
    $("genreFilter").value = "all";
    applyFilters();
  });
  $("sortSelect").addEventListener("change", applyFilters);
  document.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => {
    viewMode = button.dataset.viewMode;
    document.querySelectorAll("[data-view-mode]").forEach((item) => item.classList.toggle("active", item === button));
    renderSongs();
  }));
  document.querySelectorAll(".nav-link[data-view]").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
    document.querySelector(link.getAttribute("href"))?.scrollIntoView();
    $("sidebar").classList.remove("open");
  }));
  $("playTrending").addEventListener("click", () => {
    const first = sortSongs(songs, "trending")[0];
    if (first) player.load(first.id);
  });
  $("createPlaylistHero").addEventListener("click", openCreatePlaylist);
  $("newPlaylist").addEventListener("click", openCreatePlaylist);
  $("savePlaylistName").addEventListener("click", savePlaylistFromModal);
  $("clearQueue").addEventListener("click", () => queue.clear());
  $("playPauseBtn").addEventListener("click", () => player.toggle());
  $("nextBtn").addEventListener("click", () => player.next());
  $("prevBtn").addEventListener("click", () => player.previous());
  $("shuffleBtn").addEventListener("click", (event) => {
    player.shuffle = !player.shuffle;
    event.currentTarget.classList.toggle("active", player.shuffle);
    toast(player.shuffle ? "Shuffle on" : "Shuffle off");
  });
  $("repeatBtn").addEventListener("click", (event) => {
    const mode = player.toggleRepeat();
    event.currentTarget.classList.toggle("active", mode !== "off");
    event.currentTarget.textContent = mode === "one" ? "R1" : "Rep";
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
  document.addEventListener("click", () => $("contextMenu").classList.add("hidden"));
}

function renderAll() {
  songs = getLibrary();
  artists = buildArtistRegistry(songs);
  hydrateDefaultPlaylists();
  player.setSongs(songs);
  renderFilters();
  renderCategories();
  applyFilters();
  renderFavorites();
  renderArtists();
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
    applyFilters();
  }));
}

function applyFilters() {
  const query = $("globalSearch").value;
  if (query.trim()) {
    const searches = [query.trim(), ...read(keys.searches, []).filter((item) => item !== query.trim())].slice(0, 8);
    write(keys.searches, searches);
  }
  filtered = sortSongs(filterSongs(songs, query, $("genreFilter").value), $("sortSelect").value);
  renderSongs();
}

function renderSongs() {
  const grid = $("songGrid");
  grid.className = `song-grid ${viewMode === "list" ? "list-mode" : ""}`;
  grid.innerHTML = filtered.map(songCard).join("");
  bindSongActions(grid);
  $("emptyState").classList.toggle("hidden", filtered.length > 0);
}

function songCard(song) {
  const liked = favorites.includes(song.id) ? "liked" : "";
  const artistLinks = song.artists.map((artist, index) => `<button class="artist-link" data-action="artist" data-artist-id="${song.artistIds[index]}">${escapeHtml(artist)}</button>`).join(" . ");
  return `
    <article class="song-card" data-song-id="${song.id}" draggable="true">
      <div class="cover-wrap">
        <img src="${song.cover}" alt="${escapeHtml(song.album)} cover">
        <button class="play-overlay" data-action="play" aria-label="Play ${escapeHtml(song.title)}">Play</button>
      </div>
      <div class="song-meta">
        <h3>${escapeHtml(song.title)}</h3>
        <p>${artistLinks} . ${escapeHtml(song.album)}</p>
        <p>${escapeHtml(song.genre)}</p>
      </div>
      <div class="card-actions">
        <button class="heart-button ${liked}" data-action="like" aria-label="Like ${escapeHtml(song.title)}">Like</button>
        <button class="tiny-button" data-action="queue">Queue</button>
        <button class="tiny-button" data-action="next">Play Next</button>
        <button class="tiny-button" data-action="menu">More</button>
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
      if (action === "menu") openContext(event, id);
      if (action === "artist") openArtist(event.target.dataset.artistId);
    });
  });
}

function renderFavorites() {
  const liked = songs.filter((song) => favorites.includes(song.id));
  $("favoritesGrid").innerHTML = liked.length ? liked.map(songCard).join("") : empty("No favorites yet", "Like songs to collect them here.");
  bindSongActions($("favoritesGrid"));
}

function renderArtists() {
  const sorted = [...artists.values()].sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name));
  $("artistGrid").innerHTML = sorted.map((artist) => `
    <button class="artist-card" data-artist-card="${artist.id}">
      <img src="${artist.image}" alt="${escapeHtml(artist.name)}">
      <strong>${escapeHtml(artist.name)}</strong>
      <span>${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</span>
    </button>`).join("");
  $("artistGrid").querySelectorAll("[data-artist-card]").forEach((button) => button.addEventListener("click", () => openArtist(button.dataset.artistCard)));
}

function openArtist(artistId) {
  const artist = artists.get(artistId);
  if (!artist) return;
  const profile = $("artistProfile");
  profile.classList.remove("hidden");
  profile.innerHTML = `
    <div class="artist-profile-head">
      <img src="${artist.image}" alt="${escapeHtml(artist.name)}">
      <div>
        <p class="eyebrow">Artist profile</p>
        <h2>${escapeHtml(artist.name)}</h2>
        <p>${artist.songCount} song${artist.songCount === 1 ? "" : "s"}</p>
      </div>
    </div>
    <div class="song-grid list-mode">${artist.relatedSongs.map(songCard).join("")}</div>`;
  bindSongActions(profile);
  document.querySelector('[href="#artists"]')?.click();
  profile.scrollIntoView({ behavior: "smooth", block: "start" });
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
  $("queueList").innerHTML = items.length ? items.map((song, index) => queueItem(song, index)).join("") : empty("Your queue is empty", "Add songs or choose Play Next from any track.");
  $("queueList").querySelectorAll(".queue-item").forEach((item) => {
    item.addEventListener("dragstart", () => draggedQueueIndex = Number(item.dataset.index));
    item.addEventListener("dragover", (event) => event.preventDefault());
    item.addEventListener("drop", () => queue.reorder(draggedQueueIndex, Number(item.dataset.index)));
    item.querySelector("[data-remove]").addEventListener("click", () => queue.remove(item.dataset.id));
  });
}

function queueItem(song, index) {
  return `<div class="queue-item" data-id="${song.id}" data-index="${index}" draggable="true">
    <img src="${song.cover}" alt="">
    <div><strong>${escapeHtml(song.title)}</strong><p>${escapeHtml(artistDisplay(song))}</p></div>
    <button class="icon-button" data-remove aria-label="Remove">X</button>
  </div>`;
}

function renderPlaylists() {
  $("sidebarPlaylists").innerHTML = playlists.playlists.map((pl) => `<button class="compact-item" data-select-playlist="${pl.id}">${escapeHtml(pl.name)}</button>`).join("");
  $("playlistList").innerHTML = playlists.playlists.map((pl) => {
    const first = getSong(pl.songIds[0]);
    return `<button class="playlist-item" data-select-playlist="${pl.id}">
      <img src="${first?.cover || "https://picsum.photos/seed/playlist/120/120"}" alt="">
      <span><strong>${escapeHtml(pl.name)}</strong><br><small>${pl.songIds.length} songs</small></span>
      <span>&gt;</span>
    </button>`;
  }).join("") || empty("No playlists", "Create one to begin organizing tracks.");
  document.querySelectorAll("[data-select-playlist]").forEach((button) => button.addEventListener("click", () => {
    playlists.selectedId = button.dataset.selectPlaylist;
    renderPlaylists();
  }));
  renderPlaylistDetail();
}

function renderPlaylistDetail() {
  const playlist = playlists.get();
  if (!playlist) {
    $("playlistDetail").innerHTML = empty("Select a playlist");
    return;
  }
  const tracks = playlist.songIds.map(getSong).filter(Boolean);
  $("playlistDetail").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">Playlist</p><h2>${escapeHtml(playlist.name)}</h2></div>
      <div class="control-row">
        <button class="secondary-button" id="renamePlaylist">Rename</button>
        <button class="secondary-button" id="deletePlaylist">Delete</button>
      </div>
    </div>
    <div class="queue-list" data-playlist-drop="${playlist.id}">
      ${tracks.length ? tracks.map((song) => `<div class="queue-item" data-song="${song.id}" draggable="true">
        <img src="${song.cover}" alt=""><div><strong>${escapeHtml(song.title)}</strong><p>${escapeHtml(artistDisplay(song))}</p></div>
        <button class="icon-button" data-remove-song="${song.id}">X</button>
      </div>`).join("") : empty("Drop songs here", "Drag library songs into this playlist or use More.")}
    </div>`;
  $("renamePlaylist").addEventListener("click", () => openRenamePlaylist(playlist.id));
  $("deletePlaylist").addEventListener("click", () => playlists.delete(playlist.id));
  $("playlistDetail").querySelectorAll("[data-remove-song]").forEach((button) => button.addEventListener("click", () => playlists.removeSong(playlist.id, button.dataset.removeSong)));
  const dropZone = $("playlistDetail").querySelector("[data-playlist-drop]");
  dropZone.addEventListener("dragover", (event) => event.preventDefault());
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    const card = document.querySelector(".song-card.dragging");
    const songId = card?.dataset.songId || draggedPlaylist?.songId;
    if (songId) playlists.addSong(playlist.id, songId);
  });
}

function openContext(event, songId) {
  event.stopPropagation();
  const menu = $("contextMenu");
  menu.innerHTML = `
    <button data-cmd="next">Play Next</button>
    <button data-cmd="queue">Add to Queue</button>
    <button data-cmd="favorite">${favorites.includes(songId) ? "Unlike" : "Like"} Song</button>
    ${playlists.playlists.map((pl) => `<button data-cmd="playlist" data-id="${pl.id}">Add to ${escapeHtml(pl.name)}</button>`).join("")}`;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 210)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 220)}px`;
  menu.classList.remove("hidden");
  menu.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.cmd === "next") queue.add(songId, true);
    if (button.dataset.cmd === "queue") queue.add(songId);
    if (button.dataset.cmd === "favorite") toggleFavorite(songId);
    if (button.dataset.cmd === "playlist") playlists.addSong(button.dataset.id, songId);
  }));
}

function toggleFavorite(id) {
  favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
  write(keys.favorites, favorites);
  toast(favorites.includes(id) ? "Added to favorites" : "Removed from favorites");
  renderAll();
}

function addRecent(id) {
  recent = [id, ...recent.filter((item) => item !== id)].slice(0, 12);
  write(keys.recent, recent);
  renderRecent();
}

function renderPlayer(song) {
  if (!song) return;
  $("playerCover").src = song.cover;
  $("playerTitle").textContent = song.title;
  $("playerArtist").textContent = artistDisplay(song);
  $("playPauseBtn").textContent = audio.paused ? "Play" : "Pause";
  $("likeCurrent").classList.toggle("liked", favorites.includes(song.id));
  $("lyricsTitle").textContent = song.title;
  $("lyricsText").textContent = song.lyrics || "Lyrics are not available for this track.";
  $("volumeSlider").value = audio.volume;
  $("muteBtn").textContent = audio.muted || audio.volume === 0 ? "Muted" : "Vol";
}

function updateProgress() {
  $("currentTime").textContent = format(audio.currentTime);
  $("duration").textContent = Number.isFinite(audio.duration) ? format(audio.duration) : "0:00";
  $("progressBar").value = audio.duration ? String((audio.currentTime / audio.duration) * 1000) : "0";
  $("playPauseBtn").textContent = audio.paused ? "Play" : "Pause";
}

function format(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function toggleMute() {
  audio.muted = !audio.muted;
  renderPlayer(player.current);
}

function handleKeys(event) {
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

function renderUser() {
  const user = currentUser();
  if (!user) return;
  $("profilePill").href = user.type === "artist" ? "artist-dashboard.html" : "#home";
  $("profilePill").querySelector(".avatar").textContent = user.name.slice(0, 1).toUpperCase();
  $("profilePill").lastElementChild.textContent = user.name;
  document.querySelectorAll(".artist-only").forEach((node) => node.classList.toggle("hidden", user.type !== "artist"));
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
