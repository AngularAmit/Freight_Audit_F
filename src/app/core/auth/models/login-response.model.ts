export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ModulePermission {
  moduleCode: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: UserInfo;
  permissions: ModulePermission[];
}
