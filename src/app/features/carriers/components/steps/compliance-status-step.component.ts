import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import { CarrierCompliance, CarrierResponse } from '../../models/carrier.model';

@Component({
  selector: 'app-compliance-status-step',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="card">
      <header class="head">
        <h3>Compliance status</h3>
        <p>AI-driven sanctions, embargo and risk evaluation. Review before approval.</p>
      </header>

      <div class="content">
        @if (compliance) {
          <div class="grid">
            <article class="metric">
              <span class="lbl">Risk score</span>
              <strong class="val">{{ compliance.riskScore }} <i>/ 100</i></strong>
              <span class="pill" [class.pill--low]="riskTone === 'low'"
                                 [class.pill--med]="riskTone === 'med'"
                                 [class.pill--high]="riskTone === 'high'">
                {{ compliance.riskLevel || 'Unknown' }}
              </span>
              <div class="bar">
                <span [style.width.%]="riskBar"
                      [class.bar--low]="riskTone === 'low'"
                      [class.bar--med]="riskTone === 'med'"
                      [class.bar--high]="riskTone === 'high'"></span>
              </div>
            </article>

            <article class="metric">
              <span class="lbl">Approval status</span>
              <strong class="val">{{ compliance.approvalStatus }}</strong>
              @if (compliance.reviewedAt) {
                <span class="muted">Reviewed {{ compliance.reviewedAt | date: 'medium' }}</span>
              } @else {
                <span class="muted">Awaiting reviewer action.</span>
              }
            </article>

            <article class="check" [class.is-pass]="compliance.sanctionCheck">
              <span class="ico">
                @if (compliance.sanctionCheck) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                }
              </span>
              <div>
                <strong>Sanction check</strong>
                <span>{{ compliance.sanctionCheck ? 'Cleared — no matches found' : 'Pending or failed' }}</span>
              </div>
            </article>

            <article class="check" [class.is-pass]="compliance.embargoCheck">
              <span class="ico">
                @if (compliance.embargoCheck) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                }
              </span>
              <div>
                <strong>Embargo check</strong>
                <span>{{ compliance.embargoCheck ? 'No restricted geography hits' : 'Pending or failed' }}</span>
              </div>
            </article>
          </div>

          @if (compliance.reviewerComments) {
            <div class="comments">
              <span class="lbl">Reviewer comments</span>
              <p>{{ compliance.reviewerComments }}</p>
            </div>
          }
        } @else {
          <div class="empty">
            <strong>No compliance record yet.</strong>
            <p>Compliance is initialised the moment the carrier is created. If this is showing,
               the record may still be loading. Refresh the wizard to retry.</p>
          </div>
        }

        <footer class="step-actions">
          <button type="button" class="btn-ghost" (click)="back.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back
          </button>
          <div class="right">
            <button type="button" class="btn-secondary" (click)="refresh.emit()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>
              </svg>
              Refresh
            </button>
            <button type="button" class="btn-primary" (click)="continue.emit()">
              Continue to approval
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </section>
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
    .head {
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--color-border);
      h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text); letter-spacing: -0.2px; }
      p  { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    }
    .content { padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .metric, .check {
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .metric .lbl, .check .lbl, .comments .lbl {
      font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .metric .val { font-size: 22px; font-weight: 700; color: var(--color-text); letter-spacing: -0.4px; }
    .metric .val i { font-style: normal; font-size: 12px; font-weight: 600; color: var(--color-text-subtle); margin-left: 4px; }
    .muted { font-size: 12px; color: var(--color-text-muted); }

    .pill {
      align-self: flex-start;
      display: inline-block;
      font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 999px;
      letter-spacing: 0.4px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .pill--low  { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .pill--med  { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .pill--high { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }

    .bar {
      height: 6px;
      background: var(--color-border);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }
    .bar > span {
      display: block; height: 100%;
      background: var(--color-primary-500);
      border-radius: 3px;
      transition: width 0.4s var(--ease-out);
    }
    .bar > span.bar--low  { background: #10b981; }
    .bar > span.bar--med  { background: #f59e0b; }
    .bar > span.bar--high { background: #ef4444; }

    .check {
      flex-direction: row; align-items: center; gap: 12px;
      border-color: #fecaca;
      background: #fef2f2;
    }
    .check.is-pass { border-color: #a7f3d0; background: #ecfdf5; }
    .check .ico {
      width: 30px; height: 30px;
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      background: #fee2e2; color: #b91c1c;
      border-radius: 8px;
    }
    .check.is-pass .ico { background: #d1fae5; color: #047857; }
    .check strong { font-size: 13px; color: var(--color-text); font-weight: 600; }
    .check span { font-size: 12px; color: var(--color-text-muted); }

    .comments {
      padding: 14px 16px;
      background: var(--color-surface-2);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
    }
    .comments p { margin: 6px 0 0; color: var(--color-text); font-size: 13px; line-height: 1.45; }

    .empty {
      padding: 24px;
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
    }
    .empty strong { display: block; font-size: 13.5px; color: var(--color-text); }
    .empty p { margin: 6px 0 0; font-size: 12.5px; color: var(--color-text-muted); }

    .step-actions {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--color-border);
    }
    .right { display: inline-flex; gap: 10px; align-items: center; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 18px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover { filter: brightness(1.05); }
    .btn-secondary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 14px;
      background: #fff;
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-200);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-secondary:hover { background: var(--color-primary-50); border-color: var(--color-primary-300); }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }

    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ComplianceStatusStepComponent {
  @Input({ required: true }) carrier!: CarrierResponse;
  @Input() compliance: CarrierCompliance | null = null;

  @Output() refresh = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() continue = new EventEmitter<void>();

  /** Risk-level tone derived from `riskLevel` string or score. */
  get riskTone(): 'low' | 'med' | 'high' {
    const lvl = this.compliance?.riskLevel?.toLowerCase() ?? '';
    if (lvl.includes('low')) return 'low';
    if (lvl.includes('high') || lvl.includes('critical')) return 'high';
    if (lvl.includes('med') || lvl.includes('moderate')) return 'med';
    const score = this.compliance?.riskScore ?? 0;
    if (score < 40) return 'low';
    if (score < 70) return 'med';
    return 'high';
  }

  get riskBar(): number {
    const score = this.compliance?.riskScore ?? 0;
    return Math.max(2, Math.min(100, score));
  }
}
