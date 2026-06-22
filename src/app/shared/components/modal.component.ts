import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="overlay" (click)="onOverlayClick()">
        <div class="dialog" [class.dialog--lg]="size === 'lg'" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="dialog-head">
            <div>
              <h2>{{ title }}</h2>
              @if (subtitle) { <p>{{ subtitle }}</p> }
            </div>
            <button type="button" class="close" (click)="close.emit()" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <div class="dialog-body">
            <ng-content></ng-content>
          </div>

          @if (showFooter) {
            <footer class="dialog-foot">
              <ng-content select="[modal-footer]"></ng-content>
            </footer>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(15, 31, 51, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 1000;
      animation: fadeIn 0.18s var(--ease-out);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .dialog {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 40px);
      animation: rise 0.2s var(--ease-out);
    }
    .dialog--lg { max-width: 720px; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .dialog-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px;
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--color-border);
      h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); letter-spacing: -0.2px; }
      p  { margin: 2px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
    }

    .close {
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      color: var(--color-text-muted);
      border-radius: 8px;
    }
    .close:hover { background: var(--color-surface-2); color: var(--color-text); }

    .dialog-body {
      padding: 18px 22px;
      overflow-y: auto;
    }

    .dialog-foot {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 14px 22px 18px;
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
  `]
})
export class ModalComponent {
  @Input({ required: true }) open: boolean = false;
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() size: 'md' | 'lg' = 'md';
  @Input() closeOnOverlayClick: boolean = true;
  @Input() showFooter: boolean = true;
  @Output() close = new EventEmitter<void>();

  onOverlayClick(): void {
    if (this.closeOnOverlayClick) this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close.emit();
  }
}
