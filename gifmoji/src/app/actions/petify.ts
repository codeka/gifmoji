import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

import { parseGIF, decompressFrames } from 'gifuct-js'

export interface SpinifyOptions {
  zoom: number;
  reverse: boolean;
  numFrames: number;
  frameDelay: number;
  blurFrames: number;
  blurAmount: number;
  blurLength: number;
}

const baseImageSizeFactor = 0.8;
const baseImageShrinkAmount = 0.5;
const baseImageFlareAmount = 1.1;

export class Petify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["zoom", new ActionSetting('Zoom', 'number', 2)],
    ["mirror", new ActionSetting('Mirror', 'checkbox', false)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 40)],
    ["squishAmount", new ActionSetting('Squish Amount', 'number', 1.0)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      var petpet = await fetch("/petpet.gif")
          .then(resp => resp.arrayBuffer())
          .then(buff => parseGIF(buff))
          .then(gif => decompressFrames(gif, true));
      console.log(petpet);

      var maxPetpetWidth = 0;
      var maxPetpetHeight = 0;
      for (const frame of petpet) {
        if (frame.dims.width > maxPetpetWidth) {
          maxPetpetWidth = frame.dims.width;
        }
        if (frame.dims.height > maxPetpetHeight) {
          maxPetpetHeight = frame.dims.height;
        }
      }

      const zoom = this.settings.get("zoom")!.value;
      const mirror = this.settings.get("mirror")!.value;
      const squishAmount = this.settings.get("squishAmount")!.value;

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = Math.round(maxPetpetWidth * zoom);
      const height = Math.round(maxPetpetHeight * zoom);
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

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < petpet.length; i++) {
        ctx.clearRect(0, 0, width, height);

        const frame = petpet[i];
        const imageData = ctx.createImageData(frame.dims.width, frame.dims.height);
        imageData.data.set(frame.patch);

        const imgAspect = origWidth / origHeight;
        const targetAspect = width / height;
        let drawWidth = width;
        let drawHeight = height;
        if (imgAspect > targetAspect) {
          drawHeight = Math.round(width / imgAspect);
        } else {
          drawWidth = Math.round(height * imgAspect);
        }

        drawWidth = Math.round(drawWidth * baseImageSizeFactor);
        drawHeight = Math.round(drawHeight * baseImageSizeFactor);

        const shrinkAmount = baseImageShrinkAmount * Math.sin(Math.PI * i / petpet.length) * squishAmount;
        drawHeight = Math.round(drawHeight * (1 - shrinkAmount));

        const flareAmount = baseImageFlareAmount * Math.sin(Math.PI * i / petpet.length) * squishAmount;
        drawWidth = Math.round(drawWidth * (1 + flareAmount));

        const drawX = Math.round((width - drawWidth) / 2);
        const drawY = Math.round(height - drawHeight);
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Draw the petpet image on top.
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        const frameImage = await this.toImage(imageData);
        ctx.drawImage(
            frameImage,
            frame.dims.left * zoom,
            frame.dims.top * zoom,
            frame.dims.width * zoom,
            frame.dims.height * zoom);
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

  private async toImage(imageData: ImageData): Promise<HTMLImageElement> {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')!!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    console.log("Created canvas with size", canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    var image = new Image();
    image.src = canvas.toDataURL();
    await new Promise((resolve) => { image.onload = resolve; });
    return image;
}
}
