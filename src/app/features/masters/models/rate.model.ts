/**
 * Mirrors `FreightAudit.Domain.Enums.RateType`.
 * Numeric values are critical — backend has no JsonStringEnumConverter, so
 * payloads must send the integer.
 */
export enum RateType {
  CWT = 0,
  FLAT = 1
}

/** `FreightAudit.Domain.Enums.AccessorialType` (numeric on the wire). */
export enum AccessorialType {
  LIFTGATE = 0,
  RESIDENTIAL = 1,
  INSIDE_DELIVERY = 2,
  APPOINTMENT = 3,
  NOTIFICATION = 4,
  FUEL_SURCHARGE = 5,
  OTHER = 6
}

/** `FreightAudit.Domain.Enums.AccessorialUnit` (numeric on the wire). */
export enum AccessorialUnit {
  FLAT = 0,
  PERCENT = 1
}

export const RATE_TYPE_OPTIONS: { value: RateType; label: string; hint: string }[] = [
  { value: RateType.CWT,  label: 'CWT',  hint: 'Cost per hundred-weight (per 100 lb)' },
  { value: RateType.FLAT, label: 'FLAT', hint: 'Flat rate per shipment' }
];

export const ACCESSORIAL_TYPE_OPTIONS: { value: AccessorialType; label: string }[] = [
  { value: AccessorialType.LIFTGATE,        label: 'Liftgate' },
  { value: AccessorialType.RESIDENTIAL,     label: 'Residential' },
  { value: AccessorialType.INSIDE_DELIVERY, label: 'Inside delivery' },
  { value: AccessorialType.APPOINTMENT,     label: 'Appointment' },
  { value: AccessorialType.NOTIFICATION,    label: 'Notification' },
  { value: AccessorialType.FUEL_SURCHARGE,  label: 'Fuel surcharge' },
  { value: AccessorialType.OTHER,           label: 'Other' }
];

export const ACCESSORIAL_UNIT_OPTIONS: { value: AccessorialUnit; label: string }[] = [
  { value: AccessorialUnit.FLAT,    label: 'Flat (currency)' },
  { value: AccessorialUnit.PERCENT, label: 'Percent of base' }
];

export interface Accessorial {
  id: string;
  rateId: string;
  type: string;
  value: number;
  unit: string;
  createdAt: string;
}

export interface RateListItem {
  id: string;
  carrierId: string;
  carrierName: string;
  origin: string;
  destination: string;
  serviceType: string;
  rateType: string;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  accessorialsCount: number;
}

export interface RateResponse {
  id: string;
  carrierId: string;
  carrierName: string;
  origin: string;
  destination: string;
  serviceType: string;
  rateType: string;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  accessorials: Accessorial[];
}

export interface RatePagedResponse {
  items: RateListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateRateDto {
  carrierId: string;
  origin: string;
  destination: string;
  serviceType: string;
  rateType: RateType;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateRateDto {
  origin: string;
  destination: string;
  serviceType: string;
  rateType: RateType;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CreateAccessorialDto {
  type: AccessorialType;
  value: number;
  unit: AccessorialUnit;
}

export interface GetRatesQuery {
  page?: number;
  pageSize?: number;
  carrierId?: string | null;
  origin?: string;
  destination?: string;
  serviceType?: string;
  activeOnly?: boolean | null;
}
