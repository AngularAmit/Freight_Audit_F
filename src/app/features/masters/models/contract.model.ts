export interface SlaRule {
  id: string;
  contractId: string;
  otdTarget: number;
  penaltyThreshold: number;
  penaltyPercent: number;
  createdAt: string;
}

export interface ContractListItem {
  id: string;
  carrierId: string;
  carrierName: string;
  contractName: string;
  filePath: string | null;
  isActive: boolean;
  slaRulesCount: number;
  createdAt: string;
}

export interface ContractResponse {
  id: string;
  carrierId: string;
  carrierName: string;
  contractName: string;
  filePath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  slaRules: SlaRule[];
}

export interface ContractPagedResponse {
  items: ContractListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateContractDto {
  carrierId: string;
  contractName: string;
  isActive: boolean;
}

export interface UpdateContractDto {
  contractName: string;
  isActive: boolean;
}

export interface UploadContractFileDto {
  filePath: string;
}

export interface CreateSlaRuleDto {
  otdTarget: number;
  penaltyThreshold: number;
  penaltyPercent: number;
}

export interface GetContractsQuery {
  page?: number;
  pageSize?: number;
  carrierId?: string | null;
  isActive?: boolean | null;
  search?: string;
}
