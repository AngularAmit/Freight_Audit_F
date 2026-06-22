import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CARRIER_DOCUMENT_TYPES, CarrierDocument, CarrierResponse } from '../../models/carrier.model';

interface PendingUpload {
  /** Local-only id for tracking before the API responds. */
  tempId: string;
  file: File;
  documentType: string;
  status: 'queued' | 'uploading' | 'failed';
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx']);

@Component({
  selector: 'app-upload-documents-step',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <section class="card">
      <header class="head">
        <h3>Upload documents</h3>
        <p>Drag & drop or pick files (PDF, image, Word or Excel — up to 10 MB each).</p>
      </header>

      <div class="content">
        @if (!readOnly) {
          <div class="picker">
            <label class="doc-type">
              <span class="lbl">Document type</span>
              <select [(ngModel)]="selectedType" name="docType">
                @for (t of documentTypes; track t) {
                  <option [value]="t">{{ t }}</option>
                }
              </select>
            </label>

            <div class="dropzone"
                 [class.is-dragover]="isDragOver()"
                 (dragover)="onDragOver($event)"
                 (dragleave)="onDragLeave($event)"
                 (drop)="onDrop($event)"
                 (click)="fileInput.click()"
                 role="button"
                 tabindex="0"
                 (keydown.enter)="fileInput.click()"
                 (keydown.space)="fileInput.click(); $event.preventDefault()">
              <input #fileInput type="file" multiple hidden
                     (change)="onFileInputChange($event)"
                     accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
              <svg class="cloud" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15.5A4.5 4.5 0 0 0 17 11h-1.26A6 6 0 1 0 4 14"></path>
                <polyline points="16 16 12 12 8 16"></polyline>
                <line x1="12" y1="12" x2="12" y2="21"></line>
              </svg>
              <strong>Drop files here</strong>
              <span>or <em>click to browse</em></span>
              <small>Tagged as <b>{{ selectedType }}</b></small>
            </div>
          </div>
        }

        @if (pending().length > 0) {
          <div class="list pending-list">
            <h4>Uploading…</h4>
            @for (p of pending(); track p.tempId) {
              <div class="row" [class.is-failed]="p.status === 'failed'">
                <div class="meta">
                  <span class="dot" [class.is-uploading]="p.status === 'uploading'"></span>
                  <div class="info">
                    <strong>{{ p.file.name }}</strong>
                    <span>{{ p.documentType }} · {{ formatSize(p.file.size) }} · {{ statusLabel(p.status) }}</span>
                    @if (p.error) { <em class="err">{{ p.error }}</em> }
                  </div>
                </div>
                @if (p.status === 'failed') {
                  <button type="button" class="icon-btn" (click)="retry(p)" title="Retry">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" (click)="remove(p)" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="list">
          <h4>
            Uploaded documents
            <span class="counter">{{ documents.length }}</span>
          </h4>
          @if (documents.length === 0) {
            <div class="empty">
              No documents uploaded yet. Drop files above to attach KYC, GST and trade documents.
            </div>
          } @else {
            @for (d of documents; track d.id) {
              <div class="row">
                <div class="meta">
                  <span class="badge">{{ extension(d.fileName) || 'doc' }}</span>
                  <div class="info">
                    <strong>{{ d.fileName }}</strong>
                    <span>{{ d.documentType }} · uploaded {{ d.createdAt | date: 'mediumDate' }}</span>
                  </div>
                </div>
                <span class="status-pill">{{ d.status }}</span>
              </div>
            }
          }
        </div>

        <footer class="step-actions">
          <button type="button" class="btn-ghost" (click)="back.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back
          </button>
          <button type="button" class="btn-primary"
                  [disabled]="documents.length === 0"
                  (click)="continue.emit()">
            Continue
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </footer>
      </div>
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
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--color-border);
      h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); letter-spacing: -0.2px; }
      p  { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    }
    .content { padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }

    .picker {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 14px;
      align-items: stretch;
    }
    .doc-type { display: flex; flex-direction: column; gap: 6px; }
    .doc-type .lbl { font-size: 11.5px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
    .doc-type select {
      height: 44px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .doc-type select:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }

    .dropzone {
      border: 2px dashed var(--color-primary-200);
      border-radius: var(--radius-lg);
      background: var(--color-primary-50);
      padding: 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-align: center;
      cursor: pointer;
      color: var(--color-primary-700);
      transition: background 0.15s var(--ease-out), border-color 0.15s var(--ease-out), transform 0.1s var(--ease-out);
    }
    .dropzone:hover { background: #fff; border-color: var(--color-primary-400); }
    .dropzone.is-dragover {
      background: #fff;
      border-color: var(--color-primary-500);
      transform: scale(1.005);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.10);
    }
    .dropzone .cloud { color: var(--color-primary-500); margin-bottom: 4px; }
    .dropzone strong { font-size: 14px; color: var(--color-text); font-weight: 600; }
    .dropzone span  { font-size: 12.5px; color: var(--color-text-muted); }
    .dropzone em    { color: var(--color-primary-700); font-style: normal; font-weight: 600; }
    .dropzone small { font-size: 11.5px; color: var(--color-text-subtle); margin-top: 4px; }
    .dropzone small b { color: var(--color-text); font-weight: 600; }

    .list { display: flex; flex-direction: column; gap: 8px; }
    .list h4 {
      margin: 0;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
      display: inline-flex; align-items: center; gap: 8px;
    }
    .counter {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 20px; padding: 0 7px;
      background: var(--color-primary-100); color: var(--color-primary-700);
      border-radius: 999px; font-size: 11px; font-weight: 700;
    }

    .empty {
      padding: 24px 18px;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      text-align: center;
      color: var(--color-text-muted);
      font-size: 12.5px;
      background: var(--color-surface-2);
    }

    .row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: #fff;
    }
    .row.is-failed { border-color: #fca5a5; background: #fef2f2; }

    .meta { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }

    .badge {
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-sm);
      font-size: 11px; font-weight: 700;
      text-transform: uppercase;
    }

    .dot {
      flex-shrink: 0;
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--color-text-subtle);
    }
    .dot.is-uploading {
      background: var(--color-primary-500);
      animation: pulse 1.1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
      50%      { box-shadow: 0 0 0 6px rgba(59,130,246,0.0); }
    }

    .info { display: flex; flex-direction: column; min-width: 0; }
    .info strong { font-size: 13px; color: var(--color-text); font-weight: 600; }
    .info span { font-size: 11.5px; color: var(--color-text-muted); }
    .info .err { font-size: 11.5px; color: var(--color-error); font-style: normal; margin-top: 2px; }

    .status-pill {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      letter-spacing: 0.3px;
    }

    .icon-btn {
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
    }
    .icon-btn:hover { background: var(--color-surface-2); color: var(--color-primary-700); }
    .icon-btn--danger:hover { color: var(--color-error); background: var(--color-error-bg); }

    .step-actions {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--color-border);
    }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 18px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .btn-ghost {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }

