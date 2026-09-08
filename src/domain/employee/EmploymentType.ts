export type EmploymentType =
  | { type: 'FullTime' | 'PartTime'; weeklyHours: number }
  | { type: 'Minijob'; minHours: number; maxHours: number };

export function targetWeeklyHours(employmentType: EmploymentType): number {
  return employmentType.type === 'Minijob' ? employmentType.maxHours : employmentType.weeklyHours;
}

export function employmentTypeLabel(employmentType: EmploymentType): string {
  switch (employmentType.type) {
    case 'FullTime':
      return 'Vollzeit';
    case 'PartTime':
      return 'Teilzeit';
    case 'Minijob':
      return 'Geringfügig beschäftigt';
  }
}
