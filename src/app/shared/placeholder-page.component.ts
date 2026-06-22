import { Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PermissionsService } from '../core/services/permissions.service';

/**
 * Generic "module landing" placeholder used by feature stubs until real screens
 * are built. Renders the module's name, an AI-themed banner, and the granted
 * actions for the current user (View / Create / Edit / Delete).
 */
@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <div class="hero">
        <span class="eyebrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/>
          </svg>
          {{ moduleCode }}
        </span>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>

      <div class="cards">
        <div class="card">
          <h3>Your access</h3>
          <p class="muted">Permissions inherited from your role on this module.</p>
          <ul class="flags">
            <li class="flag" [class.on]="permission()?.canView">
              <span class="flag-dot"></span> View
            </li>
            <li class="flag" [class.on]="permission()?.canCreate">
              <span class="flag-dot"></span> Create
            </li>
            <li class="flag" [class.on]="permission()?.canEdit">
              <span class="flag-dot"></span> Edit
            </li>
            <li class="flag" [class.on]="permission()?.canDelete">
              <span class="flag-dot"></span> Delete
            </li>
          </ul>
        </div>

        <div class="card ai-card">
          <div class="ai-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 L13.8 8.2 L20 10 L13.8 11.8 L12 18 L10.2 11.8 L4 10 L10.2 8.2 Z"/>
            </svg>
          </div>
          <h3>AI agent ready</h3>
          <p class="muted">
            Once your data is connected, the LEVO AI agent will surface insights for
            <strong>{{ title }}</strong> right here — anomalies, recommendations, and
            actions you can take in one click.
          </p>
          <button type="button" class="btn-ghost" disabled>Connect data source</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page { display: flex; flex-direction: column; gap: 22px; }

    .hero {
      padding: 28px 30px;
      border-radius: var(--radius-lg);
      background: var(--gradient-brand);
      color: #fff;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }
    .hero::after {
      content: "";
      position: absolute;
      width: 320px; height: 320px;
      border-radius: 50%;
      top: -160px; right: -120px;
      background: radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
      background: rgba(255,255,255,0.18);
      padding: 5px 12px; border-radius: 999px;
      margin-bottom: 10px;
      backdrop-filter: blur(6px);
    }
    .eyebrow svg { animation: sparkle 2.6s ease-in-out infinite; }
    @keyframes sparkle {
      0%, 100% { transform: rotate(0deg) scale(1); }
      50%      { transform: rotate(15deg) scale(1.18); }
    }
    .hero h1 { margin: 0 0 6px; font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
    .hero p  { margin: 0; color: rgba(255,255,255,0.92); font-size: 14px; max-width: 640px; }

    .cards {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) 2fr;
      gap: 18px;
    }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 22px 24px;
      box-shadow: var(--shadow-xs);
    }
    .card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: var(--color-text); }
    .muted { color: var(--color-text-muted); font-size: 13px; margin: 0 0 14px; line-height: 1.5; }

    .flags {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 8px;
    }
    .flag {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 13px; font-weight: 500;
      color: var(--color-text-muted);
    }
    .flag.on {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      border-color: var(--color-primary-200);
      font-weight: 600;
    }
    .flag-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #d1d5db;
    }
    .flag.on .flag-dot { background: #10b981; }

    .ai-card {
      background: linear-gradient(135deg, #ffffff, #f0f9ff);
      border-color: var(--color-primary-100);
      position: relative;
      overflow: hidden;
    }
    .ai-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: var(--gradient-brand);
    }
    .ai-mark {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: var(--gradient-brand);
      color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.32);
      margin-bottom: 12px;
    }
    .ai-mark svg { animation: sparkle 2.6s ease-in-out infinite; }

    .btn-ghost {
      background: var(--color-primary-50);
      border: 1px solid var(--color-primary-200);
      color: var(--color-primary-700);
      padding: 10px 14px;
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-md);
    }
    .btn-ghost:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    @media (max-width: 880px) {
      .cards { grid-template-columns: 1fr; }
    }
  `]
})
export class PlaceholderPageComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input({ required: true }) moduleCode!: string;

  private readonly perms = inject(PermissionsService);

  readonly permission = computed(() =>
    this.perms.permissions().find((p) => p.moduleCode === this.moduleCode) ?? null
  );
}
