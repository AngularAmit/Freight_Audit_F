import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';

import { AdminService } from '../admin.service';
import { Role, ModuleInfo, UpdatePermissionItem } from '../models/role.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';
import { PermissionsService } from '../../../core/services/permissions.service';

interface MatrixRow extends UpdatePermissionItem {
  moduleCode: string;
  moduleName: string;
}

@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <header class="card-head">
        <div>
          <h3>Permission matrix</h3>
          <p>Choose a role and tick the actions each module exposes to it.</p>
        </div>

        <div class="role-picker">
          <label for="role-select">Role</label>
          <select id="role-select" [(ngModel)]="selectedRoleId" (ngModelChange)="onRoleChange($event)">
            <option value="" disabled>Select a role…</option>
            @for (r of roles(); track r.id) {
              <option [value]="r.id">{{ r.name }}</option>
            }
          </select>
        </div>
      </header>

      @if (loading()) {
        <div class="state">Loading permissions…</div>
      } @else if (!selectedRoleId) {
        <div class="state">
          <strong>Pick a role to start editing.</strong>
          <span>Tick a checkbox to grant an action; uncheck to revoke. Changes are saved when you click "Save changes".</span>
        </div>
      } @else if (rows().length === 0) {
        <div class="state">
          <strong>No modules available.</strong>
          <span>Seed the database with at least one module to manage permissions.</span>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th class="module-col">Module</th>
                <th class="check-col">View</th>
                <th class="check-col">Create</th>
                <th class="check-col">Edit</th>
                <th class="check-col">Delete</th>
                <th class="actions-col">Quick</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.moduleId) {
                <tr [class.highlight]="dirty()">
                  <td class="module-col">
                    <strong>{{ row.moduleName }}</strong>
                    <span class="code">{{ row.moduleCode }}</span>
                  </td>
                  <td class="check-col">
                    <label class="cbx">
                      <input type="checkbox" [(ngModel)]="row.canView" (change)="markDirty()" />
                      <span></span>
                    </label>
                  </td>
                  <td class="check-col">
                    <label class="cbx">
                      <input type="checkbox" [(ngModel)]="row.canCreate" (change)="markDirty()" />
                      <span></span>
                    </label>
                  </td>
                  <td class="check-col">
                    <label class="cbx">
                      <input type="checkbox" [(ngModel)]="row.canEdit" (change)="markDirty()" />
                      <span></span>
                    </label>
                  </td>
                  <td class="check-col">
                    <label class="cbx">
                      <input type="checkbox" [(ngModel)]="row.canDelete" (change)="markDirty()" />
                      <span></span>
                    </label>
                  </td>
                  <td class="actions-col">
                    <button class="quick" (click)="setRow(row, true)" title="Grant all">All</button>
                    <button class="quick quick--off" (click)="setRow(row, false)" title="Revoke all">None</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <footer class="card-foot">
          <span class="dirty-label" [class.dirty]="dirty()">
            @if (dirty()) {
              <span class="dot"></span> You have unsaved changes
            } @else {
              <span class="dot dot--idle"></span> All changes saved
            }
          </span>
          <div class="foot-actions">
            <button class="btn-ghost" (click)="reset()" [disabled]="!dirty() || saving()">Discard</button>
            <button class="btn-primary" (click)="save()" [disabled]="!dirty() || saving()">
              @if (saving()) { Saving… } @else { Save changes }
            </button>
          </div>
        </footer>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }

    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--color-border);

      h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--color-text); }
      p  { margin: 2px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    }

    .role-picker {
      display: flex; align-items: center; gap: 10px;
      label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); letter-spacing: 0.4px; text-transform: uppercase; }
      select {
        height: 38px; padding: 0 12px; min-width: 200px;
        background: #fff;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 13.5px;
        color: var(--color-text);
        font-weight: 500;
      }
      select:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }
    }

    .state {
      padding: 32px 22px;
      text-align: center;
      color: var(--color-text-muted);
      strong { display: block; color: var(--color-text); margin-bottom: 4px; }
      span { font-size: 13px; }
    }

    .table-wrap { overflow-x: auto; }

    table.matrix {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    table.matrix thead th {
      text-align: left;
      padding: 11px 18px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-border);
    }
    table.matrix tbody td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      vertical-align: middle;
    }
    table.matrix tbody tr:last-child td { border-bottom: none; }
    table.matrix tbody tr:hover { background: var(--color-primary-50); }

    .module-col {
      strong { display: block; font-size: 13.5px; color: var(--color-text); font-weight: 600; }
      .code  { font-size: 11px; color: var(--color-text-subtle); letter-spacing: 0.4px; text-transform: uppercase; }
    }

    .check-col { width: 90px; text-align: center; }
    thead .check-col { text-align: center; }
    tbody .check-col { padding-left: 0; padding-right: 0; }

    .actions-col { width: 130px; text-align: right; }

    .cbx {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .cbx input { position: absolute; opacity: 0; pointer-events: none; }
    .cbx span {
      width: 20px; height: 20px;
      background: #fff;
      border: 1.5px solid var(--color-border);
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s var(--ease-out), border-color 0.15s var(--ease-out);
      position: relative;
    }
    .cbx input:checked + span {
      background: var(--gradient-brand);
      border-color: var(--color-primary-600);
    }
    .cbx input:checked + span::after {
      content: '';
      width: 5px; height: 9px;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
      transform: translateY(-1px) rotate(45deg);
    }
    .cbx:hover span { border-color: var(--color-primary-400); }

    .quick {
      padding: 4px 8px;
      background: transparent;
      color: var(--color-primary-700);
      font-size: 11px; font-weight: 600;
      border: 1px solid var(--color-primary-200);
      border-radius: 6px;
      margin-left: 4px;
    }
    .quick:hover { background: var(--color-primary-50); }
    .quick--off { color: var(--color-text-muted); border-color: var(--color-border); }
    .quick--off:hover { background: var(--color-surface-2); color: var(--color-text); }

    .card-foot {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      padding: 14px 22px;
      background: var(--color-surface-2);
      border-top: 1px solid var(--color-border);
    }

    .dirty-label {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 500;
      color: var(--color-text-muted);
    }
    .dirty-label.dirty { color: #b45309; }
    .dirty-label .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
      animation: pulseDot 2s ease-out infinite;
    }
    .dirty-label .dot--idle { background: #10b981; animation: none; box-shadow: none; }
    @keyframes pulseDot {
      0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
      80%  { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
      100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }

    .foot-actions { display: flex; gap: 10px; }
    .btn-ghost {
      padding: 8px 14px;
      background: #fff; color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; font-weight: 500;
    }
    .btn-ghost:hover:not(:disabled) { background: var(--color-surface-2); color: var(--color-text); }

    .btn-primary {
      padding: 8px 16px;
      background: var(--gradient-brand);
      color: #fff;
      border: none;
      border-radius: var(--radius-md);
      font-size: 13px; font-weight: 600;
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }
  `]
})
export class PermissionMatrixComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionsService);

  readonly roles = signal<Role[]>([]);
  readonly modules = signal<ModuleInfo[]>([]);
  readonly rows = signal<MatrixRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);

  selectedRoleId: string = '';

  /** Snapshot of the rows when last loaded — used for "Discard". */
  private originalRows = signal<MatrixRow[]>([]);

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      roles: this.admin.getRoles(),
      modules: this.admin.getModuleCatalogue()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ roles, modules }) => {
          this.roles.set(roles);
          this.modules.set(modules);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not load roles or modules.');
        }
      });
  }

  onRoleChange(roleId: string): void {
    if (!roleId) {
      this.rows.set([]);
      this.dirty.set(false);
      return;
    }
    this.loadFor(roleId);
  }

  private loadFor(roleId: string): void {
    this.loading.set(true);
    this.admin.getPermissions(roleId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (perms) => {
        const byModuleId = new Map(perms.map((p) => [p.moduleId!, p]));
        const rows: MatrixRow[] = this.modules().map((m) => {
          const p = byModuleId.get(m.id);
          return {
            moduleId: m.id,
            moduleCode: m.code,
            moduleName: m.name,
            canView: p?.canView ?? false,
            canCreate: p?.canCreate ?? false,
            canEdit: p?.canEdit ?? false,
            canDelete: p?.canDelete ?? false
          };
        });
        this.rows.set(rows);
        this.originalRows.set(structuredClone(rows));
        this.dirty.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiResponse<unknown> | undefined;
        this.toast.error(body?.message ?? 'Could not load permissions.');
      }
    });
  }

  markDirty(): void {
    this.dirty.set(true);
  }

  setRow(row: MatrixRow, on: boolean): void {
    row.canView = on;
    row.canCreate = on;
    row.canEdit = on;
    row.canDelete = on;
    this.markDirty();
  }

  reset(): void {
    this.rows.set(structuredClone(this.originalRows()));
    this.dirty.set(false);
  }

  save(): void {
    if (!this.selectedRoleId || !this.dirty() || this.saving()) return;
    this.saving.set(true);
    const dto = {
      permissions: this.rows().map<UpdatePermissionItem>((r) => ({
        moduleId: r.moduleId,
        canView: r.canView,
        canCreate: r.canCreate,
        canEdit: r.canEdit,
        canDelete: r.canDelete
      }))
    };

    this.admin.updatePermissions(this.selectedRoleId, dto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.originalRows.set(structuredClone(this.rows()));
          this.dirty.set(false);
          this.toast.success('Permissions saved.');

          // If the user just edited their own role, refresh the sidebar permissions.
          const myRoleId = this.permissions.currentRoleId();
          if (myRoleId && myRoleId === this.selectedRoleId) {
            this.permissions.refresh().subscribe();
          }

          this.admin.invalidateCatalogue();
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as ApiResponse<unknown> | undefined;
          this.toast.error(body?.message ?? 'Could not save permissions.');
        }
      });
  }
}
