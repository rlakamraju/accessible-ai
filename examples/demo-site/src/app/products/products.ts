import { Component } from '@angular/core';

interface Product {
  name: string;
  price: string;
  image: string;
  imageAlt: string;
  outOfStock?: boolean;
}

@Component({
  selector: 'app-products',
  imports: [],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products {
  // Intentional violation: 2.1.1 Keyboard — this is the only state driving the
  // custom "Sort by" dropdown below. It is toggled exclusively by a mouse
  // `(click)` handler in the template; there is no keydown handler, no
  // role="listbox"/"option" semantics, and no tabindex, so the widget cannot
  // be operated from a keyboard.
  sortOpen = false;
  sortLabel = 'Featured';

  products: Product[] = [
    {
      name: 'Wireless Headphones',
      price: '$59.99',
      image: 'assets/product-headphones.svg',
      // Intentional violation: 1.1.1 Non-text Content — alt="" (empty) is only
      // appropriate for purely decorative images. This photo is the sole
      // representation of the product being sold, so an empty alt hides
      // meaningful content from screen-reader users.
      imageAlt: '',
    },
    {
      name: 'Ceramic Coffee Mug',
      price: '$14.50',
      image: 'assets/product-mug.svg',
      // Intentional violation: 1.1.1 Non-text Content — alt text is a raw
      // filename, not a description of the product. This isn't caught by an
      // automated "alt attribute present?" check, but fails 1.1.1 on manual
      // review because it conveys no information about the image's content.
      imageAlt: 'IMG_2043.JPG',
      outOfStock: true,
    },
    {
      name: 'Travel Backpack',
      price: '$89.00',
      image: 'assets/product-backpack.svg',
      imageAlt: 'Grey travel backpack with padded straps, front pocket, and laptop sleeve.',
    },
    {
      name: 'Desk Lamp',
      price: '$32.25',
      image: 'assets/product-lamp.svg',
      imageAlt: 'Adjustable wooden desk lamp with a triangular fabric shade.',
    },
  ];

  toggleSort(): void {
    this.sortOpen = !this.sortOpen;
  }

  selectSort(label: string): void {
    this.sortLabel = label;
    this.sortOpen = false;
  }
}
