export interface Role {
  id: string;
  name: string;
}

export interface ModuleInfo {
  id: string;
  code: string;
  name: string;
}

export interface UpdatePermissionItem {
  moduleId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UpdatePermissionsDto {
  permissions: UpdatePermissionItem[];
}
