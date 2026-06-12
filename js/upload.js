import { artistDisplay, normalizeArtistList, normalizeSong, parseSongFilename } from "./library.js";
import { keys, read, write, toast, uid, currentUser } from "./storage.js";

const form = document.getElementById("uploadForm");
const list = document.getElementById("uploadedSongs");
const user = currentUser();

if (!user || user.type !== "artist") {
  toast("Create or login as an artist to upload songs");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById("uploadAudio")?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const parsed = parseSongFilename(file.name);
  document.getElementById("uploadTitle").value ||= parsed.title;
  document.getElementById("uploadArtist").value ||= parsed.artists.join(", ");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const audioFile = document.getElementById("uploadAudio").files[0];
  const coverFile = document.getElementById("uploadCover").files[0];
  if (!audioFile) return;
  const parsed = parseSongFilename(audioFile.name);
  const artistInput = document.getElementById("uploadArtist").value.trim();
  const song = normalizeSong({
    id: uid("upload"),
    title: document.getElementById("uploadTitle").value.trim() || parsed.title,
    artists: normalizeArtistList(artistInput || parsed.artists),
    album: document.getElementById("uploadAlbum").value.trim() || "Uploads",
    genre: document.getElementById("uploadGenre").value.trim() || "Uploaded",
    src: await fileToDataUrl(audioFile),
    cover: coverFile ? await fileToDataUrl(coverFile) : `https://picsum.photos/seed/${Date.now()}/480/480`,
    plays: 0,
    uploaded: true,
    owner: user?.id,
    filename: audioFile.name,
    lyrics: "Artist-uploaded track."
  });
  write(keys.uploads, [song, ...read(keys.uploads, [])]);
  form.reset();
  toast("Song published to library");
  renderUploads();
});

function renderUploads() {
  const uploads = read(keys.uploads, []).map(normalizeSong).filter((song) => !user || song.owner === user.id || !song.owner);
  list.innerHTML = uploads.length ? uploads.map((song) => `
    <div class="queue-item">
      <img src="${song.cover}" alt="">
      <div><strong>${song.title}</strong><p>${artistDisplay(song)} • ${song.genre}</p></div>
      <button class="icon-button" data-delete="${song.id}">×</button>
    </div>`).join("") : `<div class="empty-state"><h3>No uploads yet</h3><p>Published songs appear in the main library instantly.</p></div>`;
  list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    write(keys.uploads, read(keys.uploads, []).filter((song) => song.id !== button.dataset.delete));
    toast("Upload removed");
    renderUploads();
  }));
}

renderUploads();
