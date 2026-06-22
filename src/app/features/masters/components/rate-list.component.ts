import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

import { MasterService } from '../master.service';
import { CarrierOption, CarriersPickerService } from '../carriers-picker.service';
import { RateListItem, RatePagedResponse, RateResponse } from '../models/rate.model';

import { RateFormComponent } from './rate-form.component';
import { RateDetailComponent } from './rate-detail.component';

@Component({
  selector: 'app-rate-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, DatePipe, DecimalPipe,
    RateFormComponent, RateDetailComponent
  ],
  template: `
    <section class="card">
      <header class="toolbar">
        <div class="filters">
          <select class="picker" [formControl]="carrierCtrl">
            <option value="">All carriers</option>
            @for (c of carriers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>

          <input class="lane-input" type="text" placeholder="Origin" [formControl]="originCtrl" />
          <input class="lane-input" type="text" placeholder="Destination" [formControl]="destCtrl" />
          <input class="lane-input" type="text" placeholder="Service type" [formControl]="serviceCtrl" />

          <select class="picker" [formControl]="activeCtrl">
            <option value="">All</option>
            <option value="true">Active only</option>
          </select>
        </div>

        <div class="actions">
          @if (canCreate()) {
            <button type="button" class="btn-primary" (click)="openCreate()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New rate
            </button>
          }
        </div>
      </header>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lane</th>
              <th>Carrier</th>
              <th>Service</th>
              <th>Type</th>
              <th class="num">Rate</th>
              <th>Effective</th>
              <th>Accessorials</th>
              <th>Status</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="9" class="state-row">Loading rates…</td></tr>
            } @else if (page().items.length === 0) {
              <tr><td colspan="9" class="state-row state-empty">
                <strong>No rates found.</strong>
                <span>Create one or change your filters.</span>
              </td></tr>
            } @else {
              @for (r of page().items; track r.id) {
                <tr (click)="openDetail(r)">
                  <td>
                    <div class="lane">
                      <span class="origin">{{ r.origin }}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                      <span class="dest">{{ r.destination }}</span>
                    </div>
                  </td>
                  <td>{{ r.carrierName }}</td>
                  <td><span class="service-pill">{{ r.serviceType }}</span></td>
                  <td>
                    <span class="type-pill" [class.type-pill--cwt]="r.rateType === 'CWT'">{{ r.rateType }}</span>
                  </td>
                  <td class="num">
                    <strong>{{ r.rateValue | number: '1.2-2' }}</strong>
                    <span class="muted">/ {{ r.rateType === 'CWT' ? 'cwt' : 'shpt' }}</span>
                  </td>
                  <td class="muted">
                    <span>{{ r.effectiveFrom | date: 'mediumDate' }}</span>
                    @if (r.effectiveTo) {
                      <span> → {{ r.effectiveTo | date: 'mediumDate' }}</span>
                    } @else {
                      <span> → open</span>
                    }
                  </td>
                  <td>
                    @if (r.accessorialsCount > 0) {
                      <span class="counter-pill">{{ r.accessorialsCount }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    <span class="status" [class.status--off]="!r.isActive">
                      <span class="dot"></span>
                      {{ r.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="actions-col">
                    <button class="icon-btn" (click)="openDetail(r); $event.stopPropagation()" title="Open">
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

    <app-rate-form
      [open]="formOpen()"
      (closed)="formOpen.set(false)"
      (created)="onCreated($event)">
    </app-rate-form>

    <app-rate-detail
      [open]="detailOpen()"
      [rate]="detailRate()"
      (closed)="closeDetail()"
      (updated)="onDetailUpdated($event)">
    </app-rate-detail>
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

    .toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .filters {
      display: grid;
      grid-template-columns: 180px 1fr 1fr 1fr 130px;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .picker, .lane-input {
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
      min-width: 0;
    }
    .picker:focus, .lane-input:focus {
      outline: none;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }
    .lane-input::placeholder { color: var(--color-text-subtle); }

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
    thead th.num { text-align: right; }
    tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
    }
    tbody td.num { text-align: right; }
    tbody td.num strong { font-weight: 600; }
    tbody td.num .muted { font-size: 11.5px; margin-left: 3px; }
    tbody tr { cursor: pointer; transition: background 0.15s var(--ease-out); }
    tbody tr:hover { background: var(--color-primary-50); }
    tbody tr:last-child td { border-bottom: none; }

    .lane {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600;
      color: var(--color-text);
    }
    .lane svg { color: var(--color-primary-500); flex-shrink: 0; }
    .origin, .dest {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      padding: 2px 8px; border-radius: 4px;
      letter-spacing: 0.4px;
    }

    .service-pill {
      display: inline-block;
      font-size: 11.5px; font-weight: 600;
      padding: 3px 9px; border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      letter-spacing: 0.3px;
    }

    .type-pill {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      padding: 3px 9px; border-radius: 4px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      letter-spacing: 0.5px;
    }
    .type-pill--cwt {
      background: #eef2ff; color: #4338ca; border-color: #c7d2fe;
    }

    .counter-pill {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
    }

    .status {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      color: #047857;
    }
    .status .dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; }
    .status--off { color: var(--color-text-muted); }
    .status--off .dot { background: #d1d5db; }

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
    .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-indicator { font-size: 12px; color: var(--color-text-muted); }

    @media (max-width: 1100px) {
      .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .toolbar { flex-direction: column; align-items: stretch; }
      .filters { grid-template-columns: 1fr; }
    }
  `]
})
export class RateListComponent implements OnInit {
  private readonly master = inject(MasterService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  readonly carrierCtrl = new FormControl<string>('', { nonNullable: true });
  readonly originCtrl = new FormControl<string>('', { nonNullable: true });
  readonly destCtrl = new FormControl<string>('', { nonNullable: true });
  readonly serviceCtrl = new FormControl<string>('', { nonNullable: true });
  readonly activeCtrl = new FormControl<string>('', { nonNullable: true });

  readonly carriers = signal<CarrierOption[]>([]);
  readonly page = signal<RatePagedResponse>({ items: [], totalCount: 0, page: 1, pageSize: 10 });
  readonly loading = signal(false);

  readonly formOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailRate = signal<RateResponse | null>(null);

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

  canCreate = computed(() => this.perms.hasPermission('RATE', 'canCreate'));

  ngOnInit(): void {
    this.carriersPicker.load().subscribe({ next: (c) => this.carriers.set(c) });

    [this.originCtrl, this.destCtrl, this.serviceCtrl].forEach((ctrl) =>
      ctrl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.fetch(1))
    );
    [this.carrierCtrl, this.activeCtrl].forEach((ctrl) =>
      ctrl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.fetch(1))
    );

    this.fetch(1);
  }

  fetch(page: number = this.currentPage()): void {
    this.loading.set(true);
    const activeStr = this.activeCtrl.value;
    this.master
      .listRates({
        page,
        pageSize: this.page().pageSize || 10,
        carrierId: this.carrierCtrl.value || undefined,
        origin: this.originCtrl.value.trim() || undefined,
        destination: this.destCtrl.value.trim() || undefined,
        serviceType: this.serviceCtrl.value.trim() || undefined,
        activeOnly: activeStr === 'true' ? true : null
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => this.page.set(p),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load rates.');
        }
      });
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.fetch(p);
  }

  openCreate(): void { this.formOpen.set(true); }

  onCreated(r: RateResponse): void {
    this.formOpen.set(false);
    this.fetch(1);
    this.openDetailFor(r);
  }

  openDetail(item: RateListItem): void {
    this.master.getRate(item.id).subscribe({
      next: (r) => this.openDetailFor(r),
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not open rate.');
      }
    });
  }

  private openDetailFor(r: RateResponse): void {
    this.detailRate.set(r);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailRate.set(null);
    this.fetch(this.currentPage());
  }

  onDetailUpdated(r: RateResponse): void {
    this.detailRate.set(r);
  }
}
