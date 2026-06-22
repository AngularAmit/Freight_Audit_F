import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from './models/api-response.model';
import { LoginRequest } from './models/login-request.model';
import { LoginResponse, UserInfo } from './models/login-response.model';
import { PermissionsService } from '../services/permissions.service';

const TOKEN_KEY = 'fa.auth.token';
const EXPIRES_KEY = 'fa.auth.expiresAt';
const USER_KEY = 'fa.auth.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);

  private readonly _currentUser = signal<UserInfo | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  constructor() {
    this.clearStoredSession();
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    const url = `${environment.apiBaseUrl}/api/auth/login`;
    return this.http.post<ApiResponse<LoginResponse>>(url, request).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Login failed.');
        }
        return res.data;
      }),
      tap((data) => this.persistSession(data))
    );
  }

  logout(redirect: boolean = true): void {
    this.clearStoredSession();

    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  clearStoredSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
    this.permissions.clear();
    this._currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    if (!token || !expiresAt) return false;

    return new Date(expiresAt).getTime() > Date.now();
  }

  private persistSession(data: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(EXPIRES_KEY, data.expiresAt);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    this.permissions.setPermissions(data.permissions ?? []);
    this._currentUser.set(data.user);
  }

}
