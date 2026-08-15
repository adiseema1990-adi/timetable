/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Faculty, Subject, ClassSection, Assignment, TimeSlot, DayOfWeek, TimetableSchedule, BatchAssignment } from '../types';

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

export interface ParallelLabUnit {
  isParallelLab: true;
  classId: string;
  sessionIndex: number;
  duration: number; // 2
  batchAssignments: {
    batchName: string;
    assignmentId: string;
    facultyId: string;
    subjectId: string;
  }[];
}

export const isSubjectLab = (sub: Subject | undefined): boolean => {
  if (!sub) return false;
  if (sub.isLab === true) return true;
  const nameLower = (sub.name || '').toLowerCase();
  const codeLower = (sub.code || '').toLowerCase();
  return nameLower.includes('lab') || nameLower.includes('practical') || codeLower.includes('lab');
};

export const getBatchItemsFromCell = (cell: any): BatchAssignment[] | null => {
  if (!cell) return null;
  if (Array.isArray(cell)) return cell;
  if (typeof cell === 'object') {
    if (cell._isBatchArray && Array.isArray(cell.items)) return cell.items;
    if ('batches' in cell && Array.isArray(cell.batches)) return cell.batches;
    if ('items' in cell && Array.isArray(cell.items)) return cell.items;
  }
  return null;
};

export const getAssignmentIdsFromCell = (cell: any): string[] => {
  if (!cell) return [];
  if (typeof cell === 'string') return [cell];
  const batchItems = getBatchItemsFromCell(cell);
  if (batchItems) return batchItems.map(b => b.assignmentId);
  return [];
};

export const serializeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      const serialized = serializeForFirestore(item);
      if (Array.isArray(serialized)) {
        return { _isBatchArray: true, items: serialized };
      }
      return serialized;
    });
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      result[key] = val.map(item => {
        const serialized = serializeForFirestore(item);
        if (Array.isArray(serialized)) {
          return { _isBatchArray: true, items: serialized };
        }
        return serialized;
      });
    } else {
      result[key] = serializeForFirestore(val);
    }
  }
  return result;
};

export const deserializeFromFirestore = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deserializeFromFirestore(item));
  }

  if (obj._isBatchArray === true && Array.isArray(obj.items)) {
    return obj.items.map((item: any) => deserializeFromFirestore(item));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[key] = deserializeFromFirestore(obj[key]);
  }
  return result;
};

export interface StandardUnit {
  isParallelLab: false;
  assignmentId: string;
  classId: string;
  facultyId: string;
  subjectId: string;
  unitIndex: number; // 0 to weeklyPeriods-1
  duration: number; // 1 or 2
}

