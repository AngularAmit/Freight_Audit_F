import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CarrierResponse, CarrierStatus } from '../../models/carrier.model';
import { PermissionsService } from '../../../../core/services/permissions.service';

@Component({
  selector: 'app-approval-step',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  template: `
    <section class="card">
      <header class="head">
        <h3>Approval</h3>
        <p>Final reviewer decision. Approving makes the carrier eligible for contracts and rates.</p>
      </header>

      <div class="content">
        <div class="summary">
          <div class="row">
            <span class="lbl">Carrier</span>
            <strong>{{ carrier.name }}</strong>
          </div>
          <div class="row">
            <span class="lbl">GST</span>
            <code>{{ carrier.gstNumber }}</code>
          </div>
          <div class="row">
            <span class="lbl">Geography</span>
            <span>{{ carrier.geography }}</span>
          </div>
          <div class="row">
            <span class="lbl">Documents</span>
            <span>{{ carrier.documents.length }} uploaded</span>
          </div>
          <div class="row">
            <span class="lbl">Status</span>
            <span class="status-pill" [class]="'status-pill--' + statusKey()">
              <span class="dot"></span>
              {{ statusLabel() }}
            </span>
          </div>
          <div class="row">
            <span class="lbl">Created</span>
            <span>{{ carrier.createdAt | date: 'medium' }}</span>
          </div>
        </div>

        @if (decided()) {
          <div class="decision-banner" [class]="'decision-banner--' + statusKey()">
            <strong>{{ statusLabel() }}</strong>
            @if (carrier.compliance?.reviewerComments) {
              <p>{{ carrier.compliance!.reviewerComments }}</p>
            }
            @if (carrier.compliance?.reviewedAt) {
              <em>Reviewed {{ carrier.compliance!.reviewedAt | date: 'medium' }}</em>
            }
          </div>
        } @else if (canDecide()) {
          <form class="decision" [formGroup]="form" (ngSubmit)="$event.preventDefault()">
            <label class="field">
              <span class="lbl">Reviewer comments</span>
              <textarea rows="3" formControlName="comments"
                        placeholder="Optional for approval. Required when rejecting."></textarea>
              @if (form.hasError('reasonRequired') && (form.touched || tried())) {
                <em class="err">A reason is required when rejecting a carrier.</em>
              }
            </label>

            <div class="buttons">
              <button type="button" class="btn-reject" [disabled]="busy()" (click)="onReject()">
                @if (busy() && action() === 'reject') {
                  <span class="spinner spinner--white"></span> Rejecting…
                } @else {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Reject
                }
              </button>
              <button type="button" class="btn-approve" [disabled]="busy()" (click)="onApprove()">
                @if (busy() && action() === 'approve') {
                  <span class="spinner spinner--white"></span> Approving…
                } @else {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Approve carrier
                }
              </button>
            </div>
          </form>
        } @else {
          <div class="cant-decide">
            <strong>You don't have permission to approve or reject carriers.</strong>
            <p>Ask an administrator to grant <em>CARRIER · CanEdit</em> on your role.</p>
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
          <button type="button" class="btn-secondary" (click)="finish.emit()">
            Done
          </button>
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

    .summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .summary .row {
      display: flex; flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      border-right: 1px solid var(--color-border);
    }
    .summary .row:nth-child(2n) { border-right: none; }
    .summary .row:nth-last-child(-n+2) { border-bottom: none; }
    .summary .lbl {
      font-size: 11px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .summary strong, .summary span, .summary code {
      font-size: 13px; color: var(--color-text); font-weight: 500;
    }
    .summary code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      background: #fff; padding: 1px 6px; border-radius: 4px;
      border: 1px solid var(--color-border);
      align-self: flex-start;
    }

    .status-pill {
      align-self: flex-start;
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700;
      padding: 4px 10px; border-radius: 999px;
      letter-spacing: 0.3px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
    }
    .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary-500); }
    .status-pill--pending { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .status-pill--pending .dot { background: #f59e0b; }
    .status-pill--review { background: var(--color-primary-50); color: var(--color-primary-700); border-color: var(--color-primary-100); }
    .status-pill--review .dot { background: var(--color-primary-500); }
    .status-pill--approved { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .status-pill--approved .dot { background: #10b981; }
    .status-pill--rejected { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .status-pill--rejected .dot { background: #ef4444; }

    .decision { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field .lbl {
      font-size: 11.5px; font-weight: 600;
      color: var(--color-text-muted);
    }
    .field textarea {
      padding: 10px 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; color: var(--color-text);
      font-family: inherit; resize: vertical;
      min-height: 80px;
    }
    .field textarea:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .err { color: var(--color-error); font-size: 11.5px; font-style: normal; }

    .buttons {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
    }

    .btn-approve {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(16, 185, 129, 0.32);
    }
    .btn-approve:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-approve:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .btn-reject {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 18px;
      background: #fff;
      color: #b91c1c;
      border: 1px solid #fecaca;
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-reject:hover:not(:disabled) { background: #fef2f2; border-color: #f87171; }
    .btn-reject:disabled { opacity: 0.55; cursor: not-allowed; }

    .spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(0, 0, 0, 0.15);
      border-top-color: var(--color-primary-600);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .spinner--white { border-color: rgba(255,255,255,0.4); border-top-color: #fff; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .decision-banner {
      padding: 16px 18px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      strong { font-size: 14px; font-weight: 700; }
      p      { margin: 6px 0 0; font-size: 13px; color: var(--color-text); }
      em     { display: block; margin-top: 8px; font-style: normal; font-size: 12px; color: var(--color-text-muted); }
    }
    .decision-banner--approved { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    .decision-banner--rejected { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
    .decision-banner--pending  { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .decision-banner--review   { background: var(--color-primary-50); border-color: var(--color-primary-100); color: var(--color-primary-700); }

    .cant-decide {
      padding: 18px;
      background: var(--color-surface-2);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      strong { display: block; font-size: 13.5px; color: var(--color-text); }
      p      { margin: 6px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
      em     { font-style: normal; color: var(--color-primary-700); font-weight: 600; }
    }

    .step-actions {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--color-border);
    }
    .btn-secondary {
      padding: 10px 16px;
      background: var(--color-surface-2);
      color: var(--color-text);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
    }
    .btn-secondary:hover { background: #fff; border-color: var(--color-primary-300); color: var(--color-primary-700); }
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
      .summary { grid-template-columns: 1fr; }
      .summary .row { border-right: none; }
      .summary .row:nth-last-child(2) { border-bottom: 1px solid var(--color-border); }
    }
  `]
})
export class ApprovalStepComponent {
  private readonly fb = inject(FormBuilder);
  private readonly perms = inject(PermissionsService);

