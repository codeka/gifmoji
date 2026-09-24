import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

export class Twirlify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["reverse", new ActionSetting('Reverse', 'checkbox', false)],
    ["numFrames", new ActionSetting('Number of Frames', 'number', 21)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 40)],
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
      const numFrames = this.settings.get("numFrames")!.value;

      const drawTriangle = (
        firstSourcePoint: { x: number, y: number },
        secondSourcePoint: { x: number, y: number },
        thirdSourcePoint: { x: number, y: number },
        firstPoint: { x: number, y: number },
        secondPoint: { x: number, y: number },
        thirdPoint: { x: number, y: number },
      ) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);
        ctx.lineTo(secondPoint.x, secondPoint.y);
        ctx.lineTo(thirdPoint.x, thirdPoint.y);
        ctx.closePath();
        ctx.clip();

        const sourceVectorOneX = secondSourcePoint.x - firstSourcePoint.x;
        const sourceVectorOneY = secondSourcePoint.y - firstSourcePoint.y;
        const sourceVectorTwoX = thirdSourcePoint.x - firstSourcePoint.x;
        const sourceVectorTwoY = thirdSourcePoint.y - firstSourcePoint.y;
        const destinationVectorOneX = secondPoint.x - firstPoint.x;
        const destinationVectorOneY = secondPoint.y - firstPoint.y;
        const destinationVectorTwoX = thirdPoint.x - firstPoint.x;
        const destinationVectorTwoY = thirdPoint.y - firstPoint.y;
        const determinant = sourceVectorOneX * sourceVectorTwoY - sourceVectorTwoX * sourceVectorOneY;

        ctx.transform(
          (destinationVectorOneX * sourceVectorTwoY - destinationVectorTwoX * sourceVectorOneY) / determinant,
          (destinationVectorOneY * sourceVectorTwoY - destinationVectorTwoY * sourceVectorOneY) / determinant,
          (destinationVectorTwoX * sourceVectorOneX - destinationVectorOneX * sourceVectorTwoX) / determinant,
          (destinationVectorTwoY * sourceVectorOneX - destinationVectorOneY * sourceVectorTwoX) / determinant,
          firstPoint.x,
          firstPoint.y,
        );
        ctx.translate(-firstSourcePoint.x, -firstSourcePoint.y);
        ctx.drawImage(img, 0, 0, origWidth, origHeight);
        ctx.restore();
      };

      for (let i = 0; i < numFrames; i++) {
        const angle = direction * (2 * Math.PI * i) / numFrames;

        ctx.clearRect(0, 0, width, height);
        const horizontalScale = Math.cos(angle);
        const projectedWidth = Math.abs(horizontalScale) * origWidth;
        const leftX = (width - projectedWidth) / 2.0;
        const rightX = leftX + projectedWidth;
        const perspectiveAmount = 0.08 * Math.sin(angle);
        const leftHeight = origHeight * (1 - perspectiveAmount);
        const rightHeight = origHeight * (1 + perspectiveAmount);
        const leftXForSource = horizontalScale >= 0 ? leftX : rightX;
        const rightXForSource = horizontalScale >= 0 ? rightX : leftX;
        const topLeft = { x: leftXForSource, y: (height - leftHeight) / 2.0 };
        const topRight = { x: rightXForSource, y: (height - rightHeight) / 2.0 };
        const bottomLeft = { x: leftXForSource, y: (height + leftHeight) / 2.0 };
        const bottomRight = { x: rightXForSource, y: (height + rightHeight) / 2.0 };

        drawTriangle(
          { x: 0, y: 0 },
          { x: origWidth, y: 0 },
          { x: 0, y: origHeight },
          topLeft,
          topRight,
          bottomLeft,
        );
        drawTriangle(
          { x: origWidth, y: 0 },
          { x: origWidth, y: origHeight },
          { x: 0, y: origHeight },
          topRight,
          bottomRight,
          bottomLeft,
        );

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
