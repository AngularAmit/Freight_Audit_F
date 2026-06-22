import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserListComponent } from './components/user-list.component';
import { PermissionMatrixComponent } from './components/permission-matrix.component';

type AdminTab = 'users' | 'permissions';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, UserListComponent, PermissionMatrixComponent],
  template: `
    <section class="page">
      <div class="hero">
        <span class="eyebrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/>
          </svg>
          Admin
        </span>
        <h1>Users &amp; Permissions</h1>
        <p>Manage who can access LEVO and what they can do across each module.</p>
      </div>

      <nav class="tabs" role="tablist">
        <button class="tab" role="tab"
                [attr.aria-selected]="activeTab() === 'users'"
                [class.active]="activeTab() === 'users'"
                (click)="activeTab.set('users')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Users
        </button>

        <button class="tab" role="tab"
                [attr.aria-selected]="activeTab() === 'permissions'"
                [class.active]="activeTab() === 'permissions'"
                (click)="activeTab.set('permissions')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
          Permissions
        </button>
      </nav>

      <div class="tab-panel">
        @if (activeTab() === 'users') {
          <app-user-list></app-user-list>
        } @else {
          <app-permission-matrix></app-permission-matrix>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .page { display: flex; flex-direction: column; gap: 22px; }

    .hero {
      padding: 24px 28px;
      border-radius: var(--radius-lg);
      background: var(--gradient-brand);
      color: #fff;
      position: relative; overflow: hidden;
      box-shadow: var(--shadow-md);
    }
    .hero::after {
      content: ""; position: absolute;
      width: 320px; height: 320px; border-radius: 50%;
      top: -160px; right: -120px;
      background: radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
      background: rgba(255,255,255,0.18);
      padding: 5px 12px; border-radius: 999px;
      margin-bottom: 8px;
      backdrop-filter: blur(6px);
    }
    .eyebrow svg { animation: sparkle 2.6s ease-in-out infinite; }
    @keyframes sparkle {
      0%, 100% { transform: rotate(0deg) scale(1); }
      50%      { transform: rotate(15deg) scale(1.18); }
    }
    .hero h1 { margin: 0 0 4px; font-size: 24px; font-weight: 700; letter-spacing: -0.4px; }
    .hero p  { margin: 0; color: rgba(255,255,255,0.92); font-size: 14px; max-width: 640px; }

    .tabs {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      width: fit-content;
      box-shadow: var(--shadow-xs);
    }
    .tab {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
    }
    .tab:hover { color: var(--color-text); }
    .tab.active {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
    }
    .tab.active svg { color: var(--color-primary-600); }
  `]
})
export class AdminComponent {
  readonly activeTab = signal<AdminTab>('users');
}
