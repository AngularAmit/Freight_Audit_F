import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { InvoiceService } from '../invoice.service';
import { WorkflowService } from '../workflow.service';
import {
  INVOICE_STATUS_LABELS,
  InvoiceResponse,
  InvoiceStatusKey
} from '../models/invoice.model';
import { ProcessInvoiceDto, WorkflowResult } from '../models/workflow.model';

const TIMELINE: InvoiceStatusKey[] = ['RECEIVED', 'PROCESSING', 'AUDITED', 'APPROVED'];

@Component({
  selector: 'app-workflow-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DecimalPipe, ModalComponent],
  template: `
    <app-modal [open]="open" size="lg"
               title="Run AI audit workflow"
               [subtitle]="invoice ? ('Invoice ' + shortId(invoice.id) + ' · ' + invoice.carrierName) : ''"
               [closeOnOverlayClick]="!running()"
               (close)="onClose()">

      @if (invoice) {
        <section class="timeline">
          <header>
            <h4>Status transition</h4>
            <span class="hint">RECEIVED → PROCESSING → AUDITED → APPROVED</span>
          </header>
          <ol class="track" role="list">
            @for (step of timelineSteps(); track step.key; let i = $index) {
              <li class="step"
                  [class.is-active]="step.state === 'active'"
                  [class.is-done]="step.state === 'done'"
                  [class.is-target]="step.state === 'target'">
                <span class="indicator">
                  @switch (step.state) {
                    @case ('done') {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                    @case ('active') {
                      <span class="pulse"></span>
                    }
                    @default { <span class="num">{{ i + 1 }}</span> }
                  }
                </span>
                <div class="meta">
                  <strong>{{ step.label }}</strong>
                  <span>{{ step.hint }}</span>
                </div>
                @if (i < timelineSteps().length - 1) {
                  <span class="connector"
                        [class.is-done]="step.state === 'done'"
                        [class.is-active]="step.state === 'active'"
                        aria-hidden="true"></span>
                }
              </li>
            }
          </ol>
        </section>

        @if (!result()) {
          <form class="grid" [formGroup]="form" (ngSubmit)="run()" novalidate>
            <div class="form-head">
              <h4>Audit inputs</h4>
              <p>Provide the freight details the audit engine should reconcile against the rate master.</p>
            </div>

            <label class="field">
              <span class="lbl">Actual amount <i>*</i></span>
              <input type="number" step="0.01" min="0.01" formControlName="actualAmount" placeholder="0.00" />
              @if (showError('actualAmount')) { <em class="err">{{ errorFor('actualAmount') }}</em> }
            </label>
            <label class="field">
              <span class="lbl">Service type <i>*</i></span>
              <input type="text" formControlName="serviceType" placeholder="e.g. EXPRESS / STANDARD" maxlength="50" />
              @if (showError('serviceType')) { <em class="err">{{ errorFor('serviceType') }}</em> }
            </label>

            <label class="field">
              <span class="lbl">Origin <i>*</i></span>
              <input type="text" formControlName="origin" placeholder="e.g. DEL" maxlength="100" />
              @if (showError('origin')) { <em class="err">{{ errorFor('origin') }}</em> }
            </label>
            <label class="field">
              <span class="lbl">Destination <i>*</i></span>
              <input type="text" formControlName="destination" placeholder="e.g. BOM" maxlength="100" />
              @if (showError('destination')) { <em class="err">{{ errorFor('destination') }}</em> }
            </label>

            <label class="field">
              <span class="lbl">Weight (lbs)</span>
              <input type="number" step="0.01" min="0" formControlName="weightLbs" placeholder="optional" />
            </label>
            <label class="field">
              <span class="lbl">Actual OTD (%)</span>
              <input type="number" step="0.01" min="0" max="100" formControlName="actualOtdPercent" placeholder="0–100" />
            </label>
          </form>
        } @else {
          <section class="result">
            <header class="result-head" [class]="'result-head--' + auditTone()">
              <div class="result-head-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 12 11 14 15 10"></polyline>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              </div>
              <div>
                <strong>Workflow complete · {{ result()!.finalStatus }}</strong>
                <span>Audit: {{ result()!.auditResult.status }}{{ result()!.penaltyResult ? ' · Penalty applied' : '' }}</span>
              </div>
              <em>{{ result()!.completedAt | date: 'medium' }}</em>
            </header>

            <div class="audit-grid">
              <div class="cell">
                <span class="lbl">Actual amount</span>
                <strong>{{ result()!.auditResult.actualAmount | number: '1.2-2' }}</strong>
              </div>
              <div class="cell">
                <span class="lbl">Expected base</span>
                <strong>{{ result()!.auditResult.expectedBaseAmount | number: '1.2-2' }}</strong>
              </div>
              <div class="cell">
                <span class="lbl">SLA penalty</span>
                <strong>{{ result()!.auditResult.slaPenaltyAmount | number: '1.2-2' }}</strong>
              </div>
              <div class="cell">
                <span class="lbl">Expected final</span>
                <strong>{{ result()!.auditResult.expectedFinalAmount | number: '1.2-2' }}</strong>
              </div>
              <div class="cell discrepancy" [class.discrepancy--positive]="result()!.auditResult.discrepancy > 0"
                                            [class.discrepancy--zero]="result()!.auditResult.discrepancy === 0"
                                            [class.discrepancy--negative]="result()!.auditResult.discrepancy < 0">
                <span class="lbl">Discrepancy</span>
                <strong>{{ result()!.auditResult.discrepancy | number: '1.2-2' }}</strong>
                <em>{{ result()!.auditResult.discrepancy === 0 ? 'In line with rate master' : (result()!.auditResult.discrepancy > 0 ? 'Carrier overcharged' : 'Carrier undercharged') }}</em>
              </div>
              <div class="cell wide">
                <span class="lbl">Engine notes</span>
                <strong>{{ result()!.auditResult.notes || '—' }}</strong>
              </div>
            </div>

            @if (result()!.penaltyResult; as p) {
              <div class="penalty">
                <header>
                  <h5>Penalty calculation</h5>
                  <span class="penalty-pill">{{ p.penaltyPercent | number: '1.0-2' }}% penalty</span>
                </header>
                <div class="penalty-grid">
                  <div>
                    <span class="lbl">Actual OTD</span>
                    <strong>{{ p.actualOtdPercent | number: '1.0-2' }}%</strong>
                  </div>
                  <div>
                    <span class="lbl">Threshold</span>
                    <strong>{{ p.penaltyThreshold | number: '1.0-2' }}%</strong>
                  </div>
                  <div>
                    <span class="lbl">Penalty amount</span>
                    <strong class="neg">−{{ p.penaltyAmount | number: '1.2-2' }}</strong>
                  </div>
                  <div>
                    <span class="lbl">Net payable</span>
                    <strong>{{ p.netPayable | number: '1.2-2' }}</strong>
                  </div>
                </div>
                @if (p.notes) { <p class="penalty-notes">{{ p.notes }}</p> }
              </div>
            }

            <div class="steps">
              <h5>Processing steps</h5>
              <ol>
                @for (step of result()!.processingSteps; track $index) {
                  <li>{{ step }}</li>
                }
                @if (result()!.processingSteps.length === 0) {
                  <li class="muted">No detailed step trace returned by the engine.</li>
                }
              </ol>
            </div>
          </section>
        }
      }

      <div modal-footer>
        @if (result()) {
          <button type="button" class="btn-ghost" (click)="reset()">Run again</button>
          <button type="button" class="btn-primary" (click)="onClose()">Done</button>
        } @else {
          <button type="button" class="btn-ghost" (click)="onClose()" [disabled]="running()">Cancel</button>
          <button type="button" class="btn-primary" (click)="run()" [disabled]="running() || form.invalid">
            @if (running()) {
              <span class="spinner"></span> Processing…
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Run workflow
            }
          </button>
        }
      </div>
    </app-modal>
  `,
  styles: [`
    /* ====== Timeline ====== */
    .timeline {
      margin-bottom: 18px;
      padding: 16px 18px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .timeline header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .timeline h4 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--color-text-muted); }
    .timeline .hint { font-size: 11.5px; color: var(--color-text-subtle); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .track {
      display: flex;
      align-items: center;
      list-style: none; margin: 0; padding: 0;
      gap: 0;
    }
    .step {
      flex: 1;
      display: flex; align-items: center; gap: 10px;
      position: relative;
      min-width: 0;
    }
    .indicator {
      width: 28px; height: 28px;
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: #fff;
      border: 2px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 12px; font-weight: 700;
      transition: all 0.25s var(--ease-out);
    }
    .step.is-done .indicator {
      background: #10b981;
      border-color: transparent;
      color: #fff;
    }
    .step.is-active .indicator {
      background: var(--gradient-brand);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.18);
    }
    .step.is-target .indicator {
      background: #fff;
      border-color: var(--color-primary-300);
      border-style: dashed;
      color: var(--color-primary-700);
    }

    .pulse {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #fff;
      animation: pulse 1.1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1);   opacity: 1; }
      50%      { transform: scale(0.5); opacity: 0.3; }
    }

    .meta { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
    .meta strong { font-size: 12.5px; color: var(--color-text); font-weight: 600; white-space: nowrap; }
    .meta span { font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .step.is-active .meta strong { color: var(--color-primary-700); }
    .step:not(.is-done):not(.is-active) .meta strong { color: var(--color-text-muted); }

    .connector {
      flex: 1;
      height: 2px;
      background: var(--color-border);
      margin: 0 8px;
      border-radius: 2px;
      transition: background 0.25s var(--ease-out);
    }
    .connector.is-done { background: #10b981; }
    .connector.is-active {
      background: linear-gradient(90deg, var(--color-primary-500) 0%, var(--color-primary-200) 50%, var(--color-border) 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      from { background-position: 100% 0; }
      to   { background-position: -100% 0; }
    }

    /* ====== Form ====== */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .form-head {
      grid-column: 1 / -1;
      h4 { margin: 0; font-size: 13px; font-weight: 700; color: var(--color-text); }
      p  { margin: 4px 0 4px; font-size: 12.5px; color: var(--color-text-muted); }
    }
    .field {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 12.5px; color: var(--color-text);
    }
    .field .lbl { font-weight: 600; color: var(--color-text-muted); font-size: 12px; }
    .field i { color: var(--color-error); font-style: normal; font-weight: 600; }
    .field input {
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
    }
    .field input:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }

    /* ====== Result ====== */
    .result { display: flex; flex-direction: column; gap: 16px; }

    .result-head {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      strong { display: block; font-size: 14px; font-weight: 700; }
      span   { font-size: 12.5px; opacity: 0.85; }
      em     { font-style: normal; font-size: 11.5px; opacity: 0.85; }
    }
    .result-head-icon {
      width: 44px; height: 44px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.65);
    }
    .result-head--ok      { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    .result-head--warn    { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .result-head--blocker { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }

    .audit-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .audit-grid .cell {
      padding: 12px 14px;
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      display: flex; flex-direction: column; gap: 2px;
    }
    .audit-grid .cell:nth-child(3n) { border-right: none; }
    .audit-grid .cell.wide {
      grid-column: 1 / -1;
      border-right: none;
      border-bottom: none;
    }
    .audit-grid .lbl {
      font-size: 11px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .audit-grid strong { font-size: 16px; font-weight: 700; color: var(--color-text); letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
    .audit-grid em { font-style: normal; font-size: 11.5px; color: var(--color-text-muted); }

    .discrepancy--positive strong { color: #b91c1c; }
    .discrepancy--negative strong { color: #047857; }
    .discrepancy--zero strong     { color: var(--color-text); }

    .penalty {
      padding: 14px 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: var(--radius-md);
    }
    .penalty header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .penalty h5 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: #92400e; }
    .penalty-pill {
      font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 999px;
      background: #fff;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .penalty-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .penalty-grid div { display: flex; flex-direction: column; gap: 2px; }
    .penalty-grid .lbl {
      font-size: 11px; font-weight: 700;
      color: #92400e; opacity: 0.8;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .penalty-grid strong { font-size: 14px; font-weight: 700; color: #92400e; font-variant-numeric: tabular-nums; }
    .penalty-grid strong.neg { color: #b91c1c; }
    .penalty-notes { margin: 10px 0 0; font-size: 12.5px; color: #92400e; line-height: 1.45; }

    .steps {
      padding: 14px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .steps h5 {
      margin: 0 0 10px;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.4px; text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .steps ol {
      margin: 0; padding-left: 18px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .steps li { font-size: 12.5px; color: var(--color-text); line-height: 1.5; }
    .steps li.muted { color: var(--color-text-muted); list-style: none; padding-left: 0; }

    /* ====== Buttons ====== */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
    .btn-ghost {
      padding: 9px 14px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:hover:not(:disabled) { background: var(--color-surface-2); color: var(--color-text); }
    .btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
      .audit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .audit-grid .cell:nth-child(3n) { border-right: 1px solid var(--color-border); }
      .audit-grid .cell:nth-child(2n) { border-right: none; }
      .penalty-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class WorkflowDialogComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly workflow = inject(WorkflowService);
  private readonly invoiceSvc = inject(InvoiceService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) open: boolean = false;
  @Input() invoice: InvoiceResponse | null = null;
  /** Optional defaults to pre-fill the audit form (e.g. captured at upload time). */
  @Input() defaults: ProcessInvoiceDto | null = null;

  @Output() closed = new EventEmitter<void>();
  /** Emitted with the latest invoice once it has been re-fetched after processing. */
  @Output() processed = new EventEmitter<InvoiceResponse>();

  readonly form = this.fb.nonNullable.group({
    actualAmount:     [0, [Validators.required, Validators.min(0.01)]],
    origin:           ['', [Validators.required, Validators.maxLength(100)]],
    destination:      ['', [Validators.required, Validators.maxLength(100)]],
    serviceType:      ['', [Validators.required, Validators.maxLength(50)]],
    weightLbs:        [null as number | null],
    actualOtdPercent: [null as number | null]
  });

  readonly running = signal(false);
  readonly result = signal<WorkflowResult | null>(null);

  readonly timelineSteps = computed(() => {
    const fromKey = this.invoice ? this.normalize(this.invoice.status) : 'RECEIVED';
    const toKey = this.result() ? this.normalize(this.result()!.finalStatus) : null;

    const fromIdx = TIMELINE.indexOf(fromKey);
    const toIdx = toKey ? TIMELINE.indexOf(toKey) : -1;

    return TIMELINE.map((key, i) => {
      let state: 'idle' | 'done' | 'active' | 'target';
      if (this.running() && !this.result()) {
        // Pre-result: highlight PROCESSING as the active step.
        if (i < TIMELINE.indexOf('PROCESSING')) state = 'done';
        else if (i === TIMELINE.indexOf('PROCESSING')) state = 'active';
        else state = 'idle';
      } else if (this.result()) {
        // Post-result: everything up to and incl. final is "done", in-flight is the very last reached.
        if (toIdx === -1) state = 'idle';
        else if (i < toIdx) state = 'done';
        else if (i === toIdx) state = 'done';
        else state = 'idle';
      } else {
        // Idle pre-run: from-state highlighted, ahead = target.
        if (i < fromIdx) state = 'done';
        else if (i === fromIdx) state = 'active';
        else state = 'target';
      }
      return {
        key,
        label: INVOICE_STATUS_LABELS[key] ?? key,
        hint: this.hintFor(key, state),
        state
      };
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.result.set(null);
      this.applyDefaults();
    }
    if (changes['defaults'] && this.open) this.applyDefaults();
  }

  private applyDefaults(): void {
    const d = this.defaults;
    this.form.reset({
      actualAmount: d?.actualAmount ?? 0,
      origin: d?.origin ?? '',
      destination: d?.destination ?? '',
      serviceType: d?.serviceType ?? '',
      weightLbs: d?.weightLbs ?? null,
      actualOtdPercent: d?.actualOtdPercent ?? null
    });
  }

  shortId(id: string): string { return id.slice(0, 8); }

  normalize(raw: string): InvoiceStatusKey {
    const upper = (raw || '').toUpperCase();
    if (upper === 'PROCESSING' || upper === 'AUDITED' || upper === 'APPROVED' || upper === 'RECEIVED') {
      return upper;
    }
    return 'RECEIVED';
  }

  private hintFor(key: InvoiceStatusKey, state: 'idle' | 'done' | 'active' | 'target'): string {
    if (state === 'active' && this.running()) return 'AI engine running…';
    if (state === 'done') return 'Reached';
    switch (key) {
      case 'RECEIVED':   return 'Ingested';
      case 'PROCESSING': return 'AI audit';
      case 'AUDITED':    return 'Awaiting approval';
      case 'APPROVED':   return 'Finance approved';
    }
  }

  /** Tone for the result banner — driven by audit status & discrepancy sign. */
  auditTone(): 'ok' | 'warn' | 'blocker' {
    const r = this.result();
    if (!r) return 'ok';
    const status = (r.auditResult.status || '').toUpperCase();
    const disc = r.auditResult.discrepancy;

    if (status.includes('FAIL') || status.includes('ERROR')) return 'blocker';
    if (Math.abs(disc) > 0.01 || r.penaltyResult) return 'warn';
    return 'ok';
  }

  run(): void {
    if (!this.invoice || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const dto: ProcessInvoiceDto = {
      actualAmount: Number(v.actualAmount),
      origin: v.origin.trim().toUpperCase(),
      destination: v.destination.trim().toUpperCase(),
      serviceType: v.serviceType.trim().toUpperCase(),
      weightLbs: v.weightLbs !== null ? Number(v.weightLbs) : null,
      actualOtdPercent: v.actualOtdPercent !== null ? Number(v.actualOtdPercent) : null
    };

    this.running.set(true);
    this.workflow
      .processInvoice(this.invoice.id, dto)
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.toast.success(`Workflow complete · ${r.finalStatus}.`);
          // Refresh the invoice so the parent table reflects the new status.
          this.invoiceSvc.getById(this.invoice!.id).subscribe({
            next: (inv) => this.processed.emit(inv),
            error: () => undefined
          });
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Workflow failed.');
        }
      });
  }

  reset(): void {
    this.result.set(null);
    this.applyDefaults();
  }

  onClose(): void {
    if (!this.running()) this.closed.emit();
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  errorFor(field: keyof typeof this.form.controls): string {
    const c = this.form.controls[field];
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('min')) return 'Must be greater than zero.';
    if (c.hasError('maxlength')) return 'This value is too long.';
    return 'Invalid value.';
  }
}
