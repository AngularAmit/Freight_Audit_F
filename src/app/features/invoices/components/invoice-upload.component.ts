import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { CarrierOption, CarriersPickerService } from '../../masters/carriers-picker.service';
import { InvoiceService } from '../invoice.service';
import { INVOICE_SOURCES, InvoiceResponse, InvoiceSource } from '../models/invoice.model';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-invoice-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg"
               title="Upload invoice"
               subtitle="Upload a freight invoice PDF — the AI audit engine will process it automatically."
               (close)="cancel()">

      <section class="upload-zone">
        <div class="dropzone"
             [class.is-dragover]="isDragOver()"
             [class.has-file]="!!selectedFile()"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()"
             role="button" tabindex="0"
             (keydown.enter)="fileInput.click()"
             (keydown.space)="fileInput.click(); $event.preventDefault()">
          <input #fileInput type="file" hidden accept=".pdf" (change)="onFileInputChange($event)" />

          @if (selectedFile(); as f) {
            <div class="file-info">
              <span class="badge">PDF</span>
              <div class="meta">
                <strong>{{ f.name }}</strong>
                <span>{{ formatSize(f.size) }} · ready to upload</span>
              </div>
              <button type="button" class="btn-link" (click)="clearFile($event)">Remove</button>
            </div>
          } @else {
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15.5A4.5 4.5 0 0 0 17 11h-1.26A6 6 0 1 0 4 14"></path>
              <polyline points="16 16 12 12 8 16"></polyline>
              <line x1="12" y1="12" x2="12" y2="21"></line>
            </svg>
            <strong>Drop a PDF invoice here</strong>
            <span>or <em>click to browse</em></span>
            <small>Max 10 MB · only .pdf accepted</small>
          }
        </div>
        @if (fileError()) { <em class="err err--block">{{ fileError() }}</em> }
      </section>

      <form class="grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
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
          <span class="lbl">Source</span>
          <select formControlName="source">
            @for (s of sources; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
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
          <span class="lbl">Actual amount <i>*</i></span>
          <input type="number" step="0.01" min="0.01" formControlName="actualAmount" placeholder="0.00" />
          @if (showError('actualAmount')) { <em class="err">{{ errorFor('actualAmount') }}</em> }
        </label>

        <label class="field">
          <span class="lbl">Weight (lbs)</span>
          <input type="number" step="0.01" min="0" formControlName="weightLbs" placeholder="optional" />
        </label>

        <label class="field">
          <span class="lbl">Actual OTD (%)</span>
          <input type="number" step="0.01" min="0" max="100" formControlName="actualOtdPercent" placeholder="0–100" />
        </label>
      </form>

      <div modal-footer>
        <button type="button" class="btn-ghost" (click)="cancel()" [disabled]="uploading()">Cancel</button>
        <button type="button" class="btn-primary"
                (click)="submit()"
                [disabled]="uploading() || !canSubmit()">
          @if (uploading()) {
            <span class="spinner"></span> Uploading…
          } @else {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload invoice
          }
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .upload-zone { margin-bottom: 16px; }

    .dropzone {
      border: 2px dashed var(--color-primary-200);
      border-radius: var(--radius-lg);
      background: var(--color-primary-50);
      padding: 22px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      text-align: center; cursor: pointer;
      color: var(--color-primary-700);
      transition: background 0.15s var(--ease-out), border-color 0.15s var(--ease-out);
    }
    .dropzone:hover { background: #fff; border-color: var(--color-primary-400); }
    .dropzone.is-dragover { background: #fff; border-color: var(--color-primary-500); box-shadow: 0 0 0 4px rgba(59,130,246,0.10); }
    .dropzone.has-file { background: #fff; border-style: solid; border-color: var(--color-primary-300); cursor: default; }
    .dropzone strong { font-size: 14px; color: var(--color-text); font-weight: 600; }
    .dropzone span { font-size: 12.5px; color: var(--color-text-muted); }
    .dropzone em { color: var(--color-primary-700); font-style: normal; font-weight: 600; }
    .dropzone small { font-size: 11.5px; color: var(--color-text-subtle); margin-top: 4px; }

    .file-info {
      display: flex; align-items: center; gap: 12px;
      width: 100%;
      padding: 4px 0;
    }
    .badge {
      width: 36px; height: 36px;
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-primary-50); color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-sm);
      font-size: 11px; font-weight: 700;
    }
    .meta { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }
    .meta strong { font-size: 13px; color: var(--color-text); font-weight: 600; word-break: break-all; }
    .meta span { font-size: 11.5px; color: var(--color-text-muted); }
    .btn-link {
      background: transparent; color: var(--color-primary-700);
      font-size: 12px; font-weight: 600;
      padding: 6px 10px; border-radius: 6px;
    }
    .btn-link:hover { background: var(--color-primary-50); }

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
    }
    .field input:focus, .field select:focus {
      outline: none;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }
    .err--block { display: block; margin-top: 8px; }

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
export class InvoiceUploadComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly invoices = inject(InvoiceService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) open: boolean = false;
  @Output() closed = new EventEmitter<void>();
  @Output() uploaded = new EventEmitter<InvoiceResponse>();

  readonly sources = INVOICE_SOURCES;

  readonly form = this.fb.nonNullable.group({
    carrierId:        ['', [Validators.required]],
    source:           ['UPLOAD' as InvoiceSource],
    origin:           ['', [Validators.required, Validators.maxLength(100)]],
    destination:      ['', [Validators.required, Validators.maxLength(100)]],
    serviceType:      ['', [Validators.required, Validators.maxLength(50)]],
    actualAmount:     [0, [Validators.required, Validators.min(0.01)]],
    weightLbs:        [null as number | null],
    actualOtdPercent: [null as number | null]
  });

  readonly carriers = signal<CarrierOption[]>([]);
  readonly loadingCarriers = signal(false);
  readonly uploading = signal(false);

  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly isDragOver = signal(false);

  readonly canSubmit = computed(() =>
    !!this.selectedFile() && !this.fileError() && this.form.valid
  );

  ngOnInit(): void { this.loadCarriers(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({
        carrierId: '', source: 'UPLOAD',
        origin: '', destination: '', serviceType: '',
        actualAmount: 0, weightLbs: null, actualOtdPercent: null
      });
      this.selectedFile.set(null);
      this.fileError.set(null);
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

  // ====== File picking ======

  onDragOver(ev: DragEvent): void {
    if (this.uploading()) return;
    ev.preventDefault();
    this.isDragOver.set(true);
  }
  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(false);
  }
  onDrop(ev: DragEvent): void {
    if (this.uploading()) return;
    ev.preventDefault();
    this.isDragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.acceptFile(file);
  }
  onFileInputChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.acceptFile(file);
    input.value = '';
  }

  private acceptFile(file: File): void {
    this.fileError.set(null);
    if (file.size === 0) { this.fileError.set('File is empty.'); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.fileError.set(`File exceeds 10 MB (this file is ${this.formatSize(file.size)}).`);
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      this.fileError.set('Only PDF invoices are accepted.');
      return;
    }
    this.selectedFile.set(file);
  }

  clearFile(ev: MouseEvent): void {
    ev.stopPropagation();
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  // ====== Submit ======

  submit(): void {
    if (!this.selectedFile()) {
      this.fileError.set('Please pick a PDF invoice first.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.uploading.set(true);

    this.invoices
      .upload({
        file: this.selectedFile()!,
        carrierId: v.carrierId,
        source: v.source,
        origin: v.origin.trim().toUpperCase(),
        destination: v.destination.trim().toUpperCase(),
        serviceType: v.serviceType.trim().toUpperCase(),
        actualAmount: Number(v.actualAmount),
        weightLbs: v.weightLbs !== null ? Number(v.weightLbs) : null,
        actualOtdPercent: v.actualOtdPercent !== null ? Number(v.actualOtdPercent) : null
      })
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (inv) => {
          this.toast.success(`Invoice uploaded · queued for processing (${inv.status}).`);
          this.uploaded.emit(inv);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Invoice upload failed.');
        }
      });
  }

  cancel(): void {
    if (!this.uploading()) this.closed.emit();
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

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
