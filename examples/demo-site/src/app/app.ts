import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Intentional violation: 2.1.1 Keyboard — this state is only ever toggled from
  // a mouse `(click)` handler in the template; there is no keydown handling, no
  // `role`, and no `tabindex` on the toggle element, so the "More" menu is
  // completely unreachable from the keyboard.
  moreOpen = false;

  // Mobile nav toggle — see the hamburger button in app.html, which also has
  // no accessible name (intentional violation: 4.1.2 Name, Role, Value).
  mobileNavOpen = false;

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  toggleMore(): void {
    this.moreOpen = !this.moreOpen;
  }
}
