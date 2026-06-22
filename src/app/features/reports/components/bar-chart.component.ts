import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

export interface BarPoint {
  /** X-axis label, kept short for readability ("2026-04", "Apr"). */
  key: string;
  /** Primary bar value. */
  value: number;
  /** Optional secondary value drawn as a comparison overlay (lighter bar behind). */
  compareValue?: number;
  /** Optional tooltip body line(s). */
  tooltip?: string;
  /** Optional override color for this bar. */
  color?: string;
}

interface RenderedBar extends BarPoint {
  x: number;
  width: number;
  primaryY: number;
  primaryHeight: number;
  compareY: number | null;
  compareHeight: number | null;
  color: string;
}

/**
 * Inline-SVG bar chart with optional comparison series. Pure presentation —
 * sizes itself responsively via `viewBox` so the parent grid controls layout.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      @if (title || subtitle) {
        <figcaption class="head">
          @if (title) { <h5>{{ title }}</h5> }
          @if (subtitle) { <span>{{ subtitle }}</span> }
        </figcaption>
      }

      <div class="vis" [style.height.px]="height">
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none"
             width="100%" [attr.height]="height" role="img" [attr.aria-label]="title || 'Bar chart'">

          <!-- gridlines -->
          @for (line of gridLines(); track line.y) {
            <line [attr.x1]="paddingX" [attr.x2]="width - paddingX"
                  [attr.y1]="line.y" [attr.y2]="line.y"
                  stroke="var(--color-border)" stroke-width="1" stroke-dasharray="2 4"></line>
          }

          <!-- axis baseline -->
          <line [attr.x1]="paddingX" [attr.x2]="width - paddingX"
                [attr.y1]="height - paddingBottom" [attr.y2]="height - paddingBottom"
                stroke="var(--color-border-strong)" stroke-width="1.2"></line>

          @if (rendered().length === 0) {
            <text [attr.x]="width / 2" [attr.y]="height / 2"
                  text-anchor="middle" dominant-baseline="middle"
                  fill="var(--color-text-subtle)" font-size="11" font-style="italic">
              No data available
            </text>
          }

          @for (bar of rendered(); track bar.key) {
            @if (bar.compareHeight !== null) {
              <rect [attr.x]="bar.x"
                    [attr.y]="bar.compareY"
                    [attr.width]="bar.width"
                    [attr.height]="bar.compareHeight"
                    [attr.fill]="bar.color"
                    fill-opacity="0.18"
                    rx="3">
                <title>{{ compareLabel || 'Compare' }}: {{ bar.compareValue | number: '1.0-2' }}</title>
              </rect>
            }
            <rect [attr.x]="bar.x"
                  [attr.y]="bar.primaryY"
                  [attr.width]="bar.width"
                  [attr.height]="bar.primaryHeight"
                  [attr.fill]="bar.color"
                  rx="3"
                  class="bar-rect">
              <title>{{ bar.tooltip || (bar.key + ' · ' + (bar.value | number: '1.0-2')) }}</title>
            </rect>

            <!-- x-axis labels -->
            <text [attr.x]="bar.x + bar.width / 2"
                  [attr.y]="height - paddingBottom + 14"
                  text-anchor="middle"
                  font-size="10"
                  fill="var(--color-text-muted)">
              {{ bar.key }}
            </text>
          }

          <!-- y-axis tick labels -->
          @for (line of gridLines(); track line.y) {
            <text [attr.x]="paddingX - 6"
                  [attr.y]="line.y + 3"
                  text-anchor="end"
                  font-size="10"
                  fill="var(--color-text-muted)">
              {{ line.label }}
            </text>
          }
        </svg>
      </div>

      @if (showLegend && (legendPrimary || compareLabel)) {
        <div class="legend">
          @if (legendPrimary) {
            <span class="lg">
              <span class="dot" [style.background]="primaryColor"></span>
              {{ legendPrimary }}
            </span>
          }
          @if (compareLabel) {
            <span class="lg">
              <span class="dot dot-soft" [style.background]="primaryColor"></span>
              {{ compareLabel }}
            </span>
          }
        </div>
      }
    </figure>
  `,
  styles: [`
    .chart { margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .head h5 {
      margin: 0 0 2px;
      font-size: 13px; font-weight: 700; color: var(--color-text);
    }
    .head span {
      font-size: 11.5px; color: var(--color-text-muted);
    }
    .vis {
      width: 100%;
      background: var(--color-surface);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .vis svg { display: block; width: 100%; height: 100%; }
    .bar-rect { transition: fill-opacity 0.2s var(--ease-out); }
    .bar-rect:hover { fill-opacity: 0.85; }

    .legend {
      display: flex; gap: 14px; flex-wrap: wrap;
      font-size: 11px; color: var(--color-text-muted);
      font-weight: 600;
    }
    .lg { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 2px; }
    .dot-soft { opacity: 0.4; }
  `]
})
export class BarChartComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() showLegend: boolean = true;
  @Input() legendPrimary?: string;
  @Input() compareLabel?: string;
  @Input() height: number = 180;
  @Input() primaryColor: string = '#3b82f6';
  /** Force a fixed Y-axis maximum. By default, derived from the data. */
  @Input() set yMax(value: number | undefined) { this._yMax.set(value); }
  @Input() set points(value: BarPoint[]) { this._points.set(value ?? []); }
  /** When true, formats axis labels as percentages. */
  @Input() valueAsPercent: boolean = false;

  private readonly _points = signal<BarPoint[]>([]);
  private readonly _yMax = signal<number | undefined>(undefined);

  readonly width = 600;
  readonly paddingX = 40;
  readonly paddingTop = 12;
  readonly paddingBottom = 28;

  private niceMax = computed(() => {
    const points = this._points();
    if (points.length === 0) return 1;
    const fixed = this._yMax();
    if (fixed !== undefined) return fixed;

    const max = Math.max(
      0,
      ...points.flatMap((p) => [p.value ?? 0, p.compareValue ?? 0])
    );
    if (max === 0) return 1;
    if (this.valueAsPercent) return 100;

    // round up to a "nice" number
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const rounded = Math.ceil(max / exp) * exp;
    return rounded;
  });

  rendered = computed<RenderedBar[]>(() => {
    const points = this._points();
    if (points.length === 0) return [];

    const inner = this.width - this.paddingX * 2;
    const usableHeight = this.height - this.paddingTop - this.paddingBottom;
    const slot = inner / points.length;
    const barW = Math.max(8, Math.min(48, slot * 0.62));

    const yMax = this.niceMax();

    return points.map((p, i) => {
      const x = this.paddingX + slot * i + (slot - barW) / 2;

      const primaryHeight = (Math.max(0, p.value) / yMax) * usableHeight;
      const primaryY = this.height - this.paddingBottom - primaryHeight;

      const compareHeight = p.compareValue !== undefined
        ? (Math.max(0, p.compareValue) / yMax) * usableHeight
        : null;
      const compareY = compareHeight !== null
        ? this.height - this.paddingBottom - compareHeight
        : null;

      return {
        ...p,
        x,
        width: barW,
        primaryHeight,
        primaryY,
        compareHeight,
        compareY,
        color: p.color ?? this.primaryColor
      };
    });
  });

  gridLines = computed(() => {
    const yMax = this.niceMax();
    const usableHeight = this.height - this.paddingTop - this.paddingBottom;
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const ratio = i / steps;
      const y = this.height - this.paddingBottom - usableHeight * ratio;
      const value = yMax * ratio;
      const label = this.valueAsPercent
        ? `${value.toFixed(0)}%`
        : value >= 1000
          ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
          : value.toFixed(0);
      return { y, value, label };
    });
  });
}
