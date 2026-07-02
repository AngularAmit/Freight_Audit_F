import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';
import { CarrierSummary } from '../carriers/models/carrier.model';
import { ContractListItem, ContractPagedResponse, ContractResponse } from '../masters/models/contract.model';
import { InvoicePagedResponse, InvoiceResponse } from '../invoices/models/invoice.model';

import { AuditType, AuditUploadRequest, AuditUploadResponse } from './models/audit-upload.model';

@Injectable({ providedIn: 'root' })
export class AuditUploadService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly storageKey = 'fa.audit.uploads';

  list(): Observable<AuditUploadResponse[]> {
    return forkJoin({
      contracts: this.http.get<ApiResponse<ContractPagedResponse>>(
        `${this.base}/api/contracts?page=1&pageSize=200`
      ),
      invoices: this.http.get<ApiResponse<InvoicePagedResponse>>(
        `${this.base}/api/invoices?page=1&pageSize=200`
      )
    }).pipe(
        map(({ contracts, invoices }) => this.mergeUploads([
          ...(contracts.data?.items ?? []).map((item) => this.fromContractList(item)),
          ...(invoices.data?.items ?? []).map((item) => this.fromInvoiceList(item))
        ], this.readLocal())),
        tap((items) => this.writeLocal(items)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) return throwError(() => err);
          return of(this.readLocal());
        })
      );
  }

  upload(
    carrier: CarrierSummary,
    auditType: AuditType,
    file: File,
    contractId?: string | null,
    contractName?: string | null
  ): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, auditType, file, undefined, contractId, contractName);
    const fallback = this.toResponse(request, carrier.name);

    return this.persistByType(carrier, request, file, fallback);
  }

  update(
    current: AuditUploadResponse,
    carrier: CarrierSummary,
    auditType: AuditType,
    file: File | null,
    contractId?: string | null,
    contractName?: string | null
  ): Observable<AuditUploadResponse> {
    const request = this.buildRequest(carrier, auditType, file, current, contractId, contractName);
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
    current?: AuditUploadResponse,
    contractId?: string | null,
    contractName?: string | null
  ): AuditUploadRequest {
    const createdAt = current?.EffectiveDate ?? new Date().toISOString();
    const fileName = file?.name ?? current?.FileName ?? '';

    return {
      id: current?.ID ?? this.createId(),
      auditType,
      contractId: auditType === 'Invoice' ? (contractId ?? current?.ContractId ?? null) : null,
      contractName: auditType === 'Invoice' ? (contractName ?? current?.ContracTtitle ?? null) : null,
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
      ContracTtitle: request.auditType === 'Invoice'
        ? request.contractName ?? current?.ContracTtitle ?? `${carrierName} invoice audit`
        : current?.ContracTtitle ?? `${carrierName} contract audit`,
      EffectiveDate: request.createdAt,
      Parties: current?.Parties ?? carrierName,
      Terms: request.auditType,
      FileName: request.fileName,
      IsActive: request.status.toLowerCase() !== 'inactive',
      AuditType: request.auditType,
      ContractId: request.contractId ?? null
    };
  }

  private persistByType(
    carrier: CarrierSummary,
    request: AuditUploadRequest,
    file: File,
    fallback: AuditUploadResponse
  ): Observable<AuditUploadResponse> {
    const save$ = request.auditType === 'Contracts'
      ? this.saveContractAudit(carrier, request, file)
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
    request: AuditUploadRequest,
    file: File
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
            .post<ApiResponse<ContractResponse>>(
              `${this.base}/api/contracts/${contract.id}/upload`,
              this.buildContractFormData(file)
            )
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
    fd.append('actualAmount', '1');
    fd.append('origin', 'Audit Upload');
    fd.append('destination', 'Audit Upload');
    fd.append('serviceType', 'Audit Upload');
    if (request.contractId) {
      fd.append('contractId', request.contractId);
    }

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
      AuditType: 'Contracts',
      ContractId: contract.id
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
      ContracTtitle: request.contractName ?? `${carrierName} invoice audit`,
      EffectiveDate: invoice?.createdAt ?? request.createdAt,
      Parties: invoice?.carrierName || carrierName,
      Terms: 'Invoice',
      FileName: request.fileName,
      IsActive: true,
      AuditType: 'Invoice',
      ContractId: request.contractId ?? null
    };
  }

  private fromContractList(contract: ContractListItem): AuditUploadResponse {
    return {
      ID: contract.id,
      Company: contract.carrierName,
      ContracTtitle: contract.contractName,
      EffectiveDate: contract.createdAt,
      Parties: contract.carrierName,
      Terms: 'Contracts',
      FileName: this.fileNameFromPath(contract.filePath) || contract.contractName,
      IsActive: contract.isActive,
      AuditType: 'Contracts',
      ContractId: contract.id
    };
  }

  private fromInvoiceList(invoice: InvoiceResponse): AuditUploadResponse {
    return {
      ID: invoice.id,
      Company: invoice.carrierName,
      ContracTtitle: `${invoice.carrierName} invoice audit`,
      EffectiveDate: invoice.createdAt,
      Parties: invoice.carrierName,
      Terms: 'Invoice',
      FileName: this.fileNameFromPath(invoice.filePath) || `INV-${invoice.id.slice(0, 8)}`,
      IsActive: true,
      AuditType: 'Invoice',
      ContractId: null
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

  private buildFilePath(carrierId: string, fileName: string): string {
    const safeName = fileName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `audit-uploads/${carrierId}/${stamp}-${safeName}`;
  }

  private buildContractFormData(file: File): FormData {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return fd;
  }

  private fileNameFromPath(path: string | null | undefined): string {
    if (!path) return '';
    return path.split(/[\\/]/).filter(Boolean).pop() ?? '';
  }

  private mergeUploads(remote: AuditUploadResponse[], local: AuditUploadResponse[]): AuditUploadResponse[] {
    const seen = new Set<string>();
    return [...remote, ...local]
      .map((item) => this.normalizeUpload(item))
      .filter((item) => {
        if (seen.has(item.ID)) return false;
        seen.add(item.ID);
        return true;
      })
      .sort((a, b) => Date.parse(b.EffectiveDate) - Date.parse(a.EffectiveDate));
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
