import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();

  // Minimal debug information to diagnose missing auth header locally.
  // This logs presence of a token without printing the token value.
  // Remove or guard this in production if needed.
  try {
    // eslint-disable-next-line no-console
    console.debug(`[jwtInterceptor] ${req.method} ${req.url} token=${token ? 'yes' : 'no'}`);
  } catch {}

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.logout(false);
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url, sessionExpired: '1' }
        });
      }
      return throwError(() => error);
    })
  );
};
