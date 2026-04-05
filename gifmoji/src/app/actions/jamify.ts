import GIF from "gif.js";
import { ActionSetting } from "./action-setting";
import { ActionResult, BaseAction } from "./base-action";

export class Jamify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["zoom", new ActionSetting('Zoom', 'number', 1.2)],
    ["numFrames", new ActionSetting('Number of Frames', 'number', 24)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 30)],
    ["bounceAmount", new ActionSetting('Bounce Amount', 'number', 0.2)],
    ["sidewaysMovement", new ActionSetting('Sideways Movement', 'number', 0.3)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const zoom = this.settings.get("zoom")!.value;
      const sidewaysMovement = this.settings.get("sidewaysMovement")!.value;
      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = origWidth * zoom;
      const height = origHeight * zoom;
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

      const numFrames = this.settings.get("numFrames")!.value;
      for (let i = 0; i < numFrames; i++) {
        ctx.clearRect(0, 0, width, height);

        var jamOffset = 2 * i / numFrames;
        if (jamOffset > 1.0) {
          jamOffset = jamOffset - 1.0;
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        const bounceAmount = this.settings.get("bounceAmount")!.value * height;
        ctx.drawImage(
          img,
          (width - origHeight) / 2.0 * (1.0 - sidewaysMovement),
          (zoom - 1.0) * origHeight - bounceAmount + (jamOffset * bounceAmount),
          origWidth,
          origHeight);
        ctx.resetTransform();

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
