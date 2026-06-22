import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

import { MasterService } from '../master.service';
import { CarrierOption, CarriersPickerService } from '../carriers-picker.service';
import { ContractListItem, ContractPagedResponse, ContractResponse } from '../models/contract.model';

import { ContractFormComponent } from './contract-form.component';
import { ContractDetailComponent } from './contract-detail.component';

@Component({
  selector: 'app-contract-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, DatePipe,
    ContractFormComponent, ContractDetailComponent
  ],
  template: `
    <section class="card">
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
            <input type="text" placeholder="Search contracts…" [formControl]="searchCtrl" />
            @if (searchCtrl.value) {
              <button class="clear" (click)="searchCtrl.setValue('')" aria-label="Clear search">×</button>
            }
          </div>

          <select class="picker" [formControl]="carrierCtrl">
            <option value="">All carriers</option>
            @for (c of carriers(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>

          <select class="picker" [formControl]="activeCtrl">
            <option value="">All statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
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
              New contract
            </button>
          }
        </div>
      </header>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Carrier</th>
              <th>SLA rules</th>
              <th>File</th>
              <th>Status</th>
              <th>Created</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="7" class="state-row">Loading contracts…</td></tr>
            } @else if (page().items.length === 0) {
              <tr><td colspan="7" class="state-row state-empty">
                <strong>No contracts found.</strong>
                <span>Create one or change your filters.</span>
              </td></tr>
            } @else {
              @for (c of page().items; track c.id) {
                <tr (click)="openDetail(c)">
                  <td>
                    <div class="cell">
                      <div class="badge">📄</div>
                      <div class="meta">
                        <strong>{{ c.contractName }}</strong>
                        <span>ID {{ shortId(c.id) }}</span>
                      </div>
                    </div>
                  </td>
                  <td>{{ c.carrierName }}</td>
                  <td>
                    @if (c.slaRulesCount > 0) {
                      <span class="counter-pill">{{ c.slaRulesCount }} rule{{ c.slaRulesCount === 1 ? '' : 's' }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    @if (c.filePath) {
                      <span class="file-link" [title]="c.filePath">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        Linked
                      </span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    <span class="status" [class.status--off]="!c.isActive">
                      <span class="dot"></span>
                      {{ c.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="muted">{{ c.createdAt | date: 'mediumDate' }}</td>
                  <td class="actions-col">
                    <button class="icon-btn" (click)="openDetail(c); $event.stopPropagation()" title="Open">
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

    <app-contract-form
      [open]="formOpen()"
      (closed)="formOpen.set(false)"
      (created)="onCreated($event)">
    </app-contract-form>

    <app-contract-detail
      [open]="detailOpen()"
      [contract]="detailContract()"
      (closed)="closeDetail()"
      (updated)="onDetailUpdated($event)">
    </app-contract-detail>
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
    .filters { display: flex; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }

    .search {
      flex: 1; min-width: 220px; max-width: 360px;
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

    .cell { display: flex; align-items: center; gap: 12px; }
    .badge {
      width: 34px; height: 34px;
      flex-shrink: 0;
      border-radius: 8px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .meta { display: flex; flex-direction: column; line-height: 1.25; }
    .meta strong { font-size: 13.5px; color: var(--color-text); font-weight: 600; }
    .meta span { font-size: 11.5px; color: var(--color-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .counter-pill {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
    }

    .file-link {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 3px 9px; border-radius: 999px;
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

    @media (max-width: 720px) {
      .toolbar { flex-direction: column; align-items: stretch; }
      .search, .picker { max-width: none; min-width: 0; }
    }
  `]
})
export class ContractListComponent implements OnInit {
  private readonly master = inject(MasterService);
  private readonly carriersPicker = inject(CarriersPickerService);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionsService);

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  readonly carrierCtrl = new FormControl<string>('', { nonNullable: true });
  readonly activeCtrl = new FormControl<string>('', { nonNullable: true });

  readonly carriers = signal<CarrierOption[]>([]);
  readonly page = signal<ContractPagedResponse>({ items: [], totalCount: 0, page: 1, pageSize: 10 });
  readonly loading = signal(false);

  readonly formOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailContract = signal<ContractResponse | null>(null);

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

  canCreate = computed(() => this.perms.hasPermission('CONTRACT', 'canCreate'));

  ngOnInit(): void {
    this.carriersPicker.load().subscribe({ next: (c) => this.carriers.set(c) });

    this.searchCtrl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.fetch(1));
    this.carrierCtrl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.fetch(1));
    this.activeCtrl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.fetch(1));

    this.fetch(1);
  }

  fetch(page: number = this.currentPage()): void {
    this.loading.set(true);
    const isActiveStr = this.activeCtrl.value;
    this.master
      .listContracts({
        page,
        pageSize: this.page().pageSize || 10,
        search: this.searchCtrl.value.trim() || undefined,
        carrierId: this.carrierCtrl.value || undefined,
        isActive: isActiveStr === '' ? null : isActiveStr === 'true'
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => this.page.set(p),
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load contracts.');
        }
      });
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.fetch(p);
  }

  openCreate(): void { this.formOpen.set(true); }

  onCreated(c: ContractResponse): void {
    this.formOpen.set(false);
    this.fetch(1);
    this.openDetailFor(c);
  }

  openDetail(item: ContractListItem): void {
    this.master.getContract(item.id).subscribe({
      next: (c) => this.openDetailFor(c),
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not open contract.');
      }
    });
  }

  private openDetailFor(c: ContractResponse): void {
    this.detailContract.set(c);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailContract.set(null);
    this.fetch(this.currentPage());
  }

  onDetailUpdated(c: ContractResponse): void {
    this.detailContract.set(c);
  }

  shortId(id: string): string {
    return id.slice(0, 8);
  }
}
