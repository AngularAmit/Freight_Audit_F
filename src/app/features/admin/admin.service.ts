import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/auth/models/api-response.model';
import { Permission } from '../../core/auth/models/permission.model';

import {
  User,
  CreateUserDto,
  UpdateUserDto,
  GetUsersQuery
} from './models/user.model';
import {
  Role,
  ModuleInfo,
  UpdatePermissionsDto
} from './models/role.model';
import { PagedResult } from './models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Cached module catalogue (id + code + name) — built from union across all roles. */
  private moduleCatalogueCache: ModuleInfo[] | null = null;

  // ============ USERS ============

  getUsers(query: GetUsersQuery = {}): Observable<PagedResult<User>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.search) params = params.set('search', query.search);

    return this.http
      .get<ApiResponse<PagedResult<User>>>(`${this.base}/api/users`, { params })
      .pipe(map((r) => r.data ?? this.emptyPage()));
  }

  createUser(dto: CreateUserDto): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(`${this.base}/api/users`, dto)
      .pipe(map((r) => r.data!));
  }

  updateUser(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http
      .put<ApiResponse<User>>(`${this.base}/api/users/${id}`, dto)
      .pipe(map((r) => r.data!));
  }

  deleteUser(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/api/users/${id}`)
      .pipe(map(() => void 0));
  }

  // ============ ROLES ============

  getRoles(): Observable<Role[]> {
    return this.http
      .get<ApiResponse<Role[]>>(`${this.base}/api/roles`)
      .pipe(map((r) => r.data ?? []));
  }

  // ============ PERMISSIONS ============

  getPermissions(roleId: string): Observable<Permission[]> {
    return this.http
      .get<ApiResponse<Permission[]>>(`${this.base}/api/permissions/${roleId}`)
      .pipe(map((r) => r.data ?? []));
  }

  updatePermissions(roleId: string, dto: UpdatePermissionsDto): Observable<void> {
    return this.http
      .put<ApiResponse<void>>(`${this.base}/api/permissions/${roleId}`, dto)
      .pipe(map(() => void 0));
  }

  /**
   * Returns the catalogue of every module known to the system. Computed lazily
   * by union-ing modules across all roles' permissions. Cached for the session.
   */
  getModuleCatalogue(force: boolean = false): Observable<ModuleInfo[]> {
    if (!force && this.moduleCatalogueCache) {
      return of(this.moduleCatalogueCache);
    }

    return this.getRoles().pipe(
      switchMap((roles) => {
        if (roles.length === 0) return of([] as Permission[][]);
        return forkJoin(
          roles.map((r) =>
            this.getPermissions(r.id).pipe(catchError(() => of([] as Permission[])))
          )
        );
      }),
      map((permsByRole) => {
        const unique = new Map<string, ModuleInfo>();
        for (const list of permsByRole) {
          for (const p of list) {
            if (p.moduleId && !unique.has(p.moduleId)) {
              unique.set(p.moduleId, {
                id: p.moduleId,
                code: p.moduleCode,
                name: p.moduleName
              });
            }
          }
        }
        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
      }),
      tap((catalogue) => (this.moduleCatalogueCache = catalogue))
    );
  }

  invalidateCatalogue(): void {
    this.moduleCatalogueCache = null;
  }

  private emptyPage(): PagedResult<User> {
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
