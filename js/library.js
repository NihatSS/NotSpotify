const cover = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/480`;
let assetSongs = [];
let loadingPromise = null;

const knownCaps = new Map([
  ["sza", "SZA"],
  ["asap", "ASAP"],
  ["a$ap", "A$AP"],
  ["fe!n", "FE!N"],
  ["r&b", "R&B"],
  ["nf", "NF"],
  ["jvke", "JVKE"]
]);

export function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatName(value = "") {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const raw = word.trim();
      const lower = raw.toLowerCase();
      if (knownCaps.has(lower)) return knownCaps.get(lower);
      if (raw.length <= 3 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return raw;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeArtistList(value) {
  const source = Array.isArray(value) ? value : String(value || "Unknown Artist").split(/\s*,\s*|\s+&\s+|\s+feat\.?\s+/i);
  const seen = new Set();
  return source
    .map(formatName)
    .filter(Boolean)
    .filter((artist) => {
      const key = slugify(artist) || artist.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseSongFilename(filename = "") {
  const clean = safeDecode(filename.split("/").pop() || filename).replace(/\.[^.]+$/, "");
  const separator = clean.indexOf("-");
  let artistPart = separator >= 0 ? clean.slice(0, separator) : "Unknown Artist";
  let titlePart = separator >= 0 ? clean.slice(separator + 1) : clean;

  if (/^vietsub|lyrics|official/i.test(artistPart) && titlePart.includes(" - ")) {
    const parts = titlePart.split(" - ");
    titlePart = parts.shift() || titlePart;
    artistPart = parts.shift() || artistPart;
  }

  const artists = normalizeArtistList(artistPart);
  const title = formatName(titlePart || "Untitled");
  return { title, artists, artist: artists.join(" • ") };
}

export function normalizeSong(song, index = 0) {
  const parsed = song.filename ? parseSongFilename(song.filename) : null;
  const artists = normalizeArtistList(song.artists || parsed?.artists || song.artist);
  const title = formatName(song.title || parsed?.title || "Untitled");
  const id = song.id || slugify(`${artists.join("-")}-${title}`) || `song-${index}`;
  return {
    ...song,
    id,
    title,
    artists,
    artistIds: artists.map(slugify),
    artist: artists.join(" • "),
    album: formatName(song.album || "Singles"),
    genre: formatName(song.genre || "Uploaded"),
    cover: song.cover || cover(id),
    plays: song.plays || 0,
    searchText: `${title} ${artists.join(" ")} ${song.album || ""} ${song.genre || ""}`.toLowerCase()
  };
}

export function artistDisplay(song) {
  return (song.artists?.length ? song.artists : normalizeArtistList(song.artist)).join(" • ");
}

export async function loadAssetSongs() {
  if (!loadingPromise) loadingPromise = loadAssetSongsOnce();
  return loadingPromise;
}

async function loadAssetSongsOnce() {
  const files = await discoverSongFiles();
  if (!files.length) console.warn("[PulseStream] No audio files discovered in assets/songs.");
  const resolved = await Promise.all(files.map(resolveSongFile));
  assetSongs = resolved
    .filter(Boolean)
    .map((song, index) => normalizeSong({ ...song, plays: 400 - index }, index));
  console.info(`[PulseStream] Loaded ${assetSongs.length} playable local songs from assets/songs.`, assetSongs);
  return assetSongs;
}

async function discoverSongFiles() {
  const [fromManifest, fromListing] = await Promise.all([discoverFromManifest(), discoverFromDirectoryListing()]);
  const files = [...new Set([...fromManifest, ...fromListing].map((file) => safeDecode(file)).filter(Boolean))];
  if (!files.length) console.warn("[PulseStream] Song discovery failed from manifest and directory listing.");
  else console.info("[PulseStream] Discovered local song files:", files);
  return files;
}

async function discoverFromManifest() {
  try {
    const response = await fetch("assets/songs/manifest.json", { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[PulseStream] Song manifest request failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return (Array.isArray(data) ? data : data.files || [])
      .map((file) => String(file).split("/").pop())
      .filter((file) => /\.(mp3|wav|ogg|m4a)$/i.test(file));
  } catch (error) {
    console.warn("[PulseStream] Could not read assets/songs/manifest.json.", error);
    return [];
  }
}

async function discoverFromDirectoryListing() {
  try {
    const response = await fetch("assets/songs/", { cache: "no-store" });
    if (!response.ok) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("a")]
      .map((link) => safeDecode(link.getAttribute("href") || ""))
      .filter((href) => /\.(mp3|wav|ogg|m4a)$/i.test(href))
      .map((href) => href.split("/").pop());
  } catch (error) {
    console.warn("[PulseStream] Directory scan for assets/songs failed; manifest fallback may still work.", error);
    return [];
  }
}

async function resolveSongFile(filename, index) {
  const candidates = generateSrcCandidates(filename);
  for (const src of candidates) {
    try {
      const response = await fetch(src, { method: "HEAD", cache: "no-store" });
      if (response.ok) {
        if (src !== candidates[0]) console.info(`[PulseStream] Resolved fallback for ${filename}: ${src}`);
        return {
          ...parseSongFilename(filename),
          id: slugify(filename) || `asset-song-${index}`,
          filename,
          src,
          candidates,
          cover: cover(filename),
          album: "Local Songs",
          genre: "Local",
          uploaded: false
        };
      }
      console.debug(`[PulseStream] Missing audio candidate ${src}: ${response.status}`);
    } catch (error) {
      console.debug(`[PulseStream] Failed audio candidate ${src}`, error);
    }
  }
  console.warn(`[PulseStream] Skipping missing audio file after trying ${candidates.length} candidates: ${filename}`, candidates);
  return null;
}

function songUrl(filename) {
  return `assets/songs/${encodePathSegment(filename)}`;
}

export function generateSrcCandidates(filename = "") {
  if (!filename) return [];
  const out = new Set();
  const raw = String(filename);
  out.add(songUrl(raw));
  out.add(`./${songUrl(raw)}`);
  out.add(`assets/songs/${raw}`);
  out.add(`./assets/songs/${raw}`);
  out.add(`assets/songs/${raw.replace(/\s+/g, "%20")}`);
  out.add(`assets/songs/${raw.replace(/\s+/g, "_")}`);
  try { out.add(songUrl(decodeURIComponent(raw))); } catch {}
  try { out.add(songUrl(raw.normalize("NFC"))); } catch {}
  try { out.add(songUrl(raw.normalize("NFD"))); } catch {}
  out.add(songUrl(raw.replace(/[(),]/g, "")));
  try {
    const norm = raw.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
    out.add(songUrl(norm));
  } catch {}
  return [...out].filter(Boolean);
}

function safeDecode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePathSegment(value = "") {
  return String(value)
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/'/g, "%27"))
    .join("/");
}

export function getLibrary() {
  return assetSongs.map(normalizeSong);
}

export function getSong(id) {
  return getLibrary().find((song) => song.id === id);
}

export function buildArtistRegistry(songList = getLibrary()) {
  const registry = new Map();
  songList.forEach((song) => {
    song.artists.forEach((name) => {
      const id = slugify(name) || name.toLowerCase();
      if (!registry.has(id)) {
        registry.set(id, {
          id,
          name,
          image: cover(`artist-${id}`),
          songIds: new Set(),
          songs: []
        });
      }
      const artist = registry.get(id);
      artist.songIds.add(song.id);
      artist.songs.push(song);
    });
  });
  return new Map([...registry].map(([id, artist]) => [id, {
    ...artist,
    songIds: [...artist.songIds],
    songCount: artist.songIds.size,
    relatedSongs: artist.songs
  }]));
}

export function uniqueBy(field) {
  if (field === "artist") return [...buildArtistRegistry().values()].map((artist) => artist.name).sort((a, b) => a.localeCompare(b));
  return [...new Set(getLibrary().map((song) => song[field]))].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function sortSongs(songs, sortBy) {
  const list = [...songs];
  if (sortBy === "trending") return list.sort((a, b) => (b.plays || 0) - (a.plays || 0));
  if (sortBy === "artist") return list.sort((a, b) => artistDisplay(a).localeCompare(artistDisplay(b)));
  return list.sort((a, b) => String(a[sortBy] || "").localeCompare(String(b[sortBy] || "")));
}
