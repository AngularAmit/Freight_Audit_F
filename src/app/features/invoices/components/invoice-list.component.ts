import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { distinctUntilChanged, finalize } from 'rxjs';

import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

import { InvoiceService } from '../invoice.service';
import { CarrierOption, CarriersPickerService } from '../../masters/carriers-picker.service';
import {
  INVOICE_SOURCES,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
  InvoicePagedResponse,
  InvoiceResponse,
  InvoiceStatusKey
} from '../models/invoice.model';

import { InvoiceUploadComponent } from './invoice-upload.component';
import { InvoiceDetailComponent } from './invoice-detail.component';
import { WorkflowDialogComponent } from './workflow-dialog.component';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, DatePipe,
    InvoiceUploadComponent, InvoiceDetailComponent, WorkflowDialogComponent
  ],
  template: `
    <section class="page">
      <header class="hero">
        <div class="hero-text">
          <span class="eyebrow">Transactions · Invoices</span>
          <h1>Invoices</h1>
          <p>Upload freight invoices, monitor AI audit progress, and approve for payment —
             every PDF goes through the audit engine the moment it lands.</p>
        </div>

        <div class="hero-stats">
          <div class="stat">
            <span class="lbl">Total</span>
            <strong>{{ page().totalCount }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Processing</span>
            <strong class="processing">{{ countByStatus('PROCESSING') }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Audited</span>
            <strong class="audited">{{ countByStatus('AUDITED') }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Approved</span>
            <strong class="approved">{{ countByStatus('APPROVED') }}</strong>
          </div>
        </div>
      </header>

      <section class="list">
        <header class="toolbar">
          <div class="filters">
            <select class="picker" [formControl]="carrierCtrl">
              <option value="">All carriers</option>
              @for (c of carriers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>

            <select class="picker" [formControl]="sourceCtrl">
              <option value="">All sources</option>
              @for (s of sources; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>

            <select class="picker" [formControl]="statusCtrl">
              <option value="">All statuses</option>
              @for (o of statusOptions; track o.value) {
                <option [value]="o.key">{{ o.label }}</option>
              }
            </select>
          </div>

          <div class="actions">
            <button type="button" class="btn-secondary" (click)="fetch()" [disabled]="loading()" title="Refresh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>
              </svg>
              Refresh
            </button>
            @if (canCreate()) {
              <button type="button" class="btn-primary" (click)="openUpload()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload invoice
              </button>
            }
          </div>
        </header>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Carrier</th>
                <th>Source</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="7" class="state-row">Loading invoices…</td></tr>
              } @else if (page().items.length === 0) {
                <tr><td colspan="7" class="state-row state-empty">
                  <strong>No invoices yet.</strong>
                  <span>Upload one or change your filters to see results.</span>
                </td></tr>
              } @else {
                @for (inv of page().items; track inv.id) {
                  <tr (click)="openDetail(inv)">
                    <td>
                      <div class="invoice-cell">
                        <div class="badge">PDF</div>
                        <div class="meta">
                          <strong>INV-{{ shortId(inv.id) }}</strong>
                          <span class="path" [title]="inv.filePath">{{ shortPath(inv.filePath) }}</span>
                        </div>
                      </div>
                    </td>
                    <td>{{ inv.carrierName }}</td>
                    <td><span class="source-pill">{{ inv.source }}</span></td>
                    <td>
                      <span class="status-badge" [class]="'status-badge--' + statusKey(inv.status)">
                        @if (statusKey(inv.status) === 'PROCESSING') {
                          <span class="spinner-pulse"></span>
                        } @else {
                          <span class="dot"></span>
                        }
                        {{ statusLabel(inv.status) }}
                      </span>
                    </td>
                    <td class="muted">{{ inv.createdAt | date: 'mediumDate' }}</td>
                    <td class="muted">{{ inv.updatedAt ? (inv.updatedAt | date: 'mediumDate') : '—' }}</td>
                    <td class="actions-col">
                      @if (canProcess() && statusKey(inv.status) !== 'APPROVED') {
                        <button class="icon-btn icon-btn--primary"
                                (click)="openWorkflow(inv); $event.stopPropagation()"
                                title="Run AI workflow"
                                aria-label="Run workflow">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        </button>
                      }
                      <button class="icon-btn" (click)="openDetail(inv); $event.stopPropagation()" title="Open">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <footer class="pager">
            <span class="muted">
              Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ page().totalCount }}
            </span>
            <div class="pager-buttons">
              <button class="btn-page" [disabled]="currentPage() === 1" (click)="goTo(currentPage() - 1)">← Prev</button>
              <span class="page-indicator">Page {{ currentPage() }} / {{ totalPages() }}</span>
              <button class="btn-page" [disabled]="currentPage() === totalPages()" (click)="goTo(currentPage() + 1)">Next →</button>
            </div>
          </footer>
        }
      </section>
    </section>

    <app-invoice-upload
      [open]="uploadOpen()"
      (closed)="uploadOpen.set(false)"
      (uploaded)="onUploaded($event)">
    </app-invoice-upload>

    <app-invoice-detail
      [open]="detailOpen()"
      [invoice]="detailInvoice()"
      (closed)="closeDetail()"
      (updated)="onDetailUpdated($event)"
      (process)="onProcessFromDetail($event)">
    </app-invoice-detail>

    <app-workflow-dialog
      [open]="workflowOpen()"
      [invoice]="workflowInvoice()"
      (closed)="closeWorkflow()"
      (processed)="onWorkflowProcessed($event)">
    </app-workflow-dialog>
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
      display: flex; align-items: center; justify-content: space-between; gap: 22px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(circle at 92% 12%, rgba(59,130,246,0.18), transparent 60%);
      pointer-events: none;
    }
    .hero-text { position: relative; max-width: 600px; }
    .eyebrow {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      letter-spacing: 1.4px; text-transform: uppercase;
      color: var(--color-primary-700);
      background: rgba(255,255,255,0.7);
      padding: 4px 10px; border-radius: 999px;
      border: 1px solid var(--color-primary-100);
    }
    .hero h1 {
      margin: 10px 0 4px;
      font-size: 24px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }
    .hero p { margin: 0; font-size: 13.5px; color: var(--color-text-muted); }

    .hero-stats {
      position: relative;
      display: flex; gap: 10px; flex-wrap: wrap;
    }
    .stat {
      min-width: 96px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.85);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-md);
    }
    .stat .lbl {
      display: block;
      font-size: 11px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .stat strong {
      display: block;
      margin-top: 4px;
      font-size: 20px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.4px;
    }
    .stat strong.processing { color: #92400e; }
    .stat strong.audited    { color: #4338ca; }
    .stat strong.approved   { color: #047857; }

    .list {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }

    .toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .filters { display: flex; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }
    .picker {
      height: 38px; padding: 0 12px; min-width: 160px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .picker:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }

    .actions { display: flex; align-items: center; gap: 10px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover { filter: brightness(1.05); }
    .btn-secondary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: #fff;
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-200);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-primary-50);
      border-color: var(--color-primary-300);
    }
    .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th {
      text-align: left;
      padding: 11px 18px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.5px; text-transform: uppercase;
      color: var(--color-text-muted);
      background: #fff;
      border-bottom: 1px solid var(--color-border);
    }
    tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
    }
    tbody tr { cursor: pointer; transition: background 0.15s var(--ease-out); }
    tbody tr:hover { background: var(--color-primary-50); }
    tbody tr:last-child td { border-bottom: none; }

    .invoice-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .badge {
      width: 36px; height: 36px;
      flex-shrink: 0;
      border-radius: 8px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .meta { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
    .meta strong {
      font-size: 13px; color: var(--color-text); font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.3px;
    }
    .meta .path {
      font-size: 11.5px; color: var(--color-text-muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      max-width: 320px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .source-pill {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      padding: 3px 9px; border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      letter-spacing: 0.4px;
    }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      padding: 4px 10px; border-radius: 999px;
      letter-spacing: 0.3px;
      border: 1px solid var(--color-border);
    }
    .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
    .status-badge--RECEIVED   { background: var(--color-primary-50); color: var(--color-primary-700); border-color: var(--color-primary-100); }
    .status-badge--RECEIVED   .dot { background: var(--color-primary-500); }
    .status-badge--PROCESSING { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .status-badge--PROCESSING .dot { background: #f59e0b; }
    .status-badge--AUDITED    { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
    .status-badge--AUDITED    .dot { background: #6366f1; }
    .status-badge--APPROVED   { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .status-badge--APPROVED   .dot { background: #10b981; }

    .spinner-pulse {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1);   opacity: 1; }
      50%      { transform: scale(0.5); opacity: 0.4; }
    }

    .muted { color: var(--color-text-muted); font-size: 12.5px; }
    .actions-col { width: 96px; text-align: right; white-space: nowrap; }
    .actions-col .icon-btn + .icon-btn { margin-left: 4px; }
    .icon-btn {
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
    }
    .icon-btn:hover { background: var(--color-surface-2); color: var(--color-primary-700); }
    .icon-btn--primary {
      color: var(--color-primary-700);
      background: var(--color-primary-50);
      border: 1px solid var(--color-primary-100);
    }
    .icon-btn--primary:hover {
      background: var(--gradient-brand);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 10px rgba(59, 130, 246, 0.28);
    }

    .state-row { text-align: center; padding: 28px 18px !important; color: var(--color-text-muted); }
    .state-empty strong { display: block; color: var(--color-text); margin-bottom: 4px; }
    .state-empty span { font-size: 12.5px; }

    .pager {
      display: flex; align-items: center; justify-content: space-between;
      gap: 14px;
      padding: 12px 18px;
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .pager-buttons { display: flex; align-items: center; gap: 8px; }
    .btn-page {
      padding: 6px 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 12.5px; font-weight: 500;
      border-radius: var(--radius-sm);
    }
    .btn-page:hover:not(:disabled) {
      border-color: var(--color-primary-300);
      color: var(--color-primary-700);
      background: var(--color-primary-50);
    }
    .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-indicator { font-size: 12px; color: var(--color-text-muted); }

    @media (max-width: 760px) {
      .hero { flex-direction: column; align-items: flex-start; }
      .hero-stats { width: 100%; }
      .toolbar { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class InvoiceListComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  readonly carrierCtrl = new FormControl<string>('', { nonNullable: true });
  readonly sourceCtrl = new FormControl<string>('', { nonNullable: true });
  readonly statusCtrl = new FormControl<string>('', { nonNullable: true });

  readonly sources = INVOICE_SOURCES;
  readonly statusOptions = INVOICE_STATUS_OPTIONS;

  readonly carriers = signal<CarrierOption[]>([]);
  readonly page = signal<InvoicePagedResponse>({ items: [], totalCount: 0, page: 1, pageSize: 10 });
  readonly loading = signal(false);

  readonly uploadOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailInvoice = signal<InvoiceResponse | null>(null);
  readonly workflowOpen = signal(false);
  readonly workflowInvoice = signal<InvoiceResponse | null>(null);

  readonly currentPage = computed(() => this.page().page || 1);
  readonly totalPages = computed(() => {
    const p = this.page();
    return p.pageSize > 0 ? Math.ceil(p.totalCount / p.pageSize) : 0;
  });
  readonly rangeStart = computed(() => {
    const p = this.page();
    if (p.totalCount === 0) return 0;
    return (p.page - 1) * p.pageSize + 1;
  });
  readonly rangeEnd = computed(() => {
    const p = this.page();
    return Math.min(p.page * p.pageSize, p.totalCount);
  });

  canCreate = computed(() => this.perms.hasPermission('INVOICE', 'canCreate'));
  canProcess = computed(() => this.perms.hasPermission('INVOICE', 'canEdit'));

  ngOnInit(): void {
    this.carriersPicker.load().subscribe({
      next: (c) => this.carriers.set(c),
      error: () => undefined
    });

    [this.carrierCtrl, this.sourceCtrl, this.statusCtrl].forEach((ctrl) =>
      ctrl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.fetch(1))
    );

    this.fetch(1);
  }

  fetch(page: number = this.currentPage()): void {
    this.loading.set(true);
    this.invoices
      .list({
        page,
        pageSize: this.page().pageSize || 10,
        carrierId: this.carrierCtrl.value || undefined,
        source: (this.sourceCtrl.value || undefined) as never,
        status: (this.statusCtrl.value || undefined) as never
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => this.page.set(p),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load invoices.');
        }
      });
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.fetch(p);
  }

  openUpload(): void { this.uploadOpen.set(true); }

  onUploaded(inv: InvoiceResponse): void {
    this.uploadOpen.set(false);
    this.fetch(1);
    this.openDetailFor(inv);
  }

  openDetail(inv: InvoiceResponse): void {
    // Refresh from server in case it just transitioned (e.g. PROCESSING → AUDITED).
    this.invoices.getById(inv.id).subscribe({
      next: (latest) => this.openDetailFor(latest),
      error: () => this.openDetailFor(inv)
    });
  }

  private openDetailFor(inv: InvoiceResponse): void {
    this.detailInvoice.set(inv);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailInvoice.set(null);
    this.fetch(this.currentPage());
  }

  onDetailUpdated(inv: InvoiceResponse): void {
    this.detailInvoice.set(inv);
    this.page.update((p) => ({
      ...p,
      items: p.items.map((x) => (x.id === inv.id ? inv : x))
    }));
  }

  /** Detail modal asked us to launch the workflow — close detail and open the workflow dialog. */
  onProcessFromDetail(inv: InvoiceResponse): void {
    this.detailOpen.set(false);
    this.detailInvoice.set(null);
    this.openWorkflow(inv);
  }

  openWorkflow(inv: InvoiceResponse): void {
    // Refresh from server so we run against the latest status.
    this.invoices.getById(inv.id).subscribe({
      next: (latest) => {
        this.workflowInvoice.set(latest);
        this.workflowOpen.set(true);
      },
      error: () => {
        this.workflowInvoice.set(inv);
        this.workflowOpen.set(true);
      }
    });
  }

  closeWorkflow(): void {
    this.workflowOpen.set(false);
    this.workflowInvoice.set(null);
    this.fetch(this.currentPage());
  }

  onWorkflowProcessed(latest: InvoiceResponse): void {
    this.workflowInvoice.set(latest);
    this.page.update((p) => ({
      ...p,
      items: p.items.map((x) => (x.id === latest.id ? latest : x))
    }));
  }

  countByStatus(s: InvoiceStatusKey): number {
    return this.page().items.filter((i) => this.statusKey(i.status) === s).length;
  }

  shortId(id: string): string { return id.slice(0, 8); }

  shortPath(p: string): string {
    if (!p) return '';
    return p.length <= 48 ? p : '…' + p.slice(p.length - 47);
  }

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
}
