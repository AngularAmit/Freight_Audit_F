import { Component } from '@angular/core';
import { InvoiceListComponent } from '../invoices/components/invoice-list.component';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [InvoiceListComponent],
  template: `<app-invoice-list></app-invoice-list>`,
  styles: [`:host { display: block; }`]
})
export class TransactionsComponent {}
