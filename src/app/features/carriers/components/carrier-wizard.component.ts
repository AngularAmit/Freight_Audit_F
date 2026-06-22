import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { StepDef, StepperComponent } from '../../../shared/components/stepper.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { CarrierService } from '../carrier.service';
import {
  CarrierResponse,
  CreateCarrierDto
} from '../models/carrier.model';

import { BasicDetailsStepComponent } from './steps/basic-details-step.component';
import { UploadDocumentsStepComponent } from './steps/upload-documents-step.component';
import { ComplianceStatusStepComponent } from './steps/compliance-status-step.component';
import { ApprovalStepComponent } from './steps/approval-step.component';

@Component({
  selector: 'app-carrier-wizard',
  standalone: true,
  imports: [
    CommonModule,
    StepperComponent,
    BasicDetailsStepComponent,
    UploadDocumentsStepComponent,
    ComplianceStatusStepComponent,
    ApprovalStepComponent
  ],
  template: `
    <section class="wizard">
      <header class="page-head">
        <div>
          <button type="button" class="back-link" (click)="goToList()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            All carriers
          </button>
          <h2>{{ carrier() ? carrier()!.name : 'Onboard a new carrier' }}</h2>
          <p>{{ carrier()
            ? 'Review documents, validate compliance and complete approval.'
            : 'Capture details, upload documents, validate compliance and decide approval.' }}</p>
        </div>
        @if (carrier()) {
          <span class="status-pill" [class]="'status-pill--' + statusKey()">
            <span class="dot"></span>
            {{ statusLabel() }}
          </span>
        }
      </header>

      @if (loading()) {
        <div class="loading">Loading carrier…</div>
      } @else {
        <app-stepper
          [steps]="steps()"
          [activeIndex]="activeIndex()"
          (stepSelect)="goToStep($event)">
        </app-stepper>

        <div class="step-host">
          @switch (activeIndex()) {
            @case (0) {
              <app-basic-details-step
                [carrier]="carrier()"
                [submitting]="creating"
                (create)="onCreate($event)"
                (continue)="goToStep(1)">
              </app-basic-details-step>
            }
            @case (1) {
              @if (carrier()) {
                <app-upload-documents-step
                  [carrier]="carrier()!"
                  [documents]="carrier()!.documents"
                  [readOnly]="isLocked()"
                  (upload)="onUpload($event)"
                  (back)="goToStep(0)"
                  (continue)="goToStep(2)">
                </app-upload-documents-step>
              }
            }
            @case (2) {
              @if (carrier()) {
                <app-compliance-status-step
                  [carrier]="carrier()!"
                  [compliance]="carrier()!.compliance"
                  (refresh)="reload()"
                  (back)="goToStep(1)"
                  (continue)="goToStep(3)">
                </app-compliance-status-step>
              }
            }
            @case (3) {
              @if (carrier()) {
                <app-approval-step
                  [carrier]="carrier()!"
                  [busy]="deciding"
                  [action]="decisionAction"
                  (approve)="onApprove($event)"
                  (reject)="onReject($event)"
                  (back)="goToStep(2)"
                  (finish)="goToList()">
                </app-approval-step>
              }
            }
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .wizard { display: flex; flex-direction: column; gap: 18px; }

    .page-head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
      padding: 18px 22px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
    }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 12.5px; font-weight: 600;
      padding: 4px 0;
      margin-bottom: 6px;
    }
    .back-link:hover { color: var(--color-primary-700); }
    .page-head h2 {
      margin: 0;
      font-size: 19px; font-weight: 700; color: var(--color-text);
      letter-spacing: -0.4px;
    }
    .page-head p {
      margin: 4px 0 0;
      font-size: 13px; color: var(--color-text-muted);
    }

    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11.5px; font-weight: 700;
      padding: 5px 12px; border-radius: 999px;
      letter-spacing: 0.3px;
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-text-subtle); }
    .status-pill--pending { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .status-pill--pending .dot { background: #f59e0b; }
    .status-pill--review { background: var(--color-primary-50); color: var(--color-primary-700); border-color: var(--color-primary-100); }
    .status-pill--review .dot { background: var(--color-primary-500); }
    .status-pill--approved { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .status-pill--approved .dot { background: #10b981; }
    .status-pill--rejected { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .status-pill--rejected .dot { background: #ef4444; }

    .loading {
      padding: 60px 22px;
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .step-host { display: block; }
  `]
})
export class CarrierWizardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carriers = inject(CarrierService);
  private readonly toast = inject(ToastService);

  readonly carrier = signal<CarrierResponse | null>(null);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly deciding = signal(false);
  readonly decisionAction = signal<'approve' | 'reject' | null>(null);
  readonly activeIndex = signal(0);

  readonly steps = computed<StepDef[]>(() => {
    const c = this.carrier();
    const hasDocs = !!c && c.documents.length > 0;
    const hasCompliance = !!c?.compliance;
    const decided = c?.status === 'APPROVED' || c?.status === 'REJECTED';
    const rejected = c?.status === 'REJECTED';

    return [
      {
        id: 'basic',
        label: 'Basic details',
        description: c ? 'Saved' : 'Capture entity & GST',
        complete: !!c,
        reachable: true
      },
      {
        id: 'documents',
        label: 'Upload documents',
        description: hasDocs ? `${c!.documents.length} attached` : 'KYC, GST, insurance',
        complete: hasDocs,
        reachable: !!c
      },
      {
        id: 'compliance',
        label: 'Compliance status',
        description: hasCompliance ? c!.compliance!.riskLevel : 'AI checks',
        complete: hasCompliance && (c?.compliance?.approvalStatus !== 'Pending'),
        warning: rejected,
        reachable: !!c
      },
      {
        id: 'approval',
        label: 'Approval',
        description: decided ? this.statusLabel() : 'Approve / reject',
        complete: c?.status === 'APPROVED',
        warning: rejected,
        reachable: !!c
      }
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loadCarrier(id);
    }
  }

  isLocked(): boolean {
    const s = this.carrier()?.status;
    return s === 'APPROVED' || s === 'REJECTED';
  }

  statusKey(): 'pending' | 'review' | 'approved' | 'rejected' {
    const s = this.carrier()?.status;
    if (s === 'APPROVED') return 'approved';
    if (s === 'REJECTED') return 'rejected';
    if (s === 'UNDER_REVIEW') return 'review';
    return 'pending';
  }

  statusLabel(): string {
    const s = this.carrier()?.status ?? 'PENDING';
    return s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

  goToList(): void {
    this.router.navigate(['/carriers']);
  }

  goToStep(i: number): void {
    if (i < 0 || i >= this.steps().length) return;
    if (!this.steps()[i].reachable && i !== 0) return;
    this.activeIndex.set(i);
  }

  reload(): void {
    const id = this.carrier()?.id;
    if (id) this.loadCarrier(id);
  }

  private loadCarrier(id: string): void {
    this.loading.set(true);
    this.carriers
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (c) => {
          this.carrier.set(c);
          this.activeIndex.set(this.suggestStep(c));
        },
        error: (err) => this.handleError(err, 'Could not load carrier.')
      });
  }

  private suggestStep(c: CarrierResponse): number {
    if (c.status === 'APPROVED' || c.status === 'REJECTED') return 3;
    if (c.documents.length === 0) return 1;
    if (c.status === 'UNDER_REVIEW') return 2;
    return 1;
  }

  onCreate(dto: CreateCarrierDto): void {
    this.creating.set(true);
    this.carriers
      .create(dto)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (c) => {
          this.carrier.set(c);
          this.toast.success(`Carrier "${c.name}" created.`);
          this.activeIndex.set(1);
          this.router.navigate(['/carriers', c.id], { replaceUrl: true });
        },
        error: (err) => this.handleError(err, 'Could not create carrier.')
      });
  }

  onUpload(payload: { file: File; documentType: string; onResult: (ok: boolean, error?: string) => void }): void {
    const id = this.carrier()?.id;
    if (!id) return;

    this.carriers.uploadDocument(id, payload.file, payload.documentType).subscribe({
      next: (doc) => {
        const current = this.carrier();
        if (current) {
          this.carrier.set({ ...current, documents: [...current.documents, doc] });
        }
        payload.onResult(true);
        this.toast.success(`Uploaded "${payload.file.name}".`);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        const msg = body?.message ?? 'Document upload failed.';
        payload.onResult(false, msg);
        this.toast.error(msg);
      }
    });
  }

  onApprove(payload: { comments?: string | null }): void {
    const id = this.carrier()?.id;
    if (!id) return;

    this.deciding.set(true);
    this.decisionAction.set('approve');
    this.carriers
      .approve(id, payload)
      .pipe(finalize(() => {
        this.deciding.set(false);
        this.decisionAction.set(null);
      }))
      .subscribe({
        next: () => {
          this.toast.success('Carrier approved.');
          this.loadCarrier(id);
        },
        error: (err) => this.handleError(err, 'Could not approve carrier.')
      });
  }

  onReject(payload: { reason: string }): void {
    const id = this.carrier()?.id;
    if (!id) return;

    this.deciding.set(true);
    this.decisionAction.set('reject');
    this.carriers
      .reject(id, payload)
      .pipe(finalize(() => {
        this.deciding.set(false);
        this.decisionAction.set(null);
      }))
      .subscribe({
        next: () => {
          this.toast.info('Carrier rejected.');
          this.loadCarrier(id);
        },
        error: (err) => this.handleError(err, 'Could not reject carrier.')
      });
  }

  private handleError(err: HttpErrorResponse, fallback: string): void {
    const body = err.error as ApiResponse<unknown> | undefined;
    this.toast.error(body?.message ?? fallback);
  }
}
