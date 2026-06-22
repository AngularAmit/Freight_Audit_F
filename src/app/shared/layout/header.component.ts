import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <h1 class="page-title">{{ pageTitle() }}</h1>
        @if (pageSubtitle()) {
          <p class="page-subtitle">{{ pageSubtitle() }}</p>
        }
      </div>

      <div class="search">
        <span class="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input type="text" placeholder="Ask AI or search invoices, carriers, shipments…" />
        <span class="search-key">⌘K</span>
      </div>

      <div class="topbar-right">
        <span class="ai-pill" title="The AI engine is monitoring your data">
          <span class="dot"></span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/>
          </svg>
          AI Engine
        </span>

        <div class="user-area" (click)="toggleMenu()" tabindex="0"
             (keydown.enter)="toggleMenu()" (keydown.escape)="closeMenu()">
          @if (auth.currentUser(); as user) {
            <div class="user-meta">
              <span class="user-name">{{ user.name }}</span>
              <span class="user-role">{{ user.role }}</span>
            </div>
            <div class="avatar" [title]="user.name">{{ initials() }}</div>
          }
          <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>

          @if (menuOpen()) {
            <div class="user-menu" (click)="$event.stopPropagation()">
              @if (auth.currentUser(); as user) {
                <div class="user-menu__head">
                  <div class="avatar avatar--lg">{{ initials() }}</div>
                  <div>
                    <strong>{{ user.name }}</strong>
                    <span>{{ user.email }}</span>
                  </div>
                </div>
              }
              <div class="user-menu__divider"></div>
              <button type="button" class="menu-item" (click)="closeMenu(); auth.logout()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }

    .topbar {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
      padding: 12px 28px;
      display: flex;
      align-items: center;
      gap: 18px;
      position: sticky;
      top: 0;
      z-index: 5;
    }

    .topbar-left { min-width: 0; flex-shrink: 0; }
    .page-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.2px;
    }
    .page-subtitle {
      margin: 1px 0 0;
      font-size: 11.5px;
      color: var(--color-text-muted);
    }

    .search {
      flex: 1;
      max-width: 480px;
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      padding: 0 14px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .search:focus-within {
      background: #fff;
      border-color: var(--color-primary-400);
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
    }
    .search-icon { color: var(--color-text-subtle); display: inline-flex; }
    .search input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--color-text);
    }
    .search input::placeholder { color: var(--color-text-subtle); }
    .search-key {
      font-size: 10.5px; font-weight: 600; color: var(--color-text-subtle);
      padding: 3px 6px; border: 1px solid var(--color-border); border-radius: 6px; background: #fff;
    }

    .topbar-right { display: flex; align-items: center; gap: 14px; margin-left: auto; }

    .ai-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 999px;
      font-size: 11.5px; font-weight: 700; letter-spacing: 0.4px;
      background: linear-gradient(135deg, var(--color-primary-50), #e0f2fe);
      border: 1px solid var(--color-primary-100);
      color: var(--color-primary-700);
    }
    .ai-pill .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
      animation: pulseDot 2s ease-out infinite;
    }
    @keyframes pulseDot {
      0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
      80%  { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .user-area {
      position: relative;
      display: flex; align-items: center; gap: 10px;
      padding: 4px 8px 4px 10px;
      border-radius: var(--radius-md);
      cursor: pointer;
      outline: none;
      transition: background 0.15s var(--ease-out);
    }
    .user-area:hover { background: var(--color-surface-2); }
    .user-area:focus { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18); }

    .user-meta { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; }
    .user-name { font-size: 13px; font-weight: 600; color: var(--color-text); }
    .user-role { font-size: 11.5px; color: var(--color-text-muted); }

    .avatar {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600;
      box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
    }
    .avatar--lg { width: 44px; height: 44px; font-size: 15px; }

    .chev { color: var(--color-text-subtle); }

    .user-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      min-width: 240px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: 12px;
      z-index: 20;
      animation: menuIn 0.16s var(--ease-out);
    }
    @keyframes menuIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .user-menu__head {
      display: flex; align-items: center; gap: 10px; padding: 4px 6px 10px;
      strong { display: block; font-size: 13px; color: var(--color-text); }
      span { display: block; font-size: 12px; color: var(--color-text-muted); }
    }
    .user-menu__divider { height: 1px; background: var(--color-border); margin: 4px 0 8px; }
    .menu-item {
      display: flex; align-items: center; gap: 8px;
      width: 100%;
      padding: 8px 10px;
      background: transparent;
      color: var(--color-text);
      font-size: 13px; font-weight: 500;
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-align: left;
    }
    .menu-item:hover {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
    }

    @media (max-width: 980px) {
      .topbar { padding: 12px 16px; }
    }
    @media (max-width: 720px) {
      .ai-pill { display: none; }
      .search-key { display: none; }
    }
    @media (max-width: 640px) {
      .search { display: none; }
      .user-meta { display: none; }
    }
  `]
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);

  /** Reads `data.title` and `data.subtitle` from the deepest matching child route. */
  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentRouteData())
    ),
    { initialValue: {} as { title?: string; subtitle?: string } }
  );

  readonly pageTitle = computed(() => this.routeData()['title'] ?? 'Dashboard');
  readonly pageSubtitle = computed(() => this.routeData()['subtitle'] ?? '');

  readonly initials = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return '';
    const parts = u.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || u.email[0].toUpperCase();
  });

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  private currentRouteData(): { title?: string; subtitle?: string } {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route?.firstChild) {
      route = route.firstChild;
    }

    return route?.data ?? {};
  }
}
