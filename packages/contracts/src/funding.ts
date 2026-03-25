import type { DecimalString, Id, PagedResponseDto } from "./common";
import type {
  FundingCategory,
  FundingProviderType,
  StrategyType,
} from "./enums";

export interface FundingProgramVariantDto {
  id: Id;
  fundingProgramId: Id;
  code: string;
  name: string;
  termMonths: number | null;
  interestRatePct: DecimalString | null;
  maxLoanPct: DecimalString | null;
  maxLoanPerSqm: DecimalString | null;
  rentCapEurSqm: DecimalString | null;
  loanCapPct: DecimalString | null;
  subsidyEligibleSharePct: DecimalString | null;
  eligibleStrategyTypes: StrategyType[];
  allowsKfwCombination: boolean;
}

export interface FundingProgramDto {
  id: Id;
  organizationId: Id | null;
  code: string;
  name: string;
  providerName: string;
  providerType: FundingProviderType;
  category: FundingCategory;
  stateCode: string | null;
  isGlobal: boolean;
  isActive: boolean;
  description: string | null;
  variants: FundingProgramVariantDto[];
}

export type ListFundingProgramsResponseDto = PagedResponseDto<FundingProgramDto>;
