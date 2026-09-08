import { create } from 'zustand';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { calendarWeekFromDate } from '@domain/shared/CalendarWeek';

interface CalendarWeekState {
  selectedWeek: CalendarWeek;
  setSelectedWeek: (cw: CalendarWeek) => void;
}

export const useCalendarWeekStore = create<CalendarWeekState>((set) => ({
  selectedWeek: calendarWeekFromDate(new Date()),
  setSelectedWeek: (cw) => set({ selectedWeek: cw }),
}));
