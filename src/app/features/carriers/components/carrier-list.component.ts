import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { CarrierService } from '../carrier.service';
import { CarrierStatus, CarrierSummary } from '../models/carrier.model';
import { PagedResult } from '../../admin/models/paged-result.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

interface StatusOption {
  value: CarrierStatus | '';
  label: string;
}

@Component({
  selector: 'app-carrier-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe, RouterLink],
  template: `
    <section class="page">
      <header class="hero">
        <div class="hero-text">
          <span class="eyebrow">Carrier Onboarding</span>
          <h1>Carriers</h1>
          <p>Onboard, validate and approve carriers — every step backed by AI compliance checks.</p>
        </div>

        <div class="hero-stats">
          <div class="stat">
            <span class="lbl">Total</span>
            <strong>{{ page().totalCount }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Approved</span>
            <strong class="approved">{{ countByStatus('APPROVED') }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">In review</span>
            <strong class="review">{{ countByStatus('UNDER_REVIEW') }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">Pending</span>
            <strong class="pending">{{ countByStatus('PENDING') }}</strong>
          </div>
        </div>
      </header>

      <section class="list">
        <header class="toolbar">
          <div class="filters">
            <div class="search">
              <span class="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input type="text" placeholder="Search carriers, GST, geography…" [formControl]="searchCtrl" />
              @if (searchCtrl.value) {
                <button class="clear" (click)="searchCtrl.setValue('')" aria-label="Clear search">×</button>
              }
            </div>

            <select class="status-filter" [formControl]="statusCtrl">
              @for (o of statusOptions; track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </div>

          <div class="actions">
            @if (canCreate()) {
              <button type="button" class="btn-primary" routerLink="/carriers/new">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Onboard carrier
              </button>
            }
          </div>
        </header>

        <div class="table-wrap">
          <table class="carriers">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>GST</th>
                <th>Geography</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Created</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="7" class="state-row">Loading carriers…</td></tr>
              } @else if (page().items.length === 0) {
                <tr><td colspan="7" class="state-row state-empty">
                  <strong>No carriers found.</strong>
                  <span>Adjust filters or onboard a new carrier to get started.</span>
                </td></tr>
              } @else {
                @for (c of page().items; track c.id) {
                  <tr (click)="open(c)">
                    <td>
                      <div class="carrier-cell">
                        <div class="avatar">{{ initials(c.name) }}</div>
                        <div class="meta">
                          <strong>{{ c.name }}</strong>
                          <span>{{ c.complianceStatus || '—' }}</span>
                        </div>
                      </div>
                    </td>
                    <td><code class="gst">{{ c.gstNumber }}</code></td>
                    <td>{{ c.geography }}</td>
                    <td>
                      <span class="status-pill" [class]="'status-pill--' + statusKey(c.status)">
                        <span class="dot"></span>
                        {{ statusLabel(c.status) }}
                      </span>
                    </td>
                    <td>
                      @if (c.riskLevel) {
                        <span class="risk" [class]="'risk--' + riskTone(c.riskLevel)">{{ c.riskLevel }}</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="muted">{{ c.createdAt | date: 'mediumDate' }}</td>
                    <td class="actions-col">
                      <button class="icon-btn" title="Open" (click)="open(c); $event.stopPropagation()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

        @if (page().totalPages > 1) {
          <footer class="pager">
            <span class="muted">
              Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ page().totalCount }}
            </span>
            <div class="pager-buttons">
              <button class="btn-page" [disabled]="!page().hasPreviousPage" (click)="goTo(page().page - 1)">← Prev</button>
              <span class="page-indicator">Page {{ page().page }} / {{ page().totalPages }}</span>
              <button class="btn-page" [disabled]="!page().hasNextPage" (click)="goTo(page().page + 1)">Next →</button>
            </div>
          </footer>
        }
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
      display: flex; align-items: center; justify-content: space-between; gap: 22px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(circle at 90% 20%, rgba(59,130,246,0.18), transparent 60%);
      pointer-events: none;
    }
    .hero-text { position: relative; }
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
    .hero p {
      margin: 0;
      font-size: 13.5px; color: var(--color-text-muted);
      max-width: 580px;
    }

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
      backdrop-filter: blur(4px);
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
    .stat strong.approved { color: #047857; }
    .stat strong.review   { color: var(--color-primary-700); }
    .stat strong.pending  { color: #b45309; }

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
    .filters { display: flex; gap: 10px; flex: 1; min-width: 0; }

    .search {
      flex: 1; max-width: 380px;
      display: flex; align-items: center; gap: 8px;
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .search:focus-within { border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .search-icon { color: var(--color-text-subtle); display: inline-flex; }
    .search input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; color: var(--color-text); }
    .search input::placeholder { color: var(--color-text-subtle); }
    .clear {
      background: transparent; color: var(--color-text-subtle);
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; font-size: 18px; line-height: 1;
    }
    .clear:hover { background: var(--color-surface-2); color: var(--color-text); }

    .status-filter {
      height: 38px; padding: 0 12px; min-width: 170px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .status-filter:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }

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

    .table-wrap { overflow-x: auto; }
    table.carriers { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.carriers thead th {
      text-align: left;
      padding: 11px 18px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.5px; text-transform: uppercase;
      color: var(--color-text-muted);
      background: #fff;
      border-bottom: 1px solid var(--color-border);
    }
    table.carriers tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
    }
    table.carriers tbody tr { cursor: pointer; transition: background 0.15s var(--ease-out); }
    table.carriers tbody tr:hover { background: var(--color-primary-50); }
    table.carriers tbody tr:last-child td { border-bottom: none; }

    .carrier-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: var(--gradient-brand);
      color: #fff;
      font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3);
    }
    .meta { display: flex; flex-direction: column; line-height: 1.25; }
    .meta strong { font-size: 13.5px; color: var(--color-text); font-weight: 600; }
    .meta span { font-size: 12px; color: var(--color-text-muted); }

    .gst {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      padding: 4px 10px; border-radius: 999px;
      letter-spacing: 0.3px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-text-subtle); }
    .status-pill--pending { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .status-pill--pending .dot { background: #f59e0b; }
    .status-pill--review { background: var(--color-primary-50); color: var(--color-primary-700); border-color: var(--color-primary-100); }
    .status-pill--review .dot { background: var(--color-primary-500); }
    .status-pill--approved { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .status-pill--approved .dot { background: #10b981; }
    .status-pill--rejected { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .status-pill--rejected .dot { background: #ef4444; }

    .risk {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 8px; border-radius: 6px;
      letter-spacing: 0.3px;
    }
    .risk--low  { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .risk--med  { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .risk--high { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .risk--unknown { background: var(--color-surface-2); color: var(--color-text-muted); border: 1px solid var(--color-border); }

    .muted { color: var(--color-text-muted); font-size: 12.5px; }

    .actions-col { width: 60px; text-align: right; }
    .icon-btn {
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
    }
    .icon-btn:hover { background: var(--color-surface-2); color: var(--color-primary-700); }

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
    .page-indicator { font-size: 12px; color: var(--color-text-muted); }

    @media (max-width: 760px) {
      .hero { flex-direction: column; align-items: flex-start; }
      .hero-stats { width: 100%; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .filters { flex-direction: column; }
      .search, .status-filter { max-width: none; min-width: 0; }
    }
  `]
})
export class CarrierListComponent implements OnInit {
  private readonly carriers = inject(CarrierService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionsService);

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  readonly statusCtrl = new FormControl<CarrierStatus | ''>('', { nonNullable: true });

