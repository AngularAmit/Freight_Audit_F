import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { MasterService } from '../master.service';
import { CarrierOption, CarriersPickerService } from '../carriers-picker.service';
import { ContractResponse } from '../models/contract.model';

@Component({
  selector: 'app-contract-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal [open]="open" title="Create contract"
               subtitle="Link a carrier with a master contract — file & SLA rules can be added next."
               (close)="cancel()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label class="field">
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
          <span class="lbl">Contract name <i>*</i></span>
          <input type="text" formControlName="contractName"
                 placeholder="e.g. FY26 Freight Master · BlueDart" maxlength="200" />
          @if (showError('contractName')) { <em class="err">{{ errorFor('contractName') }}</em> }
        </label>

        <label class="toggle">
          <input type="checkbox" formControlName="isActive" />
          <span class="track"><span class="thumb"></span></span>
          <div class="meta">
            <strong>Active</strong>
            <small>Active contracts are used by the audit engine for rate validation.</small>
          </div>
        </label>
      </form>

      <div modal-footer>
        <button type="button" class="btn-ghost" (click)="cancel()" [disabled]="saving()">Cancel</button>
        <button type="button" class="btn-primary" (click)="submit()" [disabled]="saving() || form.invalid">
          @if (saving()) { <span class="spinner"></span> Creating… } @else { Create contract }
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .field {
      display: flex; flex-direction: column; gap: 6px;
      margin-bottom: 14px;
      font-size: 12.5px; color: var(--color-text);
    }
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

    .toggle {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      cursor: pointer;
    }
    .toggle input { display: none; }
    .toggle .track {
      width: 36px; height: 20px;
      flex-shrink: 0;
      background: #d1d5db;
      border-radius: 999px;
      position: relative;
      transition: background 0.2s var(--ease-out);
    }
    .toggle .thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 16px; height: 16px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.18);
      transition: left 0.2s var(--ease-out);
    }
    .toggle input:checked + .track { background: var(--color-primary-500); }
    .toggle input:checked + .track .thumb { left: 18px; }
    .toggle .meta strong { display: block; font-size: 13px; color: var(--color-text); font-weight: 600; }
    .toggle .meta small { font-size: 11.5px; color: var(--color-text-muted); }

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
  `]
})
export class ContractFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly master = inject(MasterService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) open: boolean = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<ContractResponse>();

  readonly form = this.fb.nonNullable.group({
    carrierId: ['', [Validators.required]],
    contractName: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true]
  });

  readonly carriers = signal<CarrierOption[]>([]);
  readonly loadingCarriers = signal(false);
  readonly saving = signal(false);

  ngOnInit(): void { this.loadCarriers(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({ carrierId: '', contractName: '', isActive: true });
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
      .createContract({
        carrierId: v.carrierId,
        contractName: v.contractName.trim(),
        isActive: v.isActive
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (c) => {
          this.toast.success(`Contract "${c.contractName}" created.`);
          this.created.emit(c);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not create contract.');
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
    if (c.hasError('maxlength')) return 'This value is too long.';
    return 'Invalid value.';
  }
}
