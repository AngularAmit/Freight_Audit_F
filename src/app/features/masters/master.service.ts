import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';

import {
  ContractPagedResponse,
  ContractResponse,
  CreateContractDto,
  CreateSlaRuleDto,
  GetContractsQuery,
  SlaRule,
  UpdateContractDto,
  UploadContractFileDto
} from './models/contract.model';
import {
  Accessorial,
  CreateAccessorialDto,
  CreateRateDto,
  GetRatesQuery,
  RatePagedResponse,
  RateResponse,
  UpdateRateDto
} from './models/rate.model';

@Injectable({ providedIn: 'root' })
export class MasterService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ==================== CONTRACTS ====================

  /** GET /api/contracts — paged list with optional carrier / active / search filters. */
  listContracts(query: GetContractsQuery = {}): Observable<ContractPagedResponse> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.carrierId) params = params.set('carrierId', query.carrierId);
    if (typeof query.isActive === 'boolean') params = params.set('isActive', String(query.isActive));
    if (query.search) params = params.set('search', query.search);

    return this.http
      .get<ApiResponse<ContractPagedResponse>>(`${this.base}/api/contracts`, { params })
      .pipe(map((r) => r.data ?? this.emptyContracts()));
  }

  /** GET /api/contracts/{id} — full contract incl. SLA rules. */
  getContract(id: string): Observable<ContractResponse> {
    return this.http
      .get<ApiResponse<ContractResponse>>(`${this.base}/api/contracts/${id}`)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/contracts — create a new contract. */
  createContract(dto: CreateContractDto): Observable<ContractResponse> {
    return this.http
      .post<ApiResponse<ContractResponse>>(`${this.base}/api/contracts`, dto)
      .pipe(map((r) => r.data!));
  }

  /**
   * POST /api/contracts/{id}/upload — register a contract PDF.
   *
   * Backend takes JSON metadata only ({ filePath }). Frontend builds a real
   * FormData object from the picked file (so the picker UX is the File API
   * end-to-end), then derives a deterministic filePath and POSTs JSON.
   */
  uploadContractFile(id: string, file: File): Observable<ContractResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const filePath = this.buildContractFilePath(id, file.name);
    const dto: UploadContractFileDto = { filePath };

    return this.http
      .post<ApiResponse<ContractResponse>>(`${this.base}/api/contracts/${id}/upload`, dto)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/contracts/{id}/sla — add an SLA rule. */
  addSlaRule(contractId: string, dto: CreateSlaRuleDto): Observable<SlaRule> {
    return this.http
      .post<ApiResponse<SlaRule>>(`${this.base}/api/contracts/${contractId}/sla`, dto)
      .pipe(map((r) => r.data!));
  }

  /** PUT /api/contracts/{id} — update name / active flag. */
  updateContract(id: string, dto: UpdateContractDto): Observable<ContractResponse> {
    return this.http
      .put<ApiResponse<ContractResponse>>(`${this.base}/api/contracts/${id}`, dto)
      .pipe(map((r) => r.data!));
  }

  // ==================== RATES ====================

  /** GET /api/rates — paged list with carrier / lane / activeOnly filters. */
  listRates(query: GetRatesQuery = {}): Observable<RatePagedResponse> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.carrierId) params = params.set('carrierId', query.carrierId);
    if (query.origin) params = params.set('origin', query.origin);
    if (query.destination) params = params.set('destination', query.destination);
    if (query.serviceType) params = params.set('serviceType', query.serviceType);
    if (typeof query.activeOnly === 'boolean') params = params.set('activeOnly', String(query.activeOnly));

    return this.http
      .get<ApiResponse<RatePagedResponse>>(`${this.base}/api/rates`, { params })
      .pipe(map((r) => r.data ?? this.emptyRates()));
  }

  /** GET /api/rates/{id} — full rate incl. accessorials. */
  getRate(id: string): Observable<RateResponse> {
    return this.http
      .get<ApiResponse<RateResponse>>(`${this.base}/api/rates/${id}`)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/rates — create a new rate. */
  createRate(dto: CreateRateDto): Observable<RateResponse> {
    return this.http
      .post<ApiResponse<RateResponse>>(`${this.base}/api/rates`, dto)
      .pipe(map((r) => r.data!));
  }

  /** POST /api/rates/{id}/accessorials — add an accessorial charge to a rate. */
  addAccessorial(rateId: string, dto: CreateAccessorialDto): Observable<Accessorial> {
    return this.http
      .post<ApiResponse<Accessorial>>(`${this.base}/api/rates/${rateId}/accessorials`, dto)
      .pipe(map((r) => r.data!));
  }

  /** PUT /api/rates/{id} — update rate values / lane / dates. */
  updateRate(id: string, dto: UpdateRateDto): Observable<RateResponse> {
    return this.http
      .put<ApiResponse<RateResponse>>(`${this.base}/api/rates/${id}`, dto)
      .pipe(map((r) => r.data!));
  }

  // ==================== INTERNAL ====================

  private buildContractFilePath(contractId: string, fileName: string): string {
    const safeName = fileName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hasPdf = /\.pdf$/i.test(safeName);
    const finalName = hasPdf ? safeName : `${safeName}.pdf`;
    return `contracts/${contractId}/${stamp}-${finalName}`;
  }

  private emptyContracts(): ContractPagedResponse {
    return { items: [], totalCount: 0, page: 1, pageSize: 20 };
  }

  private emptyRates(): RatePagedResponse {
    return { items: [], totalCount: 0, page: 1, pageSize: 20 };
  }
}
