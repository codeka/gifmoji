import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";

export interface SpinifyOptions {
  zoom: number;
  reverse: boolean;
  numFrames: number;
  frameDelay: number;
  blurFrames: number;
  blurAmount: number;
  blurLength: number;
}

export class Spinify extends BaseAction {
  options: SpinifyOptions;

  constructor(options: Partial<SpinifyOptions>) {
    super();

    this.options = Object.assign({
      zoom: 1.0,
      reverse: false,
      numFrames: 24,
      frameDelay: 40,
      blurFrames: 0,
      blurAmount: 0.3,
      blurLength: 0.5,
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

      const direction = this.options.reverse ? -1 : 1;

      for (let i = 0; i < this.options.numFrames; i++) {
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2.0, height / 2.0);
        ctx.rotate(direction * (2 * Math.PI * i) / this.options.numFrames);
        ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
        ctx.restore();

        for (let blurFrame = 0; blurFrame < this.options.blurFrames; blurFrame++) {
          ctx.save();
          const blurAlpha =
              this.options.blurAmount * (1.0 - (blurFrame / (this.options.blurFrames + 1)));
          const lastFullAngle = direction * (2 * Math.PI * (i - 1)) / this.options.numFrames;
          const currAngle = direction * (2 * Math.PI * i) / this.options.numFrames;
          const firstBlurAngle =
              lastFullAngle + (currAngle - lastFullAngle) * (1.0 - this.options.blurLength);
          const blurAngle =
              firstBlurAngle +
                  (currAngle - firstBlurAngle) * (blurFrame / (this.options.blurFrames + 1));

          ctx.translate(width / 2.0, height / 2.0);
          ctx.rotate(blurAngle);
          ctx.globalAlpha = blurAlpha;
          ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
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
}
