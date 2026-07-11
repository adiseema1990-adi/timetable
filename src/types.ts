/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Faculty {
  id: string;
  name: string;
  shortName: string; // e.g., "Dr. A.B.S" or "MVR"
  department: string;
  email: string;
}

export interface Subject {
  id: string;
  code: string; // e.g., "21CS51"
  name: string;
  department: string;
  weeklyPeriods: number; // how many periods of this subject per week
  isLab?: boolean;
}

export interface ClassSection {
  id: string;
  name: string; // e.g., "V Sem CSE"
  semester: string; // e.g., "5th"
  section: string; // e.g., "A"
}

export interface Assignment {
  id: string;
  classId: string;
  subjectId: string;
  facultyId: string;
}

export interface TimeSlot {
  id: string;
  label: string; // e.g., "Period 1", "Period 2", "Short Break", "Lunch Break"
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:00"
  isBreak: boolean;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimetableCell {
  assignmentId: string | null; // references Assignment.id
  locked?: boolean;
}

// Day -> Array of cells (aligned with active/non-break slots)
export interface ClassTimetable {
  [day: string]: (string | null)[]; // Array of Assignment ID or null, index maps to active (non-break) periods
}

export interface TimetableSchedule {
  // classId -> ClassTimetable
  [classId: string]: ClassTimetable;
}

export interface GenerationOptions {
  days: DayOfWeek[];
  allowSaturdays: boolean;
  maxContinuousPeriodsForFaculty: number; // e.g., 2
}
