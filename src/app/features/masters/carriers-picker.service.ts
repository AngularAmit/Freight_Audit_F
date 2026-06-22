import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { CarrierService } from '../carriers/carrier.service';

export interface CarrierOption {
  id: string;
  name: string;
  gstNumber: string;
}

/**
 * Lazily-loaded carrier catalogue used by Contract / Rate forms.
 *
 * Calls `GET /api/carriers` once with a generous page size and caches the
 * result for the session. Cleared on logout via `clear()` or by injecting
 * a fresh instance per route activation.
 */
@Injectable({ providedIn: 'root' })
export class CarriersPickerService {
  private readonly carriers = inject(CarrierService);
  private cache: CarrierOption[] | null = null;

  load(force: boolean = false): Observable<CarrierOption[]> {
    if (!force && this.cache) return of(this.cache);
    return this.carriers.list({ page: 1, pageSize: 200 }).pipe(
      map((p) =>
        p.items.map((c) => ({ id: c.id, name: c.name, gstNumber: c.gstNumber }))
          .sort((a, b) => a.name.localeCompare(b.name))
      ),
      tap((opts) => (this.cache = opts))
    );
  }

  clear(): void { this.cache = null; }
}
