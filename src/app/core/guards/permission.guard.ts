import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { PermissionsService } from '../services/permissions.service';
import { PermissionAction } from '../auth/models/permission.model';

/**
 * Route guard that checks the current user has the given permission on a module.
 * If denied, redirects to /dashboard with `?forbidden=<MODULE_CODE>` so the
 * destination page can show a friendly notice.
 *
 * Usage:
 *   { path: 'admin', canActivate: [permissionGuard('ADMIN')], ... }
 *   { path: 'reports/new', canActivate: [permissionGuard('REPORT', 'canCreate')], ... }
 */
export const permissionGuard = (
  moduleCode: string,
  action: PermissionAction = 'canView'
): CanActivateFn => {
  return () => {
    const perms = inject(PermissionsService);
    const router = inject(Router);

    if (perms.hasPermission(moduleCode, action)) {
      return true;
    }

    return router.createUrlTree(['/dashboard'], {
      queryParams: { forbidden: moduleCode, action }
    });
  };
};
