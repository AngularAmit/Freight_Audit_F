import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';
import { CarrierSummary } from '../carriers/models/carrier.model';

import { AuditUploadRequest, AuditUploadResponse } from './models/audit-upload.model';

type AuditUploadListResponse =
  | ApiResponse<AuditUploadResponse[]>
  | AuditUploadResponse[]
  | { data?: AuditUploadResponse[]; items?: AuditUploadResponse[] };

@Injectable({ providedIn: 'root' })
export class AuditUploadService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly storageKey = 'fa.audit.uploads';

  list(): Observable<AuditUploadResponse[]> {
    return this.http
      .get<AuditUploadListResponse>(`${this.base}/api/audit-uploads`)
      .pipe(
        map((res) => this.unwrapList(res)),
        tap((items) => this.writeLocal(items)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) return throwError(() => err);
          return of(this.readLocal());
        })
      );
  }

  upload(carrier: CarrierSummary, file: File): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, file);
    const fallback = this.toResponse(request, carrier.name);

    return this.http
      .post<ApiResponse<AuditUploadResponse>>(`${this.base}/api/audit-uploads`, request)
      .pipe(
        map((res) => res.data ?? fallback),
        tap((upload) => this.upsertLocal(upload)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) return throwError(() => err);
          this.upsertLocal(fallback);
          return of(fallback);
        })
      );
  }

  update(
    current: AuditUploadResponse,
    carrier: CarrierSummary,
    file: File | null
  ): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, file, current);
    const fallback = this.toResponse(request, carrier.name, current);

    return this.http
      .put<ApiResponse<AuditUploadResponse>>(`${this.base}/api/audit-uploads/${current.ID}`, request)
      .pipe(
        map((res) => res.data ?? fallback),
        tap((upload) => this.upsertLocal(upload)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) return throwError(() => err);
          this.upsertLocal(fallback);
          return of(fallback);
        })
      );
  }

  private buildRequest(
    carrier: CarrierSummary,
    file: File | null,
    current?: AuditUploadResponse
  ): AuditUploadRequest {
    const createdAt = current?.EffectiveDate ?? new Date().toISOString();
    const fileName = file?.name ?? current?.FileName ?? '';

    return {
      id: current?.ID ?? this.createId(),
      documentType: carrier.name,
      fileName,
      filePath: file ? this.buildFilePath(carrier.id, file.name) : current?.FileName ?? '',
      status: current?.IsActive === false ? 'Inactive' : 'Uploaded',
      createdAt
    };
  }

  private toResponse(
    request: AuditUploadRequest,
    carrierName: string,
    current?: AuditUploadResponse
  ): AuditUploadResponse {
    return {
      ID: request.id,
      Company: carrierName,
      ContracTtitle: current?.ContracTtitle ?? `${carrierName} audit upload`,
      EffectiveDate: request.createdAt,
      Parties: current?.Parties ?? carrierName,
      Terms: request.status,
      FileName: request.fileName,
      IsActive: request.status.toLowerCase() !== 'inactive'
    };
  }

  private unwrapList(res: AuditUploadListResponse): AuditUploadResponse[] {
    if (Array.isArray(res)) return res;
    const shaped = res as { data?: AuditUploadResponse[]; items?: AuditUploadResponse[] };
    return shaped.data ?? shaped.items ?? [];
  }

  private buildFilePath(carrierId: string, fileName: string): string {
    const safeName = fileName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `audit-uploads/${carrierId}/${stamp}-${safeName}`;
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private upsertLocal(upload: AuditUploadResponse): void {
    const existing = this.readLocal();
    const next = existing.some((item) => item.ID === upload.ID)
      ? existing.map((item) => (item.ID === upload.ID ? upload : item))
      : [upload, ...existing];

    this.writeLocal(next);
  }

  private readLocal(): AuditUploadResponse[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as AuditUploadResponse[];
    } catch {
      return [];
    }
  }

  private writeLocal(items: AuditUploadResponse[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }
}
