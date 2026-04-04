import { ActionSetting } from "./action-setting";
import { ActionResult, BaseAction } from "./base-action";

export interface BorderizeOptions {
  zoom: number;
  borderSize: number;
  borderColor: string;
}

class Point2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Borderize extends BaseAction {
  override settings = new Map<string, ActionSetting>([
    ["zoom", new ActionSetting('Zoom', 'number', 1.0)],
    ["borderSize", new ActionSetting('Border Size', 'number', 5.0)],
    ["borderColor", new ActionSetting('Border Color', 'text', '#FFFFFF')],
  ]);

  override execute(imageUrl: string): Promise<ActionResult> {
    return new Promise(async (resolve) => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const borderSize = this.settings.get("borderSize")!.value;
      const borderColor = this.settings.get("borderColor")!.value;

      const zoomX = img.naturalWidth / (img.naturalWidth - 2 * borderSize);
      const zoomY = img.naturalHeight / (img.naturalHeight - 2 * borderSize);

      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      const width = Math.round(origWidth * zoomX);
      const height = Math.round(origHeight * zoomY);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true })!;

      // Draw the image first.
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        img, (width / 2) - (origWidth / 2), (height / 2) - (origHeight / 2), origWidth, origHeight);

      // Convert every non-transparent pixel to the provided border color, keep alpha unchanged.
      function parseHexColor(hex: string) {
        if (!hex) return { r: 255, g: 255, b: 255 };
        let s = hex.trim();
        if (s[0] === '#') s = s.slice(1);
        if (s.length === 3) {
          // expand shorthand like 'abc' -> 'aabbcc'
          s = s.split('').map((c) => c + c).join('');
        }
        if (s.length !== 6) return { r: 255, g: 255, b: 255 };
        const r = parseInt(s.slice(0, 2), 16);
        const g = parseInt(s.slice(2, 4), 16);
        const b = parseInt(s.slice(4, 6), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return { r: 255, g: 255, b: 255 };
        return { r, g, b };
      }

      const { r: borderR, g: borderG, b: borderB } = parseHexColor(borderColor);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let p = 0; p < data.length; p += 4) {
        const alpha = data[p + 3];
        if (alpha !== 0) {
          data[p] = borderR;
          data[p + 1] = borderG;
          data[p + 2] = borderB;
          // preserve alpha as-is
        }
      }

      // Find all the edge points -- that is, opaque pixels that have at least one transparent
      // neighbor.
      const edgePoints = this.findEdgePoints(data, width, height);

      // Draw border pixels
      ctx.save();
      ctx.fillStyle = borderColor;
      for (const point of edgePoints) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, borderSize, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();

      // Draw the original image again on top (preserves original pixels over the white conversion).
      ctx.drawImage(
        img, (width / 2) - (origWidth / 2), (height / 2) - (origHeight / 2), origWidth, origHeight);

      // Export as PNG and set gifUrl
      const blob: Blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create PNG blob'));
        }, 'image/png');
      });

      resolve(new ActionResult(URL.createObjectURL(blob)));
    });
  }

  /**
   * Finds "edge" points. That is, given an image that includes some transparent pixels, finds the
   * 2d coordinates of pixels that are opaque but have at least one neighboring pixel that is
   * transparent.
   */
  private findEdgePoints(data: Uint8ClampedArray, width: number, height: number): Point2D[] {
    const edgePoints: Point2D[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3];
        if (alpha < 10) {
          // Skip transparent pixels.
          continue;
        }

        // Check neighbors for transparency.
        // TODO: also check diagonals?
        const neighbors = [
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        ];
        for (const neighbor of neighbors) {
          const nx = x + neighbor.dx;
          const ny = y + neighbor.dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = (ny * width + nx) * 4;
            const nAlpha = data[nIndex + 3];
            if (nAlpha < 10) {
              edgePoints.push(new Point2D(x, y));
              break;
            }
          }
        }
      }
    }
    return edgePoints;
  }

}
