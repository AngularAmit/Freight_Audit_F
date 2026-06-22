import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

import { MasterService } from '../master.service';
import {
  ACCESSORIAL_TYPE_OPTIONS,
  ACCESSORIAL_UNIT_OPTIONS,
  AccessorialType,
  AccessorialUnit,
  RateResponse
} from '../models/rate.model';

@Component({
  selector: 'app-rate-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DecimalPipe, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg"
               [title]="rate ? (rate.origin + ' → ' + rate.destination + ' · ' + rate.serviceType) : 'Rate'"
               [subtitle]="rate ? (rate.carrierName + ' · ' + rate.rateType + ' rate') : ''"
               (close)="closed.emit()">
      @if (rate) {
        <section class="section">
          <header class="section-head">
            <h4>Rate summary</h4>
            <span class="status-pill" [class.status-pill--off]="!rate.isActive">
              <span class="dot"></span>
              {{ rate.isActive ? 'Active' : 'Inactive' }}
            </span>
          </header>

          <div class="summary-grid">
            <div class="cell">
              <span class="lbl">Rate value</span>
              <strong class="val">{{ rate.rateValue | number: '1.2-2' }}</strong>
              <span class="muted">per {{ rate.rateType === 'CWT' ? '100 lb' : 'shipment' }}</span>
            </div>
            <div class="cell">
              <span class="lbl">Effective from</span>
              <strong>{{ rate.effectiveFrom | date: 'mediumDate' }}</strong>
            </div>
            <div class="cell">
              <span class="lbl">Effective to</span>
              <strong>{{ rate.effectiveTo ? (rate.effectiveTo | date: 'mediumDate') : '— open ended' }}</strong>
            </div>
            <div class="cell">
              <span class="lbl">Service</span>
              <strong>{{ rate.serviceType }}</strong>
            </div>
          </div>
        </section>

        <section class="section">
          <header class="section-head">
            <h4>Accessorials <span class="counter">{{ rate.accessorials.length }}</span></h4>
            <span class="hint">Liftgate, residential, fuel surcharge, etc.</span>
          </header>

          @if (rate.accessorials.length === 0) {
            <div class="empty">No accessorial charges yet. Add one below.</div>
          } @else {
            <table class="acc-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                @for (a of rate.accessorials; track a.id) {
                  <tr>
                    <td><strong>{{ formatType(a.type) }}</strong></td>
                    <td>{{ a.value | number: '1.2-2' }}</td>
                    <td>
                      <span class="unit-pill" [class.unit-pill--pct]="a.unit === 'PERCENT'">
                        {{ a.unit === 'PERCENT' ? '% of base' : 'flat' }}
                      </span>
                    </td>
                    <td class="muted">{{ a.createdAt | date: 'mediumDate' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (canCreate()) {
            <form class="acc-form" [formGroup]="accForm" (ngSubmit)="addAccessorial()" novalidate>
              <h5>Add accessorial</h5>
              <div class="grid">
                <label class="field">
                  <span class="lbl">Type <i>*</i></span>
                  <select formControlName="type">
                    @for (o of accessorialTypeOptions; track o.value) {
                      <option [ngValue]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span class="lbl">Unit <i>*</i></span>
                  <select formControlName="unit">
                    @for (o of accessorialUnitOptions; track o.value) {
                      <option [ngValue]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span class="lbl">Value <i>*</i></span>
                  <input type="number" min="0.01" step="0.01" formControlName="value"
                         [placeholder]="accForm.controls.unit.value === percentUnit ? 'e.g. 12.5' : 'e.g. 250.00'" />
                  @if (showAccError('value')) { <em class="err">{{ accErrorFor('value') }}</em> }
                </label>
                <button type="submit" class="btn-primary" [disabled]="adding() || accForm.invalid">
                  @if (adding()) { <span class="spinner"></span> Adding… } @else { Add accessorial }
                </button>
              </div>
              @if (accForm.controls.unit.value === percentUnit) {
                <em class="hint">Percent values must be ≤ 100.</em>
              }
            </form>
          }
        </section>
      }

      <div modal-footer>
        <button type="button" class="btn-ghost" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .section { margin-bottom: 22px; }
    .section:last-child { margin-bottom: 0; }
    .section-head {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      margin-bottom: 10px;
      h4 { margin: 0; font-size: 13px; font-weight: 700; color: var(--color-text); display: inline-flex; align-items: center; gap: 8px; }
      .hint { font-size: 11.5px; color: var(--color-text-muted); }
    }

    .counter {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 20px; padding: 0 7px;
      background: var(--color-primary-100); color: var(--color-primary-700);
      border-radius: 999px; font-size: 11px; font-weight: 700;
    }

    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 999px;
      letter-spacing: 0.3px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
    .status-pill--off { background: var(--color-surface-2); color: var(--color-text-muted); border-color: var(--color-border); }
    .status-pill--off .dot { background: #d1d5db; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .summary-grid .cell {
      display: flex; flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
    }
    .summary-grid .cell:nth-child(2n) { border-right: none; }
    .summary-grid .cell:nth-last-child(-n+2) { border-bottom: none; }
    .summary-grid .lbl {
      font-size: 11px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .summary-grid strong { font-size: 13.5px; color: var(--color-text); font-weight: 600; }
    .summary-grid .val { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
    .summary-grid .muted { font-size: 11.5px; color: var(--color-text-muted); }

    .empty {
      padding: 18px;
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      font-size: 12.5px;
    }

    .acc-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .acc-table thead th {
      text-align: left; padding: 10px 14px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-border);
    }
    .acc-table tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
    }
    .acc-table tbody tr:last-child td { border-bottom: none; }
    .muted { color: var(--color-text-muted); font-size: 12.5px; }

    .unit-pill {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 2px 9px; border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .unit-pill--pct {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border-color: var(--color-primary-100);
    }

    .acc-form {
      padding: 14px 16px;
      background: var(--color-surface-2);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
    }
    .acc-form h5 { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--color-text-muted); }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr auto;
      gap: 10px;
      align-items: end;
    }
    .field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
    .field .lbl { font-weight: 600; color: var(--color-text-muted); font-size: 11.5px; }
    .field i { color: var(--color-error); font-style: normal; font-weight: 600; }
    .field input, .field select {
      height: 36px; padding: 0 10px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .field input:focus, .field select:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }
    .hint { display: block; margin-top: 8px; font-size: 11.5px; color: var(--color-text-muted); font-style: normal; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
      height: 36px;
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .btn-ghost {
      padding: 9px 14px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 720px) {
      .summary-grid { grid-template-columns: 1fr; }
      .summary-grid .cell { border-right: none; }
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class RateDetailComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly master = inject(MasterService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  @Input({ required: true }) open: boolean = false;
  @Input() rate: RateResponse | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<RateResponse>();

  readonly accessorialTypeOptions = ACCESSORIAL_TYPE_OPTIONS;
  readonly accessorialUnitOptions = ACCESSORIAL_UNIT_OPTIONS;
  readonly percentUnit = AccessorialUnit.PERCENT;

  readonly accForm = this.fb.nonNullable.group({
    type:  [AccessorialType.LIFTGATE as AccessorialType],
    unit:  [AccessorialUnit.FLAT as AccessorialUnit],
    value: [0, [Validators.required, Validators.min(0.01)]]
  });

  readonly adding = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rate']) {
      this.accForm.reset({
        type: AccessorialType.LIFTGATE,
        unit: AccessorialUnit.FLAT,
        value: 0
      });
    }
  }

  canCreate = computed(() => this.perms.hasPermission('RATE', 'canCreate'));

  formatType(raw: string): string {
    return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  addAccessorial(): void {
    if (!this.rate || this.accForm.invalid) {
      this.accForm.markAllAsTouched();
      return;
    }
    const v = this.accForm.getRawValue();
    const value = Number(v.value);
    const unit = Number(v.unit) as AccessorialUnit;

    if (unit === AccessorialUnit.PERCENT && value > 100) {
      this.toast.error('Percent values cannot exceed 100.');
      return;
    }

    this.adding.set(true);
    this.master
      .addAccessorial(this.rate.id, {
        type: Number(v.type) as AccessorialType,
        value,
        unit
      })
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Accessorial added.');
          this.master.getRate(this.rate!.id).subscribe({
            next: (r) => this.updated.emit(r),
            error: () => undefined
          });
          this.accForm.reset({ type: AccessorialType.LIFTGATE, unit: AccessorialUnit.FLAT, value: 0 });
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not add accessorial.');
        }
      });
  }

  showAccError(field: keyof typeof this.accForm.controls): boolean {
    const c = this.accForm.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }
  accErrorFor(field: keyof typeof this.accForm.controls): string {
    const c = this.accForm.controls[field];
    if (c.hasError('required')) return 'Required.';
    if (c.hasError('min')) return 'Must be > 0.';
    return 'Invalid.';
  }
}
