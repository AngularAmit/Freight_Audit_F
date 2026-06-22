import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, finalize, firstValueFrom } from 'rxjs';

import { AdminService } from '../admin.service';
import { Role } from '../models/role.model';
import { User, GetUsersQuery } from '../models/user.model';
import { PagedResult } from '../models/paged-result.model';
import { ToastService } from '../../../shared/services/toast.service';
import { UserFormComponent } from './user-form.component';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { ExcelExportService } from '../../../shared/services/excel-export.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe, UserFormComponent],
  template: `
    <section class="user-list">
      <header class="toolbar">
        <div class="filters">
          <div class="search">
            <span class="search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input type="text" placeholder="Search by name or email…" [formControl]="searchCtrl" />
            @if (searchCtrl.value) {
              <button class="clear" (click)="searchCtrl.setValue('')" aria-label="Clear search">×</button>
            }
          </div>

          <select class="role-filter" [formControl]="roleFilterCtrl">
            <option value="">All roles</option>
            @for (r of roles(); track r.id) {
              <option [value]="r.id">{{ r.name }}</option>
            }
          </select>
        </div>

        <div class="actions">
          <button type="button" class="btn-secondary"
                  (click)="exportToExcel()"
                  [disabled]="exporting() || loading() || page().totalCount === 0"
                  [title]="'Export ' + page().totalCount + ' users to Excel'">
            @if (exporting()) {
              <span class="spinner" aria-hidden="true"></span>
              Exporting…
            } @else {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export to Excel
            }
          </button>

          <button type="button" class="btn-primary" (click)="openCreate()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add user
          </button>
        </div>
      </header>

      <div class="table-wrap">
        <table class="users">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="5" class="state-row">Loading users…</td></tr>
            } @else if (page().items.length === 0) {
              <tr><td colspan="5" class="state-row state-empty">
                <strong>No users found.</strong>
                <span>Try changing your search or filter.</span>
              </td></tr>
            } @else {
              @for (u of page().items; track u.id) {
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="avatar">{{ initials(u) }}</div>
                      <div class="meta">
                        <strong>{{ u.name }}</strong>
                        <span>{{ u.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="role-tag">{{ u.roleName }}</span></td>
                  <td>
                    <span class="status" [class.status--off]="!u.isActive">
                      <span class="dot"></span>
                      {{ u.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="muted">{{ u.createdAt | date: 'mediumDate' }}</td>
                  <td class="actions-col">
                    <button class="icon-btn" title="Edit" (click)="openEdit(u)">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button class="icon-btn icon-btn--danger" title="Delete" (click)="deleteUser(u)">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6M14 11v6"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (page().totalPages > 1) {
        <footer class="pager">
          <span class="muted">
            Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ page().totalCount }}
          </span>
          <div class="pager-buttons">
            <button class="btn-page" [disabled]="!page().hasPreviousPage" (click)="goTo(page().page - 1)">
              ← Prev
            </button>
            <span class="page-indicator">Page {{ page().page }} / {{ page().totalPages }}</span>
            <button class="btn-page" [disabled]="!page().hasNextPage" (click)="goTo(page().page + 1)">
              Next →
            </button>
          </div>
        </footer>
      }
    </section>

    <app-user-form
      [open]="formOpen()"
      [user]="editingUser()"
      [roles]="roles()"
      (close)="closeForm()"
      (saved)="onSaved()">
    </app-user-form>
  `,
  styles: [`
    :host { display: block; }
    .user-list {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }

    .filters { display: flex; gap: 10px; flex: 1; min-width: 0; }

    .search {
      flex: 1;
      max-width: 360px;
      display: flex; align-items: center; gap: 8px;
      height: 38px; padding: 0 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .search:focus-within {
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
    }
    .search-icon { color: var(--color-text-subtle); display: inline-flex; }
    .search input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--color-text);
    }
    .search input::placeholder { color: var(--color-text-subtle); }
    .clear {
      background: transparent; color: var(--color-text-subtle);
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      font-size: 18px; line-height: 1;
    }
    .clear:hover { background: var(--color-surface-2); color: var(--color-text); }

    .role-filter {
      height: 38px; padding: 0 12px; min-width: 160px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px;
      color: var(--color-text);
    }
    .role-filter:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }

    .actions { display: flex; align-items: center; gap: 10px; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: var(--gradient-brand);
      color: #fff; font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover { filter: brightness(1.05); }

    .btn-secondary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px;
      background: #fff;
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-200);
      font-size: 13.5px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-primary-50);
      border-color: var(--color-primary-300);
    }
    .btn-secondary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(59, 130, 246, 0.25);
      border-top-color: var(--color-primary-600);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .table-wrap { overflow-x: auto; }
    table.users {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.users thead th {
      text-align: left;
      padding: 11px 18px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: #fff;
      border-bottom: 1px solid var(--color-border);
      position: sticky; top: 0;
    }
    table.users tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      vertical-align: middle;
    }
    table.users tbody tr:hover { background: var(--color-primary-50); }
    table.users tbody tr:last-child td { border-bottom: none; }

    .actions-col { width: 110px; text-align: right; }

    .state-row {
      text-align: center;
      padding: 28px 18px !important;
      color: var(--color-text-muted);
    }
    .state-empty strong { display: block; color: var(--color-text); margin-bottom: 4px; }
    .state-empty span { font-size: 12.5px; }

    .user-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: #fff;
      font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3);
    }
    .meta { display: flex; flex-direction: column; line-height: 1.25; }
    .meta strong { font-size: 13.5px; color: var(--color-text); font-weight: 600; }
    .meta span { font-size: 12px; color: var(--color-text-muted); }

    .role-tag {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border: 1px solid var(--color-primary-100);
      letter-spacing: 0.3px;
    }

    .status {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      color: #047857;
    }
    .status .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #10b981;
    }
    .status--off { color: var(--color-text-muted); }
    .status--off .dot { background: #d1d5db; }

    .muted { color: var(--color-text-muted); font-size: 12.5px; }

    .icon-btn {
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
      margin-left: 4px;
    }
    .icon-btn:hover { background: var(--color-surface-2); color: var(--color-primary-700); }
    .icon-btn--danger:hover { color: var(--color-error); background: var(--color-error-bg); }

    .pager {
      display: flex; align-items: center; justify-content: space-between;
      gap: 14px;
      padding: 12px 18px;
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .pager-buttons { display: flex; align-items: center; gap: 8px; }
    .btn-page {
      padding: 6px 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 12.5px; font-weight: 500;
      border-radius: var(--radius-sm);
    }
    .btn-page:hover:not(:disabled) {
      border-color: var(--color-primary-300);
      color: var(--color-primary-700);
      background: var(--color-primary-50);
    }
    .page-indicator { font-size: 12px; color: var(--color-text-muted); }

    @media (max-width: 720px) {
      .toolbar { flex-direction: column; align-items: stretch; }
      .filters { flex-direction: column; }
      .search, .role-filter { max-width: none; min-width: 0; }
    }
  `]
})
export class UserListComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly excel = inject(ExcelExportService);

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  readonly roleFilterCtrl = new FormControl<string>('', { nonNullable: true });

  readonly roles = signal<Role[]>([]);
  readonly page = signal<PagedResult<User>>({
    items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0,
    hasNextPage: false, hasPreviousPage: false
  });
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly formOpen = signal(false);
  readonly editingUser = signal<User | null>(null);

  readonly rangeStart = computed(() => {
    const p = this.page();
    if (p.totalCount === 0) return 0;
    return (p.page - 1) * p.pageSize + 1;
  });
  readonly rangeEnd = computed(() => {
    const p = this.page();
    return Math.min(p.page * p.pageSize, p.totalCount);
  });

  ngOnInit(): void {
    this.admin.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => this.toast.error('Could not load roles.')
    });

    this.searchCtrl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.fetch(1));

    this.roleFilterCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => this.fetch(1));

    this.fetch(1);
  }

  fetch(page: number = this.page().page): void {
    this.loading.set(true);
    const q = {
      page,
      pageSize: this.page().pageSize || 10,
      search: this.searchCtrl.value.trim() || undefined,
      roleId: this.roleFilterCtrl.value || undefined
    };
    this.admin.getUsers(q).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (p) => this.page.set(p),
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not load users.');
      }
    });
  }

  goTo(p: number): void {
    if (p < 1 || p > this.page().totalPages) return;
    this.fetch(p);
  }

  openCreate(): void {
    this.editingUser.set(null);
    this.formOpen.set(true);
  }
  openEdit(u: User): void {
    this.editingUser.set(u);
    this.formOpen.set(true);
  }
  closeForm(): void {
    this.formOpen.set(false);
    this.editingUser.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.fetch(this.page().page);
  }

  deleteUser(u: User): void {
    if (!confirm(`Delete user "${u.name}"?\n\nThis action cannot be undone.`)) return;

    this.admin.deleteUser(u.id).subscribe({
      next: () => {
        this.toast.success(`User "${u.name}" deleted.`);
        const remaining = this.page().items.length - 1;
        this.fetch(remaining === 0 && this.page().page > 1 ? this.page().page - 1 : this.page().page);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not delete user.');
      }
    });
  }

  initials(u: User): string {
    const parts = u.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || u.email[0].toUpperCase();
  }

  async exportToExcel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);

    try {
      const all = await this.fetchAllUsers();
      if (all.length === 0) {
        this.toast.info('No users to export.');
        return;
      }

      const filterParts: string[] = [];
      if (this.searchCtrl.value.trim()) filterParts.push(`search="${this.searchCtrl.value.trim()}"`);
      const roleId = this.roleFilterCtrl.value;
      if (roleId) {
        const roleName = this.roles().find((r) => r.id === roleId)?.name;
        if (roleName) filterParts.push(`role="${roleName}"`);
      }

      this.excel.export(
        all,
        [
          { header: 'Name',       value: (u) => u.name,                                 width: 26 },
          { header: 'Email',      value: (u) => u.email,                                width: 32 },
          { header: 'Role',       value: (u) => u.roleName,                             width: 16 },
          { header: 'Status',     value: (u) => (u.isActive ? 'Active' : 'Inactive'),   width: 12 },
          { header: 'Created at', value: (u) => new Date(u.createdAt),                  width: 22 },
          { header: 'User Id',    value: (u) => u.id,                                   width: 38 }
        ],
        { filename: 'levo-users', sheetName: 'Users' }
      );

      const filterMsg = filterParts.length ? ` (${filterParts.join(', ')})` : '';
      this.toast.success(`Exported ${all.length} user${all.length === 1 ? '' : 's'}${filterMsg}.`);
    } catch (err) {
      const body = (err as HttpErrorResponse)?.error as ApiResponse<unknown> | undefined;
      this.toast.error(body?.message ?? 'Could not export users.');
    } finally {
      this.exporting.set(false);
    }
  }

  /** Fetches every user that matches the current filters across all pages. */
  private async fetchAllUsers(): Promise<User[]> {
    const baseQuery: GetUsersQuery = {
      pageSize: 200,
      search: this.searchCtrl.value.trim() || undefined,
      roleId: this.roleFilterCtrl.value || undefined
    };

    const collected: User[] = [];
    let pageNum = 1;
    while (true) {
      const result = await firstValueFrom(this.admin.getUsers({ ...baseQuery, page: pageNum }));
      collected.push(...result.items);

      if (
        result.items.length === 0 ||
        pageNum >= result.totalPages ||
        collected.length >= result.totalCount
      ) {
        break;
      }
      pageNum++;
    }
    return collected;
  }
}
