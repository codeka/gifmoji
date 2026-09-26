import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

export class Karatefy extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["reverse", new ActionSetting('Reverse', 'checkbox', false)],
    ["numFrames", new ActionSetting('Number of Frames', 'number', 15)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 20)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = origWidth;
      const height = origHeight;
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
      const numFrames = Math.max(1, Math.floor(Number(this.settings.get("numFrames")!.value)));
      const frameDelay = Math.max(0, Number(this.settings.get("frameDelay")!.value));

      // The poses start with a few nearly-still frames, then punch through the canvas before
      // easing back to the starting pose for a seamless loop.
      const poses = [
        [1.00, 0.00, 0.00, 0], [1.02, 0.01, -0.01, 1], [0.98, -0.01, 0.01, -1],
        [1.05, 0.02, -0.01, 2], [1.15, 0.05, -0.02, 3], [1.35, 0.12, -0.04, 5],
        [1.80, 0.25, -0.08, 7], [2.40, 0.45, -0.15, 9], [3.20, 0.72, -0.25, 11],
        [4.00, 0.88, -0.38, 13], [4.50, 0.98, -0.50, 15], [4.00, 0.70, -0.64, 12],
        [3.20, 0.35, -0.72, 9], [2.30, -0.10, -0.62, 6], [1.60, -0.42, -0.45, 4],
        [1.15, -0.62, -0.22, 2], [0.95, -0.78, 0.02, 0], [1.10, -0.58, 0.20, -2],
        [1.60, -0.30, 0.38, -4], [2.40, 0.05, 0.52, -7], [3.40, 0.42, 0.62, -10],
        [4.30, 0.78, 0.55, -13], [3.80, 0.92, 0.35, -11], [2.80, 0.72, 0.08, -8],
        [1.80, 0.42, -0.12, -5], [1.20, 0.16, -0.10, -2], [1.02, 0.03, -0.03, 0],
        [1.00, 0.00, 0.00, 0], [1.02, -0.01, 0.01, 1], [1.00, 0.00, 0.00, 0],
      ];

      for (let i = 0; i < numFrames; i++) {
        const poseIndex = Math.floor(i * poses.length / numFrames);
        const pose = poses[direction === 1 ? poseIndex : poses.length - 1 - poseIndex];
        const scale = pose[0];
        const xOffset = pose[1] * width;
        const yOffset = pose[2] * height;
        const angle = pose[3] * Math.PI / 180;
        const isFlipped = poseIndex >= 11;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(width / 2 + xOffset, height / 2 + yOffset);
        ctx.rotate(angle);
        ctx.scale(isFlipped ? -1 : 1, 1);
        ctx.drawImage(
          img,
          -origWidth * scale / 2,
          -origHeight * scale / 2,
          origWidth * scale,
          origHeight * scale,
        );
        ctx.restore();

        this.fixTransparency(ctx, width, height);
        gif.addFrame(ctx, { copy: true, delay: frameDelay, dispose: 2 });
      }

      gif.on('finished', (blob: Blob) => {
        resolve(new ActionResult(URL.createObjectURL(blob)));
      });
      gif.render();
    });
  }
}
