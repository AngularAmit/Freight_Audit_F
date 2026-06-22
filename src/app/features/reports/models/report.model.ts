/* ===========================================================================
 * Mirrors `FreightAudit.Application.DTOs.Reports.*`. Use a separate model file
 * for each report so we can evolve them independently if the backend splits.
 * =========================================================================== */

/** Generic count-by-key bucket (used for invoice source / status / audit status). */
export interface CountByKey {
  key: string;
  count: number;
  /** Optional aggregate amount tied to the bucket (e.g. total $ per status). */
  amount?: number | null;
}

/* ---------------------------------------------------------------- summary */

export interface SummaryReport {
  totalInvoices: number;
  invoicesBySource: CountByKey[];
  invoicesByStatus: CountByKey[];

  totalActualBilled: number;
  totalExpectedAmount: number;
  totalOvercharge: number;
  totalUndercharge: number;
  totalSavingsFromAudit: number;

  totalPenaltyDeducted: number;
  totalNetPayable: number;

  auditResultsByStatus: CountByKey[];

  generatedAt: string;
}

/* ----------------------------------------------------------- performance */

export interface CarrierPerformanceRow {
  carrierId: string;
  carrierName: string;
  monthsRecorded: number;
  monthsInBreach: number;
  averageOtd: number;
  latestOtd: number;
  latestMonth: string;
  breachRate: string;
  slaOtdTarget: number | null;
  slaThreshold: number | null;
}

export interface MonthlyOtdTrend {
  month: string;            // "2026-04"
  averageOtd: number;
  carriersInBreach: number;
  totalCarriers: number;
}

export interface PerformanceReport {
  totalCarriersTracked: number;
  totalMonthsRecorded: number;
  overallAverageOtd: number;
  totalBreachMonths: number;
  carriers: CarrierPerformanceRow[];
  monthlyTrend: MonthlyOtdTrend[];
  generatedAt: string;
}

/* -------------------------------------------------------------- penalties */

export interface CarrierPenaltySummary {
  carrierId: string;
  carrierName: string;
  totalInvoices: number;
  breachCount: number;
  totalInvoiceAmount: number;
  totalPenaltyAmount: number;
  totalNetPayable: number;
  averageOtdAtPenalty: number;
}

export interface MonthlyPenaltyTrend {
  month: string;
  penaltyCount: number;
  totalPenaltyAmount: number;
  totalNetPayable: number;
}

export interface PenaltyReport {
  totalPenaltyRecords: number;
  penaltyBreachCount: number;
  totalInvoiceAmount: number;
  totalPenaltyAmount: number;
  totalNetPayable: number;
  penaltyRatePercent: number;
  byCarrier: CarrierPenaltySummary[];
  monthlyTrend: MonthlyPenaltyTrend[];
  generatedAt: string;
}
