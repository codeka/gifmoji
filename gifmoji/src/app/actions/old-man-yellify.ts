import GIF from "gif.js";
import { ActionResult, BaseAction } from "./base-action";
import { ActionSetting } from "./action-setting";

import { parseGIF, decompressFrames, ParsedFrame } from 'gifuct-js'

export class OldManYellify extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["animated", new ActionSetting('Animated', 'checkbox', false)],
    ["zoom", new ActionSetting('Zoom', 'number', 2)],
    ["frameDelay", new ActionSetting('Frame Delay', 'number', 40)],
    ["frameSkip", new ActionSetting('Frame Skip', 'number', 2)],
    ["inputShrink", new ActionSetting('Input Shrink', 'number', 0.6)],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      var parsedFrames: ParsedFrame[] | null = null;
      var img: HTMLImageElement | null = null;
      if (this.settings.get("animated")!.value) {
        parsedFrames = await fetch(imageUrl)
          .then(resp => resp.arrayBuffer())
          .then(buff => parseGIF(buff))
          .then(gif => decompressFrames(gif, true));
      } else {
        img = new Image();
        img.src = imageUrl;
        await new Promise((resolve) => { img!.onload = resolve; });
      }

      var oldman = await fetch("/old-man.gif")
          .then(resp => resp.arrayBuffer())
          .then(buff => parseGIF(buff))
          .then(gif => decompressFrames(gif, true));

      var maxOldmanWidth = 0;
      var maxOldmanHeight = 0;
      for (const frame of oldman) {
        if (frame.dims.width > maxOldmanWidth) {
          maxOldmanWidth = frame.dims.width;
        }
        if (frame.dims.height > maxOldmanHeight) {
          maxOldmanHeight = frame.dims.height;
        }
      }

      const zoom = this.settings.get("zoom")!.value;
      const frameSkip = this.settings.get("frameSkip")!.value;

      var origWidth = 0;
      var origHeight = 0;
      if (img) {
        origWidth = img.width;
        origHeight = img.height;
      } else if (parsedFrames) {
        for (const frame of parsedFrames) {
          if (frame.dims.width > origWidth) {
            origWidth = frame.dims.width;
          }
          if (frame.dims.height > origHeight) {
            origHeight = frame.dims.height;
          }
        }
      }
      const width = Math.round(maxOldmanWidth * zoom);
      const height = Math.round(maxOldmanHeight * zoom);
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

      var parsedFrameIndex = 0;
      for (let i = 0; i < oldman.length * frameSkip; i++) {
        ctx.clearRect(0, 0, width, height);

        console.log("oldman frame", Math.floor(i / frameSkip), "with dims", oldman[Math.floor(i / frameSkip)].dims);
        const frame = oldman[Math.floor(i / frameSkip)];
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

        const inputShrink = this.settings.get("inputShrink")!.value;
        drawWidth = Math.round(drawWidth * inputShrink);
        drawHeight = Math.round(drawHeight * inputShrink);

        if (img) {
          ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
        } else if (parsedFrames) {
          console.log("Drawing frame", parsedFrameIndex, "with dims", frame.dims);
          const inputFrame = parsedFrames[parsedFrameIndex];
          const inputImageData = ctx.createImageData(inputFrame.dims.width, inputFrame.dims.height);
          inputImageData.data.set(inputFrame.patch);
          const inputFrameImage = await this.toImage(inputImageData)

          ctx.drawImage(inputFrameImage, 0, 0, drawWidth, drawHeight);

          parsedFrameIndex = (parsedFrameIndex + 1) % parsedFrames.length;
        }

        // Draw the oldman image on top.
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
