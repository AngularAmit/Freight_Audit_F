import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { LogoComponent } from '../logo.component';
import { PermissionsService } from '../../core/services/permissions.service';

interface SidebarItem {
  label: string;
  route: string;
  iconKey: IconKey;
  alwaysVisible?: boolean;
  /** Module code from backend; if undefined the item is always visible. */
  moduleCode?: string;
  badge?: string;
}

type IconKey = 'home' | 'shield' | 'truck' | 'database' | 'invoice' | 'reports' | 'ai';

/**
 * Static catalogue of the supported sidebar items. The sidebar renders
 * `alwaysVisible` items unconditionally and other items only if the
 * permissions service reports `canView=true` for their module code.
 */
const SIDEBAR_CATALOGUE: SidebarItem[] = [
  { label: 'Dashboard',          route: '/dashboard',    iconKey: 'home',     alwaysVisible: true },
  { label: 'Admin',              route: '/admin',        iconKey: 'shield',   moduleCode: 'ADMIN' },
  { label: 'Carrier Onboarding', route: '/carriers',     iconKey: 'truck',    moduleCode: 'CARRIER' },
  { label: 'Master',             route: '/masters',      iconKey: 'database', moduleCode: 'MASTER' },
  { label: 'Transactions',       route: '/transactions', iconKey: 'invoice',  moduleCode: 'TRANSACTION' },
  { label: 'Reports',            route: '/reports',      iconKey: 'reports',  moduleCode: 'REPORT' }
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <aside class="sidebar">
      <div class="brand">
        <app-logo variant="lockup" tone="color" [size]="36"></app-logo>
      </div>

      <nav class="nav" aria-label="Primary">
        <p class="nav-section">Navigation</p>

        @for (item of items(); track item.route) {
          <a class="nav-item"
             [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: false }">
            <span class="nav-icon" [innerHTML]="iconHtml(item.iconKey)"></span>
            <span class="nav-label">{{ item.label }}</span>
            @if (item.badge) {
              <span class="nav-pill">{{ item.badge }}</span>
            }
          </a>
        }

        @if (items().length === 1) {
          <p class="nav-empty">No modules assigned to your role yet.</p>
        }
      </nav>

      <div class="sidebar-footer">
        <span class="ai-status">
          <span class="dot"></span>
          AI Engine · Online
        </span>
        <small>&copy; {{ year }} LEVO Services Pvt. Ltd.</small>
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; }

    .sidebar {
      width: 248px;
      background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
      border-right: 1px solid var(--color-border);
      padding: 22px 16px;
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
    }

    .brand {
      padding: 0 6px 18px;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 14px;
    }

    .nav { display: flex; flex-direction: column; gap: 2px; }

    .nav-section {
      margin: 4px 8px 8px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--color-text-subtle);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
    }
    .nav-item:hover {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      text-decoration: none;
    }
    .nav-item.active {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      font-weight: 600;
    }
    .nav-item.active .nav-icon { color: var(--color-primary-600); }

    .nav-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      color: var(--color-text-subtle);
      flex-shrink: 0;
    }
    .nav-label { flex: 1; }

    .nav-pill {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.6px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--gradient-brand);
      color: #fff;
    }

    .nav-empty {
      margin: 6px 12px;
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.4;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 10px 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: var(--color-text-subtle);
      font-size: 11px;
      letter-spacing: 0.3px;
    }
    .ai-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--color-primary-700);
    }
    .ai-status .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
      animation: pulseDot 2s ease-out infinite;
    }
    @keyframes pulseDot {
      0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
      80%  { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    @media (max-width: 980px) {
      .sidebar { display: none; }
    }
  `]
})
export class SidebarComponent {
  private readonly perms = inject(PermissionsService);
  readonly year = new Date().getFullYear();

  readonly items = computed<SidebarItem[]>(() => {
    const viewable = new Set(this.perms.viewableModuleCodes());
    return SIDEBAR_CATALOGUE.filter(
      (item) => item.alwaysVisible || (item.moduleCode && viewable.has(item.moduleCode))
    );
  });

  iconHtml(name: IconKey): string {
    const base = `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    switch (name) {
      case 'home':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5z"/></svg>`;
      case 'shield':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;
      case 'truck':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><rect x="1" y="6" width="13" height="11" rx="2"/><path d="M14 9h4l3 4v4h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>`;
      case 'database':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></svg>`;
      case 'invoice':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`;
      case 'reports':
        return `<svg width="18" height="18" viewBox="0 0 24 24" ${base}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
      case 'ai':
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/></svg>`;
    }
  }
}
