import { keys, read, write, toast } from "./storage.js";

export class QueueManager {
  constructor(render) {
    this.render = render;
    this.items = read(keys.queue, []);
  }

  save() {
    write(keys.queue, this.items);
    this.render?.();
  }

  set(ids) {
    this.items = ids;
    this.save();
  }

  add(id, next = false) {
    if (this.items.includes(id)) {
      toast("This song is already in the queue");
      return false;
    }
    this.items = next ? [id, ...this.items] : [...this.items, id];
    this.save();
    toast(next ? "Added to Play Next" : "Added to queue");
    return true;
  }

  shift() {
    const [id, ...rest] = this.items;
    this.items = rest;
    this.save();
    return id;
  }

  remove(id) {
    this.items = this.items.filter((item) => item !== id);
    this.save();
  }

  reorder(from, to) {
    const next = [...this.items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    this.items = next;
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
    toast("Queue cleared");
  }
}
