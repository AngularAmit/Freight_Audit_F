import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** ms before auto-dismiss; 0 = sticky */
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 1;

  show(message: string, kind: ToastKind = 'info', duration: number = 4500): void {
    const toast: Toast = { id: this.nextId++, kind, message, duration };
    this._toasts.update((list) => [...list, toast]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  success(message: string, duration: number = 4000): void { this.show(message, 'success', duration); }
  error(message: string,   duration: number = 6000): void { this.show(message, 'error',   duration); }
  info(message: string,    duration: number = 4500): void { this.show(message, 'info',    duration); }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
