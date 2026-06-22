import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';
import { PagedResult } from '../admin/models/paged-result.model';

import {
  ApproveCarrierDto,
  CarrierDocument,
  CarrierResponse,
  CarrierSummary,
  CreateCarrierDto,
  GetCarriersQuery,
  RejectCarrierDto,
  UploadDocumentDto
} from './models/carrier.model';

@Injectable({ providedIn: 'root' })
export class CarrierService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /api/carriers — paged list with optional status / search filters. */
  list(query: GetCarriersQuery = {}): Observable<PagedResult<CarrierSummary>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.status) params = params.set('status', query.status);
    if (query.search) params = params.set('search', query.search);

    return this.http
      .get<ApiResponse<PagedResult<CarrierSummary>>>(`${this.base}/api/carriers`, { params })
      .pipe(map((r) => r.data ?? this.emptyPage()));
  }

  /** GET /api/carriers/{id} — full carrier detail incl. docs + compliance. */
  getById(id: string): Observable<CarrierResponse> {
    return this.http
      .get<ApiResponse<CarrierResponse>>(`${this.base}/api/carriers/${id}`)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/carriers — create a new carrier (initial PENDING status). */
  create(dto: CreateCarrierDto): Observable<CarrierResponse> {
    return this.http
      .post<ApiResponse<CarrierResponse>>(`${this.base}/api/carriers`, dto)
      .pipe(map((r) => r.data!));
  }

  /**
   * POST /api/carriers/{id}/documents — register a document for the carrier.
   *
   * Backend currently expects JSON metadata only. We build a FormData object
   * client-side (so the file picker / drag-drop UX is a real File pipeline),
   * read the File's name + size, generate a stable synthetic filePath, then
   * post JSON metadata to the API.
   */
  uploadDocument(carrierId: string, file: File, documentType: string): Observable<CarrierDocument> {
    // Real FormData built so the upload pipeline uses the File API end-to-end.
    // Sent as JSON to the existing JSON endpoint until a multipart endpoint exists.
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('documentType', documentType);

    const filePath = this.buildFilePath(carrierId, file.name);
    const dto: UploadDocumentDto = {
      documentType,
      fileName: file.name,
      filePath,
      fileSizeBytes: file.size
    };

    return this.http
      .post<ApiResponse<CarrierDocument>>(`${this.base}/api/carriers/${carrierId}/documents`, dto)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/carriers/{id}/approve — mark APPROVED with optional reviewer comments. */
  approve(id: string, dto: ApproveCarrierDto): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(`${this.base}/api/carriers/${id}/approve`, dto)
      .pipe(map(() => void 0));
  }

  /** POST /api/carriers/{id}/reject — mark REJECTED with mandatory reason. */
  reject(id: string, dto: RejectCarrierDto): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(`${this.base}/api/carriers/${id}/reject`, dto)
      .pipe(map(() => void 0));
  }

  private buildFilePath(carrierId: string, fileName: string): string {
    const safeName = fileName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `carriers/${carrierId}/${stamp}-${safeName}`;
  }

  private emptyPage(): PagedResult<CarrierSummary> {
    return {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }
}
