export type PermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface Permission {
  /** Optional — only present when fetched via GET /api/permissions/{roleId} */
  moduleId?: string;
  moduleCode: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
