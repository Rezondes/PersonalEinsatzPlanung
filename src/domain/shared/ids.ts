export type BranchId = string & { readonly __brand: 'BranchId' };
export type EmployeeId = string & { readonly __brand: 'EmployeeId' };
export type WeeklyScheduleId = string & { readonly __brand: 'WeeklyScheduleId' };
export type AbsenceId = string & { readonly __brand: 'AbsenceId' };
export type ShiftTemplateId = string & { readonly __brand: 'ShiftTemplateId' };

export function createId<T extends string>(): T {
  return crypto.randomUUID() as T;
}
