
export class ActionResult {
  constructor(public url: string) {}
}

export abstract class BaseAction {
  abstract execute(imageUrl: string): Promise<ActionResult>;

  // Given an existing image with potentially partially-transparent pixels, convert it to
  // a format that GIF will interpret correctly by replacing transparent pixels with magenta.
  // Any other pixels are made fully opaque. Any pixels that are already magenta are made slightly
  // off-magenta to avoid confusion with transparency.
  protected fixTransparency(ctx: CanvasRenderingContext2D, width: number, height: number) {
    var numTransparentPixels = 0;
    var numMagentaPixels = 0;
    var numSemiTransparentPixels = 0;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] === 0) {
        numTransparentPixels++;
        // Transparent pixel: set to magenta
        data[p] = 255;   // R
        data[p + 1] = 0; // G
        data[p + 2] = 255; // B
        data[p + 3] = 255; // Opaque
      } else if (data[p] === 255 && data[p + 1] === 0 && data[p + 2] === 255) {
        // If it's already magenta, make it slightly off-magenta to avoid confusion with transparency.
        data[p] = 254;
        numMagentaPixels++;
      } else {
        numSemiTransparentPixels++;
        // Make every other pixel fully opaque.
        data[p + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

}