  readonly statusOptions: StatusOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'UNDER_REVIEW', label: 'Under review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  readonly page = signal<PagedResult<CarrierSummary>>({
    items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0,
    hasNextPage: false, hasPreviousPage: false
  });
  readonly loading = signal(false);

  readonly rangeStart = computed(() => {
    const p = this.page();
    if (p.totalCount === 0) return 0;
    return (p.page - 1) * p.pageSize + 1;
  });
  readonly rangeEnd = computed(() => {
    const p = this.page();
    return Math.min(p.page * p.pageSize, p.totalCount);
  });

  ngOnInit(): void {
    this.searchCtrl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.fetch(1));

    this.statusCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => this.fetch(1));

    this.fetch(1);
  }

  fetch(page: number = this.page().page): void {
    this.loading.set(true);
    this.carriers
      .list({
        page,
        pageSize: this.page().pageSize || 10,
        search: this.searchCtrl.value.trim() || undefined,
        status: this.statusCtrl.value || undefined
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => this.page.set(p),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load carriers.');
        }
      });
  }

  goTo(p: number): void {
    if (p < 1 || p > this.page().totalPages) return;
    this.fetch(p);
  }

  open(c: CarrierSummary): void {
    this.router.navigate(['/carriers', c.id]);
  }

  countByStatus(s: CarrierStatus): number {
    return this.page().items.filter((c) => c.status === s).length;
  }

  canCreate(): boolean {
    return this.perms.hasPermission('CARRIER', 'canCreate');
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || (name[0] ?? '?').toUpperCase();
  }

  statusKey(s: CarrierStatus): 'pending' | 'review' | 'approved' | 'rejected' {
    if (s === 'APPROVED') return 'approved';
    if (s === 'REJECTED') return 'rejected';
    if (s === 'UNDER_REVIEW') return 'review';
    return 'pending';
  }

  statusLabel(s: CarrierStatus): string {
    return s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

  riskTone(level: string): 'low' | 'med' | 'high' | 'unknown' {
    const l = level.toLowerCase();
    if (l.includes('low')) return 'low';
    if (l.includes('high') || l.includes('critical')) return 'high';
    if (l.includes('med') || l.includes('moderate')) return 'med';
    return 'unknown';
  }
}
