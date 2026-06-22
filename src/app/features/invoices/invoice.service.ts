import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';

import {
  GetInvoicesQuery,
  InvoicePagedResponse,
  InvoiceResponse,
  InvoiceStatus,
  UploadInvoiceFormData
} from './models/invoice.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /**
   * POST /api/invoices/upload — multipart form-data.
   *
   * Unlike the carrier-document endpoint, this one *actually accepts* binary
   * via `IFormFile` and persists it under `uploads/invoices/{carrierId}/...`.
   * The audit engine is enqueued for processing immediately after.
   */
  upload(payload: UploadInvoiceFormData): Observable<InvoiceResponse> {
    const fd = new FormData();
    fd.append('file', payload.file, payload.file.name);
    fd.append('carrierId', payload.carrierId);
    fd.append('source', payload.source);
    fd.append('actualAmount', String(payload.actualAmount));
    fd.append('origin', payload.origin);
    fd.append('destination', payload.destination);
    fd.append('serviceType', payload.serviceType);
    if (payload.weightLbs !== null && payload.weightLbs !== undefined) {
      fd.append('weightLbs', String(payload.weightLbs));
    }
    if (payload.actualOtdPercent !== null && payload.actualOtdPercent !== undefined) {
      fd.append('actualOtdPercent', String(payload.actualOtdPercent));
    }

    return this.http
      .post<ApiResponse<InvoiceResponse>>(`${this.base}/api/invoices/upload`, fd)
      .pipe(map((r) => r.data!));
  }

  /** GET /api/invoices — paged list with optional carrier / source / status filters. */
  list(query: GetInvoicesQuery = {}): Observable<InvoicePagedResponse> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.carrierId) params = params.set('carrierId', query.carrierId);
    if (query.source) params = params.set('source', query.source);
    if (query.status) params = params.set('status', query.status);

    return this.http
      .get<ApiResponse<InvoicePagedResponse>>(`${this.base}/api/invoices`, { params })
      .pipe(map((r) => r.data ?? this.empty()));
  }

  /** GET /api/invoices/{id} — single invoice. */
  getById(id: string): Observable<InvoiceResponse> {
    return this.http
      .get<ApiResponse<InvoiceResponse>>(`${this.base}/api/invoices/${id}`)
      .pipe(map((r) => r.data!));
  }

  /**
   * POST /api/invoices/{id}/status — manual status transition (numeric enum).
   *
   * The backend enforces transition rules via `IStatusTransitionService`
   * so callers should expect 4xx responses for invalid moves.
   */
  changeStatus(id: string, newStatus: InvoiceStatus): Observable<InvoiceResponse> {
    return this.http
      .post<ApiResponse<InvoiceResponse>>(`${this.base}/api/invoices/${id}/status`, { newStatus })
      .pipe(map((r) => r.data!));
  }

  private empty(): InvoicePagedResponse {
    return { items: [], totalCount: 0, page: 1, pageSize: 20 };
  }
}
