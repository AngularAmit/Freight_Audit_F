import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContractListComponent } from './components/contract-list.component';
import { RateListComponent } from './components/rate-list.component';

type MasterTab = 'contracts' | 'rates';

@Component({
  selector: 'app-masters',
  standalone: true,
  imports: [CommonModule, ContractListComponent, RateListComponent],
  template: `
    <section class="page">
      <header class="hero">
        <div class="hero-text">
          <span class="eyebrow">Master Data</span>
          <h1>Contracts & rates</h1>
          <p>Source-of-truth for carrier contracts, SLA rules, lane rates and accessorial charges —
             consumed by the AI audit engine.</p>
        </div>

        <div class="hero-illustration" aria-hidden="true">
          <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
            <rect x="6" y="10" width="56" height="60" rx="6" fill="#fff" stroke="#bfdbfe" stroke-width="1.5"/>
            <line x1="14" y1="22" x2="50" y2="22" stroke="#bfdbfe" stroke-width="2" stroke-linecap="round"/>
            <line x1="14" y1="32" x2="44" y2="32" stroke="#dbeafe" stroke-width="2" stroke-linecap="round"/>
            <line x1="14" y1="42" x2="50" y2="42" stroke="#dbeafe" stroke-width="2" stroke-linecap="round"/>
            <line x1="14" y1="52" x2="36" y2="52" stroke="#dbeafe" stroke-width="2" stroke-linecap="round"/>
            <rect x="60" y="22" width="54" height="48" rx="6" fill="url(#g1)" opacity="0.92"/>
            <text x="68" y="46" font-family="ui-sans-serif, system-ui" font-size="13" font-weight="700" fill="#fff">RATE</text>
            <text x="68" y="60" font-family="ui-monospace, monospace" font-size="9" fill="rgba(255,255,255,0.85)">CWT/FLAT</text>
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#2563eb"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <nav class="tabs" role="tablist">
        <button type="button" role="tab"
                [class.is-active]="tab() === 'contracts'"
                (click)="tab.set('contracts')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Contracts
        </button>
        <button type="button" role="tab"
                [class.is-active]="tab() === 'rates'"
                (click)="tab.set('rates')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="16"></line>
          </svg>
          Rates
        </button>
      </nav>

      @switch (tab()) {
        @case ('contracts') { <app-contract-list></app-contract-list> }
        @case ('rates')     { <app-rate-list></app-rate-list> }
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .page { display: flex; flex-direction: column; gap: 18px; }

    .hero {
      position: relative;
      padding: 22px 26px;
      background: var(--gradient-brand-soft);
      border: 1px solid var(--color-primary-100);
      border-radius: var(--radius-lg);
      display: flex; align-items: center; justify-content: space-between; gap: 22px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(circle at 92% 12%, rgba(59,130,246,0.18), transparent 60%);
      pointer-events: none;
    }
    .hero-text { position: relative; max-width: 600px; }
    .eyebrow {
      display: inline-block;
      font-size: 11px; font-weight: 700;
      letter-spacing: 1.4px; text-transform: uppercase;
      color: var(--color-primary-700);
      background: rgba(255,255,255,0.7);
      padding: 4px 10px; border-radius: 999px;
      border: 1px solid var(--color-primary-100);
    }
    .hero h1 {
      margin: 10px 0 4px;
      font-size: 24px; font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }
    .hero p { margin: 0; font-size: 13.5px; color: var(--color-text-muted); }
    .hero-illustration { position: relative; }

    .tabs {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-xs);
      align-self: flex-start;
    }
    .tabs button {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 13px; font-weight: 600;
      border-radius: var(--radius-sm);
      transition: all 0.15s var(--ease-out);
    }
    .tabs button:hover { color: var(--color-text); background: var(--color-surface-2); }
    .tabs button.is-active {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      box-shadow: inset 0 0 0 1px var(--color-primary-200);
    }

    @media (max-width: 760px) {
      .hero-illustration { display: none; }
    }
  `]
})
export class MastersComponent {
  readonly tab = signal<MasterTab>('contracts');
}
