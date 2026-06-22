import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * LEVO logo component.
 *
 * Variants:
 *  - "mark"   → just the icon (square gradient mark with stylised "L" + AI sparkle)
 *  - "lockup" → mark + wordmark "LEVO" + small subtitle "Services Private Limited"
 *
 * Tones:
 *  - "color"   → blue gradient on white surfaces (default)
 *  - "onDark"  → wordmark in white, used on the brand gradient panel
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="logo" [class.lockup]="variant === 'lockup'" [class.on-dark]="tone === 'onDark'">
      <span class="logo-mark" [style.width.px]="size" [style.height.px]="size">
        <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient [attr.id]="gradId" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stop-color="#3b82f6"/>
              <stop offset="55%"  stop-color="#0ea5e9"/>
              <stop offset="100%" stop-color="#22d3ee"/>
            </linearGradient>
          </defs>

          <rect x="2" y="2" width="36" height="36" rx="10" [attr.fill]="'url(#' + gradId + ')'"/>

          <path d="M 5 6 Q 20 16 35 6 L 35 4 Q 20 4 5 4 Z" fill="#ffffff" fill-opacity="0.18"/>

          <path d="M 12 11 L 12 26 L 22 26"
                stroke="#ffffff" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M 19 22 L 23 26 L 19 30"
                stroke="#ffffff" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round" fill="none"/>

          <g transform="translate(28.5, 11.5)">
            <path d="M 0 -4.5 L 0.9 -0.9 L 4.5 0 L 0.9 0.9 L 0 4.5 L -0.9 0.9 L -4.5 0 L -0.9 -0.9 Z"
                  fill="#ffffff"/>
            <circle cx="0" cy="0" r="1.1" fill="#0ea5e9"/>
          </g>
        </svg>
      </span>

      @if (variant === 'lockup') {
        <span class="logo-text">
          <span class="brand">LEVO</span>
          <span class="tagline">Services Private Limited</span>
        </span>
      }
    </span>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 12px; line-height: 1; }

    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 6px 14px rgba(59, 130, 246, 0.35));
      flex-shrink: 0;
    }

    .logo.on-dark .logo-mark {
      filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.18));
    }

    .logo-text {
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 2.2px;
      color: var(--color-text);
      background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo.on-dark .brand {
      background: none;
      -webkit-text-fill-color: initial;
      color: #ffffff;
      letter-spacing: 2.4px;
    }

    .tagline {
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .logo.on-dark .tagline {
      color: rgba(255, 255, 255, 0.78);
    }
  `]
})
export class LogoComponent {
  @Input() variant: 'mark' | 'lockup' = 'lockup';
  @Input() size: number = 40;
  @Input() tone: 'color' | 'onDark' = 'color';

  readonly gradId = 'levo-grad-' + Math.random().toString(36).slice(2, 9);
}
