import { Component, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import GIF from 'gif.js';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

class Point2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}


@Component({
  selector: 'app-gifmojify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gifmojify.component.html',
  styleUrls: ['./gifmojify.component.css'],
})
export class GifmojifyComponent {
  @Input() image: File | null = null;

  styles = ["spinify", "intensify", "borderize"]
  selectedStyle = this.styles[0];
  frameDelay = 40;
  zoom = 1.0;
  numFrames = 24;
  blurFrames = 0;
  blurAmount = 0.3;
  blurLength = 0.5;

  // Spinify-specific settings.
  reverse = false;

  // Intensify-specific settings.
  intensity = 5.0;

  // Borderize-specific settings.
  borderSize = 5;
  borderColor = '#FFFFFF';

  // Cache the object URL so it doesn't change on every CD cycle.
  imageUrl: string = '';

  gifUrl: string = '';
  private gifObjectUrl: string = '';

  constructor(private router: Router, private cdr: ChangeDetectorRef) {
    // Retrieve the image from the router state
    const navigation = this.router.getCurrentNavigation();
    this.image = navigation?.extras.state?.['image'] || null;
    if (this.image) {
      this.imageUrl = URL.createObjectURL(this.image);
      this.generateSpinifyGif();
    }
  }

  refresh() {
    if (this.selectedStyle === 'spinify') {
      this.generateSpinifyGif();
    } else if (this.selectedStyle === 'intensify') {
      this.generateIntensifyGif();
    } else if (this.selectedStyle === 'borderize') {
      this.generateBorderizePng();
    }
  }

  // Given an existing image with potentially partially-transparent pixels, convert it to
  // a format that GIF will interpret correctly by replacing transparent pixels with magenta.
  // Any other pixels are made fully opaque. Any pixels that are already magenta are made slightly
  // off-magenta to avoid confusion with transparency.
  private fixTransparency(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

  private async generateSpinifyGif() {
    if (!this.imageUrl) return;
    const img = new Image();
    img.src = this.imageUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const origWidth = img.naturalWidth;
    const origHeight = img.naturalHeight;
    const width = origWidth * this.zoom;
    const height = origHeight * this.zoom;
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

    const direction = this.reverse ? -1 : 1;

    for (let i = 0; i < this.numFrames; i++) {
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2.0, height / 2.0);
      ctx.rotate(direction * (2 * Math.PI * i) / this.numFrames);
      ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
      ctx.restore();

      for (let blurFrame = 0; blurFrame < this.blurFrames; blurFrame++) {
        ctx.save();
        const blurAlpha = this.blurAmount * (1.0 - (blurFrame / (this.blurFrames + 1)));
        const lastFullAngle = direction * (2 * Math.PI * (i - 1)) / this.numFrames;
        const currAngle = direction * (2 * Math.PI * i) / this.numFrames;
        const firstBlurAngle = lastFullAngle + (currAngle - lastFullAngle) * (1.0 - this.blurLength);
        const blurAngle = firstBlurAngle + (currAngle - firstBlurAngle) * (blurFrame / (this.blurFrames + 1));

        ctx.translate(width / 2.0, height / 2.0);
        ctx.rotate(blurAngle);
        ctx.globalAlpha = blurAlpha;
        ctx.drawImage(img, -origWidth / 2.0, -origHeight / 2.0, origWidth, origHeight);
        ctx.restore();
      }

      this.fixTransparency(ctx, width, height);
      gif.addFrame(ctx, { copy: true, delay: this.frameDelay, dispose: 2 });
    }

    console.log("rendering gif")
    gif.on('finished', (blob: Blob) => {
      console.log("finished")
      if (this.gifObjectUrl) {
        URL.revokeObjectURL(this.gifObjectUrl);
      }
      this.gifObjectUrl = URL.createObjectURL(blob);
      this.gifUrl = this.gifObjectUrl;
      this.cdr.detectChanges();
    });
    gif.render();
  }

