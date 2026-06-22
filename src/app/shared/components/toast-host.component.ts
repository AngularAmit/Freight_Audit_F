import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (t of toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind">
          <span class="icon" [attr.data-kind]="t.kind">
            @switch (t.kind) {
              @case ('success') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              }
              @case ('error') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              }
              @default {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              }
            }
          </span>
          <span class="msg">{{ t.message }}</span>
          <button class="dismiss" (click)="toastSvc.dismiss(t.id)" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .toast-stack {
      position: fixed;
      right: 18px;
      bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1100;
      max-width: calc(100vw - 36px);
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 280px;
      padding: 12px 14px 12px 12px;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      font-size: 13.5px;
      color: var(--color-text);
      animation: slide-in 0.22s var(--ease-out);
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .icon {
      width: 26px; height: 26px;
      border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .icon[data-kind="success"] { background: #d1fae5; color: #047857; }
    .icon[data-kind="error"]   { background: #fee2e2; color: #b91c1c; }
    .icon[data-kind="info"]    { background: var(--color-primary-100); color: var(--color-primary-700); }

    .toast[data-kind="success"] { border-color: #a7f3d0; }
    .toast[data-kind="error"]   { border-color: #fecaca; }
    .toast[data-kind="info"]    { border-color: var(--color-primary-200); }

    .msg { flex: 1; line-height: 1.4; }

    .dismiss {
      background: transparent;
      color: var(--color-text-subtle);
      width: 24px; height: 24px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px;
    }
    .dismiss:hover { background: var(--color-surface-2); color: var(--color-text); }
  `]
})
export class ToastHostComponent {
  protected readonly toastSvc = inject(ToastService);
  protected readonly toasts = this.toastSvc.toasts;
}