    @media (max-width: 760px) {
      .picker { grid-template-columns: 1fr; }
    }
  `]
})
export class UploadDocumentsStepComponent {
  @Input({ required: true }) carrier!: CarrierResponse;
  @Input({ required: true }) documents: CarrierDocument[] = [];
  @Input() readOnly: boolean = false;

  @Output() upload = new EventEmitter<{ file: File; documentType: string; onResult: (ok: boolean, error?: string) => void }>();
  @Output() back = new EventEmitter<void>();
  @Output() continue = new EventEmitter<void>();

  readonly documentTypes = CARRIER_DOCUMENT_TYPES;
  selectedType: string = CARRIER_DOCUMENT_TYPES[0];

  readonly pending = signal<PendingUpload[]>([]);
  readonly isDragOver = signal(false);

  onDragOver(ev: DragEvent): void {
    if (this.readOnly) return;
    ev.preventDefault();
    this.isDragOver.set(true);
  }
  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(false);
  }
  onDrop(ev: DragEvent): void {
    if (this.readOnly) return;
    ev.preventDefault();
    this.isDragOver.set(false);
    const files = ev.dataTransfer?.files;
    if (files?.length) this.queueFiles(Array.from(files));
  }
  onFileInputChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files?.length) this.queueFiles(Array.from(input.files));
    input.value = '';
  }

  private queueFiles(files: File[]): void {
    for (const file of files) this.queueFile(file, this.selectedType);
  }

  private queueFile(file: File, documentType: string): void {
    const validation = this.validate(file);
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (validation) {
      this.pending.update((list) => [
        ...list,
        { tempId, file, documentType, status: 'failed', error: validation }
      ]);
      return;
    }

    const item: PendingUpload = { tempId, file, documentType, status: 'uploading' };
    this.pending.update((list) => [...list, item]);

    this.upload.emit({
      file,
      documentType,
      onResult: (ok, error) => {
        if (ok) {
          this.pending.update((list) => list.filter((p) => p.tempId !== tempId));
        } else {
          this.pending.update((list) =>
            list.map((p) => (p.tempId === tempId ? { ...p, status: 'failed', error: error ?? 'Upload failed.' } : p))
          );
        }
      }
    });
  }

  retry(p: PendingUpload): void {
    this.pending.update((list) => list.filter((x) => x.tempId !== p.tempId));
    this.queueFile(p.file, p.documentType);
  }

  remove(p: PendingUpload): void {
    this.pending.update((list) => list.filter((x) => x.tempId !== p.tempId));
  }

  private validate(file: File): string | null {
    if (file.size === 0) return 'File is empty.';
    if (file.size > MAX_FILE_SIZE_BYTES) return 'File exceeds 10 MB.';
    const ext = ('.' + (file.name.split('.').pop() ?? '')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return `File type ${ext} is not allowed.`;
    return null;
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

  statusLabel(s: PendingUpload['status']): string {
    switch (s) {
      case 'queued':    return 'Queued';
      case 'uploading': return 'Uploading…';
      case 'failed':    return 'Failed';
    }
  }
}
