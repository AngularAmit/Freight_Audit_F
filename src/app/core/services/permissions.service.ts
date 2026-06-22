import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../auth/models/api-response.model';
import { Permission, PermissionAction } from '../auth/models/permission.model';
import { decodeJwt } from '../auth/jwt.util';

const PERMISSIONS_KEY = 'fa.auth.permissions';
const TOKEN_KEY = 'fa.auth.token';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);

  private readonly _permissions = signal<Permission[]>(this.read());
  /** Reactive signal of all permissions known about the current user. */
  readonly permissions = this._permissions.asReadonly();

  /** Modules the current user can VIEW (used to render the sidebar). */
  readonly viewableModuleCodes = computed(() =>
    this._permissions()
      .filter((p) => p.canView)
      .map((p) => p.moduleCode)
  );

  /** Replace the in-memory + persisted permissions (called by AuthService on login). */
  setPermissions(perms: Permission[]): void {
    const safe = perms ?? [];
    this._permissions.set(safe);
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(safe));
  }

  clear(): void {
    this._permissions.set([]);
    localStorage.removeItem(PERMISSIONS_KEY);
  }

  /** True if the current user has the given action on the module. */
  hasPermission(moduleCode: string, action: PermissionAction = 'canView'): boolean {
    const p = this._permissions().find((x) => x.moduleCode === moduleCode);
    return !!p && !!p[action];
  }

  /**
   * Fetches the latest permissions for the current user's role from the API.
   * Falls back silently to cached permissions if the call fails (e.g. 403 for
   * non-admins who don't have ADMIN.CanView).
   */
  refresh(): Observable<Permission[]> {
    const roleId = this.currentRoleId();
    if (!roleId) return of(this._permissions());

    const url = `${environment.apiBaseUrl}/api/permissions/${roleId}`;
    return this.http.get<ApiResponse<Permission[]>>(url).pipe(
      map((res) => res.data ?? []),
      tap((perms) => this.setPermissions(perms)),
      catchError((err: HttpErrorResponse) => {
        if (err.status !== 401) {
          console.warn('[PermissionsService] Could not refresh from server, using cache:', err.status);
        }
        return of(this._permissions());
      })
    );
  }

  /** Extracts the roleId from the JWT (server adds a "roleId" claim). */
  currentRoleId(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const claims = decodeJwt(token);
    return (claims?.['roleId'] as string) ?? null;
  }

  private read(): Permission[] {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Permission[];
    } catch {
      return [];
    }
  }
}
