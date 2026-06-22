import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StepDef {
  id: string;
  label: string;
  description?: string;
  /** When true the step can be activated by clicking the header. */
  reachable?: boolean;
  /** Marks the step as complete (renders a check). */
  complete?: boolean;
  /** Optional warning / blocker indicator (e.g. rejected, missing data). */
  warning?: boolean;
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ol class="stepper" role="tablist">
      @for (s of steps; track s.id; let i = $index) {
        <li class="step"
            role="tab"
            [class.is-active]="i === activeIndex"
            [class.is-complete]="!!s.complete"
            [class.is-warning]="!!s.warning"
            [class.is-clickable]="canJumpTo(i)"
            (click)="onSelect(i)">
          <div class="indicator">
            @if (s.complete) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            } @else if (s.warning) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="8" x2="12" y2="13"></line>
                <line x1="12" y1="16.5" x2="12" y2="17"></line>
              </svg>
            } @else {
              <span class="num">{{ i + 1 }}</span>
            }
          </div>
          <div class="content">
            <span class="label">{{ s.label }}</span>
            @if (s.description) { <span class="desc">{{ s.description }}</span> }
          </div>
          @if (i < steps.length - 1) { <span class="connector" aria-hidden="true"></span> }
        </li>
      }
    </ol>
  `,
  styles: [`
    :host { display: block; }
    .stepper {
      display: flex;
      align-items: flex-start;
      gap: 0;
      list-style: none;
      margin: 0;
      padding: 18px 22px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }

    .step {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      min-width: 0;
      padding: 4px 6px;
    }
    .step.is-clickable { cursor: pointer; }
    .step.is-clickable:hover .label { color: var(--color-primary-700); }

    .indicator {
      flex-shrink: 0;
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: #fff;
      border: 2px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 12.5px; font-weight: 700;
      transition: all 0.2s var(--ease-out);
    }
    .step.is-active .indicator {
      background: var(--gradient-brand);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.32);
    }
    .step.is-complete .indicator {
      background: #10b981;
      border-color: transparent;
      color: #fff;
    }
    .step.is-warning .indicator {
      background: #fef2f2;
      border-color: #f87171;
      color: #b91c1c;
    }

    .content {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      min-width: 0;
    }
    .label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
      letter-spacing: -0.1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.2s var(--ease-out);
    }
    .step.is-active .label { color: var(--color-primary-700); }
    .step:not(.is-active):not(.is-complete) .label { color: var(--color-text-muted); }
    .desc {
      font-size: 11.5px;
      color: var(--color-text-subtle);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .connector {
      flex: 1;
      height: 2px;
      background: var(--color-border);
      margin: 0 8px;
      border-radius: 2px;
      transition: background 0.2s var(--ease-out);
    }
    .step.is-complete + .step .connector,
    .step.is-complete .connector { background: #10b981; }

    @media (max-width: 760px) {
      .stepper { flex-direction: column; align-items: stretch; gap: 4px; padding: 14px 16px; }
      .step { padding: 8px 0; }
      .connector { display: none; }
      .desc { white-space: normal; }
    }
  `]
})
export class StepperComponent {
  @Input({ required: true }) steps: StepDef[] = [];
  @Input({ required: true }) activeIndex: number = 0;
  /** When false, only the active step header is interactive. */
  @Input() allowJump: boolean = true;

  @Output() stepSelect = new EventEmitter<number>();

  canJumpTo(i: number): boolean {
    if (!this.allowJump) return false;
    const step = this.steps[i];
    return !!step?.reachable && i !== this.activeIndex;
  }

  onSelect(i: number): void {
    if (this.canJumpTo(i)) {
      this.stepSelect.emit(i);
    }
  }
}
