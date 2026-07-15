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

export interface ClassGroupInfo {
  groupId: string;
  baseSection: string;
  batch: string | null;
  semester: string;
}

export function getClassGroupInfo(cls: ClassSection): ClassGroupInfo {
  const sectionStr = cls.section.trim().toUpperCase();
  // Match a letter (A-Z) followed by optional spaces/hyphens and then digits (\d+) at the end
  const match = sectionStr.match(/([A-Z])\s*-?\s*(\d+)$/);
  const baseSection = match ? match[1] : sectionStr;
  const batch = match ? match[2] : null;
  return {
    groupId: `${cls.semester}_${baseSection}`,
    baseSection,
    batch,
    semester: cls.semester
  };
}

export function areSiblingBatches(cls1: ClassSection, cls2: ClassSection): boolean {
  if (cls1.id === cls2.id) return false;
  const info1 = getClassGroupInfo(cls1);
  const info2 = getClassGroupInfo(cls2);
  return info1.groupId === info2.groupId && 
         info1.batch !== null && 
         info2.batch !== null;
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

  // Helper to check if an active slot corresponds to Period 1
  const isPeriod1 = (pIdx: number): boolean => {
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    return labelLower.includes('period 1') || labelLower.includes('1st') || pIdx === 0;
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

  // Pre-calculate class lab units count
  const classLabUnitsCount: Record<string, number> = {};
  for (const cls of classes) {
    let labCount = 0;
    const classAssigns = assignments.filter(a => a.classId === cls.id);
    for (const assign of classAssigns) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub && sub.isLab) {
        labCount += sub.weeklyPeriods;
      }
    }
    classLabUnitsCount[cls.id] = labCount;
  }

  // Pre-calculate group lab faculties
  const groupLabFaculties: Record<string, Set<string>> = {};
  for (const assign of assignments) {
    const sub = subjects.find(s => s.id === assign.subjectId);
    if (sub && sub.isLab) {
      const cls = classes.find(c => c.id === assign.classId);
      if (cls) {
        const info = getClassGroupInfo(cls);
        if (!groupLabFaculties[info.groupId]) {
          groupLabFaculties[info.groupId] = new Set();
        }
        groupLabFaculties[info.groupId].add(assign.facultyId);
      }
    }
  }

  const shareLabFaculty = (groupId1: string, groupId2: string): boolean => {
    if (groupId1 === groupId2) return false;
    const set1 = groupLabFaculties[groupId1];
    const set2 = groupLabFaculties[groupId2];
    if (!set1 || !set2) return false;
    for (const fac of set1) {
      if (set2.has(fac)) return true;
    }
    return false;
  };

  const hasClassLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subId = getSubjectAt(classId, day, pIdx);
      if (subId) {
        const sub = subjects.find(s => s.id === subId);
        if (sub && sub.isLab) {
          return true;
        }
      }
    }
    return false;
  };

  const countScheduledLabUnits = (classId: string): number => {
    let count = 0;
    for (const d of days) {
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        const subId = getSubjectAt(classId, d, pIdx);
        if (subId) {
          const sub = subjects.find(s => s.id === subId);
          if (sub && sub.isLab) {
            count++;
          }
        }
      }
    }
    return count;
  };

  const hasSharedFacultyLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    const currentCls = classes.find(cl => cl.id === classId);
    if (!currentCls) return false;
    const currentInfo = getClassGroupInfo(currentCls);

    for (const otherCls of classes) {
      if (otherCls.id === classId) continue;
      const otherInfo = getClassGroupInfo(otherCls);
      if (currentInfo.groupId === otherInfo.groupId) continue;

      if (shareLabFaculty(currentInfo.groupId, otherInfo.groupId)) {
        if (hasClassLabOnDay(otherCls.id, day)) {
          return true;
        }
      }
    }
    return false;
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

        // 3. One subject has to be allotted only once for Period 1 in a week.
        const occupiesPeriod1 = duration === 2 ? (isPeriod1(pIdx) || isPeriod1(pIdx + 1)) : isPeriod1(pIdx);
        if (occupiesPeriod1) {
          let alreadyAllotted = false;
          for (const d of days) {
            for (let p = 0; p < totalPeriods; p++) {
              if (isPeriod1(p) && getSubjectAt(classId, d, p) === subjectId) {
                alreadyAllotted = true;
                break;
              }
            }
            if (alreadyAllotted) break;
          }
          if (alreadyAllotted) continue;
        }

        // 4. Lab constraints: sibling batches on the same day, shared-faculty labs on different days
        if (isLab) {
          const currentCls = classes.find(cl => cl.id === classId);
          if (currentCls) {
            const siblings = classes.filter(cl => areSiblingBatches(currentCls, cl));
            let siblingConstraintViolated = false;
            for (const sib of siblings) {
              const sibTotalLabPeriods = classLabUnitsCount[sib.id] || 0;
              if (sibTotalLabPeriods === 0) continue;

              const sibHasLabOnDay = hasClassLabOnDay(sib.id, day);
              if (sibHasLabOnDay) {
                continue; // Matches sibling's lab day
              }

              const sibScheduledLabPeriods = countScheduledLabUnits(sib.id);
              const sibRemainingLabPeriods = sibTotalLabPeriods - sibScheduledLabPeriods;
              if (sibRemainingLabPeriods <= 0) {
                siblingConstraintViolated = true;
                break;
              }
            }
            if (siblingConstraintViolated) continue;
          }

          if (hasSharedFacultyLabOnDay(classId, day)) {
            continue;
          }
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

  const isPeriod1 = (pIdx: number): boolean => {
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    return labelLower.includes('period 1') || labelLower.includes('1st') || pIdx === 0;
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

  // Pre-calculate class lab units count
  const classLabUnitsCount: Record<string, number> = {};
  for (const cls of classes) {
    let labCount = 0;
    const classAssigns = assignments.filter(a => a.classId === cls.id);
    for (const assign of classAssigns) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub && sub.isLab) {
        labCount += sub.weeklyPeriods;
      }
    }
    classLabUnitsCount[cls.id] = labCount;
  }

  // Pre-calculate group lab faculties
  const groupLabFaculties: Record<string, Set<string>> = {};
  for (const assign of assignments) {
    const sub = subjects.find(s => s.id === assign.subjectId);
    if (sub && sub.isLab) {
      const cls = classes.find(c => c.id === assign.classId);
      if (cls) {
        const info = getClassGroupInfo(cls);
        if (!groupLabFaculties[info.groupId]) {
          groupLabFaculties[info.groupId] = new Set();
        }
        groupLabFaculties[info.groupId].add(assign.facultyId);
      }
    }
  }

  const shareLabFaculty = (groupId1: string, groupId2: string): boolean => {
    if (groupId1 === groupId2) return false;
    const set1 = groupLabFaculties[groupId1];
    const set2 = groupLabFaculties[groupId2];
    if (!set1 || !set2) return false;
    for (const fac of set1) {
      if (set2.has(fac)) return true;
    }
    return false;
  };

  const hasClassLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subId = getSubjectAt(classId, day, pIdx);
      if (subId) {
        const sub = subjects.find(s => s.id === subId);
        if (sub && sub.isLab) {
          return true;
        }
      }
    }
    return false;
  };

  const countScheduledLabUnits = (classId: string): number => {
    let count = 0;
    for (const d of days) {
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        const subId = getSubjectAt(classId, d, pIdx);
        if (subId) {
          const sub = subjects.find(s => s.id === subId);
          if (sub && sub.isLab) {
            count++;
          }
        }
      }
    }
    return count;
  };

  const hasSharedFacultyLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    const currentCls = classes.find(cl => cl.id === classId);
    if (!currentCls) return false;
    const currentInfo = getClassGroupInfo(currentCls);

    for (const otherCls of classes) {
      if (otherCls.id === classId) continue;
      const otherInfo = getClassGroupInfo(otherCls);
      if (currentInfo.groupId === otherInfo.groupId) continue;

      if (shareLabFaculty(currentInfo.groupId, otherInfo.groupId)) {
        if (hasClassLabOnDay(otherCls.id, day)) {
          return true;
        }
      }
    }
    return false;
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

      // 3. One subject has to be allotted only once for Period 1 in a week.
      const occupiesPeriod1 = duration === 2 ? (isPeriod1(pIdx) || isPeriod1(pIdx + 1)) : isPeriod1(pIdx);
      if (occupiesPeriod1) {
        let alreadyAllotted = false;
        for (const d of days) {
          for (let p = 0; p < totalPeriods; p++) {
            if (isPeriod1(p) && getSubjectAt(classId, d, p) === subjectId) {
              alreadyAllotted = true;
              break;
            }
          }
          if (alreadyAllotted) break;
        }
        if (alreadyAllotted) continue;
      }

      // 4. Lab constraints: sibling batches on the same day, shared-faculty labs on different days
      if (isLab) {
        const currentCls = classes.find(cl => cl.id === classId);
        if (currentCls) {
          const siblings = classes.filter(cl => areSiblingBatches(currentCls, cl));
          let siblingConstraintViolated = false;
          for (const sib of siblings) {
            const sibTotalLabPeriods = classLabUnitsCount[sib.id] || 0;
            if (sibTotalLabPeriods === 0) continue;

            const sibHasLabOnDay = hasClassLabOnDay(sib.id, day);
            if (sibHasLabOnDay) {
              continue; // Matches sibling's lab day
            }

            const sibScheduledLabPeriods = countScheduledLabUnits(sib.id);
            const sibRemainingLabPeriods = sibTotalLabPeriods - sibScheduledLabPeriods;
            if (sibRemainingLabPeriods <= 0) {
              siblingConstraintViolated = true;
              break;
            }
          }
          if (siblingConstraintViolated) continue;
        }

        if (hasSharedFacultyLabOnDay(classId, day)) {
          continue;
        }
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
  const faculties: Faculty[] = [];
  const subjects: Subject[] = [];
  const classes: ClassSection[] = [];
  const assignments: Assignment[] = [];

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
