import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { CarrierResponse, CreateCarrierDto } from '../../models/carrier.model';

@Component({
  selector: 'app-basic-details-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <header class="head">
        <h3>Basic details</h3>
        <p>Capture the legal entity, GST registration and primary contact for the carrier.</p>
      </header>

      <form class="grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label class="field">
          <span class="lbl">Carrier name <i>*</i></span>
          <input type="text" formControlName="name" [readOnly]="readOnly"
                 placeholder="e.g. Bluedart Express Ltd." autocomplete="organization" />
          @if (showError('name')) {
            <em class="err">{{ errorFor('name') }}</em>
          }
        </label>

        <label class="field">
          <span class="lbl">Legal entity <i>*</i></span>
          <input type="text" formControlName="legalEntity" [readOnly]="readOnly"
                 placeholder="Registered legal name" />
          @if (showError('legalEntity')) {
            <em class="err">{{ errorFor('legalEntity') }}</em>
          }
        </label>

        <label class="field">
          <span class="lbl">GST number <i>*</i></span>
          <input type="text" formControlName="gstNumber" [readOnly]="readOnly"
                 placeholder="22AAAAA0000A1Z5"
                 maxlength="15" autocomplete="off"
                 (input)="upperCaseGst($event)" />
          @if (showError('gstNumber')) {
            <em class="err">{{ errorFor('gstNumber') }}</em>
          } @else {
            <em class="hint">15-character format: 22AAAAA0000A1Z5</em>
          }
        </label>

        <label class="field">
          <span class="lbl">Geography <i>*</i></span>
          <input type="text" formControlName="geography" [readOnly]="readOnly"
                 placeholder="e.g. India / APAC / North America" />
          @if (showError('geography')) {
            <em class="err">{{ errorFor('geography') }}</em>
          }
        </label>

        <label class="field">
          <span class="lbl">Primary contact</span>
          <input type="text" formControlName="contactName" [readOnly]="readOnly" placeholder="Full name" />
        </label>

        <label class="field">
          <span class="lbl">Contact email</span>
          <input type="email" formControlName="contactEmail" [readOnly]="readOnly"
                 placeholder="ops@carrier.com" autocomplete="email" />
          @if (showError('contactEmail')) {
            <em class="err">{{ errorFor('contactEmail') }}</em>
          }
        </label>

        <label class="field">
          <span class="lbl">Contact phone</span>
          <input type="tel" formControlName="contactPhone" [readOnly]="readOnly"
                 placeholder="+91 98xxxxxxxx" autocomplete="tel" />
        </label>

        @if (!readOnly) {
          <div class="actions">
            <button type="submit" class="btn-primary" [disabled]="submitting() || form.invalid">
              @if (submitting()) {
                <span class="spinner" aria-hidden="true"></span> Creating carrier…
              } @else {
                Save & continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              }
            </button>
          </div>
        } @else {
          <div class="actions">
            <button type="button" class="btn-primary" (click)="continue.emit()">
              Continue to documents
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        }
      </form>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }
    .head {
      padding: 18px 22px 6px;
      border-bottom: 1px solid var(--color-border);
      h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); letter-spacing: -0.2px; }
      p  { margin: 4px 0 14px; font-size: 12.5px; color: var(--color-text-muted); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      padding: 20px 22px 22px;
    }
    .field {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 12.5px; color: var(--color-text);
    }
    .field .lbl { font-weight: 600; color: var(--color-text-muted); font-size: 12px; }
    .field i { color: var(--color-error); font-style: normal; font-weight: 600; }
    .field input {
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
      transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .field input:focus {
      outline: none;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }
    .field input:read-only { background: var(--color-surface-2); color: var(--color-text-muted); cursor: not-allowed; }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }
    .hint { color: var(--color-text-subtle); font-size: 11.5px; font-style: normal; }

    .actions {
      grid-column: 1 / -1;
      display: flex; justify-content: flex-end;
      padding-top: 6px;
      border-top: 1px dashed var(--color-border);
      margin-top: 4px;
    }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 18px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
      transition: filter 0.15s var(--ease-out);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BasicDetailsStepComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() carrier: CarrierResponse | null = null;
  @Input() submitting = signal(false);

  @Output() create = new EventEmitter<CreateCarrierDto>();
  /** Emitted when the carrier already exists and the user clicks Continue. */
  @Output() continue = new EventEmitter<void>();

  readonly form = this.fb.nonNullable.group({
    name:          ['', [Validators.required, Validators.maxLength(200)]],
    legalEntity:   ['', [Validators.required, Validators.maxLength(200)]],
    gstNumber:     ['', [Validators.required, Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)]],
    geography:     ['', [Validators.required]],
    contactName:   [''],
    contactEmail:  ['', [emailIfPresent]],
    contactPhone:  ['']
  });

  get readOnly(): boolean { return !!this.carrier; }

  ngOnInit(): void { this.applyCarrier(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['carrier']) this.applyCarrier();
  }

  private applyCarrier(): void {
    if (!this.carrier) {
      this.form.enable({ emitEvent: false });
      return;
    }
    this.form.patchValue({
      name: this.carrier.name,
      legalEntity: this.carrier.legalEntity,
      gstNumber: this.carrier.gstNumber,
      geography: this.carrier.geography,
      contactName: this.carrier.contactName ?? '',
      contactEmail: this.carrier.contactEmail ?? '',
      contactPhone: ''
    }, { emitEvent: false });
    this.form.disable({ emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid || this.readOnly) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const dto: CreateCarrierDto = {
      name: v.name.trim(),
      legalEntity: v.legalEntity.trim(),
      gstNumber: v.gstNumber.trim().toUpperCase(),
      geography: v.geography.trim(),
      contactName: v.contactName?.trim() || null,
      contactEmail: v.contactEmail?.trim().toLowerCase() || null,
      contactPhone: v.contactPhone?.trim() || null
    };
    this.create.emit(dto);
  }

  upperCaseGst(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      input.value = upper;
      this.form.controls.gstNumber.setValue(upper, { emitEvent: false });
    }
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  errorFor(field: keyof typeof this.form.controls): string {
    const c = this.form.controls[field];
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('email'))    return 'Enter a valid email address.';
    if (c.hasError('pattern') && field === 'gstNumber') return 'Invalid GST format. Expected 22AAAAA0000A1Z5.';
    if (c.hasError('maxlength')) return 'This value is too long.';
    return 'Invalid value.';
  }
}

function emailIfPresent(control: AbstractControl): ValidationErrors | null {
  const v = (control.value as string | null)?.trim();
  if (!v) return null;
  return Validators.email(control);
}
