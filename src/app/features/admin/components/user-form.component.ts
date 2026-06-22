import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { finalize } from 'rxjs';

import { ModalComponent } from '../../../shared/components/modal.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ApiResponse } from '../../../core/auth/models/api-response.model';

import { AdminService } from '../admin.service';
import { Role } from '../models/role.model';
import { User, CreateUserDto, UpdateUserDto } from '../models/user.model';

type Mode = 'create' | 'edit';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal
      [open]="open"
      [title]="mode() === 'create' ? 'Add user' : 'Edit user'"
      [subtitle]="mode() === 'create' ? 'Create a new user and assign a role.' : 'Update name, role, or activation status.'"
      (close)="onClose()">

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (errorMessage()) {
          <div class="alert alert-error">{{ errorMessage() }}</div>
        }

        <div class="field">
          <label for="name">Full name</label>
          <input id="name" type="text" formControlName="name" placeholder="Jane Doe" autocomplete="name"
                 [class.invalid]="form.controls.name.touched && form.controls.name.invalid" />
          @if (form.controls.name.touched && form.controls.name.errors) {
            <small class="field-error">
              @if (form.controls.name.errors['required']) { Name is required. }
              @else if (form.controls.name.errors['maxlength']) { Name must be 100 characters or fewer. }
            </small>
          }
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" placeholder="jane@company.com" autocomplete="email"
                 [class.invalid]="form.controls.email.touched && form.controls.email.invalid" />
          @if (form.controls.email.touched && form.controls.email.errors) {
            <small class="field-error">
              @if (form.controls.email.errors['required']) { Email is required. }
              @else if (form.controls.email.errors['email']) { Enter a valid email address. }
              @else if (form.controls.email.errors['maxlength']) { Email must be 200 characters or fewer. }
            </small>
          }
        </div>

        @if (mode() === 'create') {
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" autocomplete="new-password"
                   placeholder="Min 8 chars, 1 uppercase, 1 digit"
                   [class.invalid]="form.controls.password.touched && form.controls.password.invalid" />
            @if (form.controls.password.touched && form.controls.password.errors) {
              <small class="field-error">
                @if (form.controls.password.errors['required']) { Password is required. }
                @else if (form.controls.password.errors['minlength']) { Password must be at least 8 characters. }
                @else if (form.controls.password.errors['noUpper']) { Must contain at least one uppercase letter. }
                @else if (form.controls.password.errors['noDigit']) { Must contain at least one digit. }
              </small>
            }
            <small class="hint">The user can change this after first sign-in.</small>
          </div>
        }

        <div class="field">
          <label for="roleId">Role</label>
          <select id="roleId" formControlName="roleId"
                  [class.invalid]="form.controls.roleId.touched && form.controls.roleId.invalid">
            <option value="" disabled>Select a role…</option>
            @for (r of roles; track r.id) {
              <option [value]="r.id">{{ r.name }}</option>
            }
          </select>
          @if (form.controls.roleId.touched && form.controls.roleId.errors?.['required']) {
            <small class="field-error">Role is required.</small>
          }
        </div>

        @if (mode() === 'edit') {
          <label class="toggle">
            <input type="checkbox" formControlName="isActive" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">
              <strong>Active</strong>
              <small>Inactive users cannot sign in.</small>
            </span>
          </label>
        }
      </form>

      <ng-container modal-footer>
        <button type="button" class="btn btn-ghost" (click)="onClose()" [disabled]="saving()">Cancel</button>
        <button type="button" class="btn btn-primary" (click)="submit()" [disabled]="saving()">
          @if (saving()) { Saving… } @else if (mode() === 'create') { Create user } @else { Save changes }
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    form { display: flex; flex-direction: column; gap: 14px; }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 12.5px; font-weight: 600; color: var(--color-text);
      letter-spacing: 0.1px;
    }
    .field input, .field select {
      height: 42px;
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text);
      font-size: 14px;
      transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .field input:focus, .field select:focus {
      outline: none;
      background: #fff;
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
    }
    .field input.invalid, .field select.invalid {
      border-color: var(--color-error);
      background: var(--color-error-bg);
    }
    .field-error { color: var(--color-error); font-size: 12px; font-weight: 500; }
    .hint { color: var(--color-text-muted); font-size: 11.5px; }

    .alert {
      padding: 10px 12px;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 500;
    }
    .alert-error {
      background: var(--color-error-bg);
      color: var(--color-error);
      border: 1px solid #fecaca;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
      padding: 8px 0;
    }
    .toggle input { position: absolute; opacity: 0; pointer-events: none; }
    .toggle-track {
      position: relative;
      width: 38px; height: 22px;
      background: #d1d5db;
      border-radius: 999px;
      transition: background 0.2s var(--ease-out);
      flex-shrink: 0;
    }
    .toggle-thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 18px; height: 18px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: left 0.2s var(--ease-out);
    }
    .toggle input:checked ~ .toggle-track { background: var(--color-primary-500); }
    .toggle input:checked ~ .toggle-track .toggle-thumb { left: 18px; }
    .toggle-label { display: flex; flex-direction: column; gap: 0; }
    .toggle-label strong { font-size: 13.5px; color: var(--color-text); }
    .toggle-label small  { font-size: 11.5px; color: var(--color-text-muted); }

    .btn {
      padding: 9px 16px;
      font-size: 13.5px;
      font-weight: 600;
      border-radius: var(--radius-md);
      cursor: pointer;
    }
    .btn-ghost {
      background: #fff; color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }
    .btn-primary {
      background: var(--gradient-brand);
      color: #fff;
      border: none;
      box-shadow: 0 6px 14px rgba(59, 130, 246, 0.28);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
  `]
})
export class UserFormComponent implements OnInit, OnChanges {
  @Input() open: boolean = false;
  @Input() user: User | null = null;
  @Input() roles: Role[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<User>();

  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly mode = signal<Mode>('create');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    password: ['', [
      Validators.required,
      Validators.minLength(8),
      this.regexValidator(/[A-Z]/, 'noUpper'),
      this.regexValidator(/[0-9]/, 'noDigit')
    ]],
    roleId: ['', [Validators.required]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.applyMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] || changes['open']) {
      if (this.open) {
        this.applyMode();
      }
    }
  }

  private applyMode(): void {
    this.errorMessage.set(null);
    if (this.user) {
      this.mode.set('edit');
      this.form.patchValue({
        name: this.user.name,
        email: this.user.email,
        password: '',
        roleId: this.user.roleId,
        isActive: this.user.isActive
      });
      this.form.controls.password.disable({ emitEvent: false });
    } else {
      this.mode.set('create');
      this.form.reset({
        name: '',
        email: '',
        password: '',
        roleId: '',
        isActive: true
      });
      this.form.controls.password.enable({ emitEvent: false });
    }
  }

  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.saving.set(true);

    const raw = this.form.getRawValue();

    const request$ = this.mode() === 'create'
      ? this.admin.createUser({
          name: raw.name.trim(),
          email: raw.email.trim(),
          password: raw.password,
          roleId: raw.roleId
        } as CreateUserDto)
      : this.admin.updateUser(this.user!.id, {
          name: raw.name.trim(),
          email: raw.email.trim(),
          roleId: raw.roleId,
          isActive: raw.isActive
        } as UpdateUserDto);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(
          this.mode() === 'create'
            ? `User "${saved.name}" created.`
            : `User "${saved.name}" updated.`
        );
        this.saved.emit(saved);
      },
      error: (err) => this.errorMessage.set(this.extractError(err))
    });
  }

  onClose(): void {
    if (this.saving()) return;
    this.close.emit();
  }

  private regexValidator(re: RegExp, errorKey: string) {
    return (control: { value: string }) => {
      const v = control.value ?? '';
      if (!v) return null;
      return re.test(v) ? null : { [errorKey]: true };
    };
  }

  private extractError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiResponse<unknown> | undefined;
      if (body?.errors?.length) return body.errors.join(' ');
      if (body?.message) return body.message;
      return `Request failed (${err.status}).`;
    }
    if (err instanceof Error) return err.message;
    return 'An unexpected error occurred.';
  }
}
