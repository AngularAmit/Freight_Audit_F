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
import { ContractResponse } from '../models/contract.model';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-contract-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DecimalPipe, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg"
               [title]="contract?.contractName ?? 'Contract'"
               [subtitle]="contract ? (contract.carrierName + ' · ' + (contract.isActive ? 'Active' : 'Inactive')) : ''"
               (close)="closed.emit()">
      @if (contract) {
        <section class="section">
          <header class="section-head">
            <h4>Contract file</h4>
            <span class="hint">PDF only · max 10 MB</span>
          </header>

          @if (contract.filePath) {
            <div class="file-row">
              <span class="badge">PDF</span>
              <div class="meta">
                <strong>{{ shortName(contract.filePath) }}</strong>
                <code>{{ contract.filePath }}</code>
              </div>
              <span class="status-pill status-pill--done">Linked</span>
            </div>
          } @else {
            <div class="file-row file-row--empty">
              <span class="badge badge--empty">—</span>
              <div class="meta">
                <strong>No contract file linked yet.</strong>
                <span>Upload a PDF to attach the master contract document.</span>
              </div>
            </div>
          }

          @if (canEdit()) {
            <div class="dropzone"
                 [class.is-dragover]="isDragOver()"
                 (dragover)="onDragOver($event)"
                 (dragleave)="onDragLeave($event)"
                 (drop)="onDrop($event)"
                 (click)="fileInput.click()"
                 role="button" tabindex="0"
                 (keydown.enter)="fileInput.click()"
                 (keydown.space)="fileInput.click(); $event.preventDefault()">
              <input #fileInput type="file" hidden accept=".pdf" (change)="onFileInputChange($event)" />
              @if (uploading()) {
                <span class="spinner"></span>
                <strong>Uploading…</strong>
                <span>{{ uploadFile()?.name }}</span>
              } @else {
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15.5A4.5 4.5 0 0 0 17 11h-1.26A6 6 0 1 0 4 14"></path>
                  <polyline points="16 16 12 12 8 16"></polyline>
                  <line x1="12" y1="12" x2="12" y2="21"></line>
                </svg>
                <strong>Drop a PDF here</strong>
                <span>or <em>click to browse</em></span>
              }
            </div>
          }
        </section>

        <section class="section">
          <header class="section-head">
            <h4>SLA rules <span class="counter">{{ contract.slaRules.length }}</span></h4>
            <span class="hint">OTD targets, penalty thresholds & penalty %</span>
          </header>

          @if (contract.slaRules.length === 0) {
            <div class="empty">No SLA rules yet. Add one to enforce on-time-delivery penalties.</div>
          } @else {
            <table class="sla-table">
              <thead>
                <tr>
                  <th>OTD target</th>
                  <th>Threshold</th>
                  <th>Penalty</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                @for (s of contract.slaRules; track s.id) {
                  <tr>
                    <td><strong>{{ s.otdTarget | number: '1.0-2' }}%</strong></td>
                    <td>{{ s.penaltyThreshold | number: '1.0-2' }}%</td>
                    <td><span class="penalty">{{ s.penaltyPercent | number: '1.0-2' }}%</span></td>
                    <td class="muted">{{ s.createdAt | date: 'mediumDate' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (canCreate()) {
            <form class="sla-form" [formGroup]="slaForm" (ngSubmit)="addSla()" novalidate>
              <h5>Add SLA rule</h5>
              <div class="grid">
                <label class="field">
                  <span class="lbl">OTD target (%) <i>*</i></span>
                  <input type="number" min="0" max="100" step="0.5" formControlName="otdTarget" placeholder="e.g. 95" />
                  @if (showSlaError('otdTarget')) { <em class="err">{{ slaErrorFor('otdTarget') }}</em> }
                </label>
                <label class="field">
                  <span class="lbl">Penalty threshold (%) <i>*</i></span>
                  <input type="number" min="0" max="100" step="0.5" formControlName="penaltyThreshold" placeholder="e.g. 90" />
                  @if (showSlaError('penaltyThreshold')) { <em class="err">{{ slaErrorFor('penaltyThreshold') }}</em> }
                </label>
                <label class="field">
                  <span class="lbl">Penalty (%) <i>*</i></span>
                  <input type="number" min="0" max="100" step="0.5" formControlName="penaltyPercent" placeholder="e.g. 5" />
                  @if (showSlaError('penaltyPercent')) { <em class="err">{{ slaErrorFor('penaltyPercent') }}</em> }
                </label>
                <button type="submit" class="btn-primary" [disabled]="addingSla() || slaForm.invalid">
                  @if (addingSla()) { <span class="spinner"></span> Adding… } @else { Add rule }
                </button>
              </div>
              @if (slaForm.hasError('thresholdGtTarget')) {
                <em class="err">Threshold must be ≤ OTD target.</em>
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

    .file-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: #fff;
      margin-bottom: 12px;
    }
    .file-row--empty { background: var(--color-surface-2); border-style: dashed; }
    .badge {
      flex-shrink: 0;
      width: 36px; height: 36px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-primary-50); color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-sm);
      font-size: 11px; font-weight: 700;
    }
    .badge--empty { background: var(--color-surface-2); color: var(--color-text-subtle); border-color: var(--color-border); }
    .file-row .meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .file-row .meta strong { font-size: 13px; color: var(--color-text); font-weight: 600; word-break: break-all; }
    .file-row .meta span { font-size: 12px; color: var(--color-text-muted); }
    .file-row .meta code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; color: var(--color-text-muted);
      background: var(--color-surface-2);
      padding: 1px 6px; border-radius: 4px;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      align-self: flex-start;
    }
    .status-pill {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      letter-spacing: 0.3px;
    }
    .status-pill--done { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

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
    .dropzone strong { font-size: 14px; color: var(--color-text); font-weight: 600; }
    .dropzone span { font-size: 12.5px; color: var(--color-text-muted); }
    .dropzone em { color: var(--color-primary-700); font-style: normal; font-weight: 600; }

    .empty {
      padding: 18px;
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      font-size: 12.5px;
    }

    .sla-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .sla-table thead th {
      text-align: left; padding: 10px 14px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-border);
    }
    .sla-table tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
    }
    .sla-table tbody tr:last-child td { border-bottom: none; }
    .penalty { font-weight: 600; color: var(--color-error); }
    .muted { color: var(--color-text-muted); font-size: 12.5px; }

    .sla-form {
      padding: 14px 16px;
      background: var(--color-surface-2);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
    }
    .sla-form h5 { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--color-text-muted); }
    .sla-form .grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 10px;
      align-items: end;
    }
    .field {
      display: flex; flex-direction: column; gap: 4px;
      font-size: 12.5px;
    }
    .field .lbl { font-weight: 600; color: var(--color-text-muted); font-size: 11.5px; }
    .field i { color: var(--color-error); font-style: normal; font-weight: 600; }
    .field input {
      height: 36px; padding: 0 10px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .field input:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }

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
      .sla-form .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ContractDetailComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly master = inject(MasterService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  @Input({ required: true }) open: boolean = false;
  @Input() contract: ContractResponse | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<ContractResponse>();

  readonly slaForm = this.fb.nonNullable.group({
    otdTarget:        [95, [Validators.required, Validators.min(0), Validators.max(100)]],
    penaltyThreshold: [90, [Validators.required, Validators.min(0), Validators.max(100)]],
    penaltyPercent:   [5,  [Validators.required, Validators.min(0), Validators.max(100)]]
  }, {
    validators: [(group) => {
      const otd = Number(group.get('otdTarget')?.value);
      const thr = Number(group.get('penaltyThreshold')?.value);
      return thr > otd ? { thresholdGtTarget: true } : null;
    }]
  });

  readonly addingSla = signal(false);
  readonly uploading = signal(false);
  readonly uploadFile = signal<File | null>(null);
  readonly isDragOver = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contract']) {
      this.slaForm.reset({ otdTarget: 95, penaltyThreshold: 90, penaltyPercent: 5 });
    }
  }

  canCreate = computed(() => this.perms.hasPermission('CONTRACT', 'canCreate'));
  canEdit = computed(() => this.perms.hasPermission('CONTRACT', 'canEdit'));

  shortName(path: string): string {
    return path.split('/').pop() ?? path;
  }

  // ====== File upload ======

  onDragOver(ev: DragEvent): void {
    if (!this.canEdit() || this.uploading()) return;
    ev.preventDefault();
    this.isDragOver.set(true);
  }
  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(false);
  }
  onDrop(ev: DragEvent): void {
    if (!this.canEdit() || this.uploading()) return;
    ev.preventDefault();
    this.isDragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.uploadPdf(file);
  }
  onFileInputChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadPdf(file);
    input.value = '';
  }

  private uploadPdf(file: File): void {
    if (!this.contract) return;

    if (file.size === 0) { this.toast.error('File is empty.'); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) { this.toast.error('File exceeds 10 MB limit.'); return; }
    if (!/\.pdf$/i.test(file.name)) { this.toast.error('Only PDF files are allowed.'); return; }

    this.uploading.set(true);
    this.uploadFile.set(file);

    this.master
      .uploadContractFile(this.contract.id, file)
      .pipe(finalize(() => {
        this.uploading.set(false);
        this.uploadFile.set(null);
      }))
      .subscribe({
        next: (c) => {
          this.toast.success('Contract file linked.');
          this.updated.emit(c);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Upload failed.');
        }
      });
  }

  // ====== SLA add ======

  addSla(): void {
    if (!this.contract || this.slaForm.invalid) {
      this.slaForm.markAllAsTouched();
      return;
    }
    const v = this.slaForm.getRawValue();
    this.addingSla.set(true);
    this.master
      .addSlaRule(this.contract.id, {
        otdTarget: Number(v.otdTarget),
        penaltyThreshold: Number(v.penaltyThreshold),
        penaltyPercent: Number(v.penaltyPercent)
      })
      .pipe(finalize(() => this.addingSla.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('SLA rule added.');
          // Refresh full contract to pick up the new rule
          this.master.getContract(this.contract!.id).subscribe({
            next: (c) => this.updated.emit(c),
            error: () => undefined
          });
          this.slaForm.reset({ otdTarget: 95, penaltyThreshold: 90, penaltyPercent: 5 });
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not add SLA rule.');
        }
      });
  }

  showSlaError(field: keyof typeof this.slaForm.controls): boolean {
    const c = this.slaForm.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }
  slaErrorFor(field: keyof typeof this.slaForm.controls): string {
    const c = this.slaForm.controls[field];
    if (c.hasError('required')) return 'Required.';
    if (c.hasError('min') || c.hasError('max')) return 'Must be 0–100.';
    return 'Invalid.';
  }
}
