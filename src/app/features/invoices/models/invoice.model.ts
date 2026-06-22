/**
 * Mirrors `FreightAudit.Domain.Enums.InvoiceStatus`.
 *
 * Values are numeric on the wire because the backend has no
 * `JsonStringEnumConverter`.  Keep these aligned with the C# enum order.
 */
export enum InvoiceStatus {
  RECEIVED = 0,
  PROCESSING = 1,
  AUDITED = 2,
  APPROVED = 3
}

export type InvoiceStatusKey = keyof typeof InvoiceStatus;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusKey, string> = {
  RECEIVED:   'Received',
  PROCESSING: 'Processing',
  AUDITED:    'Audited',
  APPROVED:   'Approved'
};

export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; key: InvoiceStatusKey; label: string }[] = [
  { value: InvoiceStatus.RECEIVED,   key: 'RECEIVED',   label: 'Received' },
  { value: InvoiceStatus.PROCESSING, key: 'PROCESSING', label: 'Processing' },
  { value: InvoiceStatus.AUDITED,    key: 'AUDITED',    label: 'Audited' },
  { value: InvoiceStatus.APPROVED,   key: 'APPROVED',   label: 'Approved' }
];

/**
 * `FreightAudit.Domain.Enums.InvoiceSource`.
 *
 * The upload endpoint accepts the *string name* (parsed via `Enum.TryParse`),
 * so we keep the values as strings here for clarity in `FormData` payloads.
 */
export type InvoiceSource = 'API' | 'EMAIL' | 'UPLOAD';
export const INVOICE_SOURCES: InvoiceSource[] = ['API', 'EMAIL', 'UPLOAD'];

export interface InvoiceResponse {
  id: string;
  carrierId: string;
  carrierName: string;
  filePath: string;
  source: string;
  status: InvoiceStatusKey | string;
  createdAt: string;
  updatedAt: string | null;
}

export interface InvoicePagedResponse {
  items: InvoiceResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Shape sent to `POST /api/invoices/upload` (multipart).
 * Field names match `InvoiceFileUploadRequest` properties on the API.
 */
export interface UploadInvoiceFormData {
  file: File;
  carrierId: string;
  source: InvoiceSource;
  actualAmount: number;
  origin: string;
  destination: string;
  serviceType: string;
  weightLbs?: number | null;
  actualOtdPercent?: number | null;
}

export interface GetInvoicesQuery {
  page?: number;
  pageSize?: number;
  carrierId?: string | null;
  source?: InvoiceSource | '' | null;
  status?: InvoiceStatusKey | '' | null;
}
