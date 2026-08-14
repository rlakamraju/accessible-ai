import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  imports: [],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  // Intentional violation: 4.1.2 Name, Role, Value — this only controls a
  // dismissible promo banner via a mouse `(click)` handler on an icon-only
  // close button with no aria-label (see contact.html/contact.css).
  showBanner = true;

  dismissBanner(): void {
    this.showBanner = false;
  }
}
