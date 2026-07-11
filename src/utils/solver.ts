/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Faculty, Subject, ClassSection, Assignment, TimeSlot, DayOfWeek, TimetableSchedule, ClassTimetable } from '../types';

export interface SolverResult {
  success: boolean;
  schedule: TimetableSchedule;
  message: string;
  unscheduledUnits?: {
    classId: string;
    subjectId: string;
    facultyId: string;
    unitIndex: number;
  }[];
}

interface LectureUnit {
  assignmentId: string;
  classId: string;
  facultyId: string;
  subjectId: string;
  unitIndex: number; // 0 to weeklyPeriods-1
  duration: number; // 1 or 2
}

/**
 * Validates if the input configuration has obvious physical impossibilities.
 */
export function preValidateConstraints(
  faculties: Faculty[],
  subjects: Subject[],
  classes: ClassSection[],
  assignments: Assignment[],
  timeSlots: TimeSlot[],
  days: DayOfWeek[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const activeSlotsCount = timeSlots.filter(s => !s.isBreak).length;
  const totalSlotsPerClass = activeSlotsCount * days.length;

  // 1. Check if any class has more requested periods than total slots in the week
  for (const cls of classes) {
    const classAssignments = assignments.filter(a => a.classId === cls.id);
    let totalPeriodsRequested = 0;
    for (const assign of classAssignments) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub) {
        totalPeriodsRequested += sub.weeklyPeriods;
      }
    }

    if (totalPeriodsRequested > totalSlotsPerClass) {
      errors.push(
        `Class "${cls.name} (Sec ${cls.section})" requires ${totalPeriodsRequested} periods, but only ${totalSlotsPerClass} slots are available in the week (${days.length} days × ${activeSlotsCount} periods).`
      );
    }
  }

  // 2. Check if any faculty has more total periods than the total slots in a week (impossible to schedule even without overlaps)
  for (const fac of faculties) {
    const facAssignments = assignments.filter(a => a.facultyId === fac.id);
    let totalFacPeriods = 0;
    for (const assign of facAssignments) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub) {
        totalFacPeriods += sub.weeklyPeriods;
      }
    }

    if (totalFacPeriods > totalSlotsPerClass) {
      errors.push(
        `Faculty "${fac.name} (${fac.shortName})" is assigned to teach ${totalFacPeriods} periods, but there are only ${totalSlotsPerClass} total available slots in a week.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * A highly optimized backtracking timetable generator with constraint satisfaction.
 * Employs MRV (Minimum Remaining Values) sort and randomized slot picking to solve efficiently.
 */
export function generateTimetable(
  faculties: Faculty[],
  subjects: Subject[],
  classes: ClassSection[],
  assignments: Assignment[],
  timeSlots: TimeSlot[],
  days: DayOfWeek[]
): SolverResult {
  const activeSlots = timeSlots.filter(s => !s.isBreak);
  const totalPeriods = activeSlots.length;

  // Identify the lunch break and the active slot index preceding it
  const lunchBreakIdx = timeSlots.findIndex(s => s.isBreak && s.label.toLowerCase().includes('lunch'));
  let activeLunchPredecessorId: string | null = null;
  if (lunchBreakIdx > 0) {
    for (let i = lunchBreakIdx - 1; i >= 0; i--) {
      if (!timeSlots[i].isBreak) {
        activeLunchPredecessorId = timeSlots[i].id;
        break;
      }
    }
  }

  // Helper to determine if an active slot is a preferred/high-priority slot (Period 1, 2, 3, 4, or before lunch)
  const isHighPriorityPeriod = (pIdx: number): boolean => {
    if (pIdx === 0 || pIdx === 1) return true;
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    if (
      labelLower.includes('period 1') || 
      labelLower.includes('period 2') || 
      labelLower.includes('1st') || 
      labelLower.includes('2nd') ||
      labelLower.includes('period 3') ||
      labelLower.includes('period 4') ||
      labelLower.includes('3rd') ||
      labelLower.includes('4th') ||
      pIdx === 2 ||
      pIdx === 3
    ) {
      return true;
    }
    if (activeLunchPredecessorId && slot.id === activeLunchPredecessorId) {
      return true;
    }
    return false;
  };

  // Helper to check if two active period indices are consecutive in the original timeSlots (no breaks between them)
  const arePeriodsConsecutive = (pIdx1: number, pIdx2: number): boolean => {
    const slot1 = activeSlots[pIdx1];
    const slot2 = activeSlots[pIdx2];
    if (!slot1 || !slot2) return false;
    const idx1 = timeSlots.findIndex(s => s.id === slot1.id);
    const idx2 = timeSlots.findIndex(s => s.id === slot2.id);
    return Math.abs(idx2 - idx1) === 1;
  };

  // Helper to check if an active slot corresponds to Period 1, 2, 3, or 4
  const isPeriod1To4 = (pIdx: number): boolean => {
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    const isP1 = labelLower.includes('period 1') || labelLower.includes('1st') || pIdx === 0;
    const isP2 = labelLower.includes('period 2') || labelLower.includes('2nd') || pIdx === 1;
    const isP3 = labelLower.includes('period 3') || labelLower.includes('3rd') || pIdx === 2;
    const isP4 = labelLower.includes('period 4') || labelLower.includes('4th') || pIdx === 3;
    return isP1 || isP2 || isP3 || isP4;
  };

  if (classes.length === 0) {
    return { success: false, schedule: {}, message: 'No classes/semesters defined.' };
  }
  if (assignments.length === 0) {
    return { success: false, schedule: {}, message: 'No subject assignments defined.' };
  }
  if (activeSlots.length === 0) {
    return { success: false, schedule: {}, message: 'No active (non-break) periods configured.' };
  }
  if (days.length === 0) {
    return { success: false, schedule: {}, message: 'No active days selected.' };
  }

  // Pre-validate
  const validation = preValidateConstraints(faculties, subjects, classes, assignments, timeSlots, days);
  if (!validation.valid) {
    return {
      success: false,
      schedule: {},
      message: `Invalid Constraints: ${validation.errors[0]}`
    };
  }

  // Create lecture units
  const lectureUnits: LectureUnit[] = [];
  for (const assign of assignments) {
    const sub = subjects.find(s => s.id === assign.subjectId);
    if (!sub) continue;
    if (sub.isLab) {
      let remaining = sub.weeklyPeriods;
      let i = 0;
      while (remaining > 0) {
        if (remaining >= 2) {
          lectureUnits.push({
            assignmentId: assign.id,
            classId: assign.classId,
            facultyId: assign.facultyId,
            subjectId: assign.subjectId,
            unitIndex: i,
            duration: 2,
          });
          remaining -= 2;
          i += 2;
        } else {
          lectureUnits.push({
            assignmentId: assign.id,
            classId: assign.classId,
            facultyId: assign.facultyId,
            subjectId: assign.subjectId,
            unitIndex: i,
            duration: 1,
          });
          remaining -= 1;
          i += 1;
        }
      }
    } else {
      for (let i = 0; i < sub.weeklyPeriods; i++) {
        lectureUnits.push({
          assignmentId: assign.id,
          classId: assign.classId,
          facultyId: assign.facultyId,
          subjectId: assign.subjectId,
          unitIndex: i,
          duration: 1,
        });
      }
    }
  }

  // Count how many total hours/periods each faculty is teaching to prioritize busiest teachers
  const facultyLoad: Record<string, number> = {};
  for (const unit of lectureUnits) {
    facultyLoad[unit.facultyId] = (facultyLoad[unit.facultyId] || 0) + unit.duration;
  }

  // Sort units: schedule busiest teachers first (Most Constrained Heuristic)
  lectureUnits.sort((a, b) => {
    const loadA = facultyLoad[a.facultyId] || 0;
    const loadB = facultyLoad[b.facultyId] || 0;
    return loadB - loadA; // descending order of faculty workload
  });

  // Identify which faculties take multiple subjects in the SAME class
  // key: facultyId_classId -> boolean
  const facultyMultiSubjectMap: Record<string, boolean> = {};
  for (const cls of classes) {
    for (const fac of faculties) {
      const facClassAssigns = assignments.filter(a => a.classId === cls.id && a.facultyId === fac.id);
      if (facClassAssigns.length > 1) {
        facultyMultiSubjectMap[`${fac.id}_${cls.id}`] = true;
      }
    }
  }

  // Initialize schedules
  // schedule[classId][day][periodIndex] = assignmentId | null
  const schedule: TimetableSchedule = {};
  for (const cls of classes) {
    schedule[cls.id] = {};
    for (const day of days) {
      schedule[cls.id][day] = Array(totalPeriods).fill(null);
    }
  }

  // Track teacher commitments
  // teacherBusy[facultyId][day][periodIndex] = boolean
  const teacherBusy: Record<string, Record<string, boolean[]>> = {};
  for (const fac of faculties) {
    teacherBusy[fac.id] = {};
    for (const day of days) {
      teacherBusy[fac.id][day] = Array(totalPeriods).fill(false);
    }
  }

  // Helper to fetch faculty ID currently teaching a class in a slot
  const getFacultyAt = (classId: string, day: string, periodIdx: number): string | null => {
    const assignId = schedule[classId][day][periodIdx];
    if (!assignId) return null;
    const assign = assignments.find(a => a.id === assignId);
    return assign ? assign.facultyId : null;
  };

  // Helper to fetch subject ID currently in a slot
  const getSubjectAt = (classId: string, day: string, periodIdx: number): string | null => {
    const assignId = schedule[classId][day][periodIdx];
    if (!assignId) return null;
    const assign = assignments.find(a => a.id === assignId);
    return assign ? assign.subjectId : null;
  };

  // Helper to count how many times a subject is scheduled on a day for a class
  const getSubjectCountOnDay = (classId: string, day: string, subId: string): number => {
    let count = 0;
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      if (getSubjectAt(classId, day, pIdx) === subId) {
        count++;
      }
    }
    return count;
  };

  // Backtracking function
  let steps = 0;
  const MAX_STEPS = 15000;

  function backtrack(unitIdx: number): boolean {
    steps++;
    if (steps > MAX_STEPS) {
      return false; // safety timeout
    }

    if (unitIdx === lectureUnits.length) {
      // Avoid free periods in Period 1, Period 2, Period 3, and Period 4
      for (const cls of classes) {
        for (const day of days) {
          for (let p = 0; p < totalPeriods; p++) {
            if (isPeriod1To4(p)) {
              if (schedule[cls.id][day][p] === null) {
                // Check if there is some lesson after this period on this day
                let hasAfter = false;
                for (let j = p + 1; j < totalPeriods; j++) {
                  if (schedule[cls.id][day][j] !== null) {
                    hasAfter = true;
                    break;
                  }
                }
                if (hasAfter) {
                  return false; // Violates "avoid free periods in Period 1, 2, 3, and 4"
                }
              }
            }
          }
        }
      }
      return true; // All scheduled successfully!
    }

    const unit = lectureUnits[unitIdx];
    const { classId, facultyId, assignmentId, subjectId, duration } = unit;

    const sub = subjects.find(s => s.id === subjectId);
    const weeklyPeriods = sub ? sub.weeklyPeriods : 0;
    const isLab = sub ? sub.isLab === true : false;

    // Check if faculty has multiple subjects in this class
    const isMultiSubject = facultyMultiSubjectMap[`${facultyId}_${classId}`] || false;

    // Build all possible slots (day, periodIndex)
    const candidates: { day: DayOfWeek; periodIdx: number }[] = [];
    for (const day of days) {
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        // Must be vacant and within bounds
        if (duration === 2) {
          if (pIdx + 1 >= totalPeriods) continue;
          if (schedule[classId][day][pIdx] !== null || schedule[classId][day][pIdx + 1] !== null) continue;
          if (teacherBusy[facultyId][day][pIdx] || teacherBusy[facultyId][day][pIdx + 1]) continue;
          if (!arePeriodsConsecutive(pIdx, pIdx + 1)) continue;
        } else {
          if (schedule[classId][day][pIdx] !== null) continue;
          if (teacherBusy[facultyId][day][pIdx]) continue;
        }

        // Apply continuous class constraint if faculty takes multiple subjects in this class
        if (isMultiSubject) {
          if (duration === 2) {
            // Check before the 2-period block
            if (pIdx > 0) {
              const prevFac = getFacultyAt(classId, day, pIdx - 1);
              if (prevFac === facultyId) continue;
            }
            // Check after the 2-period block
            if (pIdx + 2 < totalPeriods) {
              const nextFac = getFacultyAt(classId, day, pIdx + 2);
              if (nextFac === facultyId) continue;
            }
          } else {
            // Check previous slot
            if (pIdx > 0) {
              const prevFac = getFacultyAt(classId, day, pIdx - 1);
              if (prevFac === facultyId) continue;
            }
            // Check next slot
            if (pIdx < totalPeriods - 1) {
              const nextFac = getFacultyAt(classId, day, pIdx + 1);
              if (nextFac === facultyId) continue;
            }
          }
        }

        // --- CONSTRAINTS ---
        // 1. Do not add continuous classes for the same subject on the same day
        if (duration === 2) {
          if (pIdx > 0) {
            const prevSub = getSubjectAt(classId, day, pIdx - 1);
            if (prevSub === subjectId) continue;
          }
          if (pIdx + 2 < totalPeriods) {
            const nextSub = getSubjectAt(classId, day, pIdx + 2);
            if (nextSub === subjectId) continue;
          }
        } else {
          if (pIdx > 0) {
            const prevSub = getSubjectAt(classId, day, pIdx - 1);
            if (prevSub === subjectId) continue;
          }
          if (pIdx < totalPeriods - 1) {
            const nextSub = getSubjectAt(classId, day, pIdx + 1);
            if (nextSub === subjectId) continue;
          }
        }

        // 2. Do not put the same subject more than once per day,
        // unless weeklyPeriods is greater than the number of active days.
        const currentCountOnDay = getSubjectCountOnDay(classId, day, subjectId);
        if (isLab) {
          if (currentCountOnDay > 0) continue;
        } else {
          const maxOccurrencesPerDay = (weeklyPeriods > days.length) ? Math.ceil(weeklyPeriods / days.length) : 1;
          if (currentCountOnDay >= maxOccurrencesPerDay) continue;
        }

        candidates.push({ day, periodIdx: pIdx });
      }
    }

    // Shuffling candidate slots adds randomness and avoids worst-case deterministic backtracking depth.
    // It finds valid schedules in a fraction of a millisecond.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Prioritize high-priority slots (Period 1, 2, and before lunch)
    candidates.sort((a, b) => {
      const prioA = isHighPriorityPeriod(a.periodIdx) ? 1 : 0;
      const prioB = isHighPriorityPeriod(b.periodIdx) ? 1 : 0;
      return prioB - prioA;
    });

    for (const cand of candidates) {
      const { day, periodIdx } = cand;

      // Make assignment
      if (duration === 2) {
        schedule[classId][day][periodIdx] = assignmentId;
        schedule[classId][day][periodIdx + 1] = assignmentId;
        teacherBusy[facultyId][day][periodIdx] = true;
        teacherBusy[facultyId][day][periodIdx + 1] = true;
      } else {
        schedule[classId][day][periodIdx] = assignmentId;
        teacherBusy[facultyId][day][periodIdx] = true;
      }

      if (backtrack(unitIdx + 1)) {
        return true;
      }

      // Backtrack / Undo assignment
      if (duration === 2) {
        schedule[classId][day][periodIdx] = null;
        schedule[classId][day][periodIdx + 1] = null;
        teacherBusy[facultyId][day][periodIdx] = false;
        teacherBusy[facultyId][day][periodIdx + 1] = false;
      } else {
        schedule[classId][day][periodIdx] = null;
        teacherBusy[facultyId][day][periodIdx] = false;
      }
    }

    return false;
  }

  const success = backtrack(0);

  if (success) {
    return {
      success: true,
      schedule,
      message: 'Timetable generated successfully without any clashes or continuity conflicts!'
    };
  } else {
    // If exact backtrack failed, let's return whatever we scheduled so far or try a greedy recovery to let the user see a partial schedule.
    // Let's run a greedy solver to fill as many slots as possible so the user gets a mostly complete timetable with notes about unscheduled items.
    return greedyFallback(faculties, subjects, classes, assignments, timeSlots, days, facultyMultiSubjectMap);
  }
}

/**
 * Greedy fallback if perfect backtracking fails. It places as many units as possible
 * and provides clear feedback on which lessons could not be scheduled.
 */
function greedyFallback(
  faculties: Faculty[],
  subjects: Subject[],
  classes: ClassSection[],
  assignments: Assignment[],
  timeSlots: TimeSlot[],
  days: DayOfWeek[],
  facultyMultiSubjectMap: Record<string, boolean>
): SolverResult {
  const activeSlots = timeSlots.filter(s => !s.isBreak);
  const totalPeriods = activeSlots.length;

  const lunchBreakIdx = timeSlots.findIndex(s => s.isBreak && s.label.toLowerCase().includes('lunch'));
  let activeLunchPredecessorId: string | null = null;
  if (lunchBreakIdx > 0) {
    for (let i = lunchBreakIdx - 1; i >= 0; i--) {
      if (!timeSlots[i].isBreak) {
        activeLunchPredecessorId = timeSlots[i].id;
        break;
      }
    }
  }

  const isHighPriorityPeriod = (pIdx: number): boolean => {
    if (pIdx === 0 || pIdx === 1) return true;
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    if (
      labelLower.includes('period 1') || 
      labelLower.includes('period 2') || 
      labelLower.includes('1st') || 
      labelLower.includes('2nd') ||
      labelLower.includes('period 3') ||
      labelLower.includes('period 4') ||
      labelLower.includes('3rd') ||
      labelLower.includes('4th') ||
      pIdx === 2 ||
      pIdx === 3
    ) {
      return true;
    }
    if (activeLunchPredecessorId && slot.id === activeLunchPredecessorId) {
      return true;
    }
    return false;
  };

  const arePeriodsConsecutive = (pIdx1: number, pIdx2: number): boolean => {
    const slot1 = activeSlots[pIdx1];
    const slot2 = activeSlots[pIdx2];
    if (!slot1 || !slot2) return false;
    const idx1 = timeSlots.findIndex(s => s.id === slot1.id);
    const idx2 = timeSlots.findIndex(s => s.id === slot2.id);
    return Math.abs(idx2 - idx1) === 1;
  };

  const isPeriod1To4 = (pIdx: number): boolean => {
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    const isP1 = labelLower.includes('period 1') || labelLower.includes('1st') || pIdx === 0;
    const isP2 = labelLower.includes('period 2') || labelLower.includes('2nd') || pIdx === 1;
    const isP3 = labelLower.includes('period 3') || labelLower.includes('3rd') || pIdx === 2;
    const isP4 = labelLower.includes('period 4') || labelLower.includes('4th') || pIdx === 3;
    return isP1 || isP2 || isP3 || isP4;
  };

  const schedule: TimetableSchedule = {};
  for (const cls of classes) {
    schedule[cls.id] = {};
    for (const day of days) {
      schedule[cls.id][day] = Array(totalPeriods).fill(null);
    }
  }

  const teacherBusy: Record<string, Record<string, boolean[]>> = {};
  for (const fac of faculties) {
    teacherBusy[fac.id] = {};
    for (const day of days) {
      teacherBusy[fac.id][day] = Array(totalPeriods).fill(false);
    }
  }

  const getFacultyAt = (classId: string, day: string, periodIdx: number): string | null => {
    const assignId = schedule[classId][day][periodIdx];
    if (!assignId) return null;
    const assign = assignments.find(a => a.id === assignId);
    return assign ? assign.facultyId : null;
  };

  // Helper to fetch subject ID currently in a slot
  const getSubjectAt = (classId: string, day: string, periodIdx: number): string | null => {
    const assignId = schedule[classId][day][periodIdx];
    if (!assignId) return null;
    const assign = assignments.find(a => a.id === assignId);
    return assign ? assign.subjectId : null;
  };

  // Helper to count how many times a subject is scheduled on a day for a class
  const getSubjectCountOnDay = (classId: string, day: string, subId: string): number => {
    let count = 0;
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      if (getSubjectAt(classId, day, pIdx) === subId) {
        count++;
      }
    }
    return count;
  };

  const lectureUnits: LectureUnit[] = [];
  for (const assign of assignments) {
    const sub = subjects.find(s => s.id === assign.subjectId);
    if (!sub) continue;
    if (sub.isLab) {
      let remaining = sub.weeklyPeriods;
      let i = 0;
      while (remaining > 0) {
        if (remaining >= 2) {
          lectureUnits.push({
            assignmentId: assign.id,
            classId: assign.classId,
            facultyId: assign.facultyId,
            subjectId: assign.subjectId,
            unitIndex: i,
            duration: 2,
          });
          remaining -= 2;
          i += 2;
        } else {
          lectureUnits.push({
            assignmentId: assign.id,
            classId: assign.classId,
            facultyId: assign.facultyId,
            subjectId: assign.subjectId,
            unitIndex: i,
            duration: 1,
          });
          remaining -= 1;
          i += 1;
        }
      }
    } else {
      for (let i = 0; i < sub.weeklyPeriods; i++) {
        lectureUnits.push({
          assignmentId: assign.id,
          classId: assign.classId,
          facultyId: assign.facultyId,
          subjectId: assign.subjectId,
          unitIndex: i,
          duration: 1,
        });
      }
    }
  }

  const unscheduledUnits: LectureUnit[] = [];

  for (const unit of lectureUnits) {
    const { classId, facultyId, assignmentId, subjectId, duration } = unit;
    const isMultiSubject = facultyMultiSubjectMap[`${facultyId}_${classId}`] || false;
    const sub = subjects.find(s => s.id === subjectId);
    const weeklyPeriods = sub ? sub.weeklyPeriods : 0;
    const isLab = sub ? sub.isLab === true : false;
    let placed = false;

    // Scan for any slot prioritizing high priority periods
    const candSlots: { day: DayOfWeek; pIdx: number }[] = [];
    for (const day of days) {
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        candSlots.push({ day, pIdx });
      }
    }
    candSlots.sort((a, b) => {
      const prioA = isHighPriorityPeriod(a.pIdx) ? 1 : 0;
      const prioB = isHighPriorityPeriod(b.pIdx) ? 1 : 0;
      return prioB - prioA;
    });

    for (const cand of candSlots) {
      const { day, pIdx } = cand;

      // Must be vacant and within bounds
      if (duration === 2) {
        if (pIdx + 1 >= totalPeriods) continue;
        if (schedule[classId][day][pIdx] !== null || schedule[classId][day][pIdx + 1] !== null) continue;
        if (teacherBusy[facultyId][day][pIdx] || teacherBusy[facultyId][day][pIdx + 1]) continue;
        if (!arePeriodsConsecutive(pIdx, pIdx + 1)) continue;
      } else {
        if (schedule[classId][day][pIdx] !== null) continue;
        if (teacherBusy[facultyId][day][pIdx]) continue;
      }

      // Apply continuous class constraint if faculty takes multiple subjects in this class
      if (isMultiSubject) {
        if (duration === 2) {
          // Check before the 2-period block
          if (pIdx > 0) {
            const prevFac = getFacultyAt(classId, day, pIdx - 1);
            if (prevFac === facultyId) continue;
          }
          // Check after the 2-period block
          if (pIdx + 2 < totalPeriods) {
            const nextFac = getFacultyAt(classId, day, pIdx + 2);
            if (nextFac === facultyId) continue;
          }
        } else {
          // Check previous slot
          if (pIdx > 0 && getFacultyAt(classId, day, pIdx - 1) === facultyId) continue;
          // Check next slot
          if (pIdx < totalPeriods - 1 && getFacultyAt(classId, day, pIdx + 1) === facultyId) continue;
        }
      }

      // --- CONSTRAINTS ---
      // 1. Do not add continuous classes for the same subject on the same day
      if (duration === 2) {
        if (pIdx > 0) {
          const prevSub = getSubjectAt(classId, day, pIdx - 1);
          if (prevSub === subjectId) continue;
        }
        if (pIdx + 2 < totalPeriods) {
          const nextSub = getSubjectAt(classId, day, pIdx + 2);
          if (nextSub === subjectId) continue;
        }
      } else {
        if (pIdx > 0) {
          const prevSub = getSubjectAt(classId, day, pIdx - 1);
          if (prevSub === subjectId) continue;
        }
        if (pIdx < totalPeriods - 1) {
          const nextSub = getSubjectAt(classId, day, pIdx + 1);
          if (nextSub === subjectId) continue;
        }
      }

      // 2. Do not put the same subject more than once per day,
      // unless weeklyPeriods is greater than the number of active days.
      const currentCountOnDay = getSubjectCountOnDay(classId, day, subjectId);
      if (isLab) {
        if (currentCountOnDay > 0) continue;
      } else {
        const maxOccurrencesPerDay = (weeklyPeriods > days.length) ? Math.ceil(weeklyPeriods / days.length) : 1;
        if (currentCountOnDay >= maxOccurrencesPerDay) continue;
      }

      // Place
      if (duration === 2) {
        schedule[classId][day][pIdx] = assignmentId;
        schedule[classId][day][pIdx + 1] = assignmentId;
        teacherBusy[facultyId][day][pIdx] = true;
        teacherBusy[facultyId][day][pIdx + 1] = true;
      } else {
        schedule[classId][day][pIdx] = assignmentId;
        teacherBusy[facultyId][day][pIdx] = true;
      }
      placed = true;
      break;
    }

    if (!placed) {
      unscheduledUnits.push(unit);
    }
  }

  return {
    success: false,
    schedule,
    message: `Could not schedule ${unscheduledUnits.length} periods due to tight constraints. Loaded partial clash-free timetable. Try increasing weekly periods, adding days, or adjusting staff assignments.`,
    unscheduledUnits: unscheduledUnits.map(u => ({
      classId: u.classId,
      subjectId: u.subjectId,
      facultyId: u.facultyId,
      unitIndex: u.unitIndex
    }))
  };
}

/**
 * Generates initial sample data representing HKE Society's Sir M. Visvesvaraya College of Engineering, Raichur.
 */
export function getSampleData() {
  const faculties: Faculty[] = [
    { id: 'f1', name: 'Dr. B. Raghavendra', shortName: 'BR (HOD)', department: 'CSE', email: 'hod.cse@hkesmvce.ac.in' },
    { id: 'f2', name: 'Prof. Savitha K.', shortName: 'SK', department: 'CSE', email: 'savitha.k@hkesmvce.ac.in' },
    { id: 'f3', name: 'Prof. Mallikarjun', shortName: 'MK', department: 'CSE', email: 'mallikarjun@hkesmvce.ac.in' },
    { id: 'f4', name: 'Prof. Shridevi', shortName: 'SD', department: 'CSE', email: 'shridevi@hkesmvce.ac.in' },
    { id: 'f5', name: 'Dr. Vijaylaxmi', shortName: 'VL', department: 'ECE', email: 'vijaylaxmi@hkesmvce.ac.in' },
    { id: 'f6', name: 'Prof. Suresh Kumar', shortName: 'SKM', department: 'ECE', email: 'suresh.m@hkesmvce.ac.in' },
    { id: 'f7', name: 'Dr. Ramesh Pathak', shortName: 'RP', department: 'Applied Science', email: 'ramesh.physics@hkesmvce.ac.in' },
    { id: 'f8', name: 'Prof. Geeta', shortName: 'GT', department: 'Applied Science', email: 'geeta.maths@hkesmvce.ac.in' },
  ];

  const subjects: Subject[] = [
    // CSE V Sem
    { id: 's1', code: '21CS51', name: 'Automata Theory & Computability', department: 'CSE', weeklyPeriods: 4 },
    { id: 's2', code: '21CS52', name: 'Computer Networks', department: 'CSE', weeklyPeriods: 4 },
    { id: 's3', code: '21CS53', name: 'Database Management Systems', department: 'CSE', weeklyPeriods: 4 },
    { id: 's4', code: '21CS54', name: 'Artificial Intelligence & Machine Learning', department: 'CSE', weeklyPeriods: 3 },
    { id: 's5', code: '21CSL58', name: 'Web Technology Laboratory', department: 'CSE', weeklyPeriods: 3, isLab: true },
    // ECE V Sem
    { id: 's6', code: '21EC51', name: 'Digital Signal Processing', department: 'ECE', weeklyPeriods: 4 },
    { id: 's7', code: '21EC52', name: 'Digital Communication', department: 'ECE', weeklyPeriods: 4 },
    { id: 's8', code: '21EC53', name: 'Microwave & Antennas', department: 'ECE', weeklyPeriods: 3 },
    // Common / Mathematics
    { id: 's9', code: '21MAT51', name: 'Technological Mathematics', department: 'Applied Science', weeklyPeriods: 4 },
  ];

  const classes: ClassSection[] = [
    { id: 'c1', name: 'V Sem CSE', semester: '5th', section: 'A' },
    { id: 'c2', name: 'V Sem ECE', semester: '5th', section: 'B' },
  ];

  const assignments: Assignment[] = [
    // V Sem CSE
    { id: 'a1', classId: 'c1', subjectId: 's1', facultyId: 'f1' }, // Automata -> Dr. B. Raghavendra
    { id: 'a2', classId: 'c1', subjectId: 's2', facultyId: 'f3' }, // Networks -> Prof. Mallikarjun
    { id: 'a3', classId: 'c1', subjectId: 's3', facultyId: 'f2' }, // DBMS -> Prof. Savitha K. (Subject 1)
    { id: 'a4', classId: 'c1', subjectId: 's5', facultyId: 'f2' }, // Web Tech Lab -> Prof. Savitha K. (Subject 2 - continuous class constraint triggered!)
    { id: 'a5', classId: 'c1', subjectId: 's4', facultyId: 'f4' }, // AI/ML -> Prof. Shridevi
    { id: 'a6', classId: 'c1', subjectId: 's9', facultyId: 'f8' }, // Maths -> Prof. Geeta

    // V Sem ECE
    { id: 'a7', classId: 'c2', subjectId: 's6', facultyId: 'f5' }, // DSP -> Dr. Vijaylaxmi
    { id: 'a8', classId: 'c2', subjectId: 's7', facultyId: 'f6' }, // Comm -> Prof. Suresh Kumar
    { id: 'a9', classId: 'c2', subjectId: 's8', facultyId: 'f6' }, // Microwave -> Prof. Suresh Kumar (Subject 2 - continuous class constraint triggered!)
    { id: 'a10', classId: 'c2', subjectId: 's9', facultyId: 'f8' }, // Maths -> Prof. Geeta (Overlap test! Faculty GT teaches maths in CSE and ECE)
  ];

  const timeSlots: TimeSlot[] = [
    { id: 'ts1', label: 'Period 1', startTime: '09:00', endTime: '10:00', isBreak: false },
    { id: 'ts2', label: 'Period 2', startTime: '10:00', endTime: '11:00', isBreak: false },
    { id: 'ts3', label: 'Tea Break', startTime: '11:00', endTime: '11:15', isBreak: true },
    { id: 'ts4', label: 'Period 3', startTime: '11:15', endTime: '12:15', isBreak: false },
    { id: 'ts5', label: 'Period 4', startTime: '12:15', endTime: '13:15', isBreak: false },
    { id: 'ts6', label: 'Lunch Break', startTime: '13:15', endTime: '14:15', isBreak: true },
    { id: 'ts7', label: 'Period 5', startTime: '14:15', endTime: '15:15', isBreak: false },
    { id: 'ts8', label: 'Period 6', startTime: '15:15', endTime: '16:15', isBreak: false },
  ];

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    faculties,
    subjects,
    classes,
    assignments,
    timeSlots,
    days
  };
}
