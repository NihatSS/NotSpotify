import { keys, read, write, uid, toast } from "./storage.js";

export class PlaylistManager {
  constructor(render) {
    this.render = render;
    const defaults = [
      { id: uid("playlist"), name: "Late Night Mix", songIds: ["midnight-city", "blue-hour", "rain"], created: false },
      { id: uid("playlist"), name: "Focus Flow", songIds: ["tidal", "slow-bloom", "loft"], created: false }
    ];
    this.playlists = read(keys.playlists, defaults).map((playlist) => ({
      ...playlist,
      created: playlist.created ?? !/^(Late Night Mix|Focus Flow)$/i.test(playlist.name)
    }));
    this.selectedId = this.playlists[0]?.id || null;
    write(keys.playlists, this.playlists);
  }

  save(announce = true) {
    write(keys.playlists, this.playlists);
    this.render?.();
    if (announce) toast("Playlist updated");
  }

  create(name) {
    const playlist = { id: uid("playlist"), name, songIds: [], created: true };
    this.playlists.unshift(playlist);
    this.selectedId = playlist.id;
    this.save();
  }

  rename(id, name) {
    const playlist = this.get(id);
    if (playlist) playlist.name = name;
    this.save();
  }

  delete(id) {
    this.playlists = this.playlists.filter((playlist) => playlist.id !== id);
    this.selectedId = this.playlists[0]?.id || null;
    this.save();
  }

  addSong(id, songId) {
    const playlist = this.get(id);
    if (playlist && !playlist.songIds.includes(songId)) playlist.songIds.push(songId);
    this.save();
  }

  removeSong(id, songId) {
    const playlist = this.get(id);
    if (playlist) playlist.songIds = playlist.songIds.filter((item) => item !== songId);
    this.save();
  }

  moveSong(fromPlaylistId, toPlaylistId, songId) {
    this.removeSong(fromPlaylistId, songId);
    this.addSong(toPlaylistId, songId);
  }

  get(id = this.selectedId) {
    return this.playlists.find((playlist) => playlist.id === id);
  }
}
