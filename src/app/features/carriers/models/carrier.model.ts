export type CarrierStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface CarrierSummary {
  id: string;
  name: string;
  gstNumber: string;
  geography: string;
  status: CarrierStatus;
  complianceStatus: string | null;
  riskLevel: string | null;
  createdAt: string;
}

export interface CarrierDocument {
  id: string;
  documentType: string;
  fileName: string;
  filePath: string;
  status: string;
  createdAt: string;
}

export interface CarrierCompliance {
  id: string;
  sanctionCheck: boolean;
  embargoCheck: boolean;
  riskScore: number;
  riskLevel: string;
  approvalStatus: string;
  reviewerComments: string | null;
  reviewedAt: string | null;
}

export interface CarrierResponse {
  id: string;
  name: string;
  legalEntity: string;
  gstNumber: string;
  geography: string;
  contactName: string | null;
  contactEmail: string | null;
  status: CarrierStatus;
  createdAt: string;
  documents: CarrierDocument[];
  compliance: CarrierCompliance | null;
}

export interface CreateCarrierDto {
  name: string;
  legalEntity: string;
  gstNumber: string;
  geography: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface UploadDocumentDto {
  documentType: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
}

export interface ApproveCarrierDto {
  comments?: string | null;
}

export interface RejectCarrierDto {
  reason: string;
}

export interface GetCarriersQuery {
  page?: number;
  pageSize?: number;
  status?: CarrierStatus | '' | null;
  search?: string;
}

/** Document types we surface in the upload step. */
export const CARRIER_DOCUMENT_TYPES: readonly string[] = [
  'GST Certificate',
  'PAN Card',
  'Incorporation Certificate',
  'Trade License',
  'Insurance Policy',
  'Bank Cancelled Cheque',
  'Authorized Signatory ID',
  'Other'
] as const;
