export const keys = {
  favorites: "ps:favorites",
  playlists: "ps:playlists",
  queue: "ps:queue",
  recent: "ps:recent",
  volume: "ps:volume",
  theme: "ps:theme",
  searches: "ps:searches",
  followedArtists: "ps:followed-artists"
};

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toast(message) {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  stack.append(node);
  setTimeout(() => node.remove(), 2600);
}

export function setTheme(theme) {
  document.body.classList.toggle("light-theme", theme === "light");
  write(keys.theme, theme);
}
