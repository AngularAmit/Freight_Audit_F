import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** Optional brand-aligned color override; otherwise picks from the default palette. */
  color?: string;
}

interface RenderedSlice extends DonutSlice {
  pct: number;
  dashArray: string;
  dashOffset: string;
  color: string;
}

const DEFAULT_PALETTE = [
  '#3b82f6', // primary 500
  '#0ea5e9', // accent 500
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444'  // red
];

/**
 * Tiny inline-SVG donut chart. Renders each slice as an offset stroke on a
 * single circle (no per-arc path math, no chart library).
 */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="donut" [style.--size.px]="size">
      <div class="donut-vis">
        <svg [attr.viewBox]="viewBox" [attr.width]="size" [attr.height]="size" role="img"
             [attr.aria-label]="title || 'Donut chart'">
          <circle [attr.cx]="cx" [attr.cy]="cx" [attr.r]="r"
                  fill="none" stroke="var(--color-border)" [attr.stroke-width]="strokeWidth"></circle>

          @for (slice of rendered(); track slice.key) {
            <circle [attr.cx]="cx" [attr.cy]="cx" [attr.r]="r"
                    fill="none"
                    [attr.stroke]="slice.color"
                    [attr.stroke-width]="strokeWidth"
                    [attr.stroke-dasharray]="slice.dashArray"
                    [attr.stroke-dashoffset]="slice.dashOffset"
                    stroke-linecap="butt"
                    [attr.transform]="'rotate(-90 ' + cx + ' ' + cx + ')'">
              <title>{{ slice.label }} · {{ slice.value }} ({{ slice.pct | number: '1.0-1' }}%)</title>
            </circle>
          }
        </svg>
        <div class="center">
          <strong>{{ total() }}</strong>
          @if (centerLabel) { <span>{{ centerLabel }}</span> }
        </div>
      </div>

      @if (showLegend) {
        <figcaption class="legend">
          @for (slice of rendered(); track slice.key) {
            <div class="legend-row">
              <span class="legend-swatch" [style.background]="slice.color"></span>
              <span class="legend-key">{{ slice.label }}</span>
              <span class="legend-val">
                <strong>{{ slice.value }}</strong>
                <em>{{ slice.pct | number: '1.0-1' }}%</em>
              </span>
            </div>
          }
          @if (rendered().length === 0) {
            <div class="legend-empty">No data yet.</div>
          }
        </figcaption>
      }
    </figure>
  `,
  styles: [`
    .donut {
      margin: 0;
      display: flex; align-items: center; gap: 18px;
      flex-wrap: wrap;
    }
    .donut-vis {
      position: relative;
      width: var(--size);
      height: var(--size);
      flex-shrink: 0;
    }
    .donut-vis svg {
      display: block;
      transition: transform 0.18s var(--ease-out);
    }
    .center {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .center strong {
      font-size: 22px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.5px;
      line-height: 1;
    }
    .center span {
      margin-top: 3px;
      font-size: 10.5px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    .legend {
      flex: 1; min-width: 180px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .legend-row {
      display: grid;
      grid-template-columns: 12px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 6px 4px;
      border-radius: 6px;
    }
    .legend-row:hover { background: var(--color-surface-2); }
    .legend-swatch {
      width: 12px; height: 12px;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(15, 31, 51, 0.08);
    }
    .legend-key {
      font-size: 12.5px; color: var(--color-text);
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .legend-val {
      display: flex; align-items: baseline; gap: 6px;
      font-variant-numeric: tabular-nums;
    }
    .legend-val strong {
      font-size: 12.5px; font-weight: 700; color: var(--color-text);
    }
    .legend-val em {
      font-style: normal;
      font-size: 11px; font-weight: 600;
      color: var(--color-text-muted);
    }
    .legend-empty {
      font-size: 12px; color: var(--color-text-subtle);
      font-style: italic;
      padding: 8px 4px;
    }
  `]
})
export class DonutChartComponent {
  @Input() size: number = 140;
  @Input() title?: string;
  @Input() centerLabel?: string;
  @Input() showLegend: boolean = true;
  /** Optional palette override (loops if data has more slices than colors). */
  @Input() set palette(value: string[] | undefined) { this._palette.set(value && value.length ? value : DEFAULT_PALETTE); }
  @Input() set slices(value: DonutSlice[]) { this._slices.set(value ?? []); }

  private readonly _slices = signal<DonutSlice[]>([]);
  private readonly _palette = signal<string[]>(DEFAULT_PALETTE);

  readonly cx = 50;
  readonly r = 42;
  readonly strokeWidth = 14;
  private readonly circumference = 2 * Math.PI * this.r;
  readonly viewBox = '0 0 100 100';

  total = computed(() => this._slices().reduce((sum, s) => sum + (s.value ?? 0), 0));

  rendered = computed<RenderedSlice[]>(() => {
    const slices = this._slices().filter((s) => (s.value ?? 0) > 0);
    const palette = this._palette();
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return [];

    let acc = 0;
    return slices.map((s, i) => {
      const pct = (s.value / total) * 100;
      const length = (s.value / total) * this.circumference;
      const offset = -acc;
      acc += length;
      const color = s.color ?? palette[i % palette.length];
      return {
        ...s,
        color,
        pct,
        dashArray: `${length} ${this.circumference - length}`,
        dashOffset: offset.toString()
      };
    });
  });
}
