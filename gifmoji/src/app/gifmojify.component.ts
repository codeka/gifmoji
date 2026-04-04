import { Component, Input, ChangeDetectorRef } from '@angular/core';
import GIF from 'gif.js';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ActionResult, BaseAction } from './actions/base-action';
import { Spinify } from './actions/spinify';
import { Intensify } from './actions/intensify';
import { Borderize } from './actions/borderize';

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
      this.refresh();
    }
  }

  refresh() {
    var action: BaseAction|null = null;
    if (this.selectedStyle === 'spinify') {
      action = new Spinify({
        zoom: this.zoom,
        reverse: this.reverse,
        numFrames: this.numFrames,
        frameDelay: this.frameDelay,
        blurFrames: this.blurFrames,
        blurAmount: this.blurAmount,
        blurLength: this.blurLength
      });
    } else if (this.selectedStyle === 'intensify') {
      action = new Intensify({
        zoom: this.zoom,
        intensity: this.intensity,
        numFrames: this.numFrames,
        frameDelay: this.frameDelay,
        blurFrames: this.blurFrames,
        blurAmount: this.blurAmount,
        blurLength: this.blurLength
      });
    } else if (this.selectedStyle === 'borderize') {
      action = new Borderize({
        zoom: this.zoom,
        borderSize: this.borderSize,
        borderColor: this.borderColor,
      });
    }

    if (action) {
      action.execute(this.imageUrl).then((result) => {
        if (this.gifObjectUrl) {
          URL.revokeObjectURL(this.gifObjectUrl);
        }
        this.gifObjectUrl = result.url;
        this.gifUrl = this.gifObjectUrl;
        this.cdr.detectChanges();
      });
    }
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
