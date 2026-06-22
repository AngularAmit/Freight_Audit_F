/**
 * Mirrors `FreightAudit.Application.DTOs.Workflow.ProcessInvoiceDto`.
 *
 * Sent as JSON body to `POST /api/workflow/process-invoice/{invoiceId}`.
 */
export interface ProcessInvoiceDto {
  actualAmount: number;
  origin: string;
  destination: string;
  serviceType: string;
  weightLbs?: number | null;
  actualOtdPercent?: number | null;
}

/** Mirrors `FreightAudit.Application.DTOs.Audit.AuditResultDto`. */
export interface AuditResult {
  id: string;
  invoiceId: string;
  origin: string;
  destination: string;
  serviceType: string;
  weightLbs: number | null;
  actualAmount: number;
  expectedBaseAmount: number;
  slaPenaltyAmount: number;
  expectedFinalAmount: number;
  discrepancy: number;
  actualOtdPercent: number | null;
  status: string;
  notes: string;
  matchedRateId: string | null;
  matchedContractId: string | null;
  matchedSlaRuleId: string | null;
  createdAt: string;
}

/** Mirrors `FreightAudit.Application.DTOs.Penalty.PenaltyResponseDto`. */
export interface PenaltyResult {
  id: string;
  carrierId: string;
  carrierName: string;
  invoiceId: string;
  actualOtdPercent: number;
  penaltyThreshold: number;
  penaltyPercent: number;
  invoiceAmount: number;
  penaltyAmount: number;
  netPayable: number;
  contractSlaRuleId: string | null;
  notes: string;
  createdAt: string;
}

/** Mirrors `FreightAudit.Application.DTOs.Workflow.WorkflowResultDto`. */
export interface WorkflowResult {
  invoiceId: string;
  carrierId: string;
  carrierName: string;
  finalStatus: string;
  auditResult: AuditResult;
  penaltyResult: PenaltyResult | null;
  processingSteps: string[];
  completedAt: string;
}
