import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ToastService } from '../../shared/services/toast.service';
import { ApiResponse } from '../../core/auth/models/api-response.model';

import { ReportsService } from './reports.service';
import { PenaltyReport, PerformanceReport, SummaryReport } from './models/report.model';

import { SummaryTabComponent } from './components/summary-tab.component';
import { PerformanceTabComponent } from './components/performance-tab.component';
import { PenaltiesTabComponent } from './components/penalties-tab.component';

type TabKey = 'summary' | 'performance' | 'penalties';

interface Tab {
  key: TabKey;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    SummaryTabComponent, PerformanceTabComponent, PenaltiesTabComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <!-- Hero -->
      <header class="hero">
        <div class="hero-text">
          <span class="eyebrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/>
            </svg>
            AI-driven analytics
          </span>
          <h1>Reports dashboard</h1>
          <p>Spot recovery opportunities, monitor SLA performance, and track penalties — every report
             rebuilt live from the audit and workflow engines.</p>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn-secondary" (click)="refresh()" [disabled]="loadingAny()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>
            </svg>
            Refresh all
          </button>
          @if (lastUpdated()) {
            <span class="ts">Last refresh · {{ lastUpdated() | date: 'medium' }}</span>
          }
        </div>
      </header>

      <!-- Tabs -->
      <nav class="tabs" role="tablist">
        @for (tab of tabs; track tab.key) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.is-active]="activeTab() === tab.key"
            [attr.aria-selected]="activeTab() === tab.key"
            (click)="setTab(tab.key)">
            <span class="tab-label">{{ tab.label }}</span>
            <span class="tab-hint">{{ tab.hint }}</span>
          </button>
        }
      </nav>

      <!-- Tab body -->
      <section class="tab-body" role="tabpanel">
        @switch (activeTab()) {
          @case ('summary') {
            <app-summary-tab [report]="summary()" [loading]="loadingSummary()"></app-summary-tab>
          }
          @case ('performance') {
            <app-performance-tab [report]="performance()" [loading]="loadingPerformance()"></app-performance-tab>
          }
          @case ('penalties') {
            <app-penalties-tab [report]="penalties()" [loading]="loadingPenalties()"></app-penalties-tab>
          }
        }
      </section>

      @if (errorMessage()) {
        <div class="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12" y2="16"></line>
          </svg>
          <span>{{ errorMessage() }}</span>
          <button type="button" class="btn-ghost" (click)="refresh()">Retry</button>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page { display: flex; flex-direction: column; gap: 18px; }

    /* ===== Hero ===== */
    .hero {
      position: relative;
      padding: 22px 26px;
      background: var(--gradient-brand-soft);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-lg);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 22px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(circle at 92% 12%, rgba(59, 130, 246, 0.18), transparent 60%);
      pointer-events: none;
    }
    .hero-text { position: relative; max-width: 620px; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 1.4px; text-transform: uppercase;
      color: var(--color-primary-700);
      background: rgba(255, 255, 255, 0.7);
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

    .hero-actions {
      position: relative;
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
    }
    .btn-secondary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: #fff;
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-200);
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-primary-50);
      border-color: var(--color-primary-300);
    }
    .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
    .ts { font-size: 11px; color: var(--color-primary-700); font-variant-numeric: tabular-nums; opacity: 0.85; }

    /* ===== Tabs ===== */
    .tabs {
      display: flex; gap: 6px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 6px;
      box-shadow: var(--shadow-xs);
    }
    .tab {
      flex: 1;
      display: flex; flex-direction: column; align-items: flex-start;
      padding: 10px 14px;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: var(--radius-md);
      transition: all 0.18s var(--ease-out);
      text-align: left;
      min-width: 0;
    }
    .tab:hover:not(.is-active) {
      background: var(--color-surface-2);
      color: var(--color-text);
    }
    .tab.is-active {
      background: var(--gradient-brand);
      color: #fff;
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.28);
    }
    .tab-label {
      font-size: 13px; font-weight: 700;
    }
    .tab-hint {
      font-size: 11px; font-weight: 500;
      margin-top: 2px;
      opacity: 0.85;
    }
    .tab.is-active .tab-hint { opacity: 0.95; }

    /* ===== Body ===== */
    .tab-body { display: block; }

    /* ===== Error banner ===== */
    .error-banner {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px;
      background: var(--color-error-bg);
      border: 1px solid #fecaca;
      color: var(--color-error);
      border-radius: var(--radius-md);
      font-size: 13px;
    }
    .error-banner span { flex: 1; }
    .btn-ghost {
      padding: 6px 12px;
      background: transparent;
      color: var(--color-error);
      border: 1px solid #fecaca;
      font-size: 12px; font-weight: 600;
      border-radius: var(--radius-sm);
    }
    .btn-ghost:hover { background: #fff; }

    @media (max-width: 760px) {
      .hero { flex-direction: column; align-items: flex-start; }
      .hero-actions { align-items: flex-start; }
      .tabs { flex-wrap: wrap; }
      .tab { flex: 1 1 calc(50% - 6px); }
      .tab-hint { display: none; }
    }
  `]
})
export class ReportsComponent implements OnInit {
  private readonly reports = inject(ReportsService);
  private readonly toast = inject(ToastService);

  readonly tabs: Tab[] = [
    { key: 'summary',     label: 'Summary',     hint: 'Volumes & savings' },
    { key: 'performance', label: 'Performance', hint: 'Carrier OTD' },
    { key: 'penalties',   label: 'Penalties',   hint: 'SLA deductions' }
  ];

  readonly activeTab = signal<TabKey>('summary');

  readonly summary = signal<SummaryReport | null>(null);
  readonly performance = signal<PerformanceReport | null>(null);
  readonly penalties = signal<PenaltyReport | null>(null);

  readonly loadingSummary = signal(false);
  readonly loadingPerformance = signal(false);
  readonly loadingPenalties = signal(false);

  readonly lastUpdated = signal<Date | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly loadingAny = computed(
    () => this.loadingSummary() || this.loadingPerformance() || this.loadingPenalties()
  );

  ngOnInit(): void {
    this.refresh();
  }

  setTab(key: TabKey): void {
    this.activeTab.set(key);
  }

  /** Hits all three reports in parallel and replaces local state on success. */
  refresh(): void {
    this.errorMessage.set(null);

    this.loadingSummary.set(true);
    this.reports.getSummary()
      .pipe(finalize(() => this.loadingSummary.set(false)))
      .subscribe({
        next: (r) => this.summary.set(r),
        error: (err: HttpErrorResponse) => this.handleError(err, 'summary')
      });

    this.loadingPerformance.set(true);
    this.reports.getPerformance()
      .pipe(finalize(() => this.loadingPerformance.set(false)))
      .subscribe({
        next: (r) => this.performance.set(r),
        error: (err: HttpErrorResponse) => this.handleError(err, 'performance')
      });

    this.loadingPenalties.set(true);
    this.reports.getPenalties()
      .pipe(finalize(() => {
        this.loadingPenalties.set(false);
        if (!this.errorMessage()) this.lastUpdated.set(new Date());
      }))
      .subscribe({
        next: (r) => this.penalties.set(r),
        error: (err: HttpErrorResponse) => this.handleError(err, 'penalties')
      });
  }

  private handleError(err: HttpErrorResponse, scope: string): void {
    const body = err.error as ApiResponse<unknown> | undefined;
    const msg = body?.message ?? `Could not load ${scope} report.`;
    // Surface a banner for the failing report but keep the rest functional.
    this.errorMessage.set(msg);
    this.toast.error(msg);
  }
}
