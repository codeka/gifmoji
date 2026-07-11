import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

export class Spinify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["zoom", new ActionSetting('Zoom', 'number', 1.2)],
    ["reverse", new ActionSetting('Reverse', 'checkbox', false)],
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

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = origWidth * this.settings.get("zoom")!.value;
      const height = origHeight * this.settings.get("zoom")!.value;
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

      const direction = this.settings.get("reverse")!.value ? -1 : 1;

      for (let i = 0; i < this.settings.get("numFrames")!.value; i++) {
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2.0, height / 2.0);
        ctx.rotate(direction * (2 * Math.PI * i) / this.settings.get("numFrames")!.value);
        ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
        ctx.restore();

        for (let blurFrame = 0; blurFrame < this.settings.get("blurFrames")!.value; blurFrame++) {
          ctx.save();
          const blurAlpha =
              this.settings.get("blurAmount")!.value * (1.0 - (blurFrame / (this.settings.get("blurFrames")!.value + 1)));
          const lastFullAngle = direction * (2 * Math.PI * (i - 1)) / this.settings.get("numFrames")!.value;
          const currAngle = direction * (2 * Math.PI * i) / this.settings.get("numFrames")!.value;
          const firstBlurAngle =
              lastFullAngle + (currAngle - lastFullAngle) * (1.0 - this.settings.get("blurLength")!.value);
          const blurAngle =
              firstBlurAngle +
                  (currAngle - firstBlurAngle) * (blurFrame / (this.settings.get("blurFrames")!.value + 1));

          ctx.translate(width / 2.0, height / 2.0);
          ctx.rotate(blurAngle);
          ctx.globalAlpha = blurAlpha;
          ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
          ctx.restore();
        }

        this.fixTransparency(ctx, width, height);
        gif.addFrame(ctx, { copy: true, delay: this.settings.get("frameDelay")!.value, dispose: 2 });
      }

      console.log("rendering gif")
      gif.on('finished', (blob: Blob) => {
        resolve(new ActionResult(URL.createObjectURL(blob)));
      });
      gif.render();
    });
  }
}
