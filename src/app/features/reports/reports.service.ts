import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';

import { PenaltyReport, PerformanceReport, SummaryReport } from './models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /api/reports/summary */
  getSummary(): Observable<SummaryReport> {
    return this.http
      .get<ApiResponse<SummaryReport>>(`${this.base}/api/reports/summary`)
      .pipe(map((r) => r.data!));
  }

  /** GET /api/reports/performance */
  getPerformance(): Observable<PerformanceReport> {
    return this.http
      .get<ApiResponse<PerformanceReport>>(`${this.base}/api/reports/performance`)
      .pipe(map((r) => r.data!));
  }

  /** GET /api/reports/penalties */
  getPenalties(): Observable<PenaltyReport> {
    return this.http
      .get<ApiResponse<PenaltyReport>>(`${this.base}/api/reports/penalties`)
      .pipe(map((r) => r.data!));
  }
}
