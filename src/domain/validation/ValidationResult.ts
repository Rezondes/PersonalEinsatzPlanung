import type { EmployeeId } from '@domain/shared/ids';

/**
 * "error" = clear legal violation (UI shows red, requires explicit confirmation on save).
 * "warning" = borderline/config-dependent (yellow, blocks nothing).
 * "info" = pure notice. The software never hard-blocks, final responsibility stays with the Marktleiter,
 * but violations are surfaced and documented.
 */
export type Severity = 'info' | 'warning' | 'error';

export interface ValidationResult {
  rule: string;
  severity: Severity;
  message: string;
  employeeId?: EmployeeId;
  date?: string;
}
