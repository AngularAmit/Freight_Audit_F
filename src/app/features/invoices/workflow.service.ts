import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';

import { ProcessInvoiceDto, WorkflowResult } from './models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /**
   * POST /api/workflow/process-invoice/{invoiceId}
   *
   * Runs the full audit + penalty workflow synchronously on the invoice.
   * Returns the final status, audit result, optional penalty record, and
   * the chronological list of processing steps the engine took.
   */
  processInvoice(invoiceId: string, dto: ProcessInvoiceDto): Observable<WorkflowResult> {
    return this.http
      .post<ApiResponse<WorkflowResult>>(
        `${this.base}/api/workflow/process-invoice/${invoiceId}`,
        dto
      )
      .pipe(map((r) => r.data!));
  }
}
