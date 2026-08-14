import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Products } from './products/products';
import { Checkout } from './checkout/checkout';
import { Contact } from './contact/contact';

export const routes: Routes = [
  { path: '', component: Home, title: 'ShopEasy — Home' },
  { path: 'products', component: Products, title: 'ShopEasy — Products' },
  { path: 'checkout', component: Checkout, title: 'ShopEasy — Checkout' },
  { path: 'contact', component: Contact, title: 'ShopEasy — Contact' },
  { path: '**', redirectTo: '' },
];
