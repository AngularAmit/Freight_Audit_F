import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';

import { DonutChartComponent, DonutSlice } from './donut-chart.component';
import { SummaryReport } from '../models/report.model';

const STATUS_COLORS: Record<string, string> = {
  RECEIVED:   '#3b82f6',
  PROCESSING: '#f59e0b',
  AUDITED:    '#6366f1',
  APPROVED:   '#10b981',
  DONE:       '#10b981',
  FAILED:     '#ef4444'
};
const SOURCE_COLORS: Record<string, string> = {
  API:    '#0ea5e9',
  EMAIL:  '#8b5cf6',
  UPLOAD: '#3b82f6'
};
const AUDIT_COLORS: Record<string, string> = {
  PASS:           '#10b981',
  OVERCHARGE:     '#ef4444',
  UNDERCHARGE:    '#f59e0b',
  RATE_NOT_FOUND: '#6b7280'
};

@Component({
  selector: 'app-summary-tab',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, DonutChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading) {
      <div class="state">Loading summary…</div>
    } @else if (!data()) {
      <div class="state state--empty">
        <strong>No summary data yet.</strong>
        <span>Upload and process some invoices to populate this report.</span>
      </div>
    } @else {
      <section class="kpis">
        <article class="kpi kpi--blue">
          <span class="kpi-lbl">Invoices ingested</span>
          <strong>{{ data()!.totalInvoices | number }}</strong>
          <em>across all sources</em>
        </article>
        <article class="kpi kpi--emerald">
          <span class="kpi-lbl">AI-identified savings</span>
          <strong>{{ data()!.totalSavingsFromAudit | number: '1.2-2' }}</strong>
          <em>flagged as overcharge</em>
        </article>
        <article class="kpi kpi--amber">
          <span class="kpi-lbl">Penalty deducted</span>
          <strong>{{ data()!.totalPenaltyDeducted | number: '1.2-2' }}</strong>
          <em>SLA breaches</em>
        </article>
        <article class="kpi kpi--violet">
          <span class="kpi-lbl">Net payable</span>
          <strong>{{ data()!.totalNetPayable | number: '1.2-2' }}</strong>
          <em>after audit + penalties</em>
        </article>
      </section>

      <section class="financial">
        <header>
          <div>
            <h3>Financial reconciliation</h3>
            <p>Actual billed vs. AI-expected amounts across the audited invoices.</p>
          </div>
          <span class="ts">Generated {{ data()!.generatedAt | date: 'medium' }}</span>
        </header>

        <div class="rec-grid">
          <div class="rec-cell">
            <span class="lbl">Actual billed</span>
            <strong>{{ data()!.totalActualBilled | number: '1.2-2' }}</strong>
          </div>
          <div class="rec-cell">
            <span class="lbl">Expected (audit engine)</span>
            <strong>{{ data()!.totalExpectedAmount | number: '1.2-2' }}</strong>
          </div>
          <div class="rec-cell rec-cell--positive">
            <span class="lbl">Carrier overcharge</span>
            <strong>{{ data()!.totalOvercharge | number: '1.2-2' }}</strong>
            <em>amount carriers billed in excess</em>
          </div>
          <div class="rec-cell rec-cell--negative">
            <span class="lbl">Carrier undercharge</span>
            <strong>{{ data()!.totalUndercharge | number: '1.2-2' }}</strong>
            <em>amount carriers under-billed</em>
          </div>
        </div>

        <div class="rec-bar">
          <div class="rec-bar-track">
            <div class="rec-bar-fill rec-bar-fill--actual"
                 [style.width.%]="actualPct()" [title]="'Actual billed: ' + (data()!.totalActualBilled | number: '1.2-2')"></div>
            <div class="rec-bar-fill rec-bar-fill--expected"
                 [style.width.%]="expectedPct()" [title]="'Expected: ' + (data()!.totalExpectedAmount | number: '1.2-2')"></div>
          </div>
          <div class="rec-bar-keys">
            <span><span class="dot dot--actual"></span> Actual billed</span>
            <span><span class="dot dot--expected"></span> Expected</span>
          </div>
        </div>
      </section>

      <section class="donuts">
        <article class="donut-card">
          <header>
            <h4>By status</h4>
            <span>Lifecycle distribution</span>
          </header>
          <app-donut-chart
            [slices]="statusSlices()"
            [size]="150"
            centerLabel="Invoices">
          </app-donut-chart>
        </article>

        <article class="donut-card">
          <header>
            <h4>By source</h4>
            <span>How invoices arrive</span>
          </header>
          <app-donut-chart
            [slices]="sourceSlices()"
            [size]="150"
            centerLabel="Invoices">
          </app-donut-chart>
        </article>

        <article class="donut-card">
          <header>
            <h4>Audit verdicts</h4>
            <span>Engine-decided outcomes</span>
          </header>
          <app-donut-chart
            [slices]="auditSlices()"
            [size]="150"
            centerLabel="Audited">
          </app-donut-chart>
        </article>
      </section>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 18px; }

    .state {
      padding: 32px;
      text-align: center;
      color: var(--color-text-muted);
      background: var(--color-surface);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-lg);
    }
    .state--empty strong { display: block; font-size: 14px; color: var(--color-text); margin-bottom: 4px; }
    .state--empty span   { font-size: 12.5px; }

    /* ===== KPIs ===== */
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .kpi {
      position: relative;
      padding: 16px 18px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }
    .kpi::before {
      content: '';
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 4px;
    }
    .kpi--blue::before    { background: var(--gradient-brand); }
    .kpi--emerald::before { background: linear-gradient(180deg, #10b981, #059669); }
    .kpi--amber::before   { background: linear-gradient(180deg, #f59e0b, #b45309); }
    .kpi--violet::before  { background: linear-gradient(180deg, #8b5cf6, #6d28d9); }

    .kpi-lbl {
      display: block;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--color-text-muted);
    }
    .kpi strong {
      display: block;
      margin-top: 6px;
      font-size: 22px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.4px;
      font-variant-numeric: tabular-nums;
    }
    .kpi em {
      display: block;
      margin-top: 3px;
      font-style: normal;
      font-size: 11.5px; color: var(--color-text-muted);
    }

    /* ===== Financial reconciliation ===== */
    .financial {
      padding: 18px 20px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
    .financial header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .financial h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); }
    .financial p  { margin: 3px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    .ts { font-size: 11.5px; color: var(--color-text-subtle); }

    .rec-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .rec-cell {
      padding: 12px 14px;
      border-right: 1px solid var(--color-border);
      display: flex; flex-direction: column; gap: 2px;
    }
    .rec-cell:last-child { border-right: none; }
    .rec-cell .lbl {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--color-text-muted);
    }
    .rec-cell strong {
      font-size: 17px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.3px;
      font-variant-numeric: tabular-nums;
    }
    .rec-cell em {
      font-style: normal;
      font-size: 11px; color: var(--color-text-subtle);
    }
    .rec-cell--positive strong { color: #b91c1c; }
    .rec-cell--negative strong { color: #b45309; }

    .rec-bar { margin-top: 14px; }
    .rec-bar-track {
      position: relative;
      height: 24px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .rec-bar-fill {
      position: absolute; top: 0; bottom: 0; left: 0;
      transition: width 0.4s var(--ease-out);
    }
    .rec-bar-fill--expected { background: rgba(59, 130, 246, 0.35); }
    .rec-bar-fill--actual   { background: var(--gradient-brand); z-index: 1; }
    .rec-bar-keys {
      display: flex; gap: 14px; flex-wrap: wrap;
      margin-top: 8px;
      font-size: 11.5px; color: var(--color-text-muted);
    }
    .rec-bar-keys .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; margin-right: 6px; vertical-align: -1px; }
    .dot--actual   { background: var(--gradient-brand); }
    .dot--expected { background: rgba(59, 130, 246, 0.35); }

    /* ===== Donut cards ===== */
    .donuts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .donut-card {
      padding: 16px 18px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
    .donut-card header { margin-bottom: 12px; }
    .donut-card h4 { margin: 0; font-size: 13px; font-weight: 700; color: var(--color-text); }
    .donut-card span {
      display: block;
      margin-top: 2px;
      font-size: 11.5px; color: var(--color-text-muted);
    }

    @media (max-width: 980px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rec-cell:nth-child(2n) { border-right: none; }
      .donuts { grid-template-columns: 1fr; }
    }
  `]
})
export class SummaryTabComponent {
  @Input() loading: boolean = false;
  @Input() set report(value: SummaryReport | null) { this._report.set(value); }

  private readonly _report = signal<SummaryReport | null>(null);
  data = this._report.asReadonly();

  statusSlices = computed<DonutSlice[]>(() => {
    const r = this._report();
    if (!r) return [];
    return r.invoicesByStatus.map((b) => ({
      key: b.key, label: b.key, value: b.count, color: STATUS_COLORS[b.key]
    }));
  });

  sourceSlices = computed<DonutSlice[]>(() => {
    const r = this._report();
    if (!r) return [];
    return r.invoicesBySource.map((b) => ({
      key: b.key, label: b.key, value: b.count, color: SOURCE_COLORS[b.key]
    }));
  });

  auditSlices = computed<DonutSlice[]>(() => {
    const r = this._report();
    if (!r) return [];
    return r.auditResultsByStatus.map((b) => ({
      key: b.key, label: this.formatAuditKey(b.key), value: b.count, color: AUDIT_COLORS[b.key]
    }));
  });

  /** Visualizes actual ÷ max(actual, expected) so the bigger of the two fills. */
  actualPct = computed(() => {
    const r = this._report();
    if (!r) return 0;
    const max = Math.max(r.totalActualBilled, r.totalExpectedAmount, 1);
    return (r.totalActualBilled / max) * 100;
  });

  expectedPct = computed(() => {
    const r = this._report();
    if (!r) return 0;
    const max = Math.max(r.totalActualBilled, r.totalExpectedAmount, 1);
    return (r.totalExpectedAmount / max) * 100;
  });

  private formatAuditKey(key: string): string {
    return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
