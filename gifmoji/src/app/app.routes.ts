import { Routes } from '@angular/router';
import { StartComponent } from './start.component';
import { GifmojifyComponent } from './gifmojify.component';

export const routes: Routes = [
  { path: '', component: StartComponent },
  { path: 'gifmojify', component: GifmojifyComponent },
];
