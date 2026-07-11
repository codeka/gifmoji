import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

class Point2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Intensify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["intensity", new ActionSetting('Intensity', 'number', 5.0)],
    ["numFrames", new ActionSetting('Number of Frames', 'number', 24)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 40)],
    ["blurFrames", new ActionSetting('Blur Frames', 'number', 0)],
    ["blurAmount", new ActionSetting('Blur Amount', 'number', 0.3)],
    ["blurLength", new ActionSetting('Blur Length', 'number', 0.5)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const randomSeed = this.getRandomInt(1000000);

      // Figure out the offsets for each frame in advance so that we can use them to calculate the
      // maximum size of the output image.
      const numFrames = this.settings.get("numFrames")!.value;
      var offsets = new Array<Point2D>(numFrames);
      var maxOffsetX = 0;
      var maxOffsetY = 0;
      for (let i = 0; i < numFrames; i++) {
        offsets[i] = this.getIntensifyOffset(randomSeed, i);
        if (Math.abs(offsets[i].x) > maxOffsetX) {
          maxOffsetX = Math.abs(offsets[i].x);
        }
        if (Math.abs(offsets[i].y) > maxOffsetY) {
          maxOffsetY = Math.abs(offsets[i].y);
        }
      }

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = origWidth + (maxOffsetX * 2);
      const height = origHeight + (maxOffsetY * 2);
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

      for (let i = 0; i < this.settings.get("numFrames")!.value; i++) {
        ctx.clearRect(0, 0, width, height);

        const offset = offsets[i];

        ctx.save();
        ctx.translate(width / 2.0, height / 2.0);
        ctx.drawImage(
            img,
            -origWidth / 2.0 + offset.x,
            -origHeight / 2.0 + offset.y,
            origWidth,
            origHeight);
        ctx.restore();

        for (let blurFrame = 0; blurFrame < this.settings.get("blurFrames")!.value; blurFrame++) {
          ctx.save();
          const blurAmount = this.settings.get("blurAmount")!.value;
          const blurFrames = this.settings.get("blurFrames")!.value;
          const blurLength = this.settings.get("blurLength")!.value;
          const blurAlpha = blurAmount * (1.0 - (blurFrame / (blurFrames + 1)));
          const lastIndex = i - 1 < 0 ? this.settings.get("numFrames")!.value - 1 : i - 1;
          const lastOffset = offsets[lastIndex];
          const firstOffset = new Point2D(
            lastOffset.x + (offset.x - lastOffset.x) * (1.0 - blurLength),
            lastOffset.y + (offset.y - lastOffset.y) * (1.0 - blurLength));
          const blurOffset = new Point2D(
            firstOffset.x + (offset.x - firstOffset.x) * (blurFrame / (blurFrames + 1)),
            firstOffset.y + (offset.y - firstOffset.y) * (blurFrame / (blurFrames + 1)));

          ctx.translate(width / 2.0, height / 2.0);
          ctx.globalAlpha = blurAlpha;
          ctx.drawImage(
              img,
              -origWidth / 2.0 + blurOffset.x,
              -origHeight / 2.0 + blurOffset.y,
              origWidth,
              origHeight);
          ctx.restore();
        }

        this.fixTransparency(ctx, width, height);
        gif.addFrame(ctx, {
            copy: true,
            delay: this.settings.get("frameDelay")!.value,
            dispose: 2
        });
      }

      console.log("rendering gif")
      gif.on('finished', (blob: Blob) => {
        resolve(new ActionResult(URL.createObjectURL(blob)));
      });
      gif.render();
    });
  }
  
  private getIntensifyOffset(seed: number, frameNo: number): Point2D {
    const intensity = this.settings.get("intensity")!.value;
    const x = (
        Math.sin(seed + frameNo * 1.37) +
        Math.sin(seed * 1.79 + frameNo * 0.73)) * intensity;
    const y = (
        Math.sin(seed * 0.97 + frameNo * 1.49) +
        Math.sin(seed * 1.31 + frameNo * 0.91)) * intensity;
    return new Point2D(x, y);
  }

  private getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.max(1, Math.floor(max)));
  }
}
