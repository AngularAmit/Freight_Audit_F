export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateUserDto {
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
}

export interface GetUsersQuery {
  page?: number;
  pageSize?: number;
  roleId?: string;
  search?: string;
}
