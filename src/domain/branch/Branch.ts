import type { BranchId } from '@domain/shared/ids';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import { validateBranch } from './branchValidation';
import { createId } from '@domain/shared/ids';
import type { Address } from './Address';
import { emptyAddress } from './Address';

export const FEDERAL_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;
export type FederalState = (typeof FEDERAL_STATES)[number];

export interface Branch {
  id: BranchId;
  name: string;
  branchNumber: string;
  address: Address;
  /** Data URL (e.g. "data:image/png;base64,..."), shown top-right in the print header. */
  logoBase64: string | null;
  federalState: FederalState;
  /** ISO date list of manually maintained open Sundays (varies by state law, hence configurable instead of hard-coded). */
  allowedOpenSundays: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createBranch(details: {
  name: string;
  branchNumber: string;
  federalState: FederalState;
  address?: Address;
  logoBase64?: string | null;
}): Branch {
  // Same rules the dialog applies (branchValidation.ts); updates are deliberately not re-validated.
  assertNoFieldErrors(validateBranch(details));
  const now = new Date().toISOString();
  return {
    id: createId<BranchId>(),
    name: details.name,
    branchNumber: details.branchNumber,
    address: details.address ?? emptyAddress(),
    logoBase64: details.logoBase64 ?? null,
    federalState: details.federalState,
    allowedOpenSundays: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}
