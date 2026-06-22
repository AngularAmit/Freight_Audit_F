import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';

import { BarChartComponent, BarPoint } from './bar-chart.component';
import { CarrierPenaltySummary, PenaltyReport } from '../models/report.model';

@Component({
  selector: 'app-penalties-tab',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, BarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading) {
      <div class="state">Loading penalty data…</div>
    } @else if (!data()) {
      <div class="state state--empty">
        <strong>No penalty data yet.</strong>
        <span>SLA breaches will appear here once the workflow engine has computed any.</span>
      </div>
    } @else {
      <section class="kpis">
        <article class="kpi kpi--blue">
          <span class="kpi-lbl">Penalty records</span>
          <strong>{{ data()!.totalPenaltyRecords | number }}</strong>
          <em>{{ data()!.penaltyBreachCount | number }} breaches</em>
        </article>
        <article class="kpi kpi--amber">
          <span class="kpi-lbl">Total invoice value</span>
          <strong>{{ data()!.totalInvoiceAmount | number: '1.2-2' }}</strong>
          <em>across all penalty rows</em>
        </article>
        <article class="kpi kpi--red">
          <span class="kpi-lbl">Penalty deducted</span>
          <strong>{{ data()!.totalPenaltyAmount | number: '1.2-2' }}</strong>
          <em>SLA-driven deductions</em>
        </article>
        <article class="kpi kpi--emerald">
          <span class="kpi-lbl">Net payable</span>
          <strong>{{ data()!.totalNetPayable | number: '1.2-2' }}</strong>
          <em>after penalties</em>
        </article>
      </section>

      <section class="rate-card">
        <div class="rate-meta">
          <h3>Effective penalty rate</h3>
          <p>Share of total invoice value that was withheld via SLA penalties.</p>
        </div>
        <div class="rate-vis">
          <div class="rate-track">
            <div class="rate-fill" [style.width.%]="penaltyPctClamped()"></div>
          </div>
          <div class="rate-stats">
            <strong>{{ data()!.penaltyRatePercent | number: '1.2-2' }}%</strong>
            <span>{{ data()!.totalPenaltyAmount | number: '1.2-2' }} of {{ data()!.totalInvoiceAmount | number: '1.2-2' }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <header>
          <div>
            <h3>Monthly penalty trend</h3>
            <p>Total deducted versus net payable, month over month.</p>
          </div>
          <span class="ts">Generated {{ data()!.generatedAt | date: 'medium' }}</span>
        </header>
        <app-bar-chart
          [points]="trendPoints()"
          legendPrimary="Penalty amount"
          compareLabel="Net payable"
          primaryColor="#ef4444"
          [height]="200">
        </app-bar-chart>
      </section>

      <section class="card">
        <header>
          <div>
            <h3>Top carriers by penalty</h3>
            <p>Carriers with the highest cumulative penalty exposure.</p>
          </div>
          <span class="muted">{{ sortedCarriers().length }} carriers</span>
        </header>

        <div class="scoreboard">
          <table>
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Invoices</th>
                <th>Breaches</th>
                <th>Avg OTD at penalty</th>
                <th>Invoice total</th>
                <th>Penalty</th>
                <th>Net payable</th>
              </tr>
            </thead>
            <tbody>
              @if (sortedCarriers().length === 0) {
                <tr><td colspan="7" class="empty">No carrier penalty data available.</td></tr>
              } @else {
                @for (c of sortedCarriers(); track c.carrierId) {
                  <tr>
                    <td>
                      <div class="carrier-cell">
                        <span class="avatar">{{ initials(c.carrierName) }}</span>
                        <strong>{{ c.carrierName }}</strong>
                      </div>
                    </td>
                    <td>{{ c.totalInvoices | number }}</td>
                    <td>
                      <span class="badge"
                            [class.badge--breach]="c.breachCount > 0"
                            [class.badge--clean]="c.breachCount === 0">
                        {{ c.breachCount }}
                      </span>
                    </td>
                    <td>
                      <span [class]="otdToneClass(c.averageOtdAtPenalty)">
                        {{ c.averageOtdAtPenalty | number: '1.1-1' }}%
                      </span>
                    </td>
                    <td class="num">{{ c.totalInvoiceAmount | number: '1.2-2' }}</td>
                    <td class="num">
                      <div class="penalty-cell">
                        <span class="penalty-bar" [style.width.%]="penaltyShare(c)"></span>
                        <span class="num penalty-amount">{{ c.totalPenaltyAmount | number: '1.2-2' }}</span>
                      </div>
                    </td>
                    <td class="num">{{ c.totalNetPayable | number: '1.2-2' }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
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
    .kpi--amber::before   { background: linear-gradient(180deg, #f59e0b, #b45309); }
    .kpi--red::before     { background: linear-gradient(180deg, #ef4444, #b91c1c); }
    .kpi--emerald::before { background: linear-gradient(180deg, #10b981, #059669); }

    .kpi-lbl {
      display: block;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--color-text-muted);
    }
    .kpi strong {
      display: block; margin-top: 6px;
      font-size: 22px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.4px;
      font-variant-numeric: tabular-nums;
    }
    .kpi em {
      display: block; margin-top: 3px;
      font-style: normal; font-size: 11.5px; color: var(--color-text-muted);
    }

    .rate-card {
      padding: 18px 22px;
      background: linear-gradient(135deg, #fef2f2 0%, #ffffff 60%);
      border: 1px solid #fecaca;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr);
      gap: 22px;
      align-items: center;
    }
    .rate-meta h3 { margin: 0; font-size: 14px; font-weight: 700; color: #991b1b; }
    .rate-meta p  { margin: 4px 0 0; font-size: 12.5px; color: #b45309; }

    .rate-vis { display: flex; align-items: center; gap: 18px; }
    .rate-track {
      flex: 1;
      position: relative;
      height: 16px;
      background: rgba(254, 202, 202, 0.55);
      border: 1px solid #fecaca;
      border-radius: 999px;
      overflow: hidden;
    }
    .rate-fill {
      position: absolute; top: 0; bottom: 0; left: 0;
      background: linear-gradient(90deg, #f87171, #b91c1c);
      transition: width 0.4s var(--ease-out);
    }
    .rate-stats { text-align: right; min-width: 110px; }
    .rate-stats strong {
      display: block;
      font-size: 22px; font-weight: 700;
      color: #b91c1c; letter-spacing: -0.4px;
      font-variant-numeric: tabular-nums;
    }
    .rate-stats span {
      display: block; margin-top: 2px;
      font-size: 11.5px; color: #b45309;
      font-variant-numeric: tabular-nums;
    }

    .card {
      padding: 18px 20px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
    .card header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .card h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); }
    .card p  { margin: 3px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    .ts      { font-size: 11.5px; color: var(--color-text-subtle); }
    .muted   { font-size: 12px; color: var(--color-text-muted); }

    /* ===== Scoreboard ===== */
    .scoreboard { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th {
      text-align: left;
      padding: 10px 14px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-border);
    }
    tbody td {
      padding: 14px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--color-primary-50); }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }

    .carrier-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 32px; height: 32px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: #fff;
      font-size: 11px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      letter-spacing: 0.4px;
    }
    .carrier-cell strong { font-size: 13px; font-weight: 600; color: var(--color-text); }

    .badge {
      display: inline-block;
      font-size: 11.5px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .badge--breach { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .badge--clean  { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }

    .tone-good { color: #059669; font-weight: 600; }
    .tone-warn { color: #b45309; font-weight: 600; }
    .tone-bad  { color: #b91c1c; font-weight: 600; }

    .penalty-cell {
      position: relative;
      display: inline-block;
      width: 100%;
      padding-right: 0;
    }
    .penalty-bar {
      position: absolute;
      right: 0; top: 50%;
      transform: translateY(-50%);
      height: 18px;
      background: linear-gradient(90deg, rgba(248, 113, 113, 0.18), rgba(239, 68, 68, 0.32));
      border-radius: 4px;
      pointer-events: none;
    }
    .penalty-amount {
      position: relative;
      font-weight: 600;
      color: #b91c1c;
    }

    .empty { padding: 22px !important; text-align: center; color: var(--color-text-muted); font-style: italic; }

    @media (max-width: 980px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rate-card { grid-template-columns: 1fr; }
      .rate-stats { text-align: left; }
    }
  `]
})
export class PenaltiesTabComponent {
  @Input() loading: boolean = false;
  @Input() set report(value: PenaltyReport | null) { this._report.set(value); }

  private readonly _report = signal<PenaltyReport | null>(null);
  data = this._report.asReadonly();

  trendPoints = computed<BarPoint[]>(() => {
    const r = this._report();
    if (!r) return [];
    return r.monthlyTrend.map((m) => ({
      key: m.month.slice(2),
      value: m.totalPenaltyAmount,
      compareValue: m.totalNetPayable,
      tooltip: `${m.month} · Penalty ${m.totalPenaltyAmount.toFixed(2)} · Net ${m.totalNetPayable.toFixed(2)}`
    }));
  });

  sortedCarriers = computed<CarrierPenaltySummary[]>(() => {
    const r = this._report();
    if (!r) return [];
    return [...r.byCarrier].sort((a, b) => b.totalPenaltyAmount - a.totalPenaltyAmount);
  });

  penaltyPctClamped = computed<number>(() => {
    const r = this._report();
    if (!r) return 0;
    return Math.max(0, Math.min(100, r.penaltyRatePercent));
  });

  /** Maps a carrier's penalty share against the leader so the inline bar is comparable. */
  penaltyShare(c: CarrierPenaltySummary): number {
    const max = Math.max(...this.sortedCarriers().map((x) => x.totalPenaltyAmount), 1);
    return Math.max(0, Math.min(100, (c.totalPenaltyAmount / max) * 100));
  }

  initials(name: string): string {
    return (name || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  otdToneClass(value: number): string {
    if (value >= 95) return 'tone-good';
    if (value >= 85) return 'tone-warn';
    return 'tone-bad';
  }
}
