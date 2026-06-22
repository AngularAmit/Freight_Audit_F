import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

import { InvoiceService } from '../invoice.service';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
  InvoiceResponse,
  InvoiceStatus,
  InvoiceStatusKey
} from '../models/invoice.model';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg"
               [title]="invoice ? ('Invoice ' + shortId(invoice.id)) : 'Invoice'"
               [subtitle]="invoice ? (invoice.carrierName + ' · ' + invoice.source) : ''"
               (close)="closed.emit()">

      @if (invoice) {
        <section class="status-banner" [class]="'status-banner--' + statusKey(invoice.status)">
          <div class="status-icon">
            @switch (statusKey(invoice.status)) {
              @case ('PROCESSING') {
                <span class="spinner-pulse"></span>
              }
              @case ('AUDITED') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              }
              @case ('APPROVED') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              }
              @default {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12" y2="16"></line>
                </svg>
              }
            }
          </div>
          <div class="status-text">
            <strong>{{ statusLabel(invoice.status) }}</strong>
            <span>{{ statusHint(invoice.status) }}</span>
          </div>
        </section>

        <section class="grid">
          <div class="cell">
            <span class="lbl">Carrier</span>
            <strong>{{ invoice.carrierName }}</strong>
          </div>
          <div class="cell">
            <span class="lbl">Source</span>
            <strong><span class="source-pill">{{ invoice.source }}</span></strong>
          </div>
          <div class="cell">
            <span class="lbl">Created</span>
            <strong>{{ invoice.createdAt | date: 'medium' }}</strong>
          </div>
          <div class="cell">
            <span class="lbl">Last updated</span>
            <strong>{{ invoice.updatedAt ? (invoice.updatedAt | date: 'medium') : '—' }}</strong>
          </div>
          <div class="cell grow">
            <span class="lbl">File</span>
            <code class="file-path">{{ invoice.filePath }}</code>
          </div>
        </section>

        @if (canEdit()) {
          <section class="workflow-cta">
            <div class="cta-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
              </svg>
            </div>
            <div class="cta-text">
              <strong>Run the AI audit workflow</strong>
              <span>Triggers the audit engine, computes SLA penalties, and transitions the invoice
                through <em>RECEIVED → PROCESSING → AUDITED → APPROVED</em> in one shot.</span>
            </div>
            <button type="button" class="btn-primary" (click)="process.emit(invoice)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Process invoice
            </button>
          </section>

          <section class="status-changer">
            <header>
              <h4>Change status manually</h4>
              <p>Override the lifecycle for exceptional cases.</p>
            </header>
            <div class="status-actions">
              @for (opt of statusOptions; track opt.value) {
                <button type="button"
                        class="status-btn"
                        [class.is-current]="opt.key === statusKey(invoice.status)"
                        [class]="'status-btn--' + opt.key.toLowerCase()"
                        [disabled]="changing() || opt.key === statusKey(invoice.status)"
                        (click)="changeStatus(opt.value)">
                  @if (changing() && pendingStatus() === opt.value) {
                    <span class="spinner"></span> Updating…
                  } @else {
                    {{ opt.label }}
                  }
                </button>
              }
            </div>
            <em class="hint">Only valid lifecycle transitions are accepted by the audit engine.</em>
          </section>
        }
      }

      <div modal-footer>
        <button type="button" class="btn-ghost" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .status-banner {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px;
      border-radius: var(--radius-md);
      margin-bottom: 18px;
      border: 1px solid var(--color-border);
    }
    .status-icon {
      width: 36px; height: 36px;
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
    }
    .status-text strong { display: block; font-size: 14px; font-weight: 700; }
    .status-text span   { font-size: 12.5px; opacity: 0.85; }

    .status-banner--RECEIVED   { background: var(--color-primary-50); border-color: var(--color-primary-100); color: var(--color-primary-700); }
    .status-banner--RECEIVED   .status-icon { background: var(--color-primary-100); }
    .status-banner--PROCESSING { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .status-banner--PROCESSING .status-icon { background: #fde68a; }
    .status-banner--AUDITED    { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
    .status-banner--AUDITED    .status-icon { background: #c7d2fe; }
    .status-banner--APPROVED   { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    .status-banner--APPROVED   .status-icon { background: #a7f3d0; }

    .spinner-pulse {
      width: 12px; height: 12px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1);   opacity: 1; }
      50%      { transform: scale(0.6); opacity: 0.4; }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 18px;
    }
    .grid .cell {
      display: flex; flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
    }
    .grid .cell.grow { grid-column: 1 / -1; }
    .grid .cell:nth-child(2n) { border-right: none; }
    .grid .cell.grow { border-right: none; }
    .grid .cell:nth-last-child(-n+1).grow,
    .grid .cell:nth-last-child(2):not(.grow),
    .grid .cell:last-child { border-bottom: none; }
    .lbl {
      font-size: 11px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .grid strong { font-size: 13px; color: var(--color-text); font-weight: 600; word-break: break-word; }

    .source-pill {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      padding: 2px 9px; border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      letter-spacing: 0.4px;
    }

    .file-path {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      padding: 4px 8px; border-radius: 4px;
      align-self: flex-start;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .workflow-cta {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      margin-bottom: 14px;
      background: linear-gradient(135deg, var(--color-primary-50) 0%, #ffffff 100%);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.06);
    }
    .cta-icon {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 10px rgba(59, 130, 246, 0.32);
    }
    .cta-text strong { display: block; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
    .cta-text span   { display: block; font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; line-height: 1.45; }
    .cta-text em     { font-style: normal; font-weight: 600; color: var(--color-primary-700); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
      white-space: nowrap;
    }
    .btn-primary:hover { filter: brightness(1.05); }

    .status-changer {
      padding: 16px 18px;
      background: var(--color-surface-2);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
    }
    .status-changer header { margin-bottom: 12px; }
    .status-changer h4 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--color-text-muted); }
    .status-changer p { margin: 4px 0 0; font-size: 12px; color: var(--color-text-muted); }
    .status-changer .hint { display: block; margin-top: 10px; font-size: 11.5px; color: var(--color-text-subtle); font-style: normal; }

    .status-actions {
      display: flex; gap: 8px; flex-wrap: wrap;
    }

    .status-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: #fff;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 12.5px; font-weight: 600;
      border-radius: var(--radius-md);
      transition: all 0.15s var(--ease-out);
    }
    .status-btn:hover:not(:disabled):not(.is-current) {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border-color: var(--color-primary-200);
    }
    .status-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .status-btn.is-current {
      background: var(--gradient-brand);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
      cursor: default;
    }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(0,0,0,0.15);
      border-top-color: var(--color-primary-600);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-ghost {
      padding: 9px 14px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }

    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      .grid .cell { border-right: none; }
    }
  `]
})
export class InvoiceDetailComponent {
  private readonly invoiceSvc = inject(InvoiceService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  @Input({ required: true }) open: boolean = false;
  @Input() invoice: InvoiceResponse | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<InvoiceResponse>();
  /** User clicked the "Process invoice" CTA — parent should open the workflow dialog. */
  @Output() process = new EventEmitter<InvoiceResponse>();

  readonly statusOptions = INVOICE_STATUS_OPTIONS;

  readonly changing = signal(false);
  readonly pendingStatus = signal<InvoiceStatus | null>(null);

  canEdit = computed(() => this.perms.hasPermission('INVOICE', 'canEdit'));

  shortId(id: string): string { return id.slice(0, 8); }

  statusKey(raw: string): InvoiceStatusKey {
    const upper = (raw || '').toUpperCase();
    if (upper === 'PROCESSING' || upper === 'AUDITED' || upper === 'APPROVED' || upper === 'RECEIVED') {
      return upper;
    }
    return 'RECEIVED';
  }

  statusLabel(raw: string): string {
    return INVOICE_STATUS_LABELS[this.statusKey(raw)] ?? raw;
  }

  statusHint(raw: string): string {
    switch (this.statusKey(raw)) {
      case 'RECEIVED':   return 'Invoice ingested. Awaiting audit.';
      case 'PROCESSING': return 'AI audit engine is running on this invoice.';
      case 'AUDITED':    return 'Audit complete. Awaiting finance approval.';
      case 'APPROVED':   return 'Approved for payment.';
    }
  }

  changeStatus(next: InvoiceStatus): void {
    if (!this.invoice) return;
    this.changing.set(true);
    this.pendingStatus.set(next);

    this.invoiceSvc
      .changeStatus(this.invoice.id, next)
      .pipe(finalize(() => {
        this.changing.set(false);
        this.pendingStatus.set(null);
      }))
      .subscribe({
        next: (inv) => {
          this.toast.success(`Invoice moved to ${this.statusLabel(inv.status)}.`);
          this.updated.emit(inv);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Status change rejected.');
        }
      });
  }
}
