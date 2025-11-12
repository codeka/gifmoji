import { Component, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import GIF from 'gif.js';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gifmojify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gifmojify.component.html',
  styleUrls: ['./gifmojify.component.css'],
})
export class GifmojifyComponent {
  @Input() image: File | null = null;

  styles = ["spinify"]
  selectedStyle = this.styles[0];
  frameDelay = 40;
  zoom = 1.0;
  reverse = false;
  numFrames = 24;
  blurFrames = 0;
  blurAmount = 1.0;

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
      this.generateSpinningGif();
    }
  }

  refresh() {
    if (this.selectedStyle === 'spinify') {
      this.generateSpinningGif();
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

    console.log(`Fixed transparency: ${numTransparentPixels} transparent pixels, ${numMagentaPixels} magenta pixels, ${numSemiTransparentPixels} semi-transparent pixels.`);
  }

  private async generateSpinningGif() {
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
        const blurAngle = lastFullAngle + (currAngle - lastFullAngle) * (blurFrame / (this.blurFrames + 1));

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
}