export type SolverUnit = ParallelLabUnit | StandardUnit;

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
  const weekdayDays = days.filter(d => d !== 'Saturday');
  const weekdaySlotsPerClass = activeSlotsCount * weekdayDays.length;

  const lunchBreakIdx = timeSlots.findIndex(s => s.isBreak && s.label.toLowerCase().includes('lunch'));
  let activeSlotsAfterLunchCount = 0;
  if (lunchBreakIdx !== -1) {
    for (let i = lunchBreakIdx + 1; i < timeSlots.length; i++) {
      if (!timeSlots[i].isBreak) {
        activeSlotsAfterLunchCount++;
      }
    }
  }
  const totalSlotsAfterLunchPerClass = activeSlotsAfterLunchCount * days.length;
  // After lunch slots available on weekdays
  const weekdaySlotsAfterLunchPerClass = activeSlotsAfterLunchCount * weekdayDays.length;

  // 1. Check if any class has more requested periods than available slots
  for (const cls of classes) {
    const classAssignments = assignments.filter(a => a.classId === cls.id);
    let totalNonAictePeriodsRequested = 0;
    let totalProjectPeriodsRequested = 0;

    if (cls.labBatches && cls.labBatches > 1) {
      const labAssigns = classAssignments.filter(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        return sub && sub.isLab;
      });
      const nonLabAssigns = classAssignments.filter(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        return !sub || !sub.isLab;
      });
      for (const assign of nonLabAssigns) {
        const sub = subjects.find(s => s.id === assign.subjectId);
        if (sub && !sub.isAicteActivity) {
          totalNonAictePeriodsRequested += sub.weeklyPeriods;
          if (sub.isProject) totalProjectPeriodsRequested += sub.weeklyPeriods;
        }
      }
      if (labAssigns.length > 0) {
        const numSessions = Math.max(
          ...labAssigns.map(a => {
            const sub = subjects.find(s => s.id === a.subjectId);
            return sub ? Math.ceil(sub.weeklyPeriods / 2) : 1;
          }),
          labAssigns.length
        );
        totalNonAictePeriodsRequested += numSessions * 2;
      }
    } else {
      for (const assign of classAssignments) {
        const sub = subjects.find(s => s.id === assign.subjectId);
        if (sub && !sub.isAicteActivity) {
          totalNonAictePeriodsRequested += sub.weeklyPeriods;
          if (sub.isProject) {
            totalProjectPeriodsRequested += sub.weeklyPeriods;
          }
        }
      }
    }

    if (totalNonAictePeriodsRequested > weekdaySlotsPerClass) {
      errors.push(
        `Class "${cls.name} (Sec ${cls.section})" requires ${totalNonAictePeriodsRequested} standard periods, but only ${weekdaySlotsPerClass} slots are available on weekdays (${weekdayDays.length} days × ${activeSlotsCount} periods) as Saturday is reserved for AICTE Activity.`
      );
    }

    if (lunchBreakIdx !== -1 && totalProjectPeriodsRequested > weekdaySlotsAfterLunchPerClass) {
      errors.push(
        `Class "${cls.name} (Sec ${cls.section})" requires ${totalProjectPeriodsRequested} Project/Seminar/Internship periods, but only ${weekdaySlotsAfterLunchPerClass} slots after lunch are available on weekdays (${weekdayDays.length} days × ${activeSlotsAfterLunchCount} periods).`
      );
    }

    // AICTE Activity check (assigned or unassigned)
    let totalAictePeriodsRequested = 0;
    for (const assign of classAssignments) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub && sub.isAicteActivity) {
        if (!days.includes('Saturday' as DayOfWeek)) {
          errors.push(
            `Class "${cls.name} (Sec ${cls.section})" requires AICTE Activity subject "${sub.name} (${sub.code})", but Saturday is not included in active days.`
          );
        }
        totalAictePeriodsRequested += sub.weeklyPeriods;
      }
    }
    // Also check unassigned AICTE Activity subjects
    const unassignedAicteSubs = subjects.filter(s => s.isAicteActivity && !classAssignments.some(a => a.subjectId === s.id));
    for (const sub of unassignedAicteSubs) {
      if (!days.includes('Saturday' as DayOfWeek)) {
        errors.push(
          `Class "${cls.name} (Sec ${cls.section})" requires AICTE Activity subject "${sub.name} (${sub.code})", but Saturday is not included in active days.`
        );
      }
      totalAictePeriodsRequested += sub.weeklyPeriods;
    }

    if (days.includes('Saturday' as DayOfWeek) && totalAictePeriodsRequested > activeSlotsCount) {
      errors.push(
        `Class "${cls.name} (Sec ${cls.section})" requires ${totalAictePeriodsRequested} AICTE Activity periods, but only ${activeSlotsCount} slots are available on Saturday.`
      );
    }

    // Student Activity / Mentoring check (assigned or unassigned - must be after lunch)
    let totalMentoringPeriodsRequested = 0;
    for (const assign of classAssignments) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub && sub.isStudentActivity) {
        totalMentoringPeriodsRequested += sub.weeklyPeriods;
      }
    }
    const unassignedMentoringSubs = subjects.filter(s => s.isStudentActivity && !classAssignments.some(a => a.subjectId === s.id));
    for (const sub of unassignedMentoringSubs) {
      totalMentoringPeriodsRequested += sub.weeklyPeriods;
    }
    if (lunchBreakIdx !== -1 && totalMentoringPeriodsRequested > totalSlotsAfterLunchPerClass) {
      errors.push(
        `Class "${cls.name} (Sec ${cls.section})" requires ${totalMentoringPeriodsRequested} Student Activity / Mentoring periods, but only ${totalSlotsAfterLunchPerClass} slots after lunch are available in the week.`
      );
    }
  }

  // 2. Check if any faculty has more total periods than the total slots in a week
  for (const fac of faculties) {
    const facAssignments = assignments.filter(a => a.facultyId === fac.id);
    let totalFacPeriods = 0;
    let totalFacProjectPeriods = 0;
    for (const assign of facAssignments) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      if (sub) {
        totalFacPeriods += sub.weeklyPeriods;
        if (sub.isProject) {
          totalFacProjectPeriods += sub.weeklyPeriods;
        }
      }
    }

    if (totalFacPeriods > totalSlotsPerClass) {
      errors.push(
        `Faculty "${fac.name} (${fac.shortName})" is assigned to teach ${totalFacPeriods} periods, but there are only ${totalSlotsPerClass} total available slots in a week.`
      );
    }

    if (lunchBreakIdx !== -1 && totalFacProjectPeriods > totalSlotsAfterLunchPerClass) {
      errors.push(
        `Faculty "${fac.name} (${fac.shortName})" is assigned to teach ${totalFacProjectPeriods} Project/Seminar/Internship periods, but there are only ${totalSlotsAfterLunchPerClass} available slots after lunch in a week.`
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
 * Helper to build SolverUnits for all classes and assignments.
 */
function buildLectureUnits(
  classes: ClassSection[],
  assignments: Assignment[],
  subjects: Subject[]
): SolverUnit[] {
  const lectureUnits: SolverUnit[] = [];

  for (const cls of classes) {
    const classAssigns = [...assignments.filter(a => a.classId === cls.id)];

    // Auto-include unassigned AICTE Activity / Student Activity subjects if no assignment exists for this class
    const existingSubIds = new Set(classAssigns.map(a => a.subjectId));
    const unassignedSpecialSubs = subjects.filter(s => (s.isAicteActivity || s.isStudentActivity) && !existingSubIds.has(s.id));
    for (const specSub of unassignedSpecialSubs) {
      classAssigns.push({
        id: `auto_${cls.id}_${specSub.id}`,
        classId: cls.id,
        subjectId: specSub.id,
        facultyId: ''
      });
    }

    const numBatches = (cls.labBatches !== undefined && cls.labBatches !== null && cls.labBatches > 0) ? cls.labBatches : 2;
    if (numBatches > 1) {
      const labAssigns = classAssigns.filter(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        return isSubjectLab(sub);
      });
      const nonLabAssigns = classAssigns.filter(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        return !isSubjectLab(sub);
      });

      // Theory subjects
      for (const assign of nonLabAssigns) {
        const sub = subjects.find(s => s.id === assign.subjectId);
        if (!sub) continue;
        if (sub.isAicteActivity) {
          for (let i = 0; i < sub.weeklyPeriods; i++) {
            lectureUnits.push({
              isParallelLab: false,
              assignmentId: assign.id,
              classId: assign.classId,
              facultyId: assign.facultyId,
              subjectId: assign.subjectId,
              unitIndex: i,
              duration: 1,
            });
          }
        } else {
          for (let i = 0; i < sub.weeklyPeriods; i++) {
            lectureUnits.push({
              isParallelLab: false,
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

      // Parallel Lab sessions
      if (labAssigns.length > 0) {
        const sec = cls.section.trim().toUpperCase() || 'A';
        const batchNames: string[] = [];
        for (let b = 1; b <= numBatches; b++) {
          batchNames.push(`${sec}${b}`);
        }

        const numSessions = Math.max(
          ...labAssigns.map(a => {
            const sub = subjects.find(s => s.id === a.subjectId);
            return sub ? Math.ceil(sub.weeklyPeriods / 2) : 1;
          }),
          labAssigns.length
        );

        for (let s = 0; s < numSessions; s++) {
          const batchAssignments: ParallelLabUnit['batchAssignments'] = [];
          for (let b = 0; b < numBatches; b++) {
            const assignIdx = (s + b) % labAssigns.length;
            const assign = labAssigns[assignIdx];
            const sub = subjects.find(s => s.id === assign.subjectId);
            batchAssignments.push({
              batchName: batchNames[b],
              assignmentId: assign.id,
              facultyId: assign.facultyId,
              subjectId: sub ? sub.id : assign.subjectId,
            });
          }

          lectureUnits.push({
            isParallelLab: true,
            classId: cls.id,
            sessionIndex: s,
            duration: 2,
            batchAssignments,
          });
        }
      }
    } else {
      // Standard class (labBatches <= 1)
      for (const assign of classAssigns) {
        const sub = subjects.find(s => s.id === assign.subjectId);
        if (!sub) continue;
        if (sub.isLab) {
          let remaining = sub.weeklyPeriods;
          let i = 0;
          while (remaining > 0) {
            if (remaining >= 2) {
              lectureUnits.push({
                isParallelLab: false,
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
                isParallelLab: false,
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
        } else if (sub.isAicteActivity) {
          for (let i = 0; i < sub.weeklyPeriods; i++) {
            lectureUnits.push({
              isParallelLab: false,
              assignmentId: assign.id,
              classId: assign.classId,
              facultyId: assign.facultyId,
              subjectId: assign.subjectId,
              unitIndex: i,
              duration: 1,
            });
          }
        } else {
          for (let i = 0; i < sub.weeklyPeriods; i++) {
            lectureUnits.push({
              isParallelLab: false,
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
    }
  }

  return lectureUnits;
}

/**
 * A highly optimized backtracking timetable generator with constraint satisfaction.
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
  const lectureUnits = buildLectureUnits(classes, assignments, subjects);

  // Identify which faculties take multiple subjects in the SAME class
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
  const schedule: TimetableSchedule = {};
  for (const cls of classes) {
    schedule[cls.id] = {};
    for (const day of days) {
      schedule[cls.id][day] = Array(totalPeriods).fill(null);
    }
  }

  // Track teacher commitments
  const teacherBusy: Record<string, Record<string, boolean[]>> = {};
  for (const fac of faculties) {
    teacherBusy[fac.id] = {};
    for (const day of days) {
      teacherBusy[fac.id][day] = Array(totalPeriods).fill(false);
    }
  }

  const getFacultiesAt = (classId: string, day: string, periodIdx: number): string[] => {
    const cell = schedule[classId][day][periodIdx];
    if (!cell) return [];
    if (typeof cell === 'string') {
      const assign = assignments.find(a => a.id === cell);
      return assign ? [assign.facultyId] : [];
    }
    const batchItems = getBatchItemsFromCell(cell);
    if (batchItems) {
      const facs: string[] = [];
      for (const item of batchItems) {
        const assign = assignments.find(a => a.id === item.assignmentId);
        if (assign) facs.push(assign.facultyId);
      }
      return facs;
    }
    return [];
  };

  const getSubjectsAt = (classId: string, day: string, periodIdx: number): string[] => {
    const cell = schedule[classId][day][periodIdx];
    if (!cell) return [];
    if (typeof cell === 'string') {
      const assign = assignments.find(a => a.id === cell);
      return assign ? [assign.subjectId] : [];
    }
    const batchItems = getBatchItemsFromCell(cell);
    if (batchItems) {
      const subs: string[] = [];
      for (const item of batchItems) {
        const assign = assignments.find(a => a.id === item.assignmentId);
        if (assign) subs.push(assign.subjectId);
      }
      return subs;
    }
    return [];
  };

  const getSubjectCountOnDay = (classId: string, day: string, subId: string): number => {
    let count = 0;
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subs = getSubjectsAt(classId, day, pIdx);
      if (subs.includes(subId)) {
        count++;
      }
    }
    return count;
  };

  const hasClassLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subs = getSubjectsAt(classId, day, pIdx);
      for (const sId of subs) {
        const sub = subjects.find(s => s.id === sId);
        if (sub && sub.isLab) return true;
      }
    }
    return false;
  };

  // Sort units: schedule parallel labs and longer units first
  lectureUnits.sort((a, b) => {
    if (a.isParallelLab && !b.isParallelLab) return -1;
    if (!a.isParallelLab && b.isParallelLab) return 1;
    return b.duration - a.duration;
  });

  // Backtracking function
  let steps = 0;
  const MAX_STEPS = 20000;

  function backtrack(unitIdx: number): boolean {
    steps++;
    if (steps > MAX_STEPS) {
      return false;
    }

    if (unitIdx === lectureUnits.length) {
      // Avoid free periods in Period 1, Period 2, Period 3, and Period 4
      for (const cls of classes) {
        for (const day of days) {
          for (let p = 0; p < totalPeriods; p++) {
            if (isPeriod1To4(p)) {
              if (schedule[cls.id][day][p] === null) {
                let hasAfter = false;
                for (let j = p + 1; j < totalPeriods; j++) {
                  if (schedule[cls.id][day][j] !== null) {
                    hasAfter = true;
                    break;
                  }
                }
                if (hasAfter) {
                  return false;
                }
              }
            }
          }
        }
      }
      return true;
    }

    const unit = lectureUnits[unitIdx];

    // Build all candidate slots
    const candidates: { day: DayOfWeek; periodIdx: number }[] = [];
    for (const day of days) {
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        candidates.push({ day, periodIdx: pIdx });
      }
    }

    // Shuffle and prioritize
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    candidates.sort((a, b) => {
      const prioA = isHighPriorityPeriod(a.periodIdx) ? 1 : 0;
      const prioB = isHighPriorityPeriod(b.periodIdx) ? 1 : 0;
      return prioB - prioA;
    });

    if (unit.isParallelLab) {
      const { classId, batchAssignments } = unit;

      for (const cand of candidates) {
        const { day, periodIdx } = cand;

        // Saturday is strictly reserved for AICTE Activity subjects
        if (day === 'Saturday') continue;

        if (periodIdx + 1 >= totalPeriods) continue;
        if (schedule[classId][day][periodIdx] !== null || schedule[classId][day][periodIdx + 1] !== null) continue;
        if (!arePeriodsConsecutive(periodIdx, periodIdx + 1)) continue;

        // Check if all faculties are free and prevent back-to-back continuous lectures across sections
        let anyFacultyBusy = false;
        let anyFacultyContinuous = false;
        for (const b of batchAssignments) {
          if (teacherBusy[b.facultyId][day][periodIdx] || teacherBusy[b.facultyId][day][periodIdx + 1]) {
            anyFacultyBusy = true;
            break;
          }
          if (b.facultyId) {
            // Lab is 2 periods: check if faculty already has lecture before (periodIdx - 1) or after (periodIdx + 2)
            if (periodIdx > 0 && teacherBusy[b.facultyId][day][periodIdx - 1]) {
              anyFacultyContinuous = true;
              break;
            }
            if (periodIdx + 2 < totalPeriods && teacherBusy[b.facultyId][day][periodIdx + 2]) {
              anyFacultyContinuous = true;
              break;
            }
          }
        }
        if (anyFacultyBusy || anyFacultyContinuous) continue;

        // Check if class already has lab on this day
        if (hasClassLabOnDay(classId, day)) continue;

        // Place
        const cellValue: BatchAssignment[] = batchAssignments.map(b => ({
          batchName: b.batchName,
          assignmentId: b.assignmentId
        }));

        schedule[classId][day][periodIdx] = cellValue;
        schedule[classId][day][periodIdx + 1] = cellValue;

        for (const b of batchAssignments) {
          teacherBusy[b.facultyId][day][periodIdx] = true;
          teacherBusy[b.facultyId][day][periodIdx + 1] = true;
        }

        if (backtrack(unitIdx + 1)) return true;

        // Backtrack
        schedule[classId][day][periodIdx] = null;
        schedule[classId][day][periodIdx + 1] = null;

        for (const b of batchAssignments) {
          teacherBusy[b.facultyId][day][periodIdx] = false;
          teacherBusy[b.facultyId][day][periodIdx + 1] = false;
        }
      }
      return false;
    } else {
      const stdUnit = unit as StandardUnit;
      const { classId, facultyId, assignmentId, subjectId, duration } = stdUnit;
      const sub = subjects.find(s => s.id === subjectId);
      const weeklyPeriods = sub ? sub.weeklyPeriods : 0;
      const isLab = sub ? sub.isLab === true : false;
      const isMultiSubject = facultyMultiSubjectMap[`${facultyId}_${classId}`] || false;

      for (const cand of candidates) {
        const { day, periodIdx } = cand;

        if (periodIdx + duration > totalPeriods) continue;

        let isBlocked = false;
        for (let d = 0; d < duration; d++) {
          if (schedule[classId][day][periodIdx + d] !== null || (facultyId && teacherBusy[facultyId][day][periodIdx + d])) {
            isBlocked = true;
            break;
          }
          if (d > 0 && !arePeriodsConsecutive(periodIdx + d - 1, periodIdx + d)) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) continue;

        if (sub && sub.isAicteActivity && day !== 'Saturday') continue;
        if (sub && !sub.isAicteActivity && day === 'Saturday') continue;

        // Project and Student Activity / Mentoring post-lunch constraint
        if (sub && (sub.isProject || sub.isStudentActivity) && lunchBreakIdx !== -1) {
          const slot1 = activeSlots[periodIdx];
          const origIdx1 = timeSlots.findIndex(s => s.id === slot1.id);
          if (origIdx1 <= lunchBreakIdx) continue;
        }

        // Continuous Lecture Restrictor (Enforce across SAME and DIFFERENT sections)
        if (facultyId && !sub?.isAicteActivity && !sub?.isStudentActivity) {
          // Check if faculty already has a lecture in ANY section/class at the period immediately before or after
          if (periodIdx > 0 && teacherBusy[facultyId][day][periodIdx - 1]) continue;
          if (periodIdx + duration < totalPeriods && teacherBusy[facultyId][day][periodIdx + duration]) continue;
        }

        // 1. Same subject continuous check (unless AICTE activity or Student activity)
        if (!sub?.isAicteActivity && !sub?.isStudentActivity) {
          if (periodIdx > 0 && getSubjectsAt(classId, day, periodIdx - 1).includes(subjectId)) continue;
          if (periodIdx + duration < totalPeriods && getSubjectsAt(classId, day, periodIdx + duration).includes(subjectId)) continue;
        }

        // 2. Max occurrences per day
        const currentCountOnDay = getSubjectCountOnDay(classId, day, subjectId);
        if (isLab) {
          if (currentCountOnDay > 0) continue;
        } else if (sub && (sub.isAicteActivity || sub.isStudentActivity)) {
          if (currentCountOnDay >= sub.weeklyPeriods) continue;
        } else {
          const maxOccurrencesPerDay = (weeklyPeriods > days.length) ? Math.ceil(weeklyPeriods / days.length) : 1;
          if (currentCountOnDay >= maxOccurrencesPerDay) continue;
        }

        // 3. Period 1 constraint
        if (!sub?.isAicteActivity && !sub?.isStudentActivity) {
          let occupiesPeriod1 = false;
          for (let d = 0; d < duration; d++) {
            if (isPeriod1(periodIdx + d)) { occupiesPeriod1 = true; break; }
          }
          if (occupiesPeriod1) {
            let alreadyAllotted = false;
            for (const d of days) {
              for (let p = 0; p < totalPeriods; p++) {
                if (isPeriod1(p) && getSubjectsAt(classId, d, p).includes(subjectId)) {
                  alreadyAllotted = true;
                  break;
                }
              }
              if (alreadyAllotted) break;
            }
            if (alreadyAllotted) continue;
          }
        }

        // Place
        for (let d = 0; d < duration; d++) {
          schedule[classId][day][periodIdx + d] = assignmentId;
          if (facultyId) teacherBusy[facultyId][day][periodIdx + d] = true;
        }

        if (backtrack(unitIdx + 1)) return true;

        // Backtrack
        for (let d = 0; d < duration; d++) {
          schedule[classId][day][periodIdx + d] = null;
          if (facultyId) teacherBusy[facultyId][day][periodIdx + d] = false;
        }
      }
      return false;
    }
  }

  const success = backtrack(0);

  if (success) {
    return {
      success: true,
      schedule,
      message: 'Timetable generated successfully without any clashes or continuity conflicts!'
    };
  } else {
    return greedyFallback(faculties, subjects, classes, assignments, timeSlots, days, facultyMultiSubjectMap);
  }
}

/**
 * Greedy fallback if perfect backtracking reaches limit.
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

  const isHighPriorityPeriod = (pIdx: number): boolean => {
    if (pIdx === 0 || pIdx === 1) return true;
    const slot = activeSlots[pIdx];
    if (!slot) return false;
    const labelLower = slot.label.toLowerCase();
    return (
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
    );
  };

  const arePeriodsConsecutive = (pIdx1: number, pIdx2: number): boolean => {
    const slot1 = activeSlots[pIdx1];
    const slot2 = activeSlots[pIdx2];
    if (!slot1 || !slot2) return false;
    const idx1 = timeSlots.findIndex(s => s.id === slot1.id);
    const idx2 = timeSlots.findIndex(s => s.id === slot2.id);
    return Math.abs(idx2 - idx1) === 1;
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

  const getFacultiesAt = (classId: string, day: string, periodIdx: number): string[] => {
    const cell = schedule[classId][day][periodIdx];
    if (!cell) return [];
    if (typeof cell === 'string') {
      const assign = assignments.find(a => a.id === cell);
      return assign ? [assign.facultyId] : [];
    }
    const batchItems = getBatchItemsFromCell(cell);
    if (batchItems) {
      const facs: string[] = [];
      for (const item of batchItems) {
        const assign = assignments.find(a => a.id === item.assignmentId);
        if (assign) facs.push(assign.facultyId);
      }
      return facs;
    }
    return [];
  };

  const getSubjectsAt = (classId: string, day: string, periodIdx: number): string[] => {
    const cell = schedule[classId][day][periodIdx];
    if (!cell) return [];
    if (typeof cell === 'string') {
      const assign = assignments.find(a => a.id === cell);
      return assign ? [assign.subjectId] : [];
    }
    const batchItems = getBatchItemsFromCell(cell);
    if (batchItems) {
      const subs: string[] = [];
      for (const item of batchItems) {
        const assign = assignments.find(a => a.id === item.assignmentId);
        if (assign) subs.push(assign.subjectId);
      }
      return subs;
    }
    return [];
  };

  const getSubjectCountOnDay = (classId: string, day: string, subId: string): number => {
    let count = 0;
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subs = getSubjectsAt(classId, day, pIdx);
      if (subs.includes(subId)) count++;
    }
    return count;
  };

  const hasClassLabOnDay = (classId: string, day: DayOfWeek): boolean => {
    for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
      const subs = getSubjectsAt(classId, day, pIdx);
      for (const sId of subs) {
        const sub = subjects.find(s => s.id === sId);
        if (sub && sub.isLab) return true;
      }
    }
    return false;
  };

  const lectureUnits = buildLectureUnits(classes, assignments, subjects);

  lectureUnits.sort((a, b) => {
    if (a.isParallelLab && !b.isParallelLab) return -1;
    if (!a.isParallelLab && b.isParallelLab) return 1;
    return b.duration - a.duration;
  });

  const unscheduledUnits: SolverUnit[] = [];

  for (const unit of lectureUnits) {
    let placed = false;

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

    if (unit.isParallelLab) {
      const { classId, batchAssignments } = unit;

      for (const cand of candSlots) {
        const { day, pIdx } = cand;

        if (day === 'Saturday') continue;

        if (pIdx + 1 >= totalPeriods) continue;
        if (schedule[classId][day][pIdx] !== null || schedule[classId][day][pIdx + 1] !== null) continue;
        if (!arePeriodsConsecutive(pIdx, pIdx + 1)) continue;

        let anyFacultyBusy = false;
        let anyFacultyContinuous = false;
        for (const b of batchAssignments) {
          if (teacherBusy[b.facultyId][day][pIdx] || teacherBusy[b.facultyId][day][pIdx + 1]) {
            anyFacultyBusy = true;
            break;
          }
          if (b.facultyId) {
            if (pIdx > 0 && teacherBusy[b.facultyId][day][pIdx - 1]) {
              anyFacultyContinuous = true;
              break;
            }
            if (pIdx + 2 < totalPeriods && teacherBusy[b.facultyId][day][pIdx + 2]) {
              anyFacultyContinuous = true;
              break;
            }
          }
        }
        if (anyFacultyBusy || anyFacultyContinuous) continue;

        if (hasClassLabOnDay(classId, day)) continue;

        const cellValue: BatchAssignment[] = batchAssignments.map(b => ({
          batchName: b.batchName,
          assignmentId: b.assignmentId
        }));

        schedule[classId][day][pIdx] = cellValue;
        schedule[classId][day][pIdx + 1] = cellValue;

        for (const b of batchAssignments) {
          teacherBusy[b.facultyId][day][pIdx] = true;
          teacherBusy[b.facultyId][day][pIdx + 1] = true;
        }

        placed = true;
        break;
      }
    } else {
      const stdUnit = unit as StandardUnit;
      const { classId, facultyId, assignmentId, subjectId, duration } = stdUnit;
      const sub = subjects.find(s => s.id === subjectId);
      const weeklyPeriods = sub ? sub.weeklyPeriods : 0;
      const isLab = sub ? sub.isLab === true : false;
      const isMultiSubject = facultyMultiSubjectMap[`${facultyId}_${classId}`] || false;

      for (const cand of candSlots) {
        const { day, pIdx } = cand;

        if (pIdx + duration > totalPeriods) continue;

        let isBlocked = false;
        for (let d = 0; d < duration; d++) {
          if (schedule[classId][day][pIdx + d] !== null || (facultyId && teacherBusy[facultyId][day][pIdx + d])) {
            isBlocked = true;
            break;
          }
          if (d > 0 && !arePeriodsConsecutive(pIdx + d - 1, pIdx + d)) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) continue;

        if (sub && sub.isAicteActivity && day !== 'Saturday') continue;
        if (sub && !sub.isAicteActivity && day === 'Saturday') continue;

        if (sub && (sub.isProject || sub.isStudentActivity) && lunchBreakIdx !== -1) {
          const slot1 = activeSlots[pIdx];
          const origIdx1 = timeSlots.findIndex(s => s.id === slot1.id);
          if (origIdx1 <= lunchBreakIdx) continue;
        }

        // Continuous Lecture Restrictor (Enforce across SAME and DIFFERENT sections)
        if (facultyId && !sub?.isAicteActivity && !sub?.isStudentActivity) {
          if (pIdx > 0 && teacherBusy[facultyId][day][pIdx - 1]) continue;
          if (pIdx + duration < totalPeriods && teacherBusy[facultyId][day][pIdx + duration]) continue;
        }

        if (!sub?.isAicteActivity && !sub?.isStudentActivity) {
          if (pIdx > 0 && getSubjectsAt(classId, day, pIdx - 1).includes(subjectId)) continue;
          if (pIdx + duration < totalPeriods && getSubjectsAt(classId, day, pIdx + duration).includes(subjectId)) continue;
        }

        const currentCountOnDay = getSubjectCountOnDay(classId, day, subjectId);
        if (isLab) {
          if (currentCountOnDay > 0) continue;
        } else if (sub && (sub.isAicteActivity || sub.isStudentActivity)) {
          if (currentCountOnDay >= sub.weeklyPeriods) continue;
        } else {
          const maxOccurrencesPerDay = (weeklyPeriods > days.length) ? Math.ceil(weeklyPeriods / days.length) : 1;
          if (currentCountOnDay >= maxOccurrencesPerDay) continue;
        }

        if (!sub?.isAicteActivity && !sub?.isStudentActivity) {
          let occupiesPeriod1 = false;
          for (let d = 0; d < duration; d++) {
            if (isPeriod1(pIdx + d)) { occupiesPeriod1 = true; break; }
          }
          if (occupiesPeriod1) {
            let alreadyAllotted = false;
            for (const d of days) {
              for (let p = 0; p < totalPeriods; p++) {
                if (isPeriod1(p) && getSubjectsAt(classId, d, p).includes(subjectId)) {
                  alreadyAllotted = true;
                  break;
                }
              }
              if (alreadyAllotted) break;
            }
            if (alreadyAllotted) continue;
          }
        }

        for (let d = 0; d < duration; d++) {
          schedule[classId][day][pIdx + d] = assignmentId;
          if (facultyId) teacherBusy[facultyId][day][pIdx + d] = true;
        }
        placed = true;
        break;
      }
    }

    if (!placed) {
      unscheduledUnits.push(unit);
    }
  }

  return {
    success: false,
    schedule,
    message: `Could not schedule ${unscheduledUnits.length} periods due to tight constraints. Loaded partial clash-free timetable.`,
    unscheduledUnits: unscheduledUnits.map(u => {
      if (u.isParallelLab) {
        return {
          classId: u.classId,
          subjectId: u.batchAssignments[0]?.subjectId || '',
          facultyId: u.batchAssignments[0]?.facultyId || '',
          unitIndex: u.sessionIndex
        };
      }
      const std = u as StandardUnit;
      return {
        classId: std.classId,
        subjectId: std.subjectId,
        facultyId: std.facultyId,
        unitIndex: std.unitIndex
      };
    })
  };
}

/**
 * Generates initial sample data.
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
    { id: 'ts6', label: 'Lunch Break', startTime: '13:15', endTime: '14:00', isBreak: true },
    { id: 'ts7', label: 'Period 5', startTime: '14:00', endTime: '15:00', isBreak: false },
    { id: 'ts8', label: 'Period 6', startTime: '15:00', endTime: '16:00', isBreak: false },
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