  private async generateBorderizePng() {
    if (!this.imageUrl) return;
    const img = new Image();
    img.src = this.imageUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const zoomX = img.naturalWidth / (img.naturalWidth - 2 * this.borderSize);
    const zoomY = img.naturalHeight / (img.naturalHeight - 2 * this.borderSize);

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

    const { r: borderR, g: borderG, b: borderB } = parseHexColor(this.borderColor);
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
    ctx.fillStyle = this.borderColor;
    for (const point of edgePoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, this.borderSize, 0, 2 * Math.PI);
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

    if (this.gifObjectUrl) {
      try { URL.revokeObjectURL(this.gifObjectUrl); } catch {}
    }
    this.gifObjectUrl = URL.createObjectURL(blob);
    this.gifUrl = this.gifObjectUrl;
    this.cdr.detectChanges();
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

  private getIntensifyOffset(seed: number, frameNo: number): Point2D {
    const x = (Math.sin(seed + frameNo * 1.37) + Math.sin(seed * 1.79 + frameNo * 0.73)) * this.intensity;
    const y = (Math.sin(seed * 0.97 + frameNo * 1.49) + Math.sin(seed * 1.31 + frameNo * 0.91)) * this.intensity;
    return new Point2D(x, y);
  }

  private async generateIntensifyGif() {
    if (!this.imageUrl) return;
    const img = new Image();
    img.src = this.imageUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const origWidth = img.naturalWidth;
    const origHeight = img.naturalHeight;
    const width = origWidth * this.zoom;
    const height = origHeight * this.zoom;
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

    const randomSeed = this.getRandomInt(1000000);

    for (let i = 0; i < this.numFrames; i++) {
      ctx.clearRect(0, 0, width, height);

      const offset = this.getIntensifyOffset(randomSeed, i);

      ctx.save();
      ctx.translate(width / 2.0, height / 2.0);
      ctx.drawImage(img, -origWidth / 2.0 + offset.x, -origHeight / 2.0 + offset.y, origWidth, origHeight);
      ctx.restore();

      for (let blurFrame = 0; blurFrame < this.blurFrames; blurFrame++) {
        ctx.save();
        const blurAlpha = this.blurAmount * (1.0 - (blurFrame / (this.blurFrames + 1)));
        const lastIndex = i - 1 < 0 ? this.numFrames - 1 : i - 1;
        const lastOffset = this.getIntensifyOffset(randomSeed, lastIndex);
        const firstOffset = new Point2D(
          lastOffset.x + (offset.x - lastOffset.x) * (1.0 - this.blurLength),
          lastOffset.y + (offset.y - lastOffset.y) * (1.0 - this.blurLength));
        const blurOffset = new Point2D(
          firstOffset.x + (offset.x - firstOffset.x) * (blurFrame / (this.blurFrames + 1)),
          firstOffset.y + (offset.y - firstOffset.y) * (blurFrame / (this.blurFrames + 1)));

        ctx.translate(width / 2.0, height / 2.0);
        ctx.globalAlpha = blurAlpha;
        ctx.drawImage(img, -origWidth / 2.0 + blurOffset.x, -origHeight / 2.0 + blurOffset.y, origWidth, origHeight);
        ctx.restore();
      }

      this.fixTransparency(ctx, width, height);
      gif.addFrame(ctx, { copy: true, delay: this.frameDelay, dispose: 2 });
    }

    console.log("rendering gif")
    gif.on('finished', (blob: Blob) => {
      console.log("finished")
      if (this.gifObjectUrl) {
        URL.revokeObjectURL(this.gifObjectUrl);
      }
      this.gifObjectUrl = URL.createObjectURL(blob);
      this.gifUrl = this.gifObjectUrl;
      this.cdr.detectChanges();
    });
    gif.render();
  }

  ngOnDestroy(): void {
    if (this.imageUrl) {
      try {
        URL.revokeObjectURL(this.imageUrl);
      } catch {
        // ignore revoke errors in environments that don't support it
      }
    }
    if (this.gifObjectUrl) {
      try {
        URL.revokeObjectURL(this.gifObjectUrl);
      } catch {
        // ignore revoke errors
      }
    }
  }

  // Utility: return a random integer in [0, max)
  private getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.max(1, Math.floor(max)));
  }
}
