import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';
import { CarrierSummary } from '../carriers/models/carrier.model';
import { ContractResponse } from '../masters/models/contract.model';
import { InvoiceResponse } from '../invoices/models/invoice.model';

import { AuditType, AuditUploadRequest, AuditUploadResponse } from './models/audit-upload.model';

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
        map((res) => this.unwrapList(res).map((item) => this.normalizeUpload(item))),
        tap((items) => this.writeLocal(items)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) return throwError(() => err);
          return of(this.readLocal());
        })
      );
  }

  upload(carrier: CarrierSummary, auditType: AuditType, file: File): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, auditType, file);
    const fallback = this.toResponse(request, carrier.name);

    return this.persistByType(carrier, request, file, fallback);
  }

  update(
    current: AuditUploadResponse,
    carrier: CarrierSummary,
    auditType: AuditType,
    file: File | null
  ): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, auditType, file, current);
    const fallback = this.toResponse(request, carrier.name, current);

    if (!file) {
      this.upsertLocal(fallback);
      return of(fallback);
    }

    return this.persistByType(carrier, request, file, fallback);
  }

  private buildRequest(
    carrier: CarrierSummary,
    auditType: AuditType,
    file: File | null,
    current?: AuditUploadResponse
  ): AuditUploadRequest {
    const createdAt = current?.EffectiveDate ?? new Date().toISOString();
    const fileName = file?.name ?? current?.FileName ?? '';

    return {
      id: current?.ID ?? this.createId(),
      auditType,
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
      ContracTtitle: current?.ContracTtitle ?? `${carrierName} ${request.auditType.toLowerCase()} audit`,
      EffectiveDate: request.createdAt,
      Parties: current?.Parties ?? carrierName,
      Terms: request.auditType,
      FileName: request.fileName,
      IsActive: request.status.toLowerCase() !== 'inactive',
      AuditType: request.auditType
    };
  }

  private persistByType(
    carrier: CarrierSummary,
    request: AuditUploadRequest,
    file: File,
    fallback: AuditUploadResponse
  ): Observable<AuditUploadResponse> {
    const save$ = request.auditType === 'Contracts'
      ? this.saveContractAudit(carrier, request)
      : this.saveInvoiceAudit(carrier, request, file);

    return save$.pipe(
      tap((upload) => this.upsertLocal(upload)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) return throwError(() => err);
        this.upsertLocal(fallback);
        return of(fallback);
      })
    );
  }

  private saveContractAudit(
    carrier: CarrierSummary,
    request: AuditUploadRequest
  ): Observable<AuditUploadResponse> {
    const contractName = request.fileName || `${carrier.name} audit contract`;

    return this.http
      .post<ApiResponse<ContractResponse>>(`${this.base}/api/contracts`, {
        carrierId: carrier.id,
        contractName,
        isActive: true
      })
      .pipe(
        switchMap((created) => {
          const contract = created.data;
          if (!contract) return of(this.toResponse(request, carrier.name));

          return this.http
            .post<ApiResponse<ContractResponse>>(`${this.base}/api/contracts/${contract.id}/upload`, {
              filePath: request.filePath
            })
            .pipe(map((uploaded) => this.fromContract(uploaded.data ?? contract, request, carrier.name)));
        })
      );
  }

  private saveInvoiceAudit(
    carrier: CarrierSummary,
    request: AuditUploadRequest,
    file: File
  ): Observable<AuditUploadResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('carrierId', carrier.id);
    fd.append('source', 'UPLOAD');
    fd.append('actualAmount', '0');
    fd.append('origin', 'Audit Upload');
    fd.append('destination', 'Audit Upload');
    fd.append('serviceType', 'Audit Upload');

    return this.http
      .post<ApiResponse<InvoiceResponse>>(`${this.base}/api/invoices/upload`, fd)
      .pipe(map((res) => this.fromInvoice(res.data, request, carrier.name)));
  }

  private fromContract(
    contract: ContractResponse,
    request: AuditUploadRequest,
    carrierName: string
  ): AuditUploadResponse {
    return {
      ID: contract.id,
      Company: contract.carrierName || carrierName,
      ContracTtitle: contract.contractName,
      EffectiveDate: contract.createdAt,
      Parties: contract.carrierName || carrierName,
      Terms: 'Contracts',
      FileName: request.fileName,
      IsActive: contract.isActive,
      AuditType: 'Contracts'
    };
  }

  private fromInvoice(
    invoice: InvoiceResponse | undefined,
    request: AuditUploadRequest,
    carrierName: string
  ): AuditUploadResponse {
    return {
      ID: invoice?.id ?? request.id,
      Company: invoice?.carrierName || carrierName,
      ContracTtitle: `${carrierName} invoice audit`,
      EffectiveDate: invoice?.createdAt ?? request.createdAt,
      Parties: invoice?.carrierName || carrierName,
      Terms: 'Invoice',
      FileName: request.fileName,
      IsActive: true,
      AuditType: 'Invoice'
    };
  }

  private normalizeUpload(upload: AuditUploadResponse): AuditUploadResponse {
    return {
      ...upload,
      AuditType: upload.AuditType ?? this.inferAuditType(upload)
    };
  }

  private inferAuditType(upload: AuditUploadResponse): AuditType {
    if (upload.Terms === 'Invoice' || upload.Terms === 'Contracts') return upload.Terms;
    if (upload.ContracTtitle.toLowerCase().includes('invoice')) return 'Invoice';
    return 'Contracts';
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
