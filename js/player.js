import { keys, read, write, toast } from "./storage.js";

export class Player {
  constructor({ audio, songs, queue, visualizer, onChange, onRecent }) {
    this.audio = audio;
    this.songs = songs;
    this.queue = queue;
    this.visualizer = visualizer;
    this.onChange = onChange;
    this.onRecent = onRecent;
    this.index = 0;
    this.current = null;
    this.shuffle = false;
    this.repeat = "off";
    this.audio.volume = read(keys.volume, 0.78);
    this.bind();
  }

  bind() {
    this.audio.addEventListener("ended", () => this.handleEnded());
    this.audio.addEventListener("play", () => this.visualizer?.resume());
    this.audio.addEventListener("volumechange", () => write(keys.volume, this.audio.volume));
    this.audio.addEventListener("error", () => this.handleAudioError());
  }

  load(id, autoplay = true) {
    const nextIndex = this.songs.findIndex((song) => song.id === id);
    if (nextIndex >= 0) this.index = nextIndex;
    this.current = this.songs[this.index];
    if (!this.current) {
      console.warn("[PulseStream] Player load requested, but no matching song was found.", { id, songs: this.songs });
      return;
    }

    if (this.audio.src !== this.current.src) {
      console.debug("[PulseStream] Loading audio", {
        title: this.current.title,
        artists: this.current.artists,
        src: this.current.src,
        candidates: this.current.candidates
      });
      this.audio.src = this.current.src;
      try { this.audio.load(); } catch (error) {
        console.warn("[PulseStream] audio.load() failed.", error);
      }
    }

    this.onRecent?.(this.current.id);
    this.onChange?.(this.current);
    if (autoplay) this.play();
  }

  async play() {
    if (!this.current) this.load(this.songs[0]?.id, false);
    try {
      await this.audio.play();
    } catch (error) {
      console.debug("[PulseStream] Browser blocked or delayed playback.", error);
      toast("Tap play to start audio");
    }
    this.onChange?.(this.current);
  }

  pause() {
    this.audio.pause();
    this.onChange?.(this.current);
  }

  toggle() {
    this.audio.paused ? this.play() : this.pause();
  }

  next() {
    const queued = this.queue.shift();
    if (queued) return this.load(queued);
    if (!this.songs.length) return;
    if (this.shuffle) this.index = Math.floor(Math.random() * this.songs.length);
    else this.index = (this.index + 1) % this.songs.length;
    this.load(this.songs[this.index]?.id);
  }

  previous() {
    if (!this.songs.length) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.index = (this.index - 1 + this.songs.length) % this.songs.length;
    this.load(this.songs[this.index]?.id);
  }

  handleEnded() {
    if (this.repeat === "one") {
      this.audio.currentTime = 0;
      this.play();
      return;
    }
    if (this.repeat === "all" || this.index < this.songs.length - 1 || this.queue.items.length) this.next();
  }

  async handleAudioError() {
    const song = this.current;
    console.warn("[PulseStream] Audio failed to load.", {
      song,
      src: this.audio.currentSrc || this.audio.src,
      error: this.audio.error
    });
    if (!song) return;

    const tried = new Set([this.audio.currentSrc, this.audio.src]);
    for (const candidate of song.candidates || []) {
      if (!candidate || tried.has(candidate)) continue;
      tried.add(candidate);
      try {
        const response = await fetch(candidate, { method: "HEAD", cache: "no-store" });
        if (!response.ok) {
          console.debug(`[PulseStream] Audio fallback missing ${candidate}: ${response.status}`);
          continue;
        }
        console.info(`[PulseStream] Audio fallback loaded for ${song.title}: ${candidate}`);
        this.audio.src = candidate;
        this.audio.load();
        try { await this.audio.play(); } catch {}
        toast("Loaded track from fallback source");
        return;
      } catch (error) {
        console.debug("[PulseStream] Audio fallback failed.", { candidate, error });
      }
    }
    toast("This track could not be loaded");
  }

  setSongs(songs) {
    this.songs = songs;
    if (this.current) this.index = Math.max(0, songs.findIndex((song) => song.id === this.current.id));
  }

  toggleRepeat() {
    this.repeat = this.repeat === "off" ? "all" : this.repeat === "all" ? "one" : "off";
    toast(`Repeat ${this.repeat}`);
    return this.repeat;
  }
}
