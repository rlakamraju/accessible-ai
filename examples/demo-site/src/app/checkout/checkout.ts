import { Component } from '@angular/core';

@Component({
  selector: 'app-checkout',
  imports: [],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  submitOrder(): void {
    // Demo fixture only — no real order processing.
  }
}
