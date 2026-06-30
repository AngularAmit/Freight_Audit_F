export type AuditType = 'Contracts' | 'Invoice';

export interface AuditUploadRequest {
  id: string;
  auditType: AuditType;
  documentType: string;
  fileName: string;
  filePath: string;
  status: string;
  createdAt: string;
}

export interface AuditUploadResponse {
  ID: string;
  Company: string;
  ContracTtitle: string;
  EffectiveDate: string;
  Parties: string;
  Terms: string;
  FileName: string;
  IsActive: boolean;
  AuditType?: AuditType;
}
