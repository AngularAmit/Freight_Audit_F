import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';

import { BarChartComponent, BarPoint } from './bar-chart.component';
import { CarrierPerformanceRow, PerformanceReport } from '../models/report.model';

@Component({
  selector: 'app-performance-tab',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, BarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading) {
      <div class="state">Loading performance data…</div>
    } @else if (!data()) {
      <div class="state state--empty">
        <strong>No performance data yet.</strong>
        <span>Once carriers report monthly OTD, their trends will appear here.</span>
      </div>
    } @else {
      <section class="kpis">
        <article class="kpi">
          <span class="kpi-lbl">Carriers tracked</span>
          <strong>{{ data()!.totalCarriersTracked | number }}</strong>
          <em>actively reporting</em>
        </article>
        <article class="kpi">
          <span class="kpi-lbl">Months recorded</span>
          <strong>{{ data()!.totalMonthsRecorded | number }}</strong>
          <em>OTD data points</em>
        </article>
        <article class="kpi">
          <span class="kpi-lbl">Average OTD</span>
          <strong [class]="otdToneClass(data()!.overallAverageOtd)">
            {{ data()!.overallAverageOtd | number: '1.1-1' }}%
          </strong>
          <em>across the network</em>
        </article>
        <article class="kpi">
          <span class="kpi-lbl">Breach months</span>
          <strong class="breach">{{ data()!.totalBreachMonths | number }}</strong>
          <em>SLA threshold missed</em>
        </article>
      </section>

      <section class="card">
        <header>
          <div>
            <h3>Monthly OTD trend</h3>
            <p>Average network OTD per calendar month, with breach counts overlaid.</p>
          </div>
          <span class="ts">Generated {{ data()!.generatedAt | date: 'medium' }}</span>
        </header>
        <app-bar-chart
          [points]="trendPoints()"
          legendPrimary="Average OTD %"
          [valueAsPercent]="true"
          primaryColor="#3b82f6"
          [height]="200">
        </app-bar-chart>

        @if (trendPoints().length > 0) {
          <div class="trend-foot">
            @for (m of data()!.monthlyTrend; track m.month) {
              <div class="trend-pill">
                <span class="month">{{ m.month }}</span>
                <strong [class]="otdToneClass(m.averageOtd)">{{ m.averageOtd | number: '1.1-1' }}%</strong>
                <span class="muted">{{ m.carriersInBreach }} / {{ m.totalCarriers }} in breach</span>
              </div>
            }
          </div>
        }
      </section>

      <section class="card">
        <header>
          <div>
            <h3>Carrier scoreboard</h3>
            <p>Average OTD performance per carrier, sorted by latest reading.</p>
          </div>
          <span class="muted">{{ sortedCarriers().length }} carriers</span>
        </header>

        <div class="scoreboard">
          <table>
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Latest</th>
                <th>Average OTD</th>
                <th>Breaches</th>
                <th>SLA target</th>
              </tr>
            </thead>
            <tbody>
              @if (sortedCarriers().length === 0) {
                <tr><td colspan="5" class="empty">No carrier data available.</td></tr>
              } @else {
                @for (c of sortedCarriers(); track c.carrierId) {
                  <tr>
                    <td>
                      <div class="carrier-cell">
                        <span class="avatar">{{ initials(c.carrierName) }}</span>
                        <div>
                          <strong>{{ c.carrierName }}</strong>
                          <span class="muted">{{ c.monthsRecorded }} months on record</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="latest">
                        <strong [class]="otdToneClass(c.latestOtd)">{{ c.latestOtd | number: '1.1-1' }}%</strong>
                        <span class="muted">{{ c.latestMonth }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="otd-cell">
                        <div class="otd-bar">
                          <div class="otd-bar-fill"
                               [style.width.%]="otdPct(c.averageOtd)"
                               [class]="otdToneClass(c.averageOtd)"></div>
                        </div>
                        <span class="otd-val">{{ c.averageOtd | number: '1.1-1' }}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge"
                            [class.badge--breach]="c.monthsInBreach > 0"
                            [class.badge--clean]="c.monthsInBreach === 0">
                        {{ c.breachRate }}
                      </span>
                    </td>
                    <td>
                      @if (c.slaOtdTarget !== null) {
                        <span class="muted">{{ c.slaOtdTarget | number: '1.0-1' }}% / {{ c.slaThreshold ?? '—' }}%</span>
                      } @else {
                        <em class="muted">No SLA</em>
                      }
                    </td>
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
      padding: 16px 18px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
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
    .kpi strong.tone-good   { color: #059669; }
    .kpi strong.tone-warn   { color: #b45309; }
    .kpi strong.tone-bad    { color: #b91c1c; }
    .kpi strong.breach      { color: #b91c1c; }

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

    .trend-foot {
      display: flex; gap: 8px; flex-wrap: wrap;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed var(--color-border);
    }
    .trend-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: 999px;
      font-size: 11.5px;
    }
    .trend-pill .month {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600; color: var(--color-text-muted);
    }
    .trend-pill strong {
      font-size: 12px; font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .trend-pill strong.tone-good { color: #059669; }
    .trend-pill strong.tone-warn { color: #b45309; }
    .trend-pill strong.tone-bad  { color: #b91c1c; }

    /* ===== Scoreboard table ===== */
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

    .carrier-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 34px; height: 34px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: #fff;
      font-size: 11.5px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      letter-spacing: 0.4px;
    }
    .carrier-cell strong { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); }

    .latest {
      display: flex; flex-direction: column; line-height: 1.3;
      min-width: 70px;
    }
    .latest strong {
      font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .latest strong.tone-good { color: #059669; }
    .latest strong.tone-warn { color: #b45309; }
    .latest strong.tone-bad  { color: #b91c1c; }

    .otd-cell {
      display: flex; align-items: center; gap: 12px;
      min-width: 180px;
    }
    .otd-bar {
      position: relative;
      flex: 1;
      height: 8px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: 999px;
      overflow: hidden;
    }
    .otd-bar-fill {
      position: absolute; top: 0; bottom: 0; left: 0;
      transition: width 0.4s var(--ease-out);
      background: linear-gradient(90deg, #93c5fd, #3b82f6);
    }
    .otd-bar-fill.tone-good { background: linear-gradient(90deg, #6ee7b7, #10b981); }
    .otd-bar-fill.tone-warn { background: linear-gradient(90deg, #fcd34d, #f59e0b); }
    .otd-bar-fill.tone-bad  { background: linear-gradient(90deg, #fca5a5, #ef4444); }
    .otd-val {
      font-size: 12.5px; font-weight: 600;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
      width: 56px;
    }

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

    .empty { padding: 22px !important; text-align: center; color: var(--color-text-muted); font-style: italic; }

    @media (max-width: 980px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class PerformanceTabComponent {
  @Input() loading: boolean = false;
  @Input() set report(value: PerformanceReport | null) { this._report.set(value); }

  private readonly _report = signal<PerformanceReport | null>(null);
  data = this._report.asReadonly();

  trendPoints = computed<BarPoint[]>(() => {
    const r = this._report();
    if (!r) return [];
    return r.monthlyTrend.map((m) => ({
      key: m.month.slice(2),
      value: m.averageOtd,
      tooltip: `${m.month} · Avg OTD ${m.averageOtd.toFixed(1)}% · ${m.carriersInBreach}/${m.totalCarriers} in breach`
    }));
  });

  sortedCarriers = computed<CarrierPerformanceRow[]>(() => {
    const r = this._report();
    if (!r) return [];
    return [...r.carriers].sort((a, b) => {
      // Worst latest OTD first so problems surface immediately.
      if (a.latestOtd !== b.latestOtd) return a.latestOtd - b.latestOtd;
      return b.monthsInBreach - a.monthsInBreach;
    });
  });

  initials(name: string): string {
    return (name || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  otdPct(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  otdToneClass(value: number): string {
    if (value >= 95) return 'tone-good';
    if (value >= 85) return 'tone-warn';
    return 'tone-bad';
  }
}
