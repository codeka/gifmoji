import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

export class Meltify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["numFrames", new ActionSetting('Number of Frames', 'number', 14)],
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
      const groundY = height * 0.9;
      const numFrames = Math.max(1, Math.floor(Number(this.settings.get("numFrames")!.value)));
      const holdFrames = 4;
      const frameDelay = this.settings.get("frameDelay")!.value;
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
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = origWidth;
      sourceCanvas.height = origHeight;
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
      sourceCtx.drawImage(img, 0, 0);
      const sourcePixels = sourceCtx.getImageData(0, 0, origWidth, origHeight).data;

      const dripColors = ["#9ae8ff", "#c0f2ff", "#75d9f5", "#a8eaff", "#d5f7ff", "#82dff8"];
      const dripCount = Math.min(24, Math.max(7, Math.round(width / 28)));
      const drips = Array.from({ length: dripCount }, (_, index) => {
        const x = width * (index + 1) / (dripCount + 1) + Math.sin(index * 12.7) * width * 0.048;
        const sourceY = Math.min(origHeight - 1, Math.round(origHeight * (0.08 + (index * 0.618 % 0.78))));
        const pixelIndex = (sourceY * origWidth + Math.min(origWidth - 1, Math.round(x))) * 4;
        let colorIndex = pixelIndex;
        if (sourcePixels[colorIndex + 3] === 0) {
          for (let offset = 1; offset <= 6 && sourcePixels[colorIndex + 3] === 0; offset++) {
            const sampleY = Math.min(origHeight - 1, sourceY + offset);
            colorIndex = (sampleY * origWidth + Math.min(origWidth - 1, Math.round(x))) * 4;
          }
        }
        const puddleColor = `rgba(${sourcePixels[colorIndex]}, ${sourcePixels[colorIndex + 1]}, ${sourcePixels[colorIndex + 2]}, ${Math.max(0.35, sourcePixels[colorIndex + 3] / 255)})`;
        return {
          x,
          sourceY,
          width: Math.max(3, width * (0.024 + (index % 3) * 0.042)),
          dripColor: dripColors[index % dripColors.length],
          puddleColor,
        };
      });

      const easingStrength = 3.5;
      const maxEase = Math.exp(easingStrength) - 1;
      for (let frame = 0; frame < numFrames + holdFrames; frame++) {
        const linearProgress = Math.min(frame / Math.max(1, numFrames - 1), 1);
        const progress = (Math.exp(easingStrength * linearProgress) - 1) / maxEase;
        ctx.clearRect(0, 0, width, height);

        const waveAt = (x: number) => {
          const wave = Math.sin(x * Math.PI * 4 / width + progress * Math.PI * 2) * 0.035 +
            Math.sin(x * Math.PI * 11 / width - progress * Math.PI * 3) * 0.012;
          return origHeight * progress + origHeight * wave * Math.sin(Math.PI * progress);
        };
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, waveAt(0));
        for (let x = 4; x <= width; x += 4) {
          ctx.lineTo(x, waveAt(Math.min(x, width)));
        }
        ctx.lineTo(width, waveAt(width));
        ctx.lineTo(width, origHeight);
        ctx.lineTo(0, origHeight);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, origWidth, origHeight);
        ctx.restore();

        const puddles: Array<{ x: number; radiusX: number; radiusY: number; progress: number; color: string }> = [];
        for (const drip of drips) {
          const edgeY = Math.max(0, Math.min(origHeight, waveAt(drip.x)));
          if (edgeY < drip.sourceY) {
            continue;
          }
          const fallProgress = Math.min(1, ((edgeY - drip.sourceY) / (origHeight - drip.sourceY)) * 1.75);
          const tipY = edgeY + (groundY - edgeY) * fallProgress;
          const halfWidth = drip.width / 2;
          if (fallProgress < 1) {
            ctx.fillStyle = drip.dripColor;
            const leftX = drip.x - halfWidth * 0.45;
            const rightX = drip.x + halfWidth * 0.45;
            const bend = Math.sin(progress * Math.PI * 2 + drip.x / width * Math.PI * 2) * width * 0.018;
            const middleY = (edgeY + tipY) / 2;
            ctx.beginPath();
            ctx.moveTo(leftX, waveAt(leftX));
            ctx.quadraticCurveTo(drip.x - halfWidth + bend, middleY, drip.x - halfWidth * 0.35 + bend, tipY - halfWidth);
            ctx.quadraticCurveTo(drip.x + bend, tipY + halfWidth * 0.6, drip.x + halfWidth * 0.35 + bend, tipY - halfWidth);
            ctx.quadraticCurveTo(drip.x + halfWidth + bend, middleY, rightX, waveAt(rightX));
            ctx.quadraticCurveTo(drip.x, waveAt(drip.x), leftX, waveAt(leftX));
            ctx.closePath();
            ctx.fill();
          }

          const puddleProgress = Math.max(0, (fallProgress - 0.72) / 0.28);
          if (puddleProgress > 0) {
            puddles.push({
              x: drip.x,
              radiusX: drip.width * (0.55 + puddleProgress * 8.8),
              radiusY: (2 + puddleProgress * 32),
              progress: puddleProgress,
              color: drip.puddleColor,
            });
          }
        }

        if (puddles.length > 0) {
          const orderedPuddles = puddles.sort((first, second) => first.x - second.x);
          const left = Math.max(0, Math.min(...orderedPuddles.map((puddle) => puddle.x - puddle.radiusX)));
          const right = Math.min(width, Math.max(...orderedPuddles.map((puddle) => puddle.x + puddle.radiusX)));
          const centerX = (left + right) / 2;
          const radiusX = Math.max(1, (right - left) / 2);
          const radiusY = Math.min(height * 0.09, Math.max(...orderedPuddles.map((puddle) => puddle.radiusY)) * 2);
          const gradient = ctx.createLinearGradient(left, groundY, Math.max(left + 1, right), groundY);
          gradient.addColorStop(0, orderedPuddles[0].color);
          for (const puddle of orderedPuddles) {
            const offset = (puddle.x - left) / Math.max(1, right - left);
            if (offset > 0 && offset < 1) {
              gradient.addColorStop(offset, puddle.color);
            }
          }
          gradient.addColorStop(1, orderedPuddles[orderedPuddles.length - 1].color);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          for (let point = 0; point <= 64; point++) {
            const angle = point / 64 * Math.PI * 2;
            const wobble = 1 + 0.1 * Math.sin(angle * 6 + progress * Math.PI * 2) +
              0.045 * Math.sin(angle * 11 - progress * Math.PI);
            const x = centerX + Math.cos(angle) * radiusX * wobble;
            const y = groundY + Math.sin(angle) * radiusY * wobble;
            if (point === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.fill();
        }

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
