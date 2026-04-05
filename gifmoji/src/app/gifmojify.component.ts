import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { Router, ɵEmptyOutletComponent } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BaseAction } from './actions/base-action';
import { Spinify } from './actions/spinify';
import { Intensify } from './actions/intensify';
import { Borderize } from './actions/borderize';
import { Petify } from './actions/petify';

@Component({
  selector: 'app-gifmojify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gifmojify.component.html',
  styleUrls: ['./gifmojify.component.css'],
})
export class GifmojifyComponent {
  @Input() image: File | null = null;

  action: BaseAction | null = null;

  styles = ["spinify", "intensify", "borderize", "petify"];
  selectedStyle = this.styles[1];
  currentStyle = "";

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
    if (this.selectedStyle !== this.currentStyle) {
      if (this.selectedStyle === 'spinify') {
        this.action = new Spinify();
      } else if (this.selectedStyle === 'intensify') {
        this.action = new Intensify();
      } else if (this.selectedStyle === 'borderize') {
        this.action = new Borderize();
      } else if (this.selectedStyle === 'petify') {
        this.action = new Petify();
      }
      this.currentStyle = this.selectedStyle;
    }

    if (this.action) {
      this.action.execute(this.imageUrl).then((result) => {
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
