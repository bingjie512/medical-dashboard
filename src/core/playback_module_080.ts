export class PlaybackModule_080 {
  private data: Uint8Array | null = null;
  private bytesPerSecond: number;
  private currentPosition: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 1;
  private intervalId: number | null = null;
  private updateIntervalMs: number = 50; // emit chunks every 50ms
  
  private onDataChunk: (chunk: Uint8Array) => void;
  private onProgress: (progress: number, timeStr: string) => void;
  private onPlaybackEnd: () => void;

  constructor(
    bytesPerSecond: number,
    onDataChunk: (chunk: Uint8Array) => void,
    onProgress: (progress: number, timeStr: string) => void,
    onPlaybackEnd: () => void
  ) {
    this.bytesPerSecond = bytesPerSecond;
    this.onDataChunk = onDataChunk;
    this.onProgress = onProgress;
    this.onPlaybackEnd = onPlaybackEnd;
  }

  public loadData(buffer: ArrayBuffer) {
    this.data = new Uint8Array(buffer);
    this.currentPosition = 0;
    this.updateProgress();
  }

  public play() {
    if (!this.data || this.isPlaying || this.currentPosition >= this.data.length) return;
    this.isPlaying = true;
    
    this.intervalId = window.setInterval(() => {
      this.emitChunk();
    }, this.updateIntervalMs);
  }

  public pause() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public stop() {
    this.pause();
    this.currentPosition = 0;
    this.updateProgress();
  }

  public setSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public seek(progressRatio: number) {
    if (!this.data) return;
    const newPosition = Math.floor(progressRatio * this.data.length);
    this.currentPosition = newPosition;
    this.updateProgress();
  }

  private emitChunk() {
    if (!this.data) return;

    // Calculate how many bytes to read in this interval
    const bytesToRead = Math.floor(this.bytesPerSecond * this.playbackSpeed * (this.updateIntervalMs / 1000));
    
    const endPosition = Math.min(this.currentPosition + bytesToRead, this.data.length);
    const chunk = this.data.slice(this.currentPosition, endPosition);
    
    this.currentPosition = endPosition;
    this.onDataChunk(chunk);
    this.updateProgress();

    if (this.currentPosition >= this.data.length) {
      this.pause();
      this.onPlaybackEnd();
    }
  }

  private updateProgress() {
    if (!this.data) return;
    const progress = this.currentPosition / this.data.length;
    
    const currentSeconds = this.currentPosition / this.bytesPerSecond;
    const totalSeconds = this.data.length / this.bytesPerSecond;
    
    const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const timeStr = `${formatTime(currentSeconds)} / ${formatTime(totalSeconds)}`;
    this.onProgress(progress, timeStr);
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}
