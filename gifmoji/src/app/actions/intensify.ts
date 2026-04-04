import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";


export interface IntensifyOptions {
  zoom: number;
  intensity: number;
  numFrames: number;
  frameDelay: number;
  blurFrames: number;
  blurAmount: number;
  blurLength: number;
}

class Point2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Intensify extends BaseAction {
  private options: IntensifyOptions;

  constructor(options: Partial<IntensifyOptions>) {
    super();
    this.options = Object.assign({
      zoom: 1.0,
      intensity: 5.0,
      numFrames: 24,
      frameDelay: 40,
      blurFrames: 0,
      blurAmount: 0.3,
      blurLength: 0.5
    }, options);
  }

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = origWidth * this.options.zoom;
      const height = origHeight * this.options.zoom;
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width,
        height,
        workerScript: '/gif.worker.js',
        transparent: '0xFF00FF', // Use magenta for transparency
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true })!;

      const randomSeed = this.getRandomInt(1000000);

      for (let i = 0; i < this.options.numFrames; i++) {
        ctx.clearRect(0, 0, width, height);

        const offset = this.getIntensifyOffset(randomSeed, i);

        ctx.save();
        ctx.translate(width / 2.0, height / 2.0);
        ctx.drawImage(img, -origWidth / 2.0 + offset.x, -origHeight / 2.0 + offset.y, origWidth, origHeight);
        ctx.restore();

        for (let blurFrame = 0; blurFrame < this.options.blurFrames; blurFrame++) {
          ctx.save();
          const blurAlpha = this.options.blurAmount * (1.0 - (blurFrame / (this.options.blurFrames + 1)));
          const lastIndex = i - 1 < 0 ? this.options.numFrames - 1 : i - 1;
          const lastOffset = this.getIntensifyOffset(randomSeed, lastIndex);
          const firstOffset = new Point2D(
            lastOffset.x + (offset.x - lastOffset.x) * (1.0 - this.options.blurLength),
            lastOffset.y + (offset.y - lastOffset.y) * (1.0 - this.options.blurLength));
          const blurOffset = new Point2D(
            firstOffset.x + (offset.x - firstOffset.x) * (blurFrame / (this.options.blurFrames + 1)),
            firstOffset.y + (offset.y - firstOffset.y) * (blurFrame / (this.options.blurFrames + 1)));

          ctx.translate(width / 2.0, height / 2.0);
          ctx.globalAlpha = blurAlpha;
          ctx.drawImage(img, -origWidth / 2.0 + blurOffset.x, -origHeight / 2.0 + blurOffset.y, origWidth, origHeight);
          ctx.restore();
        }

        this.fixTransparency(ctx, width, height);
        gif.addFrame(ctx, { copy: true, delay: this.options.frameDelay, dispose: 2 });
      }

      console.log("rendering gif")
      gif.on('finished', (blob: Blob) => {
        resolve(new ActionResult(URL.createObjectURL(blob)));
      });
      gif.render();
    });
  }

  
  private getIntensifyOffset(seed: number, frameNo: number): Point2D {
    const x = (Math.sin(seed + frameNo * 1.37) + Math.sin(seed * 1.79 + frameNo * 0.73)) * this.options.intensity;
    const y = (Math.sin(seed * 0.97 + frameNo * 1.49) + Math.sin(seed * 1.31 + frameNo * 0.91)) * this.options.intensity;
    return new Point2D(x, y);
  }

  private getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.max(1, Math.floor(max)));
  }
}
