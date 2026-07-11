import GIF from "gif.js";
import { ActionSetting } from "./action-setting";
import { ActionResult, BaseAction } from "./base-action";

export class Lurkify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["zoom", new ActionSetting('Zoom', 'number', 0.7)],
    ["numFrames", new ActionSetting('Number of Frames', 'number', 30)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 30)],
    ["angle", new ActionSetting('Angle', 'number', 30.0)],
    ["lurkFrames", new ActionSetting('Lurk Frames', 'number', 8)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const wall = new Image();
      wall.src = "/brick-wall.png";
      await new Promise((resolve) => { wall.onload = resolve; });

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = wall.naturalHeight; // Note: output a square, the wall is taller than it is wide
      const height = wall.naturalHeight;
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

      const numFrames = parseInt(this.settings.get("numFrames")!.value);
      const lurkFrames = parseInt(this.settings.get("lurkFrames")!.value);
      const moveFrames = (numFrames - (lurkFrames * 2)) / 2;
      console.log("numFrames: " + numFrames + ", lurkFrames: " + lurkFrames + ", moveFrames: " + moveFrames);
      for (let i = 0; i < numFrames; i++) {
        ctx.clearRect(0, 0, width, height);

        var xOffset = 0;
        console.log("i: " + i + ", moveFrames: " + moveFrames + ", lurkFrames: " + lurkFrames);
        if (i < moveFrames) {
          console.log("moving right to left");
          // Moving from right to left
          xOffset = (width - wall.naturalWidth) * (1.0 - i / moveFrames);
        } else if (i < (moveFrames + lurkFrames)) {
          console.log("lurking on left i=" + i + " moveFrames + lurkFrames=" + (moveFrames + lurkFrames));
          // Resting on the left
          xOffset = 0;
        } else if (i < ((moveFrames * 2) + lurkFrames)) {
          console.log("moving left to right");
          // Moving from left to right
          xOffset = (width - wall.naturalWidth) * (i - moveFrames - lurkFrames) / (moveFrames);
        } else {
          console.log("lurking on right");
          // Resting on the right
          xOffset = width - wall.naturalWidth;
        }

        // Draw the background.
        console.log("drawing background, xOffset: " + xOffset);
        const outputWidth = width * this.settings.get("zoom")!.value;
        const outputHeight = height * this.settings.get("zoom")!.value;
        const angle = this.settings.get("angle")!.value;
        const y = (height - outputHeight) / 2.0;
        ctx.translate(xOffset + outputWidth / 2.0, y + outputHeight / 2.0);
        ctx.rotate(-angle * Math.PI / 180.0);
        ctx.translate(-(xOffset + outputWidth / 2.0), -(y + outputHeight / 2.0));
        ctx.drawImage(
          img,
          xOffset,
          y,
          outputWidth,
          outputHeight);
        ctx.resetTransform();

        // Draw the wall.
        ctx.drawImage(
          wall,
          width - wall.naturalWidth,
          0,
          wall.naturalWidth,
          wall.naturalHeight);
        ctx.resetTransform();

        this.fixTransparency(ctx, width, height);
        gif.addFrame(ctx, { copy: true, delay: this.settings.get("frameDelay")!.value, dispose: 2 });
      }

      gif.on('finished', (blob: Blob) => {
        resolve(new ActionResult(URL.createObjectURL(blob)));
      });
      gif.render();
    });
  }
}
