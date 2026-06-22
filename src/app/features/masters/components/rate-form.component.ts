import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { MasterService } from '../master.service';
import { CarrierOption, CarriersPickerService } from '../carriers-picker.service';
import { RATE_TYPE_OPTIONS, RateResponse, RateType } from '../models/rate.model';

@Component({
  selector: 'app-rate-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg" title="Create rate"
               subtitle="Add a lane rate (origin → destination) for a carrier."
               (close)="cancel()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="grid">
          <label class="field grow">
            <span class="lbl">Carrier <i>*</i></span>
            <select formControlName="carrierId">
              <option value="" disabled>{{ loadingCarriers() ? 'Loading carriers…' : 'Select a carrier' }}</option>
              @for (c of carriers(); track c.id) {
                <option [value]="c.id">{{ c.name }} · {{ c.gstNumber }}</option>
              }
            </select>
            @if (showError('carrierId')) { <em class="err">{{ errorFor('carrierId') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Service type <i>*</i></span>
            <input type="text" formControlName="serviceType" placeholder="e.g. EXPRESS / STANDARD" maxlength="50" />
            @if (showError('serviceType')) { <em class="err">{{ errorFor('serviceType') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Origin <i>*</i></span>
            <input type="text" formControlName="origin" placeholder="e.g. DEL" maxlength="100" />
            @if (showError('origin')) { <em class="err">{{ errorFor('origin') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Destination <i>*</i></span>
            <input type="text" formControlName="destination" placeholder="e.g. BOM" maxlength="100" />
            @if (showError('destination')) { <em class="err">{{ errorFor('destination') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Rate type <i>*</i></span>
            <select formControlName="rateType">
              @for (o of rateTypeOptions; track o.value) {
                <option [ngValue]="o.value">{{ o.label }} · {{ o.hint }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span class="lbl">Rate value <i>*</i></span>
            <input type="number" min="0.01" step="0.01" formControlName="rateValue" placeholder="0.00" />
            @if (showError('rateValue')) { <em class="err">{{ errorFor('rateValue') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Effective from <i>*</i></span>
            <input type="date" formControlName="effectiveFrom" />
            @if (showError('effectiveFrom')) { <em class="err">{{ errorFor('effectiveFrom') }}</em> }
          </label>

          <label class="field">
            <span class="lbl">Effective to</span>
            <input type="date" formControlName="effectiveTo" />
            @if (form.hasError('effectiveOrder')) {
              <em class="err">"Effective to" must be after "Effective from".</em>
            }
          </label>
        </div>
      </form>

      <div modal-footer>
        <button type="button" class="btn-ghost" (click)="cancel()" [disabled]="saving()">Cancel</button>
        <button type="button" class="btn-primary" (click)="submit()" [disabled]="saving() || form.invalid">
          @if (saving()) { <span class="spinner"></span> Creating… } @else { Create rate }
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .field {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 12.5px; color: var(--color-text);
    }
    .field.grow { grid-column: 1 / -1; }
    .field .lbl { font-weight: 600; color: var(--color-text-muted); font-size: 12px; }
    .field i { color: var(--color-error); font-style: normal; font-weight: 600; }
    .field input, .field select {
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
      transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .field input:focus, .field select:focus {
      outline: none;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
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
    .btn-ghost:hover:not(:disabled) { background: var(--color-surface-2); color: var(--color-text); }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class RateFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly master = inject(MasterService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) open: boolean = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<RateResponse>();

  readonly rateTypeOptions = RATE_TYPE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    carrierId:     ['', [Validators.required]],
    origin:        ['', [Validators.required, Validators.maxLength(100)]],
    destination:   ['', [Validators.required, Validators.maxLength(100)]],
    serviceType:   ['', [Validators.required, Validators.maxLength(50)]],
    rateType:      [RateType.CWT as RateType],
    rateValue:     [0, [Validators.required, Validators.min(0.01)]],
    effectiveFrom: [this.today(), [Validators.required]],
    effectiveTo:   ['']
  }, {
    validators: [effectiveOrderValidator]
  });

  readonly carriers = signal<CarrierOption[]>([]);
  readonly loadingCarriers = signal(false);
  readonly saving = signal(false);

  ngOnInit(): void { this.loadCarriers(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({
        carrierId: '', origin: '', destination: '', serviceType: '',
        rateType: RateType.CWT, rateValue: 0,
        effectiveFrom: this.today(), effectiveTo: ''
      });
      if (this.carriers().length === 0) this.loadCarriers();
    }
  }

  private loadCarriers(): void {
    this.loadingCarriers.set(true);
    this.carriersPicker.load().pipe(finalize(() => this.loadingCarriers.set(false))).subscribe({
      next: (opts) => this.carriers.set(opts),
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not load carriers.');
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.master
      .createRate({
        carrierId: v.carrierId,
        origin: v.origin.trim().toUpperCase(),
        destination: v.destination.trim().toUpperCase(),
        serviceType: v.serviceType.trim().toUpperCase(),
        rateType: Number(v.rateType) as RateType,
        rateValue: Number(v.rateValue),
        effectiveFrom: this.toIsoDate(v.effectiveFrom),
        effectiveTo: v.effectiveTo ? this.toIsoDate(v.effectiveTo) : null
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (r) => {
          this.toast.success(`Rate ${r.origin} → ${r.destination} created.`);
          this.created.emit(r);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not create rate.');
        }
      });
  }

  cancel(): void {
    if (!this.saving()) this.closed.emit();
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  errorFor(field: keyof typeof this.form.controls): string {
    const c = this.form.controls[field];
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('min')) return 'Must be greater than zero.';
    if (c.hasError('maxlength')) return 'This value is too long.';
    return 'Invalid value.';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private toIsoDate(v: string): string {
    // <input type="date"> already gives yyyy-MM-dd; widen to UTC midnight ISO.
    return new Date(v + 'T00:00:00Z').toISOString();
  }
}

function effectiveOrderValidator(group: AbstractControl): ValidationErrors | null {
  const from = group.get('effectiveFrom')?.value as string | null;
  const to   = group.get('effectiveTo')?.value as string | null;
  if (!from || !to) return null;
  return new Date(to) > new Date(from) ? null : { effectiveOrder: true };
}
