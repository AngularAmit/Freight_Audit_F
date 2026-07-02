import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ApiResponse } from '../../core/auth/models/api-response.model';
import { ToastService } from '../../shared/services/toast.service';
import { CarrierService } from '../carriers/carrier.service';
import { CarrierSummary } from '../carriers/models/carrier.model';
import { MasterService } from '../masters/master.service';
import { ContractListItem } from '../masters/models/contract.model';

import { AuditUploadService } from './audit-upload.service';
import { AuditType, AuditUploadResponse } from './models/audit-upload.model';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx']);
const AUDIT_TYPES: readonly AuditType[] = ['Contracts', 'Invoice'];

@Component({
  selector: 'app-audit-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <section class="page">
      <header class="hero">
        <div class="hero-text">
          <span class="eyebrow">Audit Upload</span>
          <h1>Upload audit documents</h1>
          <p>Attach audit files against approved carriers and keep the uploaded document list ready for review.</p>
        </div>

        <div class="hero-stats">
          <div class="stat">
            <span class="lbl">Approved carriers</span>
            <strong>{{ approvedCarriers().length }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Uploaded docs</span>
            <strong>{{ uploads().length }}</strong>
          </div>
        </div>
      </header>

      <section class="upload-card">
        <header class="card-head">
          <div>
            <h2>{{ editingUpload() ? 'Edit upload' : 'Upload documents' }}</h2>
            <p>Select an approved carrier name and audit type, then choose the audit file.</p>
          </div>

          @if (editingUpload()) {
            <button type="button" class="btn-ghost" (click)="cancelEdit()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cancel
            </button>
          }
        </header>

        @if (editingUpload(); as doc) {
          <div class="edit-banner">
            Editing <strong>{{ doc.FileName }}</strong>. Choose another file only if you want to replace it.
          </div>
        }

        <div class="upload-grid" [class.has-contract]="showContractName()">
          <label class="field">
            <span class="lbl">Carrier Name</span>
            <select
              [(ngModel)]="selectedCarrierId"
              name="documentType"
              [disabled]="loadingCarriers()"
              (ngModelChange)="onCarrierChange($event)">
              <option value="">Select approved carrier</option>
              @for (carrier of approvedCarriers(); track carrier.id) {
                <option [value]="carrier.id">{{ carrier.name }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span class="lbl">Audit Type</span>
            <select [(ngModel)]="selectedAuditType" name="auditType" (ngModelChange)="onAuditTypeChange($event)">
              <option value="">Select audit type</option>
              @for (type of auditTypes; track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select>
          </label>

          @if (showContractName()) {
            <label class="field">
              <span class="lbl">Contract Name</span>
              <select [(ngModel)]="selectedContractId" name="contractName" [disabled]="loadingContracts()">
                <option value="">{{ loadingContracts() ? 'Loading contracts...' : 'Select contract' }}</option>
                @for (contract of carrierContracts(); track contract.id) {
                  <option [value]="contract.id">{{ contract.contractName }}</option>
                }
              </select>
            </label>
          }

          <div class="dropzone"
               [class.is-dragover]="dragOver()"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event)"
               (click)="fileInput.click()"
               role="button"
               tabindex="0"
               (keydown.enter)="fileInput.click()"
               (keydown.space)="fileInput.click(); $event.preventDefault()">
            <input #fileInput type="file" hidden
                   (change)="onFileInputChange($event)"
                   accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />

            <svg class="cloud" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15.5A4.5 4.5 0 0 0 17 11h-1.26A6 6 0 1 0 4 14"></path>
              <polyline points="16 16 12 12 8 16"></polyline>
              <line x1="12" y1="12" x2="12" y2="21"></line>
            </svg>

            @if (selectedFile(); as file) {
              <strong>{{ file.name }}</strong>
              <span>{{ formatSize(file.size) }}</span>
            } @else {
              <strong>Drop file here</strong>
              <span>or click to browse PDF, image, Word or Excel files</span>
            }
          </div>
        </div>

        <footer class="upload-actions">
          <button type="button" class="btn-secondary" (click)="resetFile(fileInput)" [disabled]="!selectedFile()">
            Clear file
          </button>

          <button type="button" class="btn-primary" (click)="submitUpload()" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span>
              Saving...
            } @else {
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {{ editingUpload() ? 'Update' : 'Upload' }}
            }
          </button>
        </footer>
      </section>

      <section class="list-card">
        <header class="card-head">
          <div>
            <h2>Uploaded Documents</h2>
            <p>All uploaded audit documents with edit action.</p>
          </div>
          <button type="button" class="btn-secondary" (click)="loadUploads()" [disabled]="loadingUploads()">
            Refresh
          </button>
        </header>

        <div class="table-wrap">
          <table class="uploads">
            <thead>
              <tr>
                <th>Company</th>
                <th>Audit type</th>
                <th>Contract title</th>
                <th>Effective date</th>
                <th>Parties</th>
                <th>Terms</th>
                <th>File name</th>
                <th>Status</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              @if (loadingUploads()) {
                <tr><td colspan="9" class="state-row">Loading uploaded documents...</td></tr>
              } @else if (uploads().length === 0) {
                <tr>
                  <td colspan="9" class="state-row state-empty">
                    <strong>No audit documents uploaded yet.</strong>
                    <span>Select an approved carrier, audit type and upload a document to get started.</span>
                  </td>
                </tr>
              } @else {
                @for (doc of uploads(); track doc.ID) {
                  <tr>
                    <td><strong>{{ doc.Company }}</strong></td>
                    <td><span class="type-pill">{{ doc.AuditType ?? resolveAuditType(doc) }}</span></td>
                    <td>{{ doc.ContracTtitle }}</td>
                    <td class="muted">{{ doc.EffectiveDate | date: 'mediumDate' }}</td>
                    <td>{{ doc.Parties }}</td>
                    <td>{{ doc.Terms }}</td>
                    <td>
                      <span class="file-chip">{{ extension(doc.FileName) || 'DOC' }}</span>
                      {{ doc.FileName }}
                    </td>
                    <td>
                      <span class="status-pill" [class.status-pill--off]="!doc.IsActive">
                        <span class="dot"></span>
                        {{ doc.IsActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td class="actions-col">
                      <button type="button" class="icon-btn" title="Edit" (click)="editUpload(doc)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page { display: flex; flex-direction: column; gap: 18px; }

    .hero {
      position: relative;
      padding: 22px 26px;
      background: var(--gradient-brand-soft);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 22px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 92% 16%, rgba(59,130,246,0.18), transparent 60%);
      pointer-events: none;
    }
    .hero-text,
    .hero-stats { position: relative; }
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: var(--color-primary-700);
      background: rgba(255,255,255,0.7);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--color-primary-100);
    }
    .hero h1 {
      margin: 10px 0 4px;
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }
    .hero p {
      margin: 0;
      font-size: 13.5px;
      color: var(--color-text-muted);
      max-width: 620px;
    }
    .hero-stats {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .stat {
      min-width: 132px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.85);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-md);
      backdrop-filter: blur(4px);
    }
    .stat .lbl {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .stat strong {
      display: block;
      margin-top: 4px;
      font-size: 20px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.4px;
    }

    .upload-card,
    .list-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .card-head h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.2px;
    }
    .card-head p {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: var(--color-text-muted);
    }

    .edit-banner {
      margin: 16px 20px 0;
      padding: 10px 12px;
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-md);
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      font-size: 12.5px;
    }

    .upload-grid {
      display: grid;
      grid-template-columns: 240px 200px 1fr;
      gap: 16px;
      padding: 20px;
      align-items: stretch;
    }
    .upload-grid.has-contract {
      grid-template-columns: 220px 170px 240px 1fr;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field .lbl {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .field select {
      height: 44px;
      padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 13px;
    }
    .field select:focus {
      outline: none;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }

    .dropzone {
      min-height: 136px;
      border: 2px dashed var(--color-primary-200);
      border-radius: var(--radius-lg);
      background: var(--color-primary-50);
      padding: 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      text-align: center;
      cursor: pointer;
      color: var(--color-primary-700);
      transition: background 0.15s var(--ease-out), border-color 0.15s var(--ease-out), transform 0.1s var(--ease-out);
    }
    .dropzone:hover,
    .dropzone.is-dragover {
      background: #fff;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.10);
    }
    .dropzone.is-dragover { transform: scale(1.005); }
    .cloud { color: var(--color-primary-500); margin-bottom: 4px; }
    .dropzone strong { font-size: 14px; color: var(--color-text); font-weight: 600; }
    .dropzone span { font-size: 12.5px; color: var(--color-text-muted); }

    .upload-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 20px 20px;
    }
    .btn-primary,
    .btn-secondary,
    .btn-ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 38px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-primary {
      background: var(--gradient-brand);
      color: #fff;
      box-shadow: 0 6px 14px rgba(59,130,246,0.28);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-secondary {
      background: #fff;
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-200);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-primary-50);
      border-color: var(--color-primary-300);
    }
    .btn-ghost {
      background: transparent;
      color: var(--color-text-muted);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }
    .btn-primary:disabled,
    .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .table-wrap { overflow-x: auto; }
    table.uploads {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.uploads thead th {
      text-align: left;
      padding: 11px 18px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: #fff;
      border-bottom: 1px solid var(--color-border);
      white-space: nowrap;
    }
    table.uploads tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
      white-space: nowrap;
    }
    table.uploads tbody tr:hover { background: var(--color-primary-50); }
    table.uploads tbody tr:last-child td { border-bottom: none; }

    .file-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 24px;
      padding: 0 7px;
      margin-right: 8px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .type-pill {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 9px;
      border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      letter-spacing: 0.3px;
    }
    .status-pill .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    .status-pill--off {
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border-color: var(--color-border);
    }
    .status-pill--off .dot { background: var(--color-text-subtle); }
    .muted { color: var(--color-text-muted); font-size: 12.5px; }
    .actions-col { width: 60px; text-align: right; }
    .icon-btn {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
    }
    .icon-btn:hover {
      background: var(--color-surface-2);
      color: var(--color-primary-700);
    }
    .state-row {
      text-align: center;
      padding: 28px 18px !important;
      color: var(--color-text-muted);
    }
    .state-empty strong { display: block; color: var(--color-text); margin-bottom: 4px; }
    .state-empty span { font-size: 12.5px; }

    @media (max-width: 860px) {
      .upload-grid { grid-template-columns: 1fr; }
      .upload-actions { justify-content: stretch; flex-wrap: wrap; }
      .upload-actions button { flex: 1; }
    }
  `]
})
export class AuditUploadComponent implements OnInit {
  private readonly carriers = inject(CarrierService);
  private readonly masters = inject(MasterService);
  private readonly auditUploads = inject(AuditUploadService);
  private readonly toast = inject(ToastService);

  readonly approvedCarriers = signal<CarrierSummary[]>([]);
  readonly carrierContracts = signal<ContractListItem[]>([]);
  readonly uploads = signal<AuditUploadResponse[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly dragOver = signal(false);
  readonly loadingCarriers = signal(false);
  readonly loadingContracts = signal(false);
  readonly loadingUploads = signal(false);
  readonly saving = signal(false);
  readonly editingUpload = signal<AuditUploadResponse | null>(null);
  readonly auditTypes = AUDIT_TYPES;

  selectedCarrierId = '';
  selectedAuditType: AuditType | '' = '';
  selectedContractId = '';

  ngOnInit(): void {
    this.loadApprovedCarriers();
    this.loadUploads();
  }

  loadApprovedCarriers(): void {
    this.loadingCarriers.set(true);
    this.carriers
      .list({ page: 1, pageSize: 200, status: 'APPROVED' })
      .pipe(finalize(() => this.loadingCarriers.set(false)))
      .subscribe({
        next: (page) => this.approvedCarriers.set(page.items),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load approved carriers.');
        }
      });
  }

  loadUploads(): void {
    this.loadingUploads.set(true);
    this.auditUploads
      .list()
      .pipe(finalize(() => this.loadingUploads.set(false)))
      .subscribe({
        next: (items) => this.uploads.set(items),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load uploaded documents.');
        }
      });
  }

  onCarrierChange(carrierId: string): void {
    this.selectedCarrierId = carrierId;
    this.selectedContractId = '';
    this.loadContractsWhenNeeded();
  }

  onAuditTypeChange(auditType: AuditType | ''): void {
    this.selectedAuditType = auditType;
    this.selectedContractId = '';
    this.loadContractsWhenNeeded();
  }

  submitUpload(): void {
    const carrier = this.selectedCarrier();
    const auditType = this.selectedAuditType;
    if (!carrier || !auditType) {
      this.toast.error('Please select the Carrier Name and Type ');
      return;
    }

    const contract = auditType === 'Invoice' ? this.selectedContract() : null;
    if (auditType === 'Invoice' && !contract) {
      this.toast.error('Please select the Contract Name');
      return;
    }

    const file = this.selectedFile();
    const editing = this.editingUpload();
    if (!file && !editing) {
      this.toast.error('Please choose a document to upload.');
      return;
    }

    this.saving.set(true);
    const save$ = editing
      ? this.auditUploads.update(editing, carrier, auditType, file, contract?.id, contract?.contractName)
      : this.auditUploads.upload(carrier, auditType, file!, contract?.id, contract?.contractName);

    save$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (upload) => {
          this.upsertUpload(upload, editing?.ID);
          this.toast.success(editing ? 'Audit document updated.' : 'Audit document uploaded.');
          this.resetForm();
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not save audit document.');
        }
      });
  }

  editUpload(upload: AuditUploadResponse): void {
    const carrier = this.approvedCarriers().find(
      (item) => item.name.toLowerCase() === upload.Company.toLowerCase()
    );

    if (!carrier) {
      this.toast.error('Selected document carrier is not available in approved carriers.');
      return;
    }

    this.selectedCarrierId = carrier.id;
    this.selectedAuditType = this.resolveAuditType(upload);
    this.selectedContractId = upload.ContractId ?? '';
    this.selectedFile.set(null);
    this.editingUpload.set(upload);
    this.loadContractsWhenNeeded(upload.ContractId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  resetFile(input?: HTMLInputElement): void {
    this.selectedFile.set(null);
    if (input) input.value = '';
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  onFileInputChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  extension(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toUpperCase() : '';
  }

  resolveAuditType(upload: AuditUploadResponse): AuditType {
    if (upload.AuditType) return upload.AuditType;
    if (upload.Terms === 'Invoice' || upload.Terms === 'Contracts') return upload.Terms;
    if (upload.ContracTtitle.toLowerCase().includes('invoice')) return 'Invoice';
    return 'Contracts';
  }

  showContractName(): boolean {
    return this.selectedAuditType === 'Invoice' && !!this.selectedCarrierId;
  }

  private selectedCarrier(): CarrierSummary | null {
    return this.approvedCarriers().find((carrier) => carrier.id === this.selectedCarrierId) ?? null;
  }

  private selectedContract(): ContractListItem | null {
    return this.carrierContracts().find((contract) => contract.id === this.selectedContractId) ?? null;
  }

  private loadContractsWhenNeeded(preselectId?: string | null): void {
    if (!this.showContractName()) {
      this.carrierContracts.set([]);
      this.selectedContractId = '';
      return;
    }

    this.loadingContracts.set(true);
    this.masters
      .listContracts({ page: 1, pageSize: 200, carrierId: this.selectedCarrierId })
      .pipe(finalize(() => this.loadingContracts.set(false)))
      .subscribe({
        next: (page) => {
          this.carrierContracts.set(page.items);
          if (preselectId && page.items.some((contract) => contract.id === preselectId)) {
            this.selectedContractId = preselectId;
          }
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load contracts for selected carrier.');
        }
      });
  }

  private setFile(file: File): void {
    const error = this.validate(file);
    if (error) {
      this.toast.error(error);
      return;
    }

    this.selectedFile.set(file);
  }

  private validate(file: File): string | null {
    if (file.size === 0) return 'File is empty.';
    if (file.size > MAX_FILE_SIZE_BYTES) return 'File exceeds 10 MB.';
    const ext = ('.' + (file.name.split('.').pop() ?? '')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return `File type ${ext} is not allowed.`;
    return null;
  }

  private upsertUpload(upload: AuditUploadResponse, replaceId?: string): void {
    this.uploads.update((items) => {
      const withoutOld = replaceId ? items.filter((item) => item.ID !== replaceId) : items;
      return withoutOld.some((item) => item.ID === upload.ID)
        ? withoutOld.map((item) => (item.ID === upload.ID ? upload : item))
        : [upload, ...withoutOld];
    });
  }

  private resetForm(): void {
    this.selectedCarrierId = '';
    this.selectedAuditType = '';
    this.selectedContractId = '';
    this.carrierContracts.set([]);
    this.selectedFile.set(null);
    this.editingUpload.set(null);
  }
}