  @Input({ required: true }) carrier!: CarrierResponse;
  @Input() busy = signal(false);
  /** Tracks which action is currently in flight, for the per-button spinner. */
  @Input() action = signal<'approve' | 'reject' | null>(null);

  @Output() approve = new EventEmitter<{ comments?: string | null }>();
  @Output() reject  = new EventEmitter<{ reason: string }>();
  @Output() back = new EventEmitter<void>();
  @Output() finish = new EventEmitter<void>();

  readonly form = this.fb.nonNullable.group({
    comments: ['']
  });

  readonly tried = signal(false);

  canDecide(): boolean {
    return this.perms.hasPermission('CARRIER', 'canEdit');
  }

  decided = computed(() => this.carrier.status === 'APPROVED' || this.carrier.status === 'REJECTED');

  statusKey(): 'pending' | 'review' | 'approved' | 'rejected' {
    const s: CarrierStatus = this.carrier.status;
    if (s === 'APPROVED') return 'approved';
    if (s === 'REJECTED') return 'rejected';
    if (s === 'UNDER_REVIEW') return 'review';
    return 'pending';
  }

  statusLabel(): string {
    return this.carrier.status.replace('_', ' ').toLowerCase()
      .replace(/^./, (c) => c.toUpperCase());
  }

  onApprove(): void {
    this.tried.set(false);
    this.approve.emit({ comments: this.form.controls.comments.value?.trim() || null });
  }

  onReject(): void {
    this.tried.set(true);
    const reason = this.form.controls.comments.value?.trim() ?? '';
    if (!reason) {
      this.form.setErrors({ reasonRequired: true });
      this.form.markAllAsTouched();
      return;
    }
    this.form.setErrors(null);
    this.reject.emit({ reason });
  }
}
