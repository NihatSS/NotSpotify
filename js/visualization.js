export class Visualizer {
  constructor(audio, canvas) {
    this.audio = audio;
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d");
    this.audioCtx = null;
    this.analyser = null;
    this.data = null;
    this.ready = false;
  }

  init() {
    if (this.ready || !this.ctx) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 128;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    const source = this.audioCtx.createMediaElementSource(this.audio);
    source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.ready = true;
    this.draw();
  }

  resume() {
    this.init();
    if (this.audioCtx?.state === "suspended") this.audioCtx.resume();
  }

  draw() {
    if (!this.ctx || !this.analyser) return;
    requestAnimationFrame(() => this.draw());
    const { width, height } = this.canvas;
    this.analyser.getByteFrequencyData(this.data);
    this.ctx.clearRect(0, 0, width, height);
    const gradient = this.ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1ed760");
    gradient.addColorStop(0.55, "#26d0ce");
    gradient.addColorStop(1, "#ff4f81");
    const barWidth = width / this.data.length;
    this.data.forEach((value, i) => {
      const h = Math.max(8, (value / 255) * height * 0.92);
      const x = i * barWidth;
      const y = height - h;
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x + 2, y, Math.max(2, barWidth - 4), h);
    });
  }
}
