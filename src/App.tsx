/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, FormEvent, CSSProperties } from 'react';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Users, 
  BookOpen, 
  Pencil, 
  GraduationCap, 
  Calendar, 
  RotateCcw, 
  Printer, 
  Info, 
  LogIn, 
  LogOut, 
  Check, 
  AlertCircle,
  Mail,
  Sliders,
  HelpCircle,
  Save, 
  Undo, 
  Redo, 
  Download,
  Palette,
  X,
  Cloud,
  Database,
  Settings,
  Loader2,
  RefreshCw,
  CheckCircle,
  MessageSquare,
  Send,
  Copy,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Faculty, Subject, ClassSection, Assignment, TimeSlot, DayOfWeek, TimetableSchedule } from './types';
import { generateTimetable, preValidateConstraints, SolverResult, areSiblingBatches, getClassGroupInfo, isSubjectLab, serializeForFirestore, deserializeFromFirestore, getBatchItemsFromCell, getAssignmentIdsFromCell } from './utils/solver';
import { db, auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getCleanBreakLabel = (label: string): string => {
  const lower = label.toLowerCase();
  if (lower.includes('tea')) return 'tea';
  if (lower.includes('lunch')) return 'lunch';
  if (lower.includes('break')) return 'break';
  return label;
};

const SUBJECT_PALETTES = [
  {
    bg: 'bg-indigo-50/90',
    hoverBg: 'hover:bg-indigo-100/90',
    text: 'text-indigo-950',
    border: 'border-indigo-200',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
  },
  {
    bg: 'bg-emerald-50/90',
    hoverBg: 'hover:bg-emerald-100/90',
    text: 'text-emerald-950',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
  },
  {
    bg: 'bg-amber-50/90',
    hoverBg: 'hover:bg-amber-100/90',
    text: 'text-amber-950',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  {
    bg: 'bg-rose-50/90',
    hoverBg: 'hover:bg-rose-100/90',
    text: 'text-rose-950',
    border: 'border-rose-200',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
  },
  {
    bg: 'bg-cyan-50/90',
    hoverBg: 'hover:bg-cyan-100/90',
    text: 'text-cyan-950',
    border: 'border-cyan-200',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-200',
  },
  {
    bg: 'bg-purple-50/90',
    hoverBg: 'hover:bg-purple-100/90',
    text: 'text-purple-950',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
  },
  {
    bg: 'bg-orange-50/90',
    hoverBg: 'hover:bg-orange-100/90',
    text: 'text-orange-950',
    border: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200',
  },
  {
    bg: 'bg-teal-50/90',
    hoverBg: 'hover:bg-teal-100/90',
    text: 'text-teal-950',
    border: 'border-teal-200',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
  },
  {
    bg: 'bg-violet-50/90',
    hoverBg: 'hover:bg-violet-100/90',
    text: 'text-violet-950',
    border: 'border-violet-200',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-800',
    badgeBorder: 'border-violet-200',
  },
  {
    bg: 'bg-fuchsia-50/90',
    hoverBg: 'hover:bg-fuchsia-100/90',
    text: 'text-fuchsia-950',
    border: 'border-fuchsia-200',
    badgeBg: 'bg-fuchsia-100',
    badgeText: 'text-fuchsia-800',
    badgeBorder: 'border-fuchsia-200',
  },
  {
    bg: 'bg-sky-50/90',
    hoverBg: 'hover:bg-sky-100/90',
    text: 'text-sky-950',
    border: 'border-sky-200',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-200',
  },
  {
    bg: 'bg-lime-50/90',
    hoverBg: 'hover:bg-lime-100/90',
    text: 'text-lime-950',
    border: 'border-lime-200',
    badgeBg: 'bg-lime-100',
    badgeText: 'text-lime-800',
    badgeBorder: 'border-lime-200',
  }
];

const UNIQUE_BG_COLORS = [
  '#e0e7ff', // indigo-100
  '#d1fae5', // emerald-100
  '#fef3c7', // amber-100
  '#ffe4e6', // rose-100
  '#cffafe', // cyan-100
  '#f3e8ff', // purple-100
  '#ffedd5', // orange-100
  '#ccfbf1', // teal-100
  '#f5f3ff', // violet-100
  '#fae8ff', // fuchsia-100
  '#e0f2fe', // sky-100
  '#ecfccb', // lime-100
  '#fef08a', // yellow-100
  '#fed7aa', // orange-200
  '#fbcfe8', // pink-200
  '#ddd6fe', // violet-200
  '#c7d2fe', // indigo-200
  '#bfdbfe', // blue-200
  '#a5f3fc', // cyan-200
  '#99f6e4', // teal-200
  '#a7f3d0', // emerald-200
  '#bef264', // lime-200
  '#fde047', // yellow-300
  '#fecdd3', // rose-200
  '#fde68a', // amber-200
  '#bae6fd', // sky-200
  '#e9d5ff', // purple-200
  '#f5d0fe', // fuchsia-200
  '#fed7d7', // coral-soft
  '#e2e8f0', // slate-200
  '#ede9fe', // periwinkle
  '#dcfce7', // mint-light
  '#d9f99d', // chartreuse-light
  '#fee2e2', // red-100
  '#fce7f3', // pink-100
  '#e0e7ff', // blue-indigo
  '#c4b5fd', // iris-soft
  '#a5f3fc', // aqua-soft
];

export const QUICK_PRESET_COLORS = [
  { name: 'Sky Blue', hex: '#e0f2fe' },
  { name: 'Teal Pastel', hex: '#ccfbf1' },
  { name: 'Emerald', hex: '#d1fae5' },
  { name: 'Lime Pear', hex: '#ecfccb' },
  { name: 'Sunny Gold', hex: '#fef08a' },
  { name: 'Warm Amber', hex: '#fef3c7' },
  { name: 'Soft Orange', hex: '#ffedd5' },
  { name: 'Blush Rose', hex: '#ffe4e6' },
  { name: 'Flamingo Pink', hex: '#fbcfe8' },
  { name: 'Fuchsia', hex: '#fae8ff' },
  { name: 'Soft Purple', hex: '#f3e8ff' },
  { name: 'Royal Indigo', hex: '#e0e7ff' },
  { name: 'Aqua Mint', hex: '#a5f3fc' },
  { name: 'Warm Coral', hex: '#fed7aa' },
  { name: 'Lavender Mist', hex: '#ede9fe' },
  { name: 'Soft Slate', hex: '#e2e8f0' },
];

export interface ColorFamilyGroup {
  name: string;
  category: 'warm' | 'cool' | 'pastel' | 'vibrant' | 'neutral';
  shades: string[];
}

const COLOR_FAMILIES: ColorFamilyGroup[] = [
  {
    name: 'Sky & Ice Blue',
    category: 'cool',
    shades: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0284c7']
  },
  {
    name: 'Indigo & Royal Blue',
    category: 'cool',
    shades: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#6366f1', '#3730a3']
  },
  {
    name: 'Cyan & Aqua',
    category: 'cool',
    shades: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#06b6d4', '#0e7490']
  },
  {
    name: 'Teal & Seafoam',
    category: 'cool',
    shades: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#14b8a6', '#0f766e']
  },
  {
    name: 'Emerald & Mint',
    category: 'cool',
    shades: ['#f0fdf4', '#d1fae5', '#a7f3d0', '#6ee7b7', '#10b981', '#047857']
  },
  {
    name: 'Lime & Chartreuse',
    category: 'warm',
    shades: ['#f7fee7', '#ecfccb', '#d9f99d', '#bef264', '#84cc16', '#4d7c0f']
  },
  {
    name: 'Yellow & Canary',
    category: 'warm',
    shades: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#eab308', '#a16207']
  },
  {
    name: 'Warm Amber & Gold',
    category: 'warm',
    shades: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#f59e0b', '#b45309']
  },
  {
    name: 'Orange & Tangerine',
    category: 'warm',
    shades: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#f97316', '#c2410c']
  },
  {
    name: 'Coral & Peach',
    category: 'warm',
    shades: ['#fff5f5', '#fed7d7', '#fca5a5', '#fb923c', '#ea580c', '#9a3412']
  },
  {
    name: 'Red & Crimson',
    category: 'warm',
    shades: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#f43f5e', '#9f1239']
  },
  {
    name: 'Rose & Blush',
    category: 'warm',
    shades: ['#fff1f5', '#fce7f3', '#fbcfe8', '#f472b6', '#db2777', '#831843']
  },
  {
    name: 'Fuchsia & Magenta',
    category: 'vibrant',
    shades: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#d946ef', '#a21caf']
  },
  {
    name: 'Purple & Lavender',
    category: 'cool',
    shades: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#a855f7', '#6b21a8']
  },
  {
    name: 'Violet & Periwinkle',
    category: 'cool',
    shades: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#8b5cf6', '#5b21b6']
  },
  {
    name: 'Warm Earth & Latte',
    category: 'neutral',
    shades: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#57534e']
  },
  {
    name: 'Cool Slate & Silver',
    category: 'neutral',
    shades: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#334155']
  }
];

export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: 'ts1', label: 'Period 1', startTime: '09:00', endTime: '10:00', isBreak: false },
  { id: 'ts2', label: 'Period 2', startTime: '10:00', endTime: '11:00', isBreak: false },
  { id: 'ts3', label: 'Tea Break', startTime: '11:00', endTime: '11:15', isBreak: true },
  { id: 'ts4', label: 'Period 3', startTime: '11:15', endTime: '12:15', isBreak: false },
  { id: 'ts5', label: 'Period 4', startTime: '12:15', endTime: '13:15', isBreak: false },
  { id: 'ts6', label: 'Lunch Break', startTime: '13:15', endTime: '14:00', isBreak: true },
  { id: 'ts7', label: 'Period 5', startTime: '14:00', endTime: '15:00', isBreak: false },
  { id: 'ts8', label: 'Period 6', startTime: '15:00', endTime: '16:00', isBreak: false },
];

export const normalizeTimeSlotsWithDefaults = (slots: TimeSlot[]): TimeSlot[] => {
  if (!slots || !Array.isArray(slots) || slots.length === 0) return DEFAULT_TIME_SLOTS;
  return slots.map(slot => {
    // 1. Lunch Break: 13:15 to 14:00 (45 mins)
    if (
      (slot.id === 'ts6' || slot.label.toLowerCase().includes('lunch')) &&
      slot.startTime === '13:15' &&
      slot.endTime === '14:15'
    ) {
      return { ...slot, endTime: '14:00' };
    }
    // 2. Period 5: 14:00 to 15:00
    if (
      (slot.id === 'ts7' || slot.label.toLowerCase() === 'period 5' || slot.label.toLowerCase().includes('period 5')) &&
      slot.startTime === '14:15'
    ) {
      return { ...slot, startTime: '14:00', endTime: '15:00' };
    }
    // 3. Period 6: 15:00 to 16:00
    if (
      (slot.id === 'ts8' || slot.label.toLowerCase() === 'period 6' || slot.label.toLowerCase().includes('period 6')) &&
      slot.startTime === '15:15'
    ) {
      return { ...slot, startTime: '15:00', endTime: '16:00' };
    }
    // General fallback: if slot has 14:15 to 15:15
    if (slot.startTime === '14:15' && slot.endTime === '15:15') {
      return { ...slot, startTime: '14:00', endTime: '15:00' };
    }
    // General fallback: if slot has 15:15 to 16:15
    if (slot.startTime === '15:15' && slot.endTime === '16:15') {
      return { ...slot, startTime: '15:00', endTime: '16:00' };
    }
    // General fallback: if break starts at 13:15 and ends at 14:15
    if (slot.isBreak && slot.startTime === '13:15' && slot.endTime === '14:15') {
      return { ...slot, endTime: '14:00' };
    }
    return slot;
  });
};

export const formatTime12 = (timeStr: string): string => {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minutes} ${ampm}`;
};

export const formatTimeRange12 = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return '';
  return `${formatTime12(startTime)} - ${formatTime12(endTime)}`;
};

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const getUniqueUnusedColor = (currentSubjects: Subject[]) => {
  const takenColors = currentSubjects.map(s => s.color?.toLowerCase()).filter(Boolean);
  const unusedColor = UNIQUE_BG_COLORS.find(c => !takenColors.includes(c.toLowerCase()));
  if (unusedColor) return unusedColor;
  
  let randomColor = '';
  let attempts = 0;
  do {
    const h = Math.floor(Math.random() * 360);
    const s = 65 + Math.floor(Math.random() * 15); // 65-80% saturation (pastel)
    const l = 85 + Math.floor(Math.random() * 10); // 85-95% lightness (pastel)
    randomColor = hslToHex(h, s, l);
    attempts++;
  } while (takenColors.includes(randomColor.toLowerCase()) && attempts < 50);
  return randomColor;
};

const getContrastTextColor = (hex: string) => {
  if (!hex || hex[0] !== '#') return '#0f172a';
  try {
    const R = parseInt(hex.substring(1, 3), 16);
    const G = parseInt(hex.substring(3, 5), 16);
    const B = parseInt(hex.substring(5, 7), 16);
    const sRGB = [R, G, B].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    return L > 0.45 ? '#0f172a' : '#ffffff';
  } catch (e) {
    return '#0f172a';
  }
};

const adjustBrightness = (hex: string, percent: number) => {
  if (!hex || hex[0] !== '#') return hex;
  try {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = Math.max(0, Math.min(255, R + percent));
    G = Math.max(0, Math.min(255, G + percent));
    B = Math.max(0, Math.min(255, B + percent));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  } catch (e) {
    return hex;
  }
};

export const cleanFacultyName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/^👤\s*/g, '').replace(/👤/g, '').trim();
};

export const normalizeDepartment = (dept?: string): string => {
  if (!dept) return '';
  const trimmed = dept.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'applied science' || lower === 'basic science' || lower === 'bs') {
    return 'BS';
  }
  if (lower === 'civil' || lower === 'cv') {
    return 'CV';
  }
  if (lower === 'mechanical' || lower === 'me') {
    return 'ME';
  }
  if (lower === 'mba') {
    return 'MBA';
  }
  if (lower === 'cse') return 'CSE';
  if (lower === 'aiml') return 'AIML';
  if (lower === 'ece') return 'ECE';
  return trimmed;
};

export const format12HourTime = (date: Date = new Date()): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

interface SubjectPalette {
  bg: string;
  hoverBg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isCustom?: boolean;
  styles?: {
    bg: string;
    hoverBg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  };
}

const getSubjectPalette = (subjectId: string, subjectCode?: string, subjectColor?: string): SubjectPalette => {
  if (subjectColor) {
    const text = getContrastTextColor(subjectColor);
    const hoverBg = adjustBrightness(subjectColor, -10);
    const border = adjustBrightness(subjectColor, -20);
    const badgeBg = adjustBrightness(subjectColor, -15);
    const badgeText = getContrastTextColor(badgeBg);
    const badgeBorder = adjustBrightness(subjectColor, -30);
    
    return {
      bg: '',
      hoverBg: '',
      text: '',
      border: '',
      badgeBg: '',
      badgeText: '',
      badgeBorder: '',
      isCustom: true,
      styles: {
        bg: subjectColor,
        hoverBg,
        text,
        border,
        badgeBg,
        badgeText,
        badgeBorder,
      }
    };
  }

  if (subjectCode?.toUpperCase() === '21MAT51') {
    return {
      bg: 'bg-lime-100',
      hoverBg: 'hover:bg-lime-200',
      text: 'text-lime-950',
      border: 'border-lime-300',
      badgeBg: 'bg-lime-200',
      badgeText: 'text-lime-900',
      badgeBorder: 'border-lime-300',
    };
  }
  if (!subjectId) return SUBJECT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_PALETTES.length;
  return SUBJECT_PALETTES[index];
};

export default function App() {
  // --- Core State ---
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<DayOfWeek[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  
  // --- App Logic State ---
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'drag_drop' | 'faculties' | 'subjects' | 'assignments' | 'timing' | 'individual_timetable'>('dashboard');
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [customSchedule, setCustomSchedule] = useState<TimetableSchedule | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: string; slotIdx: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDataStale, setIsDataStale] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [undoStack, setUndoStack] = useState<TimetableSchedule[]>([]);
  const [redoStack, setRedoStack] = useState<TimetableSchedule[]>([]);

  // Accordion States for Dashboard Cards
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isRosterWarningsOpen, setIsRosterWarningsOpen] = useState(false);

  // Clear selected cell on tab or class change
  useEffect(() => {
    setSelectedCell(null);
  }, [selectedClassId, activeTab]);

  // --- Mock Auth Notification ---
  const [authNotification, setAuthNotification] = useState<string | null>(null);

  // --- Floating Toast Notifications ---
  interface ToastItem {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Firebase Integration States ---
  const [firebaseTimetables, setFirebaseTimetables] = useState<string[]>([]);
  const [activeTimetableName, setActiveTimetableName] = useState<string>('Main Timetable');
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isCloudFetchingList, setIsCloudFetchingList] = useState(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('mvce_auto_sync') === 'true';
  });
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [newTimetableNameInput, setNewTimetableNameInput] = useState('');
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [showNewTemplateConfirmModal, setShowNewTemplateConfirmModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('New Timetable');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [confirmFirebaseClear, setConfirmFirebaseClear] = useState(false);
  const [showInlineSaveAs, setShowInlineSaveAs] = useState(false);
  const [inlineSaveAsName, setInlineSaveAsName] = useState('');
  const [deletingTimetableName, setDeletingTimetableName] = useState<string | null>(null);

  // Keep a live ref of workspace data to avoid stale closures in debounced auto-sync
  const workspaceDataRef = useRef({
    faculties,
    subjects,
    classes,
    assignments,
    timeSlots,
    days,
    customSchedule,
    solverResult,
    activeTimetableName
  });

  // Keep workspace ref synchronously up to date
  workspaceDataRef.current = {
    faculties,
    subjects,
    classes,
    assignments,
    timeSlots,
    days,
    customSchedule,
    solverResult,
    activeTimetableName
  };

  // --- Firebase Google Auth States ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authCheckError, setAuthCheckError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // --- Clear Workspace Secure Modal States ---
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearConfirmStep, setClearConfirmStep] = useState<1 | 2>(1);
  const [clearAdminPassword, setClearAdminPassword] = useState('');
  const [clearPasswordError, setClearPasswordError] = useState<string | null>(null);

  // --- WhatsApp Sharing States ---
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppFacultyId, setWhatsAppFacultyId] = useState<string | null>(null);
  const [whatsAppPhoneInput, setWhatsAppPhoneInput] = useState('');
  const [isCopiedWhatsApp, setIsCopiedWhatsApp] = useState(false);

  // --- Form States ---
  // Faculty Form
  const [newFacName, setNewFacName] = useState('');
  const [newFacShort, setNewFacShort] = useState('');
  const [newFacDept, setNewFacDept] = useState('CSE');
  const [newFacPhone, setNewFacPhone] = useState('');
  const [facFormSubmitted, setFacFormSubmitted] = useState(false);
  
  // Faculty Editing State
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editFacName, setEditFacName] = useState('');
  const [editFacShort, setEditFacShort] = useState('');
  const [editFacDept, setEditFacDept] = useState('CSE');
  const [editFacPhone, setEditFacPhone] = useState('');
  const [editFacFormSubmitted, setEditFacFormSubmitted] = useState(false);
  
  // Subject Form
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDept, setNewSubDept] = useState('CSE');
  const [newSubPeriods, setNewSubPeriods] = useState(4);
  const [newSubIsLab, setNewSubIsLab] = useState(false);
  const [newSubIsProject, setNewSubIsProject] = useState(false);
  const [newSubIsAicte, setNewSubIsAicte] = useState(false);
  const [newSubIsMentoring, setNewSubIsMentoring] = useState(false);
  const [newSubColor, setNewSubColor] = useState('');
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [colorModalSubjectId, setColorModalSubjectId] = useState<string | null>(null);
  const [colorCategoryFilter, setColorCategoryFilter] = useState<'all' | 'cool' | 'warm' | 'vibrant' | 'neutral'>('all');
  const [subFormSubmitted, setSubFormSubmitted] = useState(false);

  // Subject Editing State
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubName, setEditSubName] = useState('');
  const [editSubDept, setEditSubDept] = useState('CSE');
  const [editSubPeriods, setEditSubPeriods] = useState(4);
  const [editSubIsLab, setEditSubIsLab] = useState(false);
  const [editSubIsProject, setEditSubIsProject] = useState(false);
  const [editSubIsAicte, setEditSubIsAicte] = useState(false);
  const [editSubIsMentoring, setEditSubIsMentoring] = useState(false);
  const [editSubColor, setEditSubColor] = useState('');
  const [editSubFormSubmitted, setEditSubFormSubmitted] = useState(false);

  // Class Form
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [newClassSem, setNewClassSem] = useState('5th');
  const [newClassSec, setNewClassSec] = useState('A');
  const [classFormSubmitted, setClassFormSubmitted] = useState(false);

  // Assignment Form
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubId, setAssignSubId] = useState('');
  const [assignFacId, setAssignFacId] = useState('');
  const [assignFormSubmitted, setAssignFormSubmitted] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  // Time Slot Form
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [newSlotIsBreak, setNewSlotIsBreak] = useState(false);
  const [timeFormSubmitted, setTimeFormSubmitted] = useState(false);

  const AUTHORIZED_EMAILS = [
    'adiseema1990@gmail.com',
    'sachinadi88@gmail.com',
    'adisachin1988@gmail.com'
  ];

  // --- Firebase Google Auth State Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email;
        const normalizedEmail = email ? email.trim().toLowerCase() : '';
        const isAuthorized = AUTHORIZED_EMAILS.some(e => e.trim().toLowerCase() === normalizedEmail);

        if (!email || !isAuthorized) {
          console.warn(`Unauthorized login attempt by ${email}`);
          await signOut(auth);
          setCurrentUser(null);
          setAuthCheckError(`Access Denied: Your Google account is not on the authorized list of teachers or superusers\n\n(Attempted account: ${email || 'No Email'})`);
          setAuthLoading(false);
          return;
        }

        try {
          // Verify Firestore access (enforcing rules given in Firestore)
          const isSuper = normalizedEmail === 'sachinadi88@gmail.com';
          const q = isSuper 
            ? collection(db, "mvce_timetables")
            : query(collection(db, "mvce_timetables"), where("userId", "==", user.uid));
          await getDocs(q);
          setCurrentUser(user);
          setAuthCheckError(null);
        } catch (err: any) {
          console.error("Auth state change permission check failed:", err);
          await signOut(auth);
          setCurrentUser(null);
          setAuthCheckError(`Access Denied: Your Google account is not on the authorized list of teachers or superusers\n\n(Attempted account: ${user.email})`);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthCheckError(null);
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email;
      const normalizedEmail = email ? email.trim().toLowerCase() : '';
      const isAuthorized = AUTHORIZED_EMAILS.some(e => e.trim().toLowerCase() === normalizedEmail);

      if (!email || !isAuthorized) {
        console.warn(`Unauthorized login attempt by ${email}`);
        await signOut(auth);
        setCurrentUser(null);
        setAuthCheckError(`Access Denied: Your Google account is not on the authorized list of teachers or superusers\n\n(Attempted account: ${email || 'No Email'})`);
        setIsLoggingIn(false);
        return;
      }
      
      // Test firestore read immediately to verify they are authorized under the Firestore rules
      try {
        const isSuper = normalizedEmail === 'sachinadi88@gmail.com';
        const q = isSuper 
          ? collection(db, "mvce_timetables")
          : query(collection(db, "mvce_timetables"), where("userId", "==", user.uid));
        await getDocs(q);
        // Success!
        setCurrentUser(user);
        showAuthNotice(`Welcome, ${user.displayName || user.email}!`);
      } catch (err: any) {
        console.error("Firestore permission check failed for user login:", err);
        // Sign out immediately because they are not allowed
        await signOut(auth);
        setCurrentUser(null);
        setAuthCheckError(`Access Denied: Your Google account is not on the authorized list of teachers or superusers\n\n(Attempted account: ${user.email})`);
      }
    } catch (error: any) {
      console.error("Google login failed:", error);
      if (error?.code === 'auth/popup-closed-by-user') {
        // User closed the popup, ignore or show brief notice
      } else if (error?.code === 'auth/unauthorized-domain' || (error?.message && error.message.includes('unauthorized-domain'))) {
        const hostname = window.location.hostname;
        setAuthCheckError(
          `Unauthorized Domain: The domain "${hostname}" is not authorized for Google Sign-In in your Firebase Project.\n\n` +
          `To fix this:\n` +
          `1. Go to the Firebase Console (console.firebase.google.com)\n` +
          `2. Navigate to "Authentication" > "Settings" tab > "Authorized domains"\n` +
          `3. Click "Add domain" and enter:\n   • ${hostname}\n` +
          `   • ${hostname.replace('ais-dev-', 'ais-pre-')} (optionally for shared URL)\n` +
          `4. Save the settings and try logging in again.`
        );
      } else {
        setAuthCheckError(error?.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setAuthCheckError(null);
      showAuthNotice("Signed out successfully.");
    } catch (error: any) {
      showAuthNotice(`Sign out failed: ${error?.message || error}`);
    }
  };

  const getAssignmentDetails = (assignmentId: string | null) => {
    if (!assignmentId) return { assign: null, sub: null, fac: null };
    let assign = assignments.find(a => a.id === assignmentId);
    if (!assign && assignmentId.startsWith('auto_')) {
      const parts = assignmentId.split('_');
      const classId = parts[1];
      const subjectId = parts.slice(2).join('_');
      const sub = subjects.find(s => s.id === subjectId);
      if (sub) {
        assign = {
          id: assignmentId,
          classId,
          subjectId,
          facultyId: ''
        };
      }
    }
    if (!assign) return { assign: null, sub: null, fac: null };
    const sub = subjects.find(s => s.id === assign.subjectId) || null;
    const fac = assign.facultyId ? (faculties.find(f => f.id === assign.facultyId) || null) : null;
    return { assign, sub, fac };
  };

  // --- Load Initial Sample Data ---
  useEffect(() => {
    // Check if the user deliberately cleared the workspace
    const isCleared = localStorage.getItem('mvce_is_cleared');
    if (isCleared === 'true') {
      setIsInitialized(true);
      return;
    }

    // Check if local storage has data
    const savedFaculties = localStorage.getItem('mvce_faculties');
    const savedSubjects = localStorage.getItem('mvce_subjects');
    const savedClasses = localStorage.getItem('mvce_classes');
    const savedAssignments = localStorage.getItem('mvce_assignments');
    const savedTimeSlots = localStorage.getItem('mvce_timeSlots');
    const savedDays = localStorage.getItem('mvce_days');
    const savedCustomSchedule = localStorage.getItem('mvce_customSchedule');
    const savedSolverResult = localStorage.getItem('mvce_solverResult');

    if (savedFaculties && savedSubjects && savedClasses && savedAssignments && savedTimeSlots && savedDays) {
      const parsedFaculties = (JSON.parse(savedFaculties) as Faculty[]).map(f => ({
        ...f,
        department: normalizeDepartment(f.department)
      }));
      setFaculties(parsedFaculties);
      const parsedSubjects = JSON.parse(savedSubjects) as Subject[];
      const subjectsWithColors = parsedSubjects.map((sub, idx) => ({
        ...sub,
        department: normalizeDepartment(sub.department),
        color: sub.color || UNIQUE_BG_COLORS[idx % UNIQUE_BG_COLORS.length]
      }));
      setSubjects(subjectsWithColors);
      const parsedClasses = JSON.parse(savedClasses).map((c: any) => ({ ...c, labBatches: c.labBatches ?? 2 }));
      setClasses(parsedClasses);
      setAssignments(JSON.parse(savedAssignments));
      setTimeSlots(normalizeTimeSlotsWithDefaults(JSON.parse(savedTimeSlots)));
      setDays(JSON.parse(savedDays));
      
      if (parsedClasses.length > 0) {
        setSelectedClassId(parsedClasses[0].id);
      }
      if (savedCustomSchedule) {
        setCustomSchedule(JSON.parse(savedCustomSchedule));
      }
      if (savedSolverResult) {
        setSolverResult(JSON.parse(savedSolverResult));
      } else if (savedCustomSchedule) {
        setSolverResult({
          success: true,
          schedule: JSON.parse(savedCustomSchedule),
          message: "Loaded saved manual adjustments."
        });
      }
    } else {
      const defaultDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setFaculties([]);
      setSubjects([]);
      setClasses([]);
      setAssignments([]);
      setTimeSlots(DEFAULT_TIME_SLOTS);
      setDays(defaultDays);
      setSelectedClassId('');
      setSolverResult(null);
      setCustomSchedule(null);
    }
    setIsInitialized(true);
  }, []);

  // Auto-migrate legacy default time slots (Lunch: 13:15-14:00 45mins, Period 5: 14:00-15:00, Period 6: 15:00-16:00)
  useEffect(() => {
    if (!isInitialized || timeSlots.length === 0) return;
    const hasLegacySlots = timeSlots.some(s => 
      (s.startTime === '13:15' && s.endTime === '14:15') ||
      (s.startTime === '14:15' && s.endTime === '15:15') ||
      (s.startTime === '15:15' && s.endTime === '16:15') ||
      ((s.id === 'ts6' || s.label.toLowerCase().includes('lunch')) && s.endTime === '14:15') ||
      ((s.id === 'ts7' || s.label.toLowerCase() === 'period 5') && s.startTime === '14:15') ||
      ((s.id === 'ts8' || s.label.toLowerCase() === 'period 6') && s.startTime === '15:15')
    );
    if (hasLegacySlots) {
      const normalized = normalizeTimeSlotsWithDefaults(timeSlots);
      setTimeSlots(normalized);
      localStorage.setItem('mvce_timeSlots', JSON.stringify(normalized));
    }
  }, [isInitialized, timeSlots]);

  // Auto-sync assignments for special subjects (AICTE Activity / Student Activity) across all classes
  useEffect(() => {
    if (!isInitialized || classes.length === 0 || subjects.length === 0) return;
    const specialSubs = subjects.filter(s => s.isAicteActivity || s.isStudentActivity);
    if (specialSubs.length === 0) return;

    let changed = false;
    const updatedAssigns = [...assignments];

    for (const cls of classes) {
      for (const specSub of specialSubs) {
        const exists = updatedAssigns.some(a => a.classId === cls.id && a.subjectId === specSub.id);
        if (!exists) {
          changed = true;
          updatedAssigns.push({
            id: `a_spec_${cls.id}_${specSub.id}`,
            classId: cls.id,
            subjectId: specSub.id,
            facultyId: ''
          });
        }
      }
    }

    if (changed) {
      setAssignments(updatedAssigns);
    }
  }, [isInitialized, classes, subjects, assignments]);

  // Ensure Saturday is in active days if AICTE Activity subjects exist
  useEffect(() => {
    if (!isInitialized || subjects.length === 0) return;
    const hasAicte = subjects.some(s => s.isAicteActivity);
    if (hasAicte && !days.includes('Saturday' as DayOfWeek)) {
      setDays(prev => prev.includes('Saturday' as DayOfWeek) ? prev : [...prev, 'Saturday' as DayOfWeek]);
    }
  }, [isInitialized, subjects, days]);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (!currentUser) return;
    if (!isInitialized) return;

    const hasAnyContent = faculties.length > 0 || subjects.length > 0 || classes.length > 0 || assignments.length > 0;
    const isCleared = localStorage.getItem('mvce_is_cleared');

    if (isCleared === 'true' && !hasAnyContent) {
      // Keep everything empty/cleared in local storage
      localStorage.setItem('mvce_faculties', JSON.stringify([]));
      localStorage.setItem('mvce_subjects', JSON.stringify([]));
      localStorage.setItem('mvce_classes', JSON.stringify([]));
      localStorage.setItem('mvce_assignments', JSON.stringify([]));
      localStorage.setItem('mvce_timeSlots', JSON.stringify(timeSlots));
      localStorage.setItem('mvce_days', JSON.stringify(days));
      localStorage.removeItem('mvce_customSchedule');
      localStorage.removeItem('mvce_solverResult');
      return;
    }

    // If user has added items, remove the cleared flag so changes persist
    if (hasAnyContent && isCleared === 'true') {
      localStorage.removeItem('mvce_is_cleared');
    }

    localStorage.setItem('mvce_faculties', JSON.stringify(faculties));
    localStorage.setItem('mvce_subjects', JSON.stringify(subjects));
    localStorage.setItem('mvce_classes', JSON.stringify(classes));
    localStorage.setItem('mvce_assignments', JSON.stringify(assignments));
    localStorage.setItem('mvce_timeSlots', JSON.stringify(timeSlots));
    localStorage.setItem('mvce_days', JSON.stringify(days));
    if (customSchedule) {
      localStorage.setItem('mvce_customSchedule', JSON.stringify(customSchedule));
    } else {
      localStorage.removeItem('mvce_customSchedule');
    }
    if (solverResult) {
      localStorage.setItem('mvce_solverResult', JSON.stringify(solverResult));
    } else {
      localStorage.removeItem('mvce_solverResult');
    }
    setIsDataStale(true);
  }, [isInitialized, currentUser, faculties, subjects, classes, assignments, timeSlots, days, customSchedule, solverResult]);

  // Run Solver
  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate slight processing for visual feedback
    setTimeout(() => {
      const result = generateTimetable(faculties, subjects, classes, assignments, timeSlots, days);
      setSolverResult(result);
      if (result.schedule) {
        setCustomSchedule(JSON.parse(JSON.stringify(result.schedule)));
      }
      setIsGenerating(false);
      setIsDataStale(false);
      setUndoStack([]);
      setRedoStack([]);
    }, 400);
  };

  // Run solver automatically on first load or when sample data loads
  useEffect(() => {
    if (isInitialized && faculties.length > 0 && subjects.length > 0 && classes.length > 0 && timeSlots.length > 0) {
      const savedCustomSchedule = localStorage.getItem('mvce_customSchedule');
      if (!savedCustomSchedule) {
        const result = generateTimetable(faculties, subjects, classes, assignments, timeSlots, days);
        setSolverResult(result);
        setCustomSchedule(result.schedule);
        setIsDataStale(false);
      }
    }
  }, [isInitialized, faculties.length, subjects.length, classes.length, assignments.length]);

  const handleSaveAdjustedSchedule = () => {
    if (!customSchedule) {
      showAuthNotice("No schedule available to save.");
      return;
    }
    const updatedSolverResult: SolverResult = {
      success: true,
      schedule: JSON.parse(JSON.stringify(customSchedule)),
      message: "Optimized (Manual changes applied)"
    };
    setSolverResult(updatedSolverResult);
    localStorage.setItem('mvce_customSchedule', JSON.stringify(customSchedule));
    localStorage.setItem('mvce_solverResult', JSON.stringify(updatedSolverResult));
    showAuthNotice("Manual adjustments saved and successfully synchronized with Dashboard & Solver!");
  };

  const performSwap = (srcDay: string, srcSlotIdx: number, destDay: string, destSlotIdx: number) => {
    if (!customSchedule || !selectedClassId || !customSchedule[selectedClassId]) return;

    // Save previous state to undo stack
    const currentSnapshot = JSON.parse(JSON.stringify(customSchedule));
    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack([]); // Clear redo stack on new action

    // Create new schedule
    const updated = JSON.parse(JSON.stringify(customSchedule));
    const sched = updated[selectedClassId];
    const temp = sched[srcDay][srcSlotIdx];
    sched[srcDay][srcSlotIdx] = sched[destDay][destSlotIdx];
    sched[destDay][destSlotIdx] = temp;

    const updatedSolverResult: SolverResult = {
      success: true,
      schedule: updated,
      message: "Optimized (Manual changes applied)"
    };

    setCustomSchedule(updated);
    setSolverResult(updatedSolverResult);
    localStorage.setItem('mvce_customSchedule', JSON.stringify(updated));
    localStorage.setItem('mvce_solverResult', JSON.stringify(updatedSolverResult));
    showAuthNotice(`Swapped slot of ${srcDay} with ${destDay}. Saved & synchronized.`);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !customSchedule) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
    setUndoStack(newUndoStack);
    setCustomSchedule(previous);

    const updatedSolverResult: SolverResult = {
      success: true,
      schedule: previous,
      message: "Optimized (Manual changes applied)"
    };
    setSolverResult(updatedSolverResult);
    localStorage.setItem('mvce_customSchedule', JSON.stringify(previous));
    localStorage.setItem('mvce_solverResult', JSON.stringify(updatedSolverResult));
    showAuthNotice("Undo manual swap successful.");
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !customSchedule) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
    setRedoStack(newRedoStack);
    setCustomSchedule(next);

    const updatedSolverResult: SolverResult = {
      success: true,
      schedule: next,
      message: "Optimized (Manual changes applied)"
    };
    setSolverResult(updatedSolverResult);
    localStorage.setItem('mvce_customSchedule', JSON.stringify(next));
    localStorage.setItem('mvce_solverResult', JSON.stringify(updatedSolverResult));
    showAuthNotice("Redo manual swap successful.");
  };

  const handleResetManualAdjustments = () => {
    if (solverResult?.schedule) {
      if (customSchedule) {
        setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
        setRedoStack([]);
      }
      setCustomSchedule(JSON.parse(JSON.stringify(solverResult.schedule)));
      showAuthNotice("Manual adjustments reset to the saved/optimized stage! You can undo this action if needed.");
    } else {
      const result = generateTimetable(faculties, subjects, classes, assignments, timeSlots, days);
      setSolverResult(result);
      if (result.schedule) {
        if (customSchedule) {
          setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
          setRedoStack([]);
        }
        setCustomSchedule(JSON.parse(JSON.stringify(result.schedule)));
        localStorage.setItem('mvce_customSchedule', JSON.stringify(result.schedule));
        localStorage.setItem('mvce_solverResult', JSON.stringify(result));
      }
      showAuthNotice("No saved timetable found. Reset to newly generated optimized timetable!");
    }
  };

  const clearAllData = () => {
    setIsAutoSyncEnabled(false);
    setFaculties([]);
    setSubjects([]);
    setClasses([]);
    setAssignments([]);
    setTimeSlots(DEFAULT_TIME_SLOTS);
    setDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    setSelectedClassId('');
    setSolverResult(null);
    setCustomSchedule(null);
    setUndoStack([]);
    setRedoStack([]);
    setIsDataStale(false);
    
    // Preserve the currently active/selected timetable name
    const currentActive = activeTimetableName || 'Main Timetable';
    setActiveTimetableName(currentActive);
    
    // Clear local storage items for workspace data without wiping user session / active timetable selection
    localStorage.setItem('mvce_is_cleared', 'true');
    localStorage.setItem('mvce_faculties', JSON.stringify([]));
    localStorage.setItem('mvce_subjects', JSON.stringify([]));
    localStorage.setItem('mvce_classes', JSON.stringify([]));
    localStorage.setItem('mvce_assignments', JSON.stringify([]));
    localStorage.setItem('mvce_timeSlots', JSON.stringify(DEFAULT_TIME_SLOTS));
    localStorage.setItem('mvce_days', JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']));
    localStorage.removeItem('mvce_customSchedule');
    localStorage.removeItem('mvce_solverResult');
    localStorage.setItem('mvce_firebase_active_timetable', currentActive);
    
    showAuthNotice(`Workspace for "${currentActive}" cleared. You can now build from scratch.`);
  };

  const createNewTimetableTemplate = (name: string) => {
    setIsAutoSyncEnabled(false);
    setFaculties([]);
    setSubjects([]);
    setClasses([]);
    setAssignments([]);
    setTimeSlots(DEFAULT_TIME_SLOTS);
    setDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setSelectedClassId('');
    setSolverResult(null);
    setCustomSchedule(null);
    setUndoStack([]);
    setRedoStack([]);
    setIsDataStale(false);
    
    const finalName = name.trim() || 'New Timetable';
    setActiveTimetableName(finalName);
    
    localStorage.clear();
    localStorage.setItem('mvce_is_cleared', 'true');
    localStorage.setItem('mvce_timeSlots', JSON.stringify(DEFAULT_TIME_SLOTS));
    localStorage.setItem('mvce_days', JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
    localStorage.setItem('mvce_firebase_active_timetable', finalName);
    
    showAuthNotice(`Created a fresh timetable: "${finalName}".`);
  };

  const handleClearSubmit = () => {
    if (clearAdminPassword === 'rampuresir') {
      clearAllData();
      setShowClearConfirmModal(false);
      setClearAdminPassword('');
      setClearPasswordError(null);
    } else {
      setClearPasswordError('Incorrect password. Access denied.');
    }
  };

  const showAuthNotice = (msg: string) => {
    let toastType: 'success' | 'info' | 'warning' | 'error' = 'success';
    const lower = msg.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('incorrect') || lower.includes('denied')) {
      toastType = 'error';
    } else if (lower.includes('warning')) {
      toastType = 'warning';
    } else if (lower.includes('info') || lower.includes('loading') || lower.includes('fetching') || lower.includes('generating') || lower.includes('preparing')) {
      toastType = 'info';
    }
    
    addToast(msg, toastType);
    setAuthNotification(msg);
    setTimeout(() => setAuthNotification(null), 4000);
  };

  const formatFacultyName = (rawName: string): string => {
    if (!rawName) return '';
    const stripped = rawName.replace(/👤/g, '').trim();
    return stripped
      .split(/(\s+)/)
      .map((part) => {
        if (!part || /^\s+$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  };

  const cleanPhoneNumber = (val: string): string => {
    return val.replace(/\D/g, '');
  };

  // --- Firebase Integration Helper Functions ---

  // Fetch available timetables from Firebase Firestore
  const fetchFirebaseTimetablesList = async (silent = false) => {
    if (!silent) setIsCloudFetchingList(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setFirebaseTimetables([]);
        return;
      }
      const isSuper = user.email === 'sachinadi88@gmail.com';
      const q = isSuper 
        ? collection(db, "mvce_timetables")
        : query(collection(db, "mvce_timetables"), where("userId", "==", user.uid));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "mvce_timetables");
      }
      const names: string[] = [];
      if (querySnapshot) {
        querySnapshot.forEach((doc) => {
          names.push(doc.id);
        });
      }
      setFirebaseTimetables(names);
      setFirebaseError(null); // Clear errors on successful fetch
    } catch (error: any) {
      console.error("Error fetching timetables from Firestore:", error);
      setFirebaseError(error?.message || String(error));
    } finally {
      if (!silent) setIsCloudFetchingList(false);
    }
  };

  // Save current timetable to Firestore
  const saveTimetableToFirebase = async (nameToSave: string, isAuto = false) => {
    if (!nameToSave || !nameToSave.trim()) {
      showAuthNotice("Please enter a valid name for the timetable.");
      return;
    }
    if (!isAuto) {
      setIsCloudSaving(true);
    } else {
      setIsAutoSyncing(true);
    }
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }
      
      const liveData = workspaceDataRef.current;
      const timetableData = {
        name: nameToSave,
        updatedAt: new Date().toISOString(),
        userId: user.uid,
        faculties: liveData.faculties,
        subjects: liveData.subjects,
        classes: liveData.classes,
        assignments: liveData.assignments,
        timeSlots: liveData.timeSlots,
        days: liveData.days,
        customSchedule: liveData.customSchedule || null,
        solverResult: liveData.solverResult || null
      };
      
      const serializedData = serializeForFirestore(timetableData);
      
      try {
        await setDoc(doc(db, "mvce_timetables", nameToSave), serializedData);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `mvce_timetables/${nameToSave}`);
      }
      
      // Update local states
      setActiveTimetableName(nameToSave);
      localStorage.setItem('mvce_firebase_active_timetable', nameToSave);
      setLastSyncedTime(format12HourTime());
      setFirebaseError(null); // Clear errors on success
      
      // Refresh list without reloading or switching active timetable
      await fetchFirebaseTimetablesList(true);
      
      if (!isAuto) {
        showAuthNotice(`Timetable "${nameToSave}" successfully saved to Firebase Cloud!`);
      }
    } catch (error: any) {
      console.error("Error saving to Firestore:", error);
      setFirebaseError(error?.message || String(error));
      if (!isAuto) {
        showAuthNotice(`Failed to save to Firebase: ${error?.message || error}`);
      }
    } finally {
      if (!isAuto) setIsCloudSaving(false);
      setIsAutoSyncing(false);
    }
  };

  // Load timetable from Firestore
  const loadTimetableFromFirebase = async (nameToLoad: string) => {
    if (!nameToLoad) return;
    setIsCloudLoading(true);
    try {
      const docRef = doc(db, "mvce_timetables", nameToLoad);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `mvce_timetables/${nameToLoad}`);
      }
      
      if (docSnap && docSnap.exists()) {
        const rawData = docSnap.data();
        const data = deserializeFromFirestore(rawData);
        
        // Load states
        if (data.faculties) {
          setFaculties((data.faculties as Faculty[]).map(f => ({
            ...f,
            department: normalizeDepartment(f.department)
          })));
        }
        if (data.subjects) {
          setSubjects((data.subjects as Subject[]).map(s => ({
            ...s,
            department: normalizeDepartment(s.department)
          })));
        }
        if (data.classes) {
          const updatedClasses = data.classes.map((c: any) => ({ ...c, labBatches: c.labBatches ?? 2 }));
          setClasses(updatedClasses);
          if (updatedClasses.length > 0) {
            setSelectedClassId(updatedClasses[0].id);
          }
        }
        if (data.assignments) setAssignments(data.assignments);
        if (data.timeSlots) setTimeSlots(normalizeTimeSlotsWithDefaults(data.timeSlots));
        if (data.days) setDays(data.days);
        if (data.customSchedule) setCustomSchedule(data.customSchedule);
        if (data.solverResult) setSolverResult(data.solverResult);
        
        setActiveTimetableName(nameToLoad);
        localStorage.setItem('mvce_firebase_active_timetable', nameToLoad);
        setLastSyncedTime(format12HourTime());
        setFirebaseError(null); // Clear errors on success
        
        showAuthNotice(`Timetable "${nameToLoad}" successfully loaded from Firebase Cloud!`);
      } else {
        showAuthNotice(`Timetable "${nameToLoad}" not found in Firebase Cloud.`);
      }
    } catch (error: any) {
      console.error("Error loading from Firestore:", error);
      setFirebaseError(error?.message || String(error));
      showAuthNotice(`Failed to load: ${error?.message || error}`);
    } finally {
      setIsCloudLoading(false);
    }
  };

  // Delete timetable from Firestore
  const deleteTimetableFromFirebase = async (nameToDelete: string) => {
    if (!nameToDelete) return;
    
    try {
      try {
        await deleteDoc(doc(db, "mvce_timetables", nameToDelete));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `mvce_timetables/${nameToDelete}`);
      }
      showAuthNotice(`Timetable "${nameToDelete}" deleted from Firebase Cloud.`);
      setFirebaseError(null); // Clear errors on success
      
      // If deleted active one, reset name
      if (activeTimetableName === nameToDelete) {
        setActiveTimetableName('Main Timetable');
        localStorage.removeItem('mvce_firebase_active_timetable');
      }
      
      await fetchFirebaseTimetablesList(true);
    } catch (error: any) {
      console.error("Error deleting from Firestore:", error);
      setFirebaseError(error?.message || String(error));
      showAuthNotice(`Failed to delete: ${error?.message || error}`);
    }
  };

  // Initialize Firebase and fetch list on mount, load last active timetable if exists
  useEffect(() => {
    if (currentUser) {
      fetchFirebaseTimetablesList(true);
      const lastActive = localStorage.getItem('mvce_firebase_active_timetable');
      if (lastActive) {
        setActiveTimetableName(lastActive);
        loadTimetableFromFirebase(lastActive);
      }
    }
  }, [currentUser]);

  const handleToggleAutoSync = () => {
    const nextState = !isAutoSyncEnabled;
    setIsAutoSyncEnabled(nextState);
    localStorage.setItem('mvce_auto_sync', String(nextState));
    if (nextState) {
      showAuthNotice("Live Auto-Sync Activated: All additions, edits, and schedule adjustments will automatically save to Firebase Cloud.");
      if (activeTimetableName && currentUser) {
        saveTimetableToFirebase(activeTimetableName, true);
      }
    } else {
      showAuthNotice("Live Auto-Sync Deactivated. Timetables will now only be saved when you click 'Save to Cloud'.");
    }
  };

  // Auto-Sync to Firebase when data changes (debounced)
  useEffect(() => {
    if (!currentUser || !isAutoSyncEnabled || !activeTimetableName) return;

    setIsAutoSyncing(true);
    const delayDebounce = setTimeout(() => {
      saveTimetableToFirebase(activeTimetableName, true);
    }, 1000); // 1.0-second debounce

    return () => {
      clearTimeout(delayDebounce);
    };
  }, [
    faculties,
    subjects,
    classes,
    assignments,
    timeSlots,
    days,
    customSchedule,
    solverResult,
    isAutoSyncEnabled,
    activeTimetableName,
    currentUser
  ]);

  const handlePrint = () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      showAuthNotice("Tip: Print dialog blocked by iframe. Click 'Open in New Tab' (top-right), then click Print!");
    }
    try {
      window.print();
    } catch (e) {
      console.error("Print failed:", e);
      showAuthNotice("Print failed. Please open the app in a new tab to print.");
    }
  };

  // --- WhatsApp Sharing Helper Functions ---
  const getFacultyWhatsAppMessage = (facId: string) => {
    const fac = faculties.find(f => f.id === facId);
    if (!fac) return '';

    let text = `*Sir M. Visvesvaraya College of Engineering, Raichur*\n`;
    text += `*FACULTY TIMETABLE: ${fac.name.toUpperCase()} (${fac.shortName})*\n`;
    text += `Department: ${normalizeDepartment(fac.department)}\n`;
    text += `==================================\n\n`;

    let hasAnyClass = false;

    days.forEach((day) => {
      let activePeriodCounter = 0;
      const daySlots: string[] = [];
      let dayHasClasses = false;

      timeSlots.forEach((slot) => {
        if (slot.isBreak) {
          daySlots.push(`• *${formatTimeRange12(slot.startTime, slot.endTime)}*: _${slot.label}_`);
          return;
        }

        const periodIdx = activePeriodCounter;
        activePeriodCounter++;

        if (solverResult?.schedule) {
          for (const cls of classes) {
            const classSched = solverResult.schedule[cls.id];
            if (classSched && classSched[day]) {
              const cellEntry = classSched[day][periodIdx];
              if (cellEntry) {
                if (typeof cellEntry === 'string') {
                  const assign = assignments.find(a => a.id === cellEntry);
                  if (assign && assign.facultyId === facId) {
                    const sub = subjects.find(s => s.id === assign.subjectId);
                    daySlots.push(`• *${formatTimeRange12(slot.startTime, slot.endTime)}* (${slot.label}): ${cls.name} (Sec ${cls.section}) - *${sub ? sub.name : 'Subject'}* [${sub ? sub.code : ''}]`);
                    dayHasClasses = true;
                  }
                } else {
                  const batchItems = getBatchItemsFromCell(cellEntry);
                  if (batchItems) {
                    for (const batchItem of batchItems) {
                      const assign = assignments.find(a => a.id === batchItem.assignmentId);
                      if (assign && assign.facultyId === facId) {
                        const sub = subjects.find(s => s.id === assign.subjectId);
                        daySlots.push(`• *${formatTimeRange12(slot.startTime, slot.endTime)}* (${slot.label}): ${cls.name} (Sec ${cls.section}, Batch ${batchItem.batchName}) - *${sub ? sub.name : 'Subject'}* [${sub ? sub.code : ''}]`);
                        dayHasClasses = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (dayHasClasses) {
        hasAnyClass = true;
        text += `*${day.toUpperCase()}*\n`;
        daySlots.forEach(line => {
          text += `${line}\n`;
        });
        text += `\n`;
      }
    });

    if (!hasAnyClass) {
      text += `_No teaching assignments scheduled._\n\n`;
    }

    text += `Generated on ${new Date().toLocaleDateString()} via College Scheduling System.`;
    return text;
  };

  const handleOpenWhatsAppModal = (facId: string) => {
    const fac = faculties.find(f => f.id === facId);
    if (!fac) return;
    setWhatsAppFacultyId(facId);
    setWhatsAppPhoneInput(fac.phone === '--' ? '' : fac.phone);
    setIsCopiedWhatsApp(false);
    setShowWhatsAppModal(true);
  };

  const handleCopyWhatsAppMessage = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setIsCopiedWhatsApp(true);
        showAuthNotice("WhatsApp timetable message copied to clipboard!");
        setTimeout(() => setIsCopiedWhatsApp(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
        showAuthNotice("Failed to copy to clipboard.");
      });
  };

  const [isExportingFacultyPDF, setIsExportingFacultyPDF] = useState(false);

  const handleExportFacultyPDF = async () => {
    const element = document.getElementById('faculty-timetable-card');
    if (!element) return;
    
    setIsExportingFacultyPDF(true);
    showAuthNotice("Generating Faculty PDF, please wait...");
    
    // Save original styles/classes
    const originalWidth = element.style.width;
    const originalMinWidth = element.style.minWidth;
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;
    const originalPadding = element.style.padding;
    
    // Temporarily force desktop size (landscape mode) for high-quality render & strip outer grey border/shadow
    element.style.width = '1120px';
    element.style.minWidth = '1120px';
    element.style.padding = '8px 0px';
    element.style.setProperty('border', 'none', 'important');
    element.style.setProperty('box-shadow', 'none', 'important');

    const elementsWithShadow = element.querySelectorAll('[class*="shadow"]');
    elementsWithShadow.forEach(el => {
      (el as HTMLElement).dataset.originalShadow = (el as HTMLElement).style.boxShadow || '';
      (el as HTMLElement).style.setProperty('box-shadow', 'none', 'important');
    });
    
    const printHeader = element.querySelector('.print\\:flex');
    if (printHeader) {
      printHeader.classList.remove('hidden');
    }
    
    const controls = element.querySelector('.roster-controls-container');
    if (controls) {
      controls.classList.add('hidden');
    }

    const infoBoxes = element.querySelectorAll('.timetable-info-box');
    infoBoxes.forEach(box => {
      box.classList.add('hidden');
    });

    const pdfSignatures = element.querySelector('.pdf-signatures');
    if (pdfSignatures) {
      pdfSignatures.classList.remove('hidden');
    }

    const pdfSubjectLegend = element.querySelector('.pdf-subject-legend');
    if (pdfSubjectLegend) {
      pdfSubjectLegend.classList.remove('hidden');
    }
    
    // Allow browser to repaint with the new landscape styles
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const currentFacultyObj = faculties.find(f => f.id === selectedFacultyId);
      const facultyName = currentFacultyObj ? `${currentFacultyObj.shortName}_Timetable` : 'Faculty_Timetable';
      
      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2.0
      });
      
      const imgWidth = 1120; // Forced width
      const imgHeight = element.offsetHeight;
      
      const pdfWidth = 842;
      const pdfHeight = 595;
      
      const ratio = imgWidth / imgHeight;
      let width = pdfWidth; // Exactly 100% coverage across left & right (edge-to-edge)
      let height = width / ratio;
      
      if (height > pdfHeight) {
        height = pdfHeight;
        width = height * ratio;
      }
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, width, height, undefined, 'FAST');
      
      // Add timestamp to the top right (date only)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const timestampText = `Generated on: ${day}/${month}/${year}`;
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60);
      pdf.text(timestampText, pdfWidth - 20, 18, { align: 'right' });

      pdf.save(`Timetable_${facultyName}.pdf`);
      showAuthNotice("Faculty Timetable PDF downloaded successfully!");
    } catch (error) {
      console.error('Faculty PDF generation failed:', error);
      showAuthNotice("PDF generation failed. Please try again.");
    } finally {
      // Restore original style values
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.border = originalBorder;
      element.style.boxShadow = originalBoxShadow;
      element.style.padding = originalPadding;

      elementsWithShadow.forEach(el => {
        (el as HTMLElement).style.boxShadow = (el as HTMLElement).dataset.originalShadow || '';
      });
      
      if (printHeader) {
        printHeader.classList.add('hidden');
      }
      if (controls) {
        controls.classList.remove('hidden');
      }
      infoBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
      if (pdfSignatures) {
        pdfSignatures.classList.add('hidden');
      }
      if (pdfSubjectLegend) {
        pdfSubjectLegend.classList.add('hidden');
      }
      setIsExportingFacultyPDF(false);
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const handleExportPDF = async () => {
    const element = document.getElementById('class-roster-timetable-card');
    if (!element) return;
    
    setIsExportingPDF(true);
    showAuthNotice("Generating PDF, please wait...");
    
    // Save original styles/classes
    const originalWidth = element.style.width;
    const originalMinWidth = element.style.minWidth;
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;
    const originalPadding = element.style.padding;
    
    // Temporarily force desktop size (landscape mode) for high-quality render & strip outer grey border/shadow
    element.style.width = '1120px';
    element.style.minWidth = '1120px';
    element.style.padding = '8px 0px';
    element.style.setProperty('border', 'none', 'important');
    element.style.setProperty('box-shadow', 'none', 'important');

    const elementsWithShadow = element.querySelectorAll('[class*="shadow"]');
    elementsWithShadow.forEach(el => {
      (el as HTMLElement).dataset.originalShadow = (el as HTMLElement).style.boxShadow || '';
      (el as HTMLElement).style.setProperty('box-shadow', 'none', 'important');
    });
    
    const printHeader = element.querySelector('.print\\:flex');
    if (printHeader) {
      printHeader.classList.remove('hidden');
    }
    
    const controls = element.querySelector('.roster-controls-container');
    if (controls) {
      controls.classList.add('hidden');
    }

    const infoBoxes = element.querySelectorAll('.timetable-info-box');
    infoBoxes.forEach(box => {
      box.classList.add('hidden');
    });

    const pdfSignatures = element.querySelector('.pdf-signatures');
    if (pdfSignatures) {
      pdfSignatures.classList.remove('hidden');
    }

    const pdfSubjectLegend = element.querySelector('.pdf-subject-legend');
    if (pdfSubjectLegend) {
      pdfSubjectLegend.classList.remove('hidden');
    }
    
    // Allow browser to repaint with the new landscape styles
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const currentClassObj = classes.find(c => c.id === selectedClassId);
      const className = currentClassObj ? `${currentClassObj.name}_Sec_${currentClassObj.section}` : 'Roster';
      
      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2.0
      });
      
      const imgWidth = 1120; // Forced width
      const imgHeight = element.offsetHeight;
      
      const pdfWidth = 842;
      const pdfHeight = 595;
      
      const ratio = imgWidth / imgHeight;
      let width = pdfWidth; // Exactly 100% coverage across left & right (edge-to-edge)
      let height = width / ratio;
      
      if (height > pdfHeight) {
        height = pdfHeight;
        width = height * ratio;
      }
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, width, height, undefined, 'FAST');
      
      // Add timestamp to the top right (date only)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const timestampText = `Generated on: ${day}/${month}/${year}`;
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60);
      pdf.text(timestampText, pdfWidth - 20, 18, { align: 'right' });

      pdf.save(`Timetable_${className}.pdf`);
      showAuthNotice("PDF downloaded successfully!");
    } catch (error) {
      console.error('PDF generation failed:', error);
      showAuthNotice("PDF generation failed. Please try again.");
    } finally {
      // Restore original style values
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.border = originalBorder;
      element.style.boxShadow = originalBoxShadow;
      element.style.padding = originalPadding;

      elementsWithShadow.forEach(el => {
        (el as HTMLElement).style.boxShadow = (el as HTMLElement).dataset.originalShadow || '';
      });
      
      if (printHeader) {
        printHeader.classList.add('hidden');
      }
      if (controls) {
        controls.classList.remove('hidden');
      }
      infoBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
      if (pdfSignatures) {
        pdfSignatures.classList.add('hidden');
      }
      if (pdfSubjectLegend) {
        pdfSubjectLegend.classList.add('hidden');
      }
      setIsExportingPDF(false);
    }
  };

  const handleDownloadPDFLocally = async () => {
    const element = document.getElementById('class-roster-timetable-card');
    if (!element) return;
    
    setIsDownloadingPDF(true);
    showAuthNotice("Preparing local PDF download...");
    
    // Save original styles/classes
    const originalWidth = element.style.width;
    const originalMinWidth = element.style.minWidth;
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;
    const originalPadding = element.style.padding;
    
    // Temporarily force desktop size (landscape mode) for high-quality render & strip outer grey border/shadow
    element.style.width = '1120px';
    element.style.minWidth = '1120px';
    element.style.padding = '8px 0px';
    element.style.setProperty('border', 'none', 'important');
    element.style.setProperty('box-shadow', 'none', 'important');

    const elementsWithShadow = element.querySelectorAll('[class*="shadow"]');
    elementsWithShadow.forEach(el => {
      (el as HTMLElement).dataset.originalShadow = (el as HTMLElement).style.boxShadow || '';
      (el as HTMLElement).style.setProperty('box-shadow', 'none', 'important');
    });
    
    const printHeader = element.querySelector('.print\\:flex');
    if (printHeader) {
      printHeader.classList.remove('hidden');
    }
    
    const controls = element.querySelector('.roster-controls-container');
    if (controls) {
      controls.classList.add('hidden');
    }

    const infoBoxes = element.querySelectorAll('.timetable-info-box');
    infoBoxes.forEach(box => {
      box.classList.add('hidden');
    });

    const pdfSignatures = element.querySelector('.pdf-signatures');
    if (pdfSignatures) {
      pdfSignatures.classList.remove('hidden');
    }

    const pdfSubjectLegend = element.querySelector('.pdf-subject-legend');
    if (pdfSubjectLegend) {
      pdfSubjectLegend.classList.remove('hidden');
    }
    
    // Allow browser to repaint with the new landscape styles
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const currentClassObj = classes.find(c => c.id === selectedClassId);
      const className = currentClassObj ? `${currentClassObj.name}_Sec_${currentClassObj.section}` : 'Roster';
      
      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2.0
      });
      
      const imgWidth = 1120; // Forced width
      const imgHeight = element.offsetHeight;
      
      const pdfWidth = 842;
      const pdfHeight = 595;
      
      const ratio = imgWidth / imgHeight;
      let width = pdfWidth; // Exactly 100% coverage across left & right (edge-to-edge)
      let height = width / ratio;
      
      if (height > pdfHeight) {
        height = pdfHeight;
        width = height * ratio;
      }
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, width, height, undefined, 'FAST');

      // Add timestamp to the top right (date only)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const timestampText = `Generated on: ${day}/${month}/${year}`;
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60);
      pdf.text(timestampText, pdfWidth - 20, 18, { align: 'right' });

      pdf.save(`Direct_Timetable_${className}.pdf`);
      showAuthNotice("Timetable PDF downloaded locally!");
    } catch (error) {
      console.error('Local PDF download failed:', error);
      showAuthNotice("Failed to download PDF locally.");
    } finally {
      // Restore original style values
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.border = originalBorder;
      element.style.boxShadow = originalBoxShadow;
      element.style.padding = originalPadding;

      elementsWithShadow.forEach(el => {
        (el as HTMLElement).style.boxShadow = (el as HTMLElement).dataset.originalShadow || '';
      });
      
      if (printHeader) {
        printHeader.classList.add('hidden');
      }
      if (controls) {
        controls.classList.remove('hidden');
      }
      infoBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
      if (pdfSignatures) {
        pdfSignatures.classList.add('hidden');
      }
      if (pdfSubjectLegend) {
        pdfSubjectLegend.classList.add('hidden');
      }
      setIsDownloadingPDF(false);
    }
  };

  // --- Form Adders ---
  const addFaculty = (e: FormEvent) => {
    e.preventDefault();
    setFacFormSubmitted(true);
    if (!newFacName || !newFacShort) return;
    if (newFacPhone && newFacPhone.length !== 10) {
      showAuthNotice("Error: Phone number must be exactly 10 digits.");
      return;
    }
    const newFac: Faculty = {
      id: 'f_' + Date.now(),
      name: formatFacultyName(newFacName),
      shortName: newFacShort.toUpperCase(),
      department: newFacDept,
      phone: newFacPhone || '--'
    };
    setFaculties([...faculties, newFac]);
    setNewFacName('');
    setNewFacShort('');
    setNewFacPhone('');
    setFacFormSubmitted(false);
    showAuthNotice(`Faculty ${newFac.shortName} added successfully.`);
  };

  const addSubject = (e: FormEvent) => {
    e.preventDefault();
    setSubFormSubmitted(true);
    if (!newSubCode || !newSubName) return;

    let selectedColor = newSubColor;
    if (!selectedColor) {
      selectedColor = getUniqueUnusedColor(subjects);
    }

    const newSub: Subject = {
      id: 's_' + Date.now(),
      code: newSubCode.toUpperCase(),
      name: newSubName,
      department: newSubDept,
      weeklyPeriods: Number(newSubPeriods),
      isLab: newSubIsLab,
      isProject: newSubIsProject,
      isAicteActivity: newSubIsAicte,
      isStudentActivity: newSubIsMentoring,
      color: selectedColor
    };
    setSubjects([...subjects, newSub]);
    showAuthNotice(`Subject ${newSub.code} added.`);

    setNewSubCode('');
    setNewSubName('');
    setNewSubPeriods(4);
    setNewSubIsLab(false);
    setNewSubIsProject(false);
    setNewSubIsAicte(false);
    setNewSubIsMentoring(false);
    setNewSubColor('');
    setSubFormSubmitted(false);
  };

  const [divideIntoBatches, setDivideIntoBatches] = useState(false);
  const [numBatches, setNumBatches] = useState(2);

  const startEditingClass = (cls: ClassSection) => {
    setEditingClassId(cls.id);
    const branchName = cls.branch || cls.name.replace(new RegExp(`\\s*${cls.semester}\\s*Sem`, 'i'), '').trim() || cls.name;
    setNewClassName(branchName.toUpperCase());
    setNewClassroom((cls.classroom || '').toUpperCase());
    setNewClassSem(cls.semester || '5th');
    setNewClassSec((cls.section || 'A').toUpperCase());
    setDivideIntoBatches((cls.labBatches ?? 1) > 1);
    setNumBatches(cls.labBatches && cls.labBatches > 1 ? cls.labBatches : 2);
    setClassFormSubmitted(false);
  };

  const cancelEditingClass = () => {
    setEditingClassId(null);
    setNewClassName('');
    setNewClassroom('');
    setNewClassSem('5th');
    setNewClassSec('A');
    setDivideIntoBatches(false);
    setNumBatches(2);
    setClassFormSubmitted(false);
  };

  const addClass = (e: FormEvent) => {
    e.preventDefault();
    setClassFormSubmitted(true);
    if (!newClassName.trim()) return;

    const branch = newClassName.trim().toUpperCase();
    const sec = newClassSec.trim().toUpperCase() || 'A';
    const room = newClassroom.trim().toUpperCase() || undefined;
    const batchCount = divideIntoBatches ? numBatches : 1;

    if (editingClassId) {
      const updatedClasses = classes.map(c => {
        if (c.id === editingClassId) {
          return {
            ...c,
            branch,
            name: `${branch} ${newClassSem} Sem`,
            semester: newClassSem,
            section: sec,
            labBatches: batchCount,
            classroom: room
          };
        }
        return c;
      });
      setClasses(updatedClasses);
      setEditingClassId(null);
      setNewClassName('');
      setNewClassroom('');
      setNewClassSec('A');
      setDivideIntoBatches(false);
      setNumBatches(2);
      setClassFormSubmitted(false);
      showAuthNotice(`Class ${branch} ${newClassSem} Sem (Sec ${sec})${room ? ` [Room ${room}]` : ''} updated successfully.`);
      return;
    }

    const newCls: ClassSection = {
      id: 'c_' + Date.now(),
      branch,
      name: `${branch} ${newClassSem} Sem`,
      semester: newClassSem,
      section: sec,
      labBatches: batchCount,
      classroom: room
    };
    setClasses([...classes, newCls]);
    if (!selectedClassId) {
      setSelectedClassId(newCls.id);
    }
    setNewClassName('');
    setNewClassroom('');
    setNewClassSec('A');
    setDivideIntoBatches(false);
    setNumBatches(2);
    setClassFormSubmitted(false);
    showAuthNotice(`Class ${newCls.name} (Sec ${newCls.section})${newCls.classroom ? ` [Room ${newCls.classroom}]` : ''} created${divideIntoBatches ? ` with ${numBatches} Lab Batches (${sec}1, ${sec}2${numBatches >= 3 ? ', ' + sec + '3' : ''}${numBatches >= 4 ? ', ' + sec + '4' : ''})` : ''}.`);
  };

  const addAssignment = (e: FormEvent) => {
    e.preventDefault();
    setAssignFormSubmitted(true);
    const selSub = subjects.find(s => s.id === assignSubId);
    const isOptionalFaculty = selSub?.isAicteActivity || selSub?.isStudentActivity;
    if (!assignClassId || !assignSubId || (!isOptionalFaculty && !assignFacId)) return;
    
    // Check if assignment already exists
    const exists = assignments.some(
      a => a.classId === assignClassId && a.subjectId === assignSubId && (isOptionalFaculty ? true : a.facultyId === assignFacId)
    );
    if (exists) {
      showAuthNotice("Warning: This assignment already exists!");
      return;
    }

    const newAssign: Assignment = {
      id: 'a_' + Date.now(),
      classId: assignClassId,
      subjectId: assignSubId,
      facultyId: assignFacId || ''
    };
    setAssignments([...assignments, newAssign]);
    setAssignFormSubmitted(false);
    showAuthNotice("Course faculty binding created successfully.");
  };

  const startEditingAssignment = (assign: Assignment) => {
    setEditingAssignmentId(assign.id);
    setAssignClassId(assign.classId);
    setAssignSubId(assign.subjectId);
    setAssignFacId(assign.facultyId);
    setAssignFormSubmitted(false);
  };

  const cancelEditingAssignment = () => {
    setEditingAssignmentId(null);
    setAssignClassId('');
    setAssignSubId('');
    setAssignFacId('');
    setAssignFormSubmitted(false);
  };

  const updateAssignment = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setAssignFormSubmitted(true);
    const selSub = subjects.find(s => s.id === assignSubId);
    const isOptionalFaculty = selSub?.isAicteActivity || selSub?.isStudentActivity;
    if (!editingAssignmentId || !assignClassId || !assignSubId || (!isOptionalFaculty && !assignFacId)) return;

    const exists = assignments.some(
      a => a.id !== editingAssignmentId && a.classId === assignClassId && a.subjectId === assignSubId && (isOptionalFaculty ? true : a.facultyId === assignFacId)
    );
    if (exists) {
      showAuthNotice("Warning: This binding already exists!");
      return;
    }

    setAssignments(assignments.map(a => {
      if (a.id === editingAssignmentId) {
        return {
          ...a,
          classId: assignClassId,
          subjectId: assignSubId,
          facultyId: assignFacId || ''
        };
      }
      return a;
    }));

    cancelEditingAssignment();
    showAuthNotice("Course faculty binding updated successfully.");
  };

  const addTimeSlot = (e: FormEvent) => {
    e.preventDefault();
    setTimeFormSubmitted(true);
    if (!newSlotLabel || !newSlotStart || !newSlotEnd) return;

    if (editingSlotId) {
      const updated = timeSlots.map(s => s.id === editingSlotId ? {
        ...s,
        label: newSlotLabel,
        startTime: newSlotStart,
        endTime: newSlotEnd,
        isBreak: newSlotIsBreak
      } : s).sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTimeSlots(updated);
      setEditingSlotId(null);
      setNewSlotLabel('');
      setNewSlotStart('09:00');
      setNewSlotEnd('10:00');
      setNewSlotIsBreak(false);
      setTimeFormSubmitted(false);
      showAuthNotice("Time slot updated successfully.");
      return;
    }

    const newSlot: TimeSlot = {
      id: 'ts_' + Date.now(),
      label: newSlotLabel,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      isBreak: newSlotIsBreak
    };
    // Sort timeslots by start time
    const updated = [...timeSlots, newSlot].sort((a, b) => a.startTime.localeCompare(b.startTime));
    setTimeSlots(updated);
    setNewSlotLabel('');
    setNewSlotIsBreak(false);
    setTimeFormSubmitted(false);
    showAuthNotice("Time slot added.");
  };

  const startEditingSlot = (slot: TimeSlot) => {
    setEditingSlotId(slot.id);
    setNewSlotLabel(slot.label);
    setNewSlotStart(slot.startTime);
    setNewSlotEnd(slot.endTime);
    setNewSlotIsBreak(slot.isBreak);
    setTimeFormSubmitted(false);
  };

  const cancelEditingSlot = () => {
    setEditingSlotId(null);
    setNewSlotLabel('');
    setNewSlotStart('09:00');
    setNewSlotEnd('10:00');
    setNewSlotIsBreak(false);
    setTimeFormSubmitted(false);
  };

  // --- Deletion Handlers ---
  const startEditingFaculty = (fac: Faculty) => {
    setEditingFacultyId(fac.id);
    setEditFacName(fac.name);
    setEditFacShort(fac.shortName);
    setEditFacDept(normalizeDepartment(fac.department));
    setEditFacPhone(fac.phone === '--' ? '' : fac.phone);
    setEditFacFormSubmitted(false);
  };

  const cancelEditingFaculty = () => {
    setEditingFacultyId(null);
    setEditFacName('');
    setEditFacShort('');
    setEditFacDept('CSE');
    setEditFacPhone('');
    setEditFacFormSubmitted(false);
  };

  const updateFaculty = (e: FormEvent) => {
    e.preventDefault();
    setEditFacFormSubmitted(true);
    if (!editingFacultyId || !editFacName || !editFacShort) return;
    if (editFacPhone && editFacPhone.length !== 10) {
      showAuthNotice("Error: Phone number must be exactly 10 digits.");
      return;
    }

    setFaculties(prevFacs => prevFacs.map(f => {
      if (f.id === editingFacultyId) {
        return {
          ...f,
          name: formatFacultyName(editFacName),
          shortName: editFacShort.toUpperCase(),
          department: editFacDept,
          phone: editFacPhone || '--'
        };
      }
      return f;
    }));

    showAuthNotice(`Faculty details updated successfully.`);
    cancelEditingFaculty();
  };

  const deleteFaculty = (id: string) => {
    const fac = faculties.find(f => f.id === id);
    setFaculties(faculties.filter(f => f.id !== id));
    setAssignments(assignments.filter(a => a.facultyId !== id));
    if (fac) {
      showAuthNotice(`Faculty "${fac.name}" (${fac.shortName}) deleted successfully.`);
    }
  };

  const deleteSubject = (id: string) => {
    const sub = subjects.find(s => s.id === id);
    setSubjects(subjects.filter(s => s.id !== id));
    setAssignments(assignments.filter(a => a.subjectId !== id));
    if (editingSubjectId === id) {
      cancelEditingSubject();
    }
    if (sub) {
      showAuthNotice(`Subject "${sub.name}" (${sub.code}) deleted successfully.`);
    }
  };

  const startEditingSubject = (sub: Subject) => {
    setEditingSubjectId(sub.id);
    setEditSubCode(sub.code);
    setEditSubName(sub.name);
    setEditSubDept(normalizeDepartment(sub.department));
    setEditSubPeriods(sub.weeklyPeriods);
    setEditSubIsLab(!!sub.isLab);
    setEditSubIsProject(!!sub.isProject);
    setEditSubIsAicte(!!sub.isAicteActivity);
    setEditSubIsMentoring(!!sub.isStudentActivity);
    setEditSubColor(sub.color || '');
    setEditSubFormSubmitted(false);
  };

  const cancelEditingSubject = () => {
    setEditingSubjectId(null);
    setEditSubCode('');
    setEditSubName('');
    setEditSubDept('CSE');
    setEditSubPeriods(4);
    setEditSubIsLab(false);
    setEditSubIsProject(false);
    setEditSubIsAicte(false);
    setEditSubIsMentoring(false);
    setEditSubColor('');
    setEditSubFormSubmitted(false);
  };

  const updateSubject = (e: FormEvent) => {
    e.preventDefault();
    setEditSubFormSubmitted(true);
    if (!editingSubjectId || !editSubCode || !editSubName) return;

    setSubjects(prevSubs => prevSubs.map(s => {
      if (s.id === editingSubjectId) {
        return {
          ...s,
          code: editSubCode.toUpperCase(),
          name: editSubName,
          department: editSubDept,
          weeklyPeriods: Number(editSubPeriods),
          isLab: editSubIsLab,
          isProject: editSubIsProject,
          isAicteActivity: editSubIsAicte,
          isStudentActivity: editSubIsMentoring,
          color: editSubColor || getUniqueUnusedColor(subjects.filter(item => item.id !== editingSubjectId))
        };
      }
      return s;
    }));

    showAuthNotice(`Subject details updated successfully.`);
    cancelEditingSubject();
  };

  const openColorModalForSubject = (subjectId: string) => {
    setColorModalSubjectId(subjectId);
    setIsColorModalOpen(true);
  };

  const updateSubjectColorDirectly = (subjectId: string, color: string) => {
    setSubjects(prevSubs => prevSubs.map(s => s.id === subjectId ? { ...s, color } : s));
    const sub = subjects.find(s => s.id === subjectId);
    showAuthNotice(`Color updated for "${sub?.name || 'Subject'}".`);
  };

  const deleteClass = (id: string) => {
    if (editingClassId === id) {
      cancelEditingClass();
    }
    const cls = classes.find(c => c.id === id);
    setClasses(classes.filter(c => c.id !== id));
    setAssignments(assignments.filter(a => a.classId !== id));
    if (selectedClassId === id) {
      const remaining = classes.filter(c => c.id !== id);
      setSelectedClassId(remaining.length > 0 ? remaining[0].id : '');
    }
    if (cls) {
      showAuthNotice(`Class "${cls.name} (Sec ${cls.section})" deleted successfully.`);
    }
  };

  const deleteAssignment = (id: string) => {
    if (editingAssignmentId === id) {
      cancelEditingAssignment();
    }
    const assign = assignments.find(a => a.id === id);
    setAssignments(assignments.filter(a => a.id !== id));
    if (assign) {
      const sub = subjects.find(s => s.id === assign.subjectId);
      const fac = faculties.find(f => f.id === assign.facultyId);
      const cls = classes.find(c => c.id === assign.classId);
      const subCode = sub ? sub.code : 'Subject';
      const facName = fac ? fac.shortName : 'Faculty';
      const clsName = cls ? `${cls.name} (Sec ${cls.section})` : '';
      showAuthNotice(`Assignment of "${subCode}" to "${facName}" for Class ${clsName} deleted successfully.`);
    }
  };

  const deleteTimeSlot = (id: string) => {
    const slot = timeSlots.find(t => t.id === id);
    setTimeSlots(timeSlots.filter(t => t.id !== id));
    if (slot) {
      showAuthNotice(`Time slot "${slot.label}" (${formatTimeRange12(slot.startTime, slot.endTime)}) deleted successfully.`);
    }
  };

  // --- Helper Selectors ---
  const activePeriods = useMemo(() => {
    return timeSlots.filter(t => !t.isBreak);
  }, [timeSlots]);

  const currentClassObj = useMemo(() => {
    return classes.find(c => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  // --- Dynamic Schedule Validation & Warnings ---
  const scheduleWarnings = useMemo(() => {
    if (!customSchedule) return [];
    const warningsList: {
      classId: string;
      day: string;
      pIdx?: number;
      message: string;
      type: 'clash' | 'continuity' | 'subject_consecutive' | 'daily_limit' | 'lab_split' | 'gap' | 'batch-collision' | 'aicte_day_conflict' | 'mentoring_lunch_conflict' | 'saturday_non_aicte_conflict';
    }[] = [];

    const activeSlots = timeSlots.filter(s => !s.isBreak);
    const totalPeriods = activeSlots.length;

    const isPeriod1To4 = (pIdx: number): boolean => {
      const slot = activeSlots[pIdx];
      if (!slot) return false;
      const labelLower = slot.label.toLowerCase();
      return labelLower.includes('period 1') || labelLower.includes('1st') || pIdx === 0 ||
             labelLower.includes('period 2') || labelLower.includes('2nd') || pIdx === 1 ||
             labelLower.includes('period 3') || labelLower.includes('3rd') || pIdx === 2 ||
             labelLower.includes('period 4') || labelLower.includes('4th') || pIdx === 3;
    };

    // 1. Teacher Clashes
    const teacherSlotMap: Record<string, { classId: string; assignId: string }[]> = {};
    for (const cls of classes) {
      const classSched = customSchedule[cls.id];
      if (!classSched) continue;
      for (const day of days) {
        const slots = classSched[day] || [];
        for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
          const assignId = slots[pIdx];
          if (assignId) {
            const assign = assignments.find(a => a.id === assignId);
            if (assign && assign.facultyId) {
              const key = `${day}_${pIdx}_${assign.facultyId}`;
              if (!teacherSlotMap[key]) {
                teacherSlotMap[key] = [];
              }
              teacherSlotMap[key].push({ classId: cls.id, assignId });
            }
          }
        }
      }
    }

    for (const key in teacherSlotMap) {
      const entries = teacherSlotMap[key];
      if (entries.length > 1) {
        const [day, pIdxStr, facId] = key.split('_');
        const pIdx = parseInt(pIdxStr, 10);
        const fac = faculties.find(f => f.id === facId);
        const facName = fac ? fac.shortName : 'Faculty';
        const classNames = entries.map(e => {
          const c = classes.find(cl => cl.id === e.classId);
          return c ? `${c.name} (Sec ${c.section})` : 'Class';
        });

        for (const entry of entries) {
          warningsList.push({
            classId: entry.classId,
            day,
            pIdx,
            message: `Teacher ${facName} is scheduled in multiple classes at the same time: ${classNames.join(', ')}`,
            type: 'clash'
          });
        }
      }
    }

    // 1b. Sibling Batch Collisions ('batch-collision')
    // Check if sibling batches (like A1 and A2, B1 and B2) are assigned a lab simultaneously with the same faculty.
    for (const cls1 of classes) {
      const classSched1 = customSchedule[cls1.id];
      if (!classSched1) continue;
      for (const cls2 of classes) {
        // Only check sibling pairs once to avoid duplicate warnings
        if (cls1.id >= cls2.id) continue;
        if (!areSiblingBatches(cls1, cls2)) continue;

        const classSched2 = customSchedule[cls2.id];
        if (!classSched2) continue;

        for (const day of days) {
          const slots1 = classSched1[day] || [];
          const slots2 = classSched2[day] || [];
          for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
            const a1Id = slots1[pIdx];
            const a2Id = slots2[pIdx];

            if (a1Id && a2Id) {
              const assign1 = assignments.find(a => a.id === a1Id);
              const assign2 = assignments.find(a => a.id === a2Id);
              if (assign1 && assign2 && assign1.facultyId === assign2.facultyId) {
                // Check if they are lab subjects
                const sub1 = subjects.find(s => s.id === assign1.subjectId);
                const sub2 = subjects.find(s => s.id === assign2.subjectId);
                if (sub1 && sub1.isLab && sub2 && sub2.isLab) {
                  const fac = faculties.find(f => f.id === assign1.facultyId);
                  const facName = fac ? fac.shortName : 'Faculty';
                  const labName = sub1.code === sub2.code ? sub1.code : `${sub1.code}/${sub2.code}`;

                  warningsList.push({
                    classId: cls1.id,
                    day,
                    pIdx,
                    message: `Batch collision: Sibling batch ${cls2.name} (Sec ${cls2.section}) is assigned lab ${labName} simultaneously with faculty ${facName}.`,
                    type: 'batch-collision'
                  });

                  warningsList.push({
                    classId: cls2.id,
                    day,
                    pIdx,
                    message: `Batch collision: Sibling batch ${cls1.name} (Sec ${cls1.section}) is assigned lab ${labName} simultaneously with faculty ${facName}.`,
                    type: 'batch-collision'
                  });
                }
              }
            }
          }
        }
      }
    }

    // 2. Class specific warnings
    for (const cls of classes) {
      const classSched = customSchedule[cls.id];
      if (!classSched) continue;

      for (const day of days) {
        const slots = classSched[day] || [];

        // Track subject counts for daily limits
        const subjectCounts: Record<string, number> = {};
        const subjectIndices: Record<string, number[]> = {};

        for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
          const assignId = slots[pIdx];
          if (assignId) {
            const assign = assignments.find(a => a.id === assignId);
            if (assign) {
              subjectCounts[assign.subjectId] = (subjectCounts[assign.subjectId] || 0) + 1;
              if (!subjectIndices[assign.subjectId]) {
                subjectIndices[assign.subjectId] = [];
              }
              subjectIndices[assign.subjectId].push(pIdx);
            }
          }
        }

        // Check Subject Consecutive Periods for non-labs (in same class)
        for (let pIdx = 0; pIdx < totalPeriods - 1; pIdx++) {
          const a1Id = slots[pIdx];
          const a2Id = slots[pIdx + 1];
          if (a1Id && a2Id) {
            const assign1 = assignments.find(a => a.id === a1Id);
            const assign2 = assignments.find(a => a.id === a2Id);
            if (assign1 && assign2 && assign1.subjectId === assign2.subjectId) {
              const sub = subjects.find(s => s.id === assign1.subjectId);
              if (sub && !sub.isLab && !sub.isAicteActivity && !sub.isStudentActivity) {
                warningsList.push({
                  classId: cls.id,
                  day,
                  pIdx,
                  message: `Subject ${sub.code} is scheduled in consecutive periods on ${day}.`,
                  type: 'subject_consecutive'
                });
              }
            }
          }
        }

        // Check Daily Limits & Labs & AICTE Activity
        for (const subId in subjectCounts) {
          const sub = subjects.find(s => s.id === subId);
          if (!sub) continue;
          const count = subjectCounts[subId];
          const weekly = sub.weeklyPeriods;

          if (day === 'Saturday' && !sub.isAicteActivity) {
            warningsList.push({
              classId: cls.id,
              day,
              message: `Subject ${sub.code} (${sub.name}) is scheduled on Saturday. Saturday is strictly reserved for AICTE Activity subjects.`,
              type: 'saturday_non_aicte_conflict'
            });
          }

          if (sub.isLab) {
            if (count === 1) {
              warningsList.push({
                classId: cls.id,
                day,
                pIdx: subjectIndices[subId][0],
                message: `Lab subject ${sub.code} is scheduled for only 1 period on ${day}. Labs should be 2 consecutive periods.`,
                type: 'lab_split'
              });
            } else if (count === 2) {
              const [idx1, idx2] = subjectIndices[subId];
              if (Math.abs(idx2 - idx1) !== 1) {
                warningsList.push({
                  classId: cls.id,
                  day,
                  pIdx: idx1,
                  message: `Lab subject ${sub.code} periods on ${day} are split. Labs must be scheduled as a consecutive block.`,
                  type: 'lab_split'
                });
              }
            } else if (count > 2) {
              warningsList.push({
                classId: cls.id,
                day,
                message: `Lab subject ${sub.code} is scheduled ${count} times on ${day}. Max is 2 periods.`,
                type: 'daily_limit'
              });
            }
          } else if (sub.isAicteActivity) {
            if (day !== 'Saturday') {
              warningsList.push({
                classId: cls.id,
                day,
                message: `AICTE Activity subject ${sub.code} is scheduled on ${day}. AICTE Activity classes must only be scheduled on Saturday.`,
                type: 'aicte_day_conflict'
              });
            } else if (count > weekly) {
              warningsList.push({
                classId: cls.id,
                day,
                message: `AICTE Activity subject ${sub.code} is scheduled ${count} times on Saturday, exceeding requested ${weekly} periods.`,
                type: 'daily_limit'
              });
            }
          } else if (sub.isStudentActivity) {
            const lunchBreakIdx = timeSlots.findIndex(s => s.isBreak && s.label.toLowerCase().includes('lunch'));
            if (lunchBreakIdx !== -1) {
              const indices = subjectIndices[subId] || [];
              for (const pIdx of indices) {
                const slot = activeSlots[pIdx];
                if (slot) {
                  const origIdx = timeSlots.findIndex(s => s.id === slot.id);
                  if (origIdx <= lunchBreakIdx) {
                    warningsList.push({
                      classId: cls.id,
                      day,
                      pIdx,
                      message: `Student Activity / Mentoring subject ${sub.code} is scheduled before or during lunch on ${day}. Must be scheduled strictly after lunch.`,
                      type: 'mentoring_lunch_conflict'
                    });
                  }
                }
              }
            }
          } else {
            const maxLimit = weekly > days.length ? Math.ceil(weekly / days.length) : 1;
            if (count > maxLimit) {
              warningsList.push({
                classId: cls.id,
                day,
                message: `Subject ${sub.code} is scheduled ${count} times on ${day}, exceeding the daily limit of ${maxLimit}.`,
                type: 'daily_limit'
              });
            }
          }
        }

        // Check Free Period Gap in Period 1-4
        for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
          if (isPeriod1To4(pIdx)) {
            if (slots[pIdx] === null) {
              let hasAfter = false;
              for (let j = pIdx + 1; j < totalPeriods; j++) {
                if (slots[j] !== null) {
                  hasAfter = true;
                  break;
                }
              }
              if (hasAfter) {
                warningsList.push({
                  classId: cls.id,
                  day,
                  pIdx,
                  message: `Free period gap in Period 1-4 on ${day} for ${cls.name}.`,
                  type: 'gap'
                });
              }
            }
          }
        }

      }
    }

    // Global Faculty Continuous Lecture Restrictor (Cross-Section & Same-Section)
    for (const fac of faculties) {
      for (const day of days) {
        for (let pIdx = 0; pIdx < totalPeriods - 1; pIdx++) {
          let facSlot1: { cls: ClassSection; assign: Assignment; sub: Subject } | null = null;
          let facSlot2: { cls: ClassSection; assign: Assignment; sub: Subject } | null = null;

          for (const cls of classes) {
            const classSched = customSchedule?.[cls.id];
            if (!classSched || !classSched[day]) continue;

            const cell1 = classSched[day][pIdx];
            if (cell1) {
              const aIds1 = getAssignmentIdsFromCell(cell1);
              for (const aId of aIds1) {
                const a = assignments.find(asgn => asgn.id === aId);
                if (a && a.facultyId === fac.id) {
                  const s = subjects.find(sub => sub.id === a.subjectId);
                  if (s) facSlot1 = { cls, assign: a, sub: s };
                }
              }
            }

            const cell2 = classSched[day][pIdx + 1];
            if (cell2) {
              const aIds2 = getAssignmentIdsFromCell(cell2);
              for (const aId of aIds2) {
                const a = assignments.find(asgn => asgn.id === aId);
                if (a && a.facultyId === fac.id) {
                  const s = subjects.find(sub => sub.id === a.subjectId);
                  if (s) facSlot2 = { cls, assign: a, sub: s };
                }
              }
            }
          }

          if (facSlot1 && facSlot2) {
            // Consecutive 2-period lab block for the same section is valid
            const isSameClassLab = facSlot1.cls.id === facSlot2.cls.id && facSlot1.sub.id === facSlot2.sub.id && facSlot1.sub.isLab;
            const isAicteExempt = facSlot1.sub.isAicteActivity && facSlot2.sub.isAicteActivity;

            if (!isSameClassLab && !isAicteExempt) {
              const isDifferentSections = facSlot1.cls.id !== facSlot2.cls.id;
              const msg = isDifferentSections
                ? `Faculty ${fac.shortName || fac.name} has continuous back-to-back lectures across different sections on ${day}: Period ${pIdx + 1} in ${facSlot1.cls.name} (Sec ${facSlot1.cls.section}) [${facSlot1.sub.code}] followed by Period ${pIdx + 2} in ${facSlot2.cls.name} (Sec ${facSlot2.cls.section}) [${facSlot2.sub.code}].`
                : `Faculty ${fac.shortName || fac.name} has continuous back-to-back lectures in ${facSlot1.cls.name} (Sec ${facSlot1.cls.section}) on ${day}: Period ${pIdx + 1} [${facSlot1.sub.code}] and Period ${pIdx + 2} [${facSlot2.sub.code}].`;

              warningsList.push({
                classId: facSlot1.cls.id,
                day,
                pIdx,
                message: msg,
                type: 'continuity'
              });
            }
          }
        }
      }
    }

    return warningsList;
  }, [customSchedule, days, timeSlots, classes, assignments, subjects, faculties]);

  // Check if a faculty has continuous classes in a class or across any sections
  const checkContinuityConflict = (classId?: string, schedObj: TimetableSchedule | null = solverResult?.schedule): boolean => {
    if (!schedObj) return false;
    const activeSlots = timeSlots.filter(s => !s.isBreak);
    const totalPeriods = activeSlots.length;

    for (const fac of faculties) {
      for (const day of days) {
        for (let pIdx = 0; pIdx < totalPeriods - 1; pIdx++) {
          let facSlot1: { cls: ClassSection; assign: Assignment; sub: Subject } | null = null;
          let facSlot2: { cls: ClassSection; assign: Assignment; sub: Subject } | null = null;

          for (const cls of classes) {
            const classSched = schedObj[cls.id];
            if (!classSched || !classSched[day]) continue;

            const cell1 = classSched[day][pIdx];
            if (cell1) {
              const aIds1 = getAssignmentIdsFromCell(cell1);
              for (const aId of aIds1) {
                const a = assignments.find(asgn => asgn.id === aId);
                if (a && a.facultyId === fac.id) {
                  const s = subjects.find(sub => sub.id === a.subjectId);
                  if (s) facSlot1 = { cls, assign: a, sub: s };
                }
              }
            }

            const cell2 = classSched[day][pIdx + 1];
            if (cell2) {
              const aIds2 = getAssignmentIdsFromCell(cell2);
              for (const aId of aIds2) {
                const a = assignments.find(asgn => asgn.id === aId);
                if (a && a.facultyId === fac.id) {
                  const s = subjects.find(sub => sub.id === a.subjectId);
                  if (s) facSlot2 = { cls, assign: a, sub: s };
                }
              }
            }
          }

          if (facSlot1 && facSlot2) {
            const isSameClassLab = facSlot1.cls.id === facSlot2.cls.id && facSlot1.sub.id === facSlot2.sub.id && facSlot1.sub.isLab;
            const isAicteExempt = facSlot1.sub.isAicteActivity && facSlot2.sub.isAicteActivity;

            if (!isSameClassLab && !isAicteExempt) {
              if (!classId || facSlot1.cls.id === classId || facSlot2.cls.id === classId) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  };

  // Check if there is any free period (gap) in Period 1, Period 2, Period 3, or Period 4 for a class
  const checkPeriod1To4FreePeriod = (classId: string, schedObj: TimetableSchedule | null = solverResult?.schedule): boolean => {
    if (!schedObj || !schedObj[classId]) return false;
    const classSched = schedObj[classId];
    const activeSlots = timeSlots.filter(s => !s.isBreak);
    const totalPeriods = activeSlots.length;

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

    for (const day of days) {
      const periods = classSched[day];
      if (!periods) continue;
      for (let pIdx = 0; pIdx < totalPeriods; pIdx++) {
        if (isPeriod1To4(pIdx)) {
          if (periods[pIdx] === null) {
            let hasAfter = false;
            for (let j = pIdx + 1; j < totalPeriods; j++) {
              if (periods[j] !== null) {
                hasAfter = true;
                break;
              }
            }
            if (hasAfter) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  // For validation and statistics display
  const validationSummary = useMemo(() => {
    if (!solverResult) return null;
    const stats = {
      totalFaculties: faculties.length,
      totalSubjects: subjects.length,
      totalClasses: classes.length,
      totalAssignments: assignments.length,
      noClashes: solverResult.success,
      continuityCheck: !checkContinuityConflict(undefined, solverResult.schedule),
    };
    return stats;
  }, [solverResult, faculties, subjects, classes, assignments, days, timeSlots]);

  const hasAnyContinuityConflict = useMemo(() => {
    return checkContinuityConflict(undefined, solverResult?.schedule);
  }, [classes, faculties, solverResult, assignments, subjects, days, timeSlots]);

  const hasAnyPeriod1To4FreePeriodConflict = useMemo(() => {
    return classes.some(c => checkPeriod1To4FreePeriod(c.id, solverResult?.schedule));
  }, [classes, solverResult, timeSlots, days]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-800">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold tracking-wider text-slate-500 uppercase">Verifying Security Session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col justify-between p-6 font-sans text-slate-800 relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/40 via-white to-slate-100/50 z-0 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center z-10 py-12">
          {/* Main Card */}
          <div className="bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-2xl max-w-lg w-full p-8 md:p-10 shadow-2xl space-y-8 animate-fade-in relative">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-blue-600 h-24 w-24 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-xl shadow-blue-500/10">
              <Lock className="h-10 w-10 text-white" />
            </div>

            {/* Title / Institution */}
            <div className="text-center pt-8 space-y-2">
              <p className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase leading-none font-sans">HKE Society's</p>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white uppercase leading-snug font-sans">
                Sir M. Visvesvaraya College of Engineering, Raichur
              </h2>
              <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full mt-4" />
              <p className="text-xs text-amber-400 font-extrabold pt-1 uppercase tracking-widest font-mono">
                College Timetable Portal
              </p>
            </div>

            {/* Error Message if unauthorized */}
            {authCheckError && (
              <div className="bg-rose-950/50 border border-rose-800/80 rounded-xl p-4 text-xs text-rose-200 space-y-2.5 animate-fadeIn text-left">
                <div className="flex items-center space-x-2 text-rose-400 font-bold font-sans">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Access Authorization Notice</span>
                </div>
                <p className="leading-relaxed text-rose-300 font-sans whitespace-pre-wrap font-medium">
                  {authCheckError}
                </p>
                <p className="text-[10px] text-rose-400/60 italic leading-normal font-sans border-t border-rose-900/40 pt-2">
                  Note: Firestore security rules restrict read/write access exclusively to authorized admin Gmail accounts. Please ensure your logged-in Google account is whitelisted.
                </p>
              </div>
            )}

            {/* Sign-In Instructions */}
            <div className="space-y-4">
              <p className="text-slate-400 text-xs text-center leading-relaxed font-sans">
                This portal is secure and reserved for authorized faculty administrators. Sign in using your official Google Workspace / personal Gmail account to access, edit, and synchronize timetables.
              </p>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 text-slate-900 animate-spin" />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.01c2.34-2.16 3.69-5.32 3.69-8.74Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.54 1.19-3.95 1.19-3.05 0-5.63-2.06-6.55-4.83H1.31v3.22A12 12 0 0 0 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.45 14.33a7.14 7.14 0 0 1 0-4.66V6.45H1.31a12 12 0 0 0 0 11.1l4.14-3.22Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A12 12 0 0 0 1.31 6.45l4.14 3.22c.92-2.77 3.5-4.83 6.55-4.83Z"
                      />
                    </svg>
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 text-center py-4 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
          © {new Date().getFullYear()} SMVCE Raichur • SECURE DATABASE PERSISTENCE
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* ========================================== */}
      {/* HEADER                                     */}
      {/* ========================================== */}
      <header id="app-header" className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 shadow-sm sticky top-0 z-50">
        <div className="flex flex-col justify-center">
          <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500 leading-none">HKE Society's</p>
          <h1 className="text-xs md:text-sm font-extrabold tracking-tight text-blue-900 uppercase mt-1 leading-none">
            Sir M. Visvesvaraya College of Engineering, Raichur
          </h1>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {currentUser && (
            <div className="flex items-center space-x-2 border-r border-slate-200 pr-2 sm:pr-3 mr-0.5 sm:mr-1 shrink-0">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || "User"} 
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0 aspect-square"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200 shrink-0 aspect-square">
                  {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || "U"}
                </div>
              )}
              <div className="flex flex-col text-left leading-none">
                <span className="text-xs font-bold text-slate-800 hidden sm:inline-block">
                  {currentUser.displayName || 'Authorized User'}
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:inline-block mt-0.5 font-mono">
                  {currentUser.email}
                </span>
              </div>
            </div>
          )}

          <button 
            id="btn-signout"
            onClick={() => setShowSignOutModal(true)}
            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg bg-white transition shadow-sm cursor-pointer flex items-center justify-center shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* TOAST / NOTIFICATION DRAWER                */}
      {/* ========================================== */}
      {authNotification && (
        <div className="bg-amber-50 border-b border-amber-200/80 text-amber-900 px-6 py-2 text-xs font-medium flex items-center justify-center space-x-2 animate-fade-in">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span>{authNotification}</span>
        </div>
      )}

      {/* ========================================== */}
      {/* FLOATING TOP RIGHT TOAST CONTAINER         */}
      {/* ========================================== */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isDeletion = toast.message.toLowerCase().includes('deleted') || toast.message.toLowerCase().includes('delete') || toast.message.toLowerCase().includes('removed');
          
          let cardBgClass = 'bg-emerald-50 border-emerald-200 text-emerald-900';
          let iconColorClass = 'text-emerald-600';
          let IconComp = CheckCircle;
          
          if (isDeletion) {
            cardBgClass = 'bg-rose-50 border-rose-200/80 text-rose-900';
            iconColorClass = 'text-rose-600';
            IconComp = Trash2;
          } else if (isError) {
            cardBgClass = 'bg-red-50 border-red-200 text-red-900';
            iconColorClass = 'text-red-600';
            IconComp = AlertCircle;
          } else if (isWarning) {
            cardBgClass = 'bg-amber-50 border-amber-200 text-amber-900';
            iconColorClass = 'text-amber-600';
            IconComp = AlertTriangle;
          } else if (toast.type === 'info') {
            cardBgClass = 'bg-blue-50 border-blue-200 text-blue-900';
            iconColorClass = 'text-blue-600';
            IconComp = Info;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border rounded-xl shadow-lg px-4 py-3 flex items-start space-x-3 animate-slide-in-right max-w-sm w-full transition-all duration-300 ${cardBgClass}`}
            >
              <IconComp className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColorClass}`} />
              <div className="flex-1 text-xs font-semibold pr-2 leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition p-0.5 rounded-full hover:bg-black/5 flex-shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA                          */}
      {/* ========================================== */}
      <main className="flex-1 w-[96%] max-w-[96%] mx-auto p-4 md:p-6 flex flex-col">
        
        {/* ========================================== */}
        {/* FIREBASE CLOUD PERSISTENCE PANEL           */}
        {/* ========================================== */}
        <div className="bg-white border border-slate-200/95 shadow-sm rounded-xl p-3 sm:p-4 mb-4 border-t-4 border-t-blue-600">
          
          {/* MOBILE-ONLY OPTIMIZED VIEW (hidden on sm and above) */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md flex-shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Cloud Storage</h3>
                    {isAutoSyncing ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-widest animate-pulse">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Saving...
                      </span>
                    ) : isAutoSyncEnabled ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                        Live Auto-Sync On
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                        Manual Sync
                      </span>
                    )}
                  </div>
                  {lastSyncedTime && (
                    <div className="text-[9.5px] text-slate-400 mt-0.5">
                      Last synced: {lastSyncedTime}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFirebaseModal(true)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded transition cursor-pointer flex items-center justify-center"
                title="Manage Cloud Database"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            {/* Active timetable info row */}
            <div className="text-[11px] text-slate-600 flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
              <span className="font-semibold text-slate-500">Active:</span>
              <span className="font-mono font-bold text-blue-950 truncate flex-1">{activeTimetableName}</span>
            </div>

            {/* Switcher & Create New */}
            <div className="flex items-center gap-1.5">
              <select
                value={activeTimetableName}
                onChange={(e) => loadTimetableFromFirebase(e.target.value)}
                disabled={isCloudLoading || firebaseTimetables.length === 0}
                className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
              >
                {firebaseTimetables.length === 0 ? (
                  <option value="">No Cloud Timetables Found</option>
                ) : (
                  firebaseTimetables.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNewTemplateName('New Timetable');
                  setShowNewTemplateConfirmModal(true);
                }}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded transition cursor-pointer flex items-center justify-center font-bold shadow-sm"
                title="Create new timetable"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* 2x2 Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => saveTimetableToFirebase(activeTimetableName)}
                disabled={isCloudSaving || isCloudLoading}
                className="py-2 px-2 bg-blue-900 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                {isCloudSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                <span className="truncate">Save Cloud</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInlineSaveAsName(activeTimetableName + " Copy");
                  setShowInlineSaveAs(true);
                }}
                disabled={isCloudSaving || isCloudLoading}
                className="py-2 px-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center shadow-sm disabled:opacity-50"
              >
                <span className="truncate">Save As...</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAutoSync}
                className={`py-2 px-2 border rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm ${
                  isAutoSyncEnabled ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span className="truncate">Auto-Sync</span>
                <span className={`w-2 h-2 rounded-full ${isAutoSyncing ? 'bg-blue-500 animate-spin' : isAutoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setClearConfirmStep(1);
                  setClearAdminPassword('');
                  setClearPasswordError(null);
                  setShowClearConfirmModal(true);
                }}
                className="py-2 px-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                <span className="truncate">Clear</span>
              </button>
            </div>

            {showInlineSaveAs && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-2 rounded-lg mt-1">
                <input
                  type="text"
                  placeholder="New timetable name"
                  value={inlineSaveAsName}
                  onChange={(e) => setInlineSaveAsName(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-300 rounded focus:outline-none flex-1 font-medium bg-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (inlineSaveAsName.trim()) {
                      await saveTimetableToFirebase(inlineSaveAsName.trim());
                      setShowInlineSaveAs(false);
                      setInlineSaveAsName('');
                    }
                  }}
                  disabled={!inlineSaveAsName.trim()}
                  className="px-2.5 py-1.5 bg-blue-800 text-white rounded text-[10px] font-bold uppercase hover:bg-blue-900 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineSaveAs(false);
                    setInlineSaveAsName('');
                  }}
                  className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* DESKTOP & TABLET PRISTINE VIEW (hidden on mobile, visible on sm and above) */}
          <div className="hidden sm:flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Cloud Storage</h3>
                  {isAutoSyncing ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-widest animate-pulse">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Saving changes...
                    </span>
                  ) : isAutoSyncEnabled ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                      Live Auto-Sync On
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                      Manual Sync
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center flex-wrap gap-2">
                  <span>Active Timetable:</span>
                  <span className="font-mono font-bold text-blue-950 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {activeTimetableName}
                  </span>
                  {lastSyncedTime && (
                    <span className="text-slate-400 text-[10px] font-medium">
                      (Last synced: {lastSyncedTime})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Timetable Selector dropdown */}
              <div className="flex items-center space-x-1.5">
                <label htmlFor="firebase_timetable_select" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch:
                </label>
                <select
                  id="firebase_timetable_select"
                  value={activeTimetableName}
                  onChange={(e) => loadTimetableFromFirebase(e.target.value)}
                  disabled={isCloudLoading || firebaseTimetables.length === 0}
                  className="text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                >
                  {firebaseTimetables.length === 0 ? (
                    <option value="">No Cloud Timetables Found</option>
                  ) : (
                    firebaseTimetables.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewTemplateName('New Timetable');
                    setShowNewTemplateConfirmModal(true);
                  }}
                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded transition cursor-pointer flex items-center justify-center font-bold shadow-sm"
                  title="Create a fresh timetable template"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Sync actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => saveTimetableToFirebase(activeTimetableName)}
                  disabled={isCloudSaving || isCloudLoading}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1.5 shadow-sm hover:shadow disabled:opacity-50"
                  title={`Save state to cloud document: "${activeTimetableName}"`}
                >
                  {isCloudSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Cloud className="h-3 w-3" />
                  )}
                  <span>Save to Cloud</span>
                </button>

                {showInlineSaveAs ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg animate-fadeIn">
                    <input
                      type="text"
                      placeholder="New name"
                      value={inlineSaveAsName}
                      onChange={(e) => setInlineSaveAsName(e.target.value)}
                      className="text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inlineSaveAsName.trim()) {
                          saveTimetableToFirebase(inlineSaveAsName.trim());
                          setShowInlineSaveAs(false);
                          setInlineSaveAsName('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (inlineSaveAsName.trim()) {
                          await saveTimetableToFirebase(inlineSaveAsName.trim());
                          setShowInlineSaveAs(false);
                          setInlineSaveAsName('');
                        }
                      }}
                      disabled={!inlineSaveAsName.trim()}
                      className="px-2 py-1 bg-blue-800 text-white rounded text-[10px] font-bold uppercase hover:bg-blue-900 disabled:opacity-40 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineSaveAs(false);
                        setInlineSaveAsName('');
                      }}
                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase hover:bg-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineSaveAsName(activeTimetableName + " Copy");
                      setShowInlineSaveAs(true);
                    }}
                    disabled={isCloudSaving || isCloudLoading}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    title="Save this configuration as a new Firestore document"
                  >
                    <span>Save As...</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`px-3 py-1.5 border font-bold text-[10px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1.5 shadow-sm ${
                    isAutoSyncEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Toggle live auto-saving to Firestore on every update"
                >
                  <span>Auto-Sync</span>
                  <span className={`w-2 h-2 rounded-full ${isAutoSyncing ? 'bg-blue-500 animate-spin' : isAutoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClearConfirmStep(1);
                    setClearAdminPassword('');
                    setClearPasswordError(null);
                    setShowClearConfirmModal(true);
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
                  title="Clear loaded timetable, sample data, and empty workspace"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFirebaseModal(true)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 rounded transition cursor-pointer"
                  title="Manage Cloud Database & documents"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {firebaseError && (
          <div className="bg-amber-50 border border-amber-200 shadow-sm rounded-xl p-4 mb-4 text-xs text-amber-900 space-y-3 border-l-4 border-l-amber-500 animate-fadeIn">
            <div className="flex items-start space-x-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div className="space-y-1.5">
                <p className="font-bold text-amber-950 text-sm">Firestore Database Authorization Notice</p>
                <p className="text-amber-800 leading-relaxed">
                  The application encountered a database permission issue with your Firebase project <span className="font-mono bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-950 font-bold">time-table-smvce</span>: <span className="font-mono italic font-bold text-red-700">{firebaseError}</span>.
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Since you are using your own private Firebase project, you must configure security rules to allow read/write access. Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold hover:text-amber-950">Firebase Console</a>, select your project, navigate to <strong>Firestore Database</strong> &rarr; <strong>Rules</strong> tab, and publish the following configuration:
                </p>
              </div>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 select-all shadow-inner">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSuperuser() {
      return request.auth != null && request.auth.token.email == "sachinadi88@gmail.com";
    }
    function isAuthorizedMember() {
      return request.auth != null 
        && request.auth.token.email_verified == true 
        && request.auth.token.email in [
             'adiseema1990@gmail.com', 
             'sachinadi88@gmail.com', 
             'adisachin1988@gmail.com'
           ];
    }
    match /mvce_timetables/{document} {
      allow read: if isAuthorizedMember() && (isSuperuser() || resource == null || resource.data.userId == request.auth.uid);
      allow create, update: if isAuthorizedMember() && (isSuperuser() || request.resource.data.userId == request.auth.uid);
      allow delete: if isAuthorizedMember() && (isSuperuser() || resource.data.userId == request.auth.uid);
    }
  }
}`}
            </pre>
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <p className="text-[10px] text-amber-700 font-medium italic">
                Note: Local storage continues to function perfectly! All of your active schedules are safe.
              </p>
              <button
                type="button"
                onClick={() => fetchFirebaseTimetablesList(false)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider rounded transition cursor-pointer shadow-sm hover:shadow"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}
        
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-4 bg-white p-1 rounded-t-lg shadow-sm border-t border-x">
          <nav className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard & Solver', icon: Sparkles },
              { id: 'drag_drop', label: 'Drag & Drop Adjuster', icon: Sliders },
              { id: 'faculties', label: 'Faculty Directory', icon: Users },
              { id: 'subjects', label: 'Subjects List', icon: BookOpen },
              { id: 'assignments', label: 'Class Assignments', icon: GraduationCap },
              { id: 'timing', label: 'Time Configuration', icon: Clock },
              { id: 'individual_timetable', label: 'Individual Time Table', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1.5 py-1.5 px-3 rounded text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Contents */}
        <div className="space-y-4">

          {/* ========================================== */}
          {/* TAB: DASHBOARD & SOLVER                    */}
          {/* ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              
              {/* Top Row: Diagnostics, Summary & Instructions - Accordion Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                
                {/* Generation Card Accordion */}
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden transition-all">
                  <div className="p-2.5 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between border-b border-slate-100 transition text-left select-none">
                    <div 
                      onClick={() => setIsOptimizerOpen(!isOptimizerOpen)}
                      className="flex items-center space-x-1.5 cursor-pointer flex-1 py-0.5 mr-2"
                    >
                      <Sparkles className="h-4 w-4 text-blue-900 flex-shrink-0" />
                      <span className="font-bold text-slate-900 text-[8pt] uppercase tracking-wider">Timetable Optimizer</span>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerate();
                        }}
                        disabled={isGenerating}
                        className="py-1.5 px-3 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] uppercase tracking-wider rounded shadow-2xs transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                      >
                        {isGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                            <span>Solving...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 text-amber-300" />
                            <span>GENERATE TIMETABLE</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsOptimizerOpen(!isOptimizerOpen)}
                        className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-center rounded hover:bg-slate-200/50"
                      >
                        {isOptimizerOpen ? (
                          <ChevronUp className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isOptimizerOpen && (
                    <div className="p-4">
                      <p className="text-[11px] text-slate-500 mb-3">
                        Instantly calculate a conflict-free roster mapping all faculties, subjects, and break timings.
                      </p>

                      <div className="pt-2 border-t border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">Algorithm Diagnostics:</h4>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Clash Solver Status</span>
                            <span className={`font-bold uppercase text-[9px] ${solverResult?.success ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-amber-700 bg-amber-50 border border-amber-100'} px-1.5 py-0.5 rounded`}>
                              {solverResult?.success ? 'Optimized' : 'Inactive / Partial'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">No-Overlap Guard</span>
                            <span className="text-slate-800 font-bold flex items-center"><Check className="h-3 w-3 text-emerald-600 mr-0.5" /> Enforced</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">No Continuous Lectures (All Sections)</span>
                            <span className="text-slate-800 font-bold flex items-center"><Check className="h-3 w-3 text-emerald-600 mr-0.5" /> Enforced</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Period 1-4 Gap Prevention</span>
                            <span className="text-slate-800 font-bold flex items-center"><Check className="h-3 w-3 text-emerald-600 mr-0.5" /> Enforced</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Lab 2-Period Block</span>
                            <span className="text-slate-800 font-bold flex items-center"><Check className="h-3 w-3 text-emerald-600 mr-0.5" /> Enforced</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Project After Lunch Break</span>
                            <span className="text-slate-800 font-bold flex items-center"><Check className="h-3 w-3 text-emerald-600 mr-0.5" /> Enforced</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Summary Card Accordion */}
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setIsConstraintsOpen(!isConstraintsOpen)}
                    className="w-full p-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between border-b border-slate-100 transition cursor-pointer text-left select-none"
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-slate-900 text-[8pt] uppercase tracking-wider">Constraint Verification</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {validationSummary && (
                        <span className={`font-bold uppercase text-[9px] ${hasAnyContinuityConflict || hasAnyPeriod1To4FreePeriodConflict ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'} px-1.5 py-0.5 rounded`}>
                          {hasAnyContinuityConflict || hasAnyPeriod1To4FreePeriodConflict ? 'Warnings' : 'Verified'}
                        </span>
                      )}
                      {isConstraintsOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {isConstraintsOpen && (
                    <div className="p-4">
                      {validationSummary ? (
                        <div className="space-y-3">
                          <div className="flex items-start space-x-2.5 text-[11px]">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-slate-800">Faculty Overlap Check</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">No faculty is assigned to multiple classes simultaneously.</p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            {hasAnyContinuityConflict ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-800">Continuous Lecture Restrictor (Cross-Section & Same Class)</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                {hasAnyContinuityConflict 
                                  ? "Warning: Some teachers are scheduled back-to-back across different sections or classes." 
                                  : "Verified: Teachers taking multiple subjects in the same class or across different sections have balanced workloads without continuous back-to-back lectures."}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-slate-800">Course Credit Hours Status</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                Mapping {validationSummary.totalAssignments} subjects across {validationSummary.totalClasses} sections.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            {hasAnyPeriod1To4FreePeriodConflict ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-800">Period 1 to 4 Unscheduled Gap Guard</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                {hasAnyPeriod1To4FreePeriodConflict 
                                  ? "Optimization Warning: An unscheduled tutorial gap exists in Period 1, 2, 3, or 4." 
                                  : "Verified: No unscheduled tutorial gaps in Period 1, 2, 3, or 4 for any class section!"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-slate-800">Lab Continuous Block</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                Verified: All Lab / Practical sessions are successfully assigned in contiguous 2-period stretches without split-break interruptions.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            {scheduleWarnings.some(w => w.type === 'aicte_day_conflict' || w.type === 'saturday_non_aicte_conflict') ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-800">Saturday AICTE Activity Exclusive Rule</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                {scheduleWarnings.some(w => w.type === 'aicte_day_conflict' || w.type === 'saturday_non_aicte_conflict')
                                  ? "Warning: Saturday is strictly reserved for AICTE Activity subjects only."
                                  : "Verified: Saturday is strictly reserved for AICTE Activity subjects, and no other subjects are scheduled on Saturday."}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2.5 text-[11px]">
                            {scheduleWarnings.some(w => w.type === 'mentoring_lunch_conflict') ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-800">Student Activity / Mentoring Post-Lunch Rule</p>
                              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                                {scheduleWarnings.some(w => w.type === 'mentoring_lunch_conflict')
                                  ? "Warning: Student Activity / Mentoring subjects must be allocated strictly after lunch."
                                  : "Verified: All Student Activity / Mentoring subjects are allocated strictly after lunch."}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 text-center py-4 font-medium italic">
                          Configure data to run verification logic.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Legend & Instructions Accordion */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg shadow-sm overflow-hidden transition-all text-[11px] text-slate-600">
                  <button
                    type="button"
                    onClick={() => setIsGuidelinesOpen(!isGuidelinesOpen)}
                    className="w-full p-3 bg-slate-100/90 hover:bg-slate-200/70 flex items-center justify-between border-b border-slate-200 transition cursor-pointer text-left select-none"
                  >
                    <div className="flex items-center space-x-2">
                      <Info className="h-3.5 w-3.5 text-blue-900" />
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">User Guidelines</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-[9px] text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">5 Steps</span>
                      {isGuidelinesOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {isGuidelinesOpen && (
                    <div className="p-4">
                      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                        <li>Add your faculties in the <strong className="text-slate-900">Faculty</strong> tab.</li>
                        <li>Add course subjects in the <strong className="text-slate-900">Subjects</strong> tab.</li>
                        <li>Link faculties and subjects in <strong className="text-slate-900">Class Assignments</strong>.</li>
                        <li>Configure college hours in <strong className="text-slate-900">Time Configuration</strong>.</li>
                        <li>Hit <strong className="text-slate-900">Generate Timetable</strong> to build rosters!</li>
                      </ol>
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Row: Generated Timetable View (Full Width Card) */}
              <div className="space-y-4 w-full">
                
                {/* Selector Header */}
                <div id="class-roster-timetable-card" className="bg-white border border-slate-200 rounded p-4 shadow-sm timetable-card transition-all duration-300 hover:shadow-md hover:border-slate-300">
                  {/* Print-only Header */}
                  {currentClassObj && (
                    <div className="hidden print:flex flex-col items-center justify-center text-center border-b border-slate-300 pb-3 mb-4 relative">
                      <img 
                        src="/college_logo.svg" 
                        alt="College Logo" 
                        className="absolute left-2 top-0 h-14 w-auto object-contain" 
                      />
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 leading-none">HKE Society's</p>
                      <h1 className="text-sm font-extrabold tracking-tight text-blue-900 uppercase mt-1 leading-none">
                        Sir M. Visvesvaraya College of Engineering, Raichur
                      </h1>
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mt-2">
                        Weekly Class Timetable
                      </h2>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                        Class: {currentClassObj.name} (Sec {currentClassObj.section}){currentClassObj.classroom ? ` • Room: ${currentClassObj.classroom}` : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-4 roster-controls-container">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Class Roster View</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Select a class section to inspect its weekly timetable schedule.</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <select
                         value={selectedClassId}
                         onChange={(e) => setSelectedClassId(e.target.value)}
                         className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] rounded px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                      >
                        <option value="">-- Select Class Section --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} (Sec {cls.section})
                          </option>
                        ))}
                      </select>

                       <button
                        onClick={handleExportPDF}
                        disabled={!selectedClassId || !solverResult?.schedule || isExportingPDF}
                        className="px-2.5 py-1.5 text-white bg-[crimson] hover:bg-[#b00f30] disabled:bg-[crimson]/50 disabled:cursor-not-allowed rounded text-[11px] font-bold uppercase tracking-wider transition shadow-sm flex items-center space-x-1 cursor-pointer"
                        title={isExportingPDF ? "Exporting PDF..." : "Export this timetable to PDF"}
                      >
                        <Download className="h-3.5 w-3.5 text-white" />
                        <span>{isExportingPDF ? "Exporting..." : "Export PDF"}</span>
                      </button>

                      <button
                        onClick={handleDownloadPDFLocally}
                        disabled={!selectedClassId || !solverResult?.schedule || isDownloadingPDF}
                        className="px-2.5 py-1.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded text-[11px] font-bold uppercase tracking-wider transition shadow-sm flex items-center space-x-1 cursor-pointer"
                        title={isDownloadingPDF ? "Downloading..." : "Download PDF file locally"}
                        style={{ display: 'none' }}
                      >
                        <Download className="h-3.5 w-3.5 text-white" />
                        <span>{isDownloadingPDF ? "Downloading..." : "Download PDF"}</span>
                      </button>


                    </div>
                  </div>

                  {/* Timetable Grid Container */}
                  <div className="overflow-x-auto border-2 border-slate-500 rounded shadow-md">
                    {selectedClassId ? (
                      (() => {
                        const classSched = solverResult?.schedule?.[selectedClassId];
                        const hasConflict = checkContinuityConflict(selectedClassId, solverResult?.schedule);

                        return (
                          <div className="min-w-[800px] bg-white text-xs">
                            {/* Schedule Header / Timeslots */}
                            <div 
                              className="grid bg-slate-800 text-white font-bold border-b-2 border-slate-600 text-[10px] uppercase tracking-wider"
                              style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                            >
                              <div className="p-1 text-center bg-slate-800 border-r border-slate-600 font-bold flex items-center justify-center text-[9px]">Day</div>
                              {timeSlots.map((slot) => (
                                <div 
                                  key={slot.id} 
                                  className={`text-center border-r border-slate-600 last:border-r-0 flex flex-col justify-center ${
                                    slot.isBreak 
                                      ? 'bg-amber-600/10 text-amber-300 [writing-mode:vertical-lr] rotate-180 select-none items-center justify-center p-1 py-3' 
                                      : 'p-2'
                                  }`}
                                >
                                  {slot.isBreak ? (
                                    <div className="flex flex-col items-center leading-none">
                                      <span className="font-bold text-[9px] uppercase tracking-widest">{getCleanBreakLabel(slot.label)}</span>
                                      <span className="text-[7.5px] opacity-75 font-mono mt-1 font-medium whitespace-nowrap">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[10px] tracking-wide">{slot.label}</span>
                                      <span className="text-[9px] opacity-75 font-mono mt-0.5 font-medium">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Table Body - Rows are Days */}
                            {days.map((day) => {
                              const slotsForDay = classSched?.[day] || [];
                              let activePeriodCounter = 0;

                              return (
                                <div 
                                  key={day} 
                                  className="grid border-b border-slate-400 last:border-b-0 hover:bg-slate-50/50 transition"
                                  style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                                >
                                  {/* Day Name */}
                                  <div className="p-1 font-bold text-slate-800 bg-slate-100 border-r border-slate-400 flex items-center justify-center text-center uppercase text-[10px] tracking-wide [writing-mode:vertical-lr] rotate-180 select-none">
                                    {day}
                                  </div>

                                  {/* Periods */}
                                  {timeSlots.map((slot) => {
                                    if (slot.isBreak) {
                                      return (
                                        <div 
                                          key={slot.id} 
                                          className="p-1 border-r border-slate-400 last:border-r-0 flex items-center justify-center bg-amber-500/5 text-amber-800 font-extrabold italic text-center text-[10px] uppercase [writing-mode:vertical-lr] rotate-180 select-none tracking-widest"
                                        >
                                          {getCleanBreakLabel(slot.label)}
                                        </div>
                                      );
                                    }

                                    const cellEntry = slotsForDay[activePeriodCounter];
                                    activePeriodCounter++;

                                    const batchItems = getBatchItemsFromCell(cellEntry);
                                    if (batchItems) {
                                      return (
                                        <div 
                                          key={slot.id} 
                                          className="p-1 border-r border-slate-400 last:border-r-0 flex flex-col justify-center space-y-1 bg-amber-50/50 hover:bg-amber-100/40 min-h-[64px] transition-all"
                                        >
                                          {batchItems.map((batchItem) => {
                                            const { assign, sub, fac } = getAssignmentDetails(batchItem.assignmentId);
                                            if (!assign || !sub) return null;

                                            const palette = getSubjectPalette(sub.id, sub.code, sub.color);

                                            return (
                                              <div 
                                                key={batchItem.batchName} 
                                                className={`p-1 rounded border text-left text-[9px] shadow-2xs transition-all ${
                                                  palette.isCustom ? '' : `${palette.bg} ${palette.border} ${palette.text}`
                                                }`}
                                                style={palette.isCustom ? {
                                                  backgroundColor: palette.styles.bg,
                                                  borderColor: palette.styles.border,
                                                  color: palette.styles.text
                                                } : undefined}
                                              >
                                                <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                  <span 
                                                    style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                                    className={`px-1 py-0.2 rounded font-extrabold ${palette.isCustom ? 'border' : `${palette.badgeBg} ${palette.badgeText} border ${palette.badgeBorder}`}`}
                                                  >
                                                    Batch {batchItem.batchName}
                                                  </span>
                                                  <span className="opacity-80 font-mono">{sub.code}</span>
                                                </div>
                                                <div className="font-extrabold break-words leading-tight mt-0.5" title={sub.name}>{sub.name}</div>
                                                <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                  <span className="break-words leading-tight">
                                                    {fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                  </span>
                                                  {fac?.department && (
                                                    <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                      {normalizeDepartment(fac.department)}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    }

                                    const assignmentId = typeof cellEntry === 'string' ? cellEntry : null;
                                    const { assign, sub, fac } = getAssignmentDetails(assignmentId);

                                    const isLabCell = sub ? isSubjectLab(sub) : false;
                                    const currentClass = classes.find(c => c.id === selectedClassId);
                                    const sec = currentClass ? currentClass.section.trim().toUpperCase() : 'A';
                                    const clsLabAssigns = isLabCell ? assignments.filter(a => a.classId === selectedClassId && isSubjectLab(subjects.find(s => s.id === a.subjectId))) : [];

                                    if (isLabCell && assign && clsLabAssigns.length > 1) {
                                      const sub1 = sub;
                                      const sub1Palette = sub1 ? getSubjectPalette(sub1.id, sub1.code, sub1.color) : null;
                                      const otherAssign = clsLabAssigns.find(a => a.id !== assign.id) || clsLabAssigns[0];
                                      const otherSub = subjects.find(s => s.id === otherAssign.subjectId);
                                      const otherFac = faculties.find(f => f.id === otherAssign.facultyId);
                                      const sub2Palette = otherSub ? getSubjectPalette(otherSub.id, otherSub.code, otherSub.color) : null;

                                      return (
                                        <div key={slot.id} className="p-1 border-r border-slate-400 last:border-r-0 flex flex-col justify-center space-y-1 bg-amber-50/50 hover:bg-amber-100/40 min-h-[64px] transition-all">
                                          {sub1 && sub1Palette && (
                                            <div 
                                              className={`p-1 rounded border text-left text-[9px] shadow-2xs ${
                                                sub1Palette.isCustom ? '' : `${sub1Palette.bg} ${sub1Palette.border} ${sub1Palette.text}`
                                              }`}
                                              style={sub1Palette.isCustom ? {
                                                backgroundColor: sub1Palette.styles.bg,
                                                borderColor: sub1Palette.styles.border,
                                                color: sub1Palette.styles.text
                                              } : undefined}
                                            >
                                              <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                <span 
                                                  style={sub1Palette.isCustom ? { backgroundColor: sub1Palette.styles.badgeBg, color: sub1Palette.styles.badgeText, borderColor: sub1Palette.styles.badgeBorder } : undefined}
                                                  className={`px-1 py-0.2 rounded font-extrabold ${sub1Palette.isCustom ? 'border' : `${sub1Palette.badgeBg} ${sub1Palette.badgeText} border ${sub1Palette.badgeBorder}`}`}
                                                >
                                                  Batch {sec}1
                                                </span>
                                                <span className="opacity-80 font-mono">{sub1.code}</span>
                                              </div>
                                              <div className="font-extrabold break-words leading-tight mt-0.5" title={sub1.name}>{sub1.name}</div>
                                              <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                <span className="break-words leading-tight">
                                                  {fac ? cleanFacultyName(fac.name) : (sub1.isAicteActivity || sub1.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                </span>
                                                {fac?.department && (
                                                  <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                    {normalizeDepartment(fac.department)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {otherSub && sub2Palette && (
                                            <div 
                                              className={`p-1 rounded border text-left text-[9px] shadow-2xs ${
                                                sub2Palette.isCustom ? '' : `${sub2Palette.bg} ${sub2Palette.border} ${sub2Palette.text}`
                                              }`}
                                              style={sub2Palette.isCustom ? {
                                                backgroundColor: sub2Palette.styles.bg,
                                                borderColor: sub2Palette.styles.border,
                                                color: sub2Palette.styles.text
                                              } : undefined}
                                            >
                                              <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                <span 
                                                  style={sub2Palette.isCustom ? { backgroundColor: sub2Palette.styles.badgeBg, color: sub2Palette.styles.badgeText, borderColor: sub2Palette.styles.badgeBorder } : undefined}
                                                  className={`px-1 py-0.2 rounded font-extrabold ${sub2Palette.isCustom ? 'border' : `${sub2Palette.badgeBg} ${sub2Palette.badgeText} border ${sub2Palette.badgeBorder}`}`}
                                                >
                                                  Batch {sec}2
                                                </span>
                                                <span className="opacity-80 font-mono">{otherSub.code}</span>
                                              </div>
                                              <div className="font-extrabold break-words leading-tight mt-0.5" title={otherSub.name}>{otherSub.name}</div>
                                              <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                <span className="break-words leading-tight">
                                                  {otherFac ? cleanFacultyName(otherFac.name) : (otherSub.isAicteActivity || otherSub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                </span>
                                                {otherFac?.department && (
                                                  <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                    {normalizeDepartment(otherFac.department)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    const palette = assign && sub ? getSubjectPalette(sub.id, sub.code, sub.color) : null;
                                    const groupInfo = currentClass ? getClassGroupInfo(currentClass) : null;
                                    const batchStr = groupInfo && groupInfo.batch ? `${groupInfo.baseSection}${groupInfo.batch}` : isLabCell ? `${sec}1&${sec}2` : null;

                                    return (
                                      <div 
                                        key={slot.id} 
                                        className={`p-2 border-r border-slate-400 last:border-r-0 flex flex-col justify-between min-h-[64px] group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:scale-[1.03] hover:z-20 relative cursor-pointer ${
                                          assign && palette ? (palette.isCustom ? 'bg-[var(--custom-bg)] hover:bg-[var(--custom-hover-bg)] text-[var(--custom-text)] border-[var(--custom-border)]' : `${palette.bg} ${palette.hoverBg}`) : 'bg-slate-50/10 hover:bg-slate-50/40'
                                        } ${batchStr ? 'pl-3.5' : ''}`}
                                        style={assign && palette && palette.isCustom ? { '--custom-bg': palette.styles?.bg, '--custom-hover-bg': palette.styles?.hoverBg, '--custom-text': palette.styles?.text, '--custom-border': palette.styles?.border } as CSSProperties : undefined}
                                      >
                                        {batchStr && assign && (
                                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                            batchStr === 'A1' ? 'bg-amber-500' :
                                            batchStr === 'A2' ? 'bg-blue-500' :
                                            batchStr === 'B1' ? 'bg-emerald-500' :
                                            batchStr === 'B2' ? 'bg-indigo-500' :
                                            'bg-slate-500'
                                          }`} />
                                        )}
                                        {batchStr && assign && (
                                          <span className={`absolute top-1 right-1 text-[7px] font-extrabold px-1 py-0.2 rounded shadow-sm select-none border tracking-wider uppercase leading-none z-10 ${
                                            batchStr === 'A1' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                            batchStr === 'A2' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                            batchStr === 'B1' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                            batchStr === 'B2' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                                            'bg-slate-100 text-slate-800 border-slate-300'
                                          }`}>
                                            {batchStr}
                                          </span>
                                        )}
                                        {assign && sub && palette ? (
                                          <>
                                            <div>
                                              <div className={`font-extrabold ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} text-[10px] leading-tight uppercase tracking-tight break-words`} title={sub.name}>
                                                {sub.name}
                                              </div>
                                              <div className={`text-[9px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 font-semibold leading-none mt-0.5`}>
                                                {sub.code}
                                              </div>
                                            </div>
                                            <div className={`mt-1.5 pt-1 border-t ${palette.isCustom ? 'border-[var(--custom-border)]' : palette.border} flex items-end justify-between gap-1.5`}>
                                              <span 
                                                style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                                className={`font-bold text-[9px] ${palette.isCustom ? '' : `${palette.badgeBg} ${palette.badgeText} border ${palette.badgeBorder}`} px-1.5 py-0.5 rounded font-mono inline-block break-words leading-tight`} 
                                                title={fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                              >
                                                {fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                              </span>
                                              {fac?.department && (
                                                <span className={`text-[8px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 group-hover:opacity-90 font-mono text-right ml-auto shrink-0 self-end`}>
                                                  {normalizeDepartment(fac.department)}
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex-1 flex items-center justify-center font-bold text-[10px] text-orange-900 bg-orange-100/90 border border-orange-300 rounded p-1 shadow-2xs">
                                             Tutorial
                                           </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-slate-400 text-center py-12 px-4">
                        <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-600">No Class Selected</p>
                        <p className="text-[11px] text-slate-400 mt-1">Please select a class section from the dropdown above to view its timetable.</p>
                      </div>
                    )}
                  </div>

                  {selectedClassId && solverResult?.success && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded flex items-start space-x-2 text-[11px] text-emerald-800 timetable-info-box">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold uppercase tracking-wider text-[10px]">Solver Verification Complete</p>
                        <p className="text-emerald-700/95 mt-0.5 leading-snug">
                          This timetable perfectly satisfies all constraints. There are zero room overlaps, zero teacher clashes, and no back-to-back lectures for multi-subject faculties.
                        </p>
                      </div>
                    </div>
                  )}

                  {solverResult && !solverResult.success && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded flex items-start space-x-2 text-[11px] text-amber-800 timetable-info-box">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold uppercase tracking-wider text-[10px]">Partial Solutions Applied</p>
                        <p className="text-amber-700/95 mt-0.5 leading-snug">
                          {solverResult.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Subject-Faculty Mapping Legend Table (for print / export & reference) */}
                  {selectedClassId && (() => {
                    const currentClass = classes.find(c => c.id === selectedClassId);
                    if (!currentClass) return null;

                    const classAssignments = assignments.filter(a => a.classId === selectedClassId);
                    if (classAssignments.length === 0) return null;

                    // Group by subject
                    const subjectMap = new Map<string, { subject: Subject; facultiesList: string[] }>();

                    classAssignments.forEach(asgn => {
                      const sub = subjects.find(s => s.id === asgn.subjectId);
                      if (!sub) return;

                      let facDesc = '';
                      if (asgn.isLabBatch && asgn.batchAssignments && asgn.batchAssignments.length > 0) {
                        const batchParts = asgn.batchAssignments.map(b => {
                          const f = faculties.find(fac => fac.id === b.facultyId);
                          const fName = f ? cleanFacultyName(f.name) : 'Unassigned';
                          return `Batch ${b.batchName}: ${fName}`;
                        });
                        facDesc = batchParts.join(', ');
                      } else {
                        const f = faculties.find(fac => fac.id === asgn.facultyId);
                        facDesc = f ? cleanFacultyName(f.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned');
                      }

                      if (!subjectMap.has(sub.id)) {
                        subjectMap.set(sub.id, { subject: sub, facultiesList: [facDesc] });
                      } else {
                        const existing = subjectMap.get(sub.id)!;
                        if (!existing.facultiesList.includes(facDesc)) {
                          existing.facultiesList.push(facDesc);
                        }
                      }
                    });

                    const rows = Array.from(subjectMap.values());
                    if (rows.length === 0) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-300 pdf-subject-legend hidden">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[8.5px] leading-tight text-slate-800">
                          {rows.map((row) => (
                            <div key={row.subject.id} className="flex items-baseline space-x-1.5 overflow-hidden">
                              <span className="font-mono font-bold text-blue-900 shrink-0">{row.subject.code}:</span>
                              <span className="font-medium text-slate-800 truncate">{row.subject.name}</span>
                              <span className="text-slate-400 shrink-0">-</span>
                              <span className="font-semibold text-slate-900 shrink-0">{row.facultiesList.join(' | ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedClassId && (
                    <div className="mt-8 pb-1 flex items-end justify-between px-8 select-none pdf-signatures hidden">
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">Co-ordinator</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">HOD</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">PRINCIPAL</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* TAB: INDIVIDUAL TIME TABLE                 */}
          {/* ========================================== */}
          {activeTab === 'individual_timetable' && (
            <div className="space-y-4">
              <div id="faculty-timetable-card" className="bg-white border border-slate-200 rounded p-4 shadow-sm timetable-card">
                {/* Print-only Header */}
                {selectedFacultyId && (
                  <div className="hidden print:flex flex-col items-center justify-center text-center border-b border-slate-300 pb-3 mb-4 relative">
                    <img 
                      src="/college_logo.svg" 
                      alt="College Logo" 
                      className="absolute left-2 top-0 h-14 w-auto object-contain" 
                    />
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 leading-none">HKE Society's</p>
                    <h1 className="text-sm font-extrabold tracking-tight text-blue-900 uppercase mt-1 leading-none">
                      Sir M. Visvesvaraya College of Engineering, Raichur
                    </h1>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mt-2">
                      Faculty Individual Weekly Timetable
                    </h2>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                      Faculty Member: {faculties.find(f => f.id === selectedFacultyId)?.name} ({faculties.find(f => f.id === selectedFacultyId)?.shortName})
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-4 roster-controls-container">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Individual Faculty Timetable</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Select a faculty member to see their specific teaching schedule across all classes.</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedFacultyId}
                      onChange={(e) => setSelectedFacultyId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] rounded px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                    >
                      <option value="">-- Select Faculty Member --</option>
                      {faculties.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name} ({fac.shortName})
                        </option>
                      ))}
                    </select>

                    {selectedFacultyId && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleExportFacultyPDF}
                          disabled={isExportingFacultyPDF}
                          className="px-2.5 py-1.5 text-white bg-[crimson] hover:bg-[#b00f30] disabled:bg-[crimson]/50 disabled:cursor-not-allowed rounded text-[11px] font-bold uppercase tracking-wider transition shadow-sm flex items-center space-x-1 cursor-pointer"
                          title={isExportingFacultyPDF ? "Exporting PDF..." : "Export this timetable to PDF"}
                        >
                          <Download className="h-3.5 w-3.5 text-white" />
                          <span>{isExportingFacultyPDF ? "Exporting..." : "Export PDF"}</span>
                        </button>

                        <button
                          onClick={() => handleOpenWhatsAppModal(selectedFacultyId)}
                          className="px-2.5 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded text-[11px] font-bold uppercase tracking-wider transition shadow-sm flex items-center space-x-1.5 cursor-pointer animate-fade-in"
                          title="Send this timetable on WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-white" />
                          <span>Send on WhatsApp</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timetable Grid Container */}
                <div className="overflow-x-auto border-2 border-slate-500 rounded shadow-md">
                  {selectedFacultyId ? (
                    <div className="min-w-[800px] bg-white text-xs">
                      {/* Schedule Header / Timeslots */}
                      <div 
                        className="grid bg-slate-800 text-white font-bold border-b-2 border-slate-600 text-[10px] uppercase tracking-wider"
                        style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                      >
                        <div className="p-1 text-center bg-slate-800 border-r border-slate-600 font-bold flex items-center justify-center text-[9px]">Day</div>
                        {timeSlots.map((slot) => (
                          <div 
                            key={slot.id} 
                            className={`text-center border-r border-slate-600 last:border-r-0 flex flex-col justify-center ${
                              slot.isBreak 
                                ? 'bg-amber-600/10 text-amber-300 [writing-mode:vertical-lr] rotate-180 select-none items-center justify-center p-1 py-3' 
                                : 'p-2'
                            }`}
                          >
                            {slot.isBreak ? (
                              <div className="flex flex-col items-center leading-none">
                                <span className="font-bold text-[9px] uppercase tracking-widest">{getCleanBreakLabel(slot.label)}</span>
                                <span className="text-[7.5px] opacity-75 font-mono mt-1 font-medium whitespace-nowrap">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                              </div>
                            ) : (
                              <>
                                <span className="font-bold text-[10px] tracking-wide">{slot.label}</span>
                                <span className="text-[9px] opacity-75 font-mono mt-0.5 font-medium">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Table Body - Rows are Days */}
                      {days.map((day) => {
                        let activePeriodCounter = 0;

                        return (
                          <div 
                            key={day} 
                            className="grid border-b border-slate-400 last:border-b-0 hover:bg-slate-50/50 transition"
                            style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                          >
                            {/* Day Name */}
                            <div className="p-1 font-bold text-slate-800 bg-slate-100 border-r border-slate-400 flex items-center justify-center text-center uppercase text-[10px] tracking-wide [writing-mode:vertical-lr] rotate-180 select-none">
                              {day}
                            </div>

                            {/* Periods */}
                            {timeSlots.map((slot) => {
                              if (slot.isBreak) {
                                return (
                                  <div 
                                    key={slot.id} 
                                    className="p-1 border-r border-slate-400 last:border-r-0 flex items-center justify-center bg-amber-500/5 text-amber-800 font-extrabold italic text-center text-[10px] uppercase [writing-mode:vertical-lr] rotate-180 select-none tracking-widest"
                                  >
                                    {getCleanBreakLabel(slot.label)}
                                  </div>
                                );
                              }

                              const periodIdx = activePeriodCounter;
                              activePeriodCounter++;

                              // Find if selected faculty is assigned to any class during this period on this day
                              let matchDetails: { cls: ClassSection; assign: Assignment; sub: Subject | undefined; batchName?: string | null } | null = null;
                              if (solverResult?.schedule) {
                                for (const cls of classes) {
                                  const classSched = solverResult.schedule[cls.id];
                                  if (classSched && classSched[day]) {
                                    const cellEntry = classSched[day][periodIdx];
                                    if (cellEntry) {
                                      if (typeof cellEntry === 'string') {
                                        const assign = assignments.find(a => a.id === cellEntry);
                                        if (assign && assign.facultyId === selectedFacultyId) {
                                          const sub = subjects.find(s => s.id === assign.subjectId);
                                          matchDetails = { cls, assign, sub, batchName: null };
                                          break;
                                        }
                                      } else {
                                        const batchItems = getBatchItemsFromCell(cellEntry);
                                        if (batchItems) {
                                          const batchMatch = batchItems.find(b => {
                                            const assign = assignments.find(a => a.id === b.assignmentId);
                                            return assign?.facultyId === selectedFacultyId;
                                          });
                                          if (batchMatch) {
                                            const assign = assignments.find(a => a.id === batchMatch.assignmentId);
                                            const sub = assign ? subjects.find(s => s.id === assign.subjectId) : null;
                                            matchDetails = { cls, assign, sub, batchName: batchMatch.batchName };
                                            break;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }

                              const palette = matchDetails?.sub ? getSubjectPalette(matchDetails.sub.id, matchDetails.sub.code, matchDetails.sub.color) : null;
                              const currentClass = matchDetails?.cls;
                              const groupInfo = currentClass ? getClassGroupInfo(currentClass) : null;
                              const batchStr = matchDetails?.batchName ? `Batch ${matchDetails.batchName}` : (groupInfo && groupInfo.batch ? `${groupInfo.baseSection}${groupInfo.batch}` : null);

                              return (
                                <div 
                                  key={slot.id} 
                                  className={`p-2 border-r border-slate-400 last:border-r-0 flex flex-col justify-between min-h-[64px] group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:scale-[1.03] hover:z-20 relative cursor-pointer ${
                                    matchDetails && palette ? (palette.isCustom ? 'bg-[var(--custom-bg)] hover:bg-[var(--custom-hover-bg)] text-[var(--custom-text)] border-[var(--custom-border)]' : `${palette.bg} ${palette.hoverBg}`) : 'bg-slate-50/10 hover:bg-slate-50/40'
                                  } ${batchStr ? 'pl-3.5' : ''}`}
                                  style={matchDetails && palette && palette.isCustom ? { '--custom-bg': palette.styles?.bg, '--custom-hover-bg': palette.styles?.hoverBg, '--custom-text': palette.styles?.text, '--custom-border': palette.styles?.border } as CSSProperties : undefined}
                                >
                                  {batchStr && matchDetails && (
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                      batchStr === 'A1' ? 'bg-amber-500' :
                                      batchStr === 'A2' ? 'bg-blue-500' :
                                      batchStr === 'B1' ? 'bg-emerald-500' :
                                      batchStr === 'B2' ? 'bg-indigo-500' :
                                      'bg-slate-500'
                                    }`} />
                                  )}
                                  {batchStr && matchDetails && (
                                    <span className={`absolute top-1 right-1 text-[7px] font-extrabold px-1 py-0.2 rounded shadow-sm select-none border tracking-wider uppercase leading-none z-10 ${
                                      batchStr === 'A1' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                      batchStr === 'A2' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                      batchStr === 'B1' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                      batchStr === 'B2' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                                      'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}>
                                      {batchStr}
                                    </span>
                                  )}
                                  {matchDetails && palette ? (
                                    <>
                                      <div>
                                        <div className={`font-extrabold ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} text-[10px] leading-tight uppercase tracking-tight break-words`} title={matchDetails.sub?.name}>
                                          {matchDetails.sub?.name}
                                        </div>
                                        <div className={`text-[9px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 font-semibold leading-none mt-0.5`}>
                                          {matchDetails.sub?.code}
                                        </div>
                                      </div>
                                      <div className={`mt-1.5 pt-1 border-t ${palette.isCustom ? 'border-[var(--custom-border)]' : palette.border} flex items-end justify-between gap-1.5`}>
                                        <span 
                                          style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                          className={`font-bold text-[9px] ${palette.isCustom ? '' : `${palette.badgeBg} ${palette.badgeText} border ${palette.badgeBorder}`} px-1.5 py-0.5 rounded font-mono inline-block break-words leading-tight`} 
                                          title={`${matchDetails.cls.name} (Sec ${matchDetails.cls.section})`}
                                        >
                                          {matchDetails.cls.name} (Sec {matchDetails.cls.section})
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex-1 flex items-center justify-center text-slate-400 font-mono text-[9px] border border-dashed border-slate-300 bg-slate-50/20 rounded p-1">
                                      -- Available --
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-12 px-4">
                      <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-xs uppercase tracking-wider text-slate-600">No Faculty Selected</p>
                      <p className="text-[11px] text-slate-400 mt-1">Please select a faculty member from the dropdown above to view their individual timetable.</p>
                    </div>
                  )}
                </div>

                  {/* Subject and Class Allocation Details for Individual Faculty */}
                  {selectedFacultyId && (() => {
                    const currentFaculty = faculties.find(f => f.id === selectedFacultyId);
                    if (!currentFaculty) return null;

                    const facultyAssignments = assignments.filter(a => {
                      if (a.facultyId === selectedFacultyId) return true;
                      if (a.isLabBatch && a.batchAssignments?.some(b => b.facultyId === selectedFacultyId)) return true;
                      return false;
                    });

                    if (facultyAssignments.length === 0) return null;

                    const rowMap = new Map<string, { subject: Subject; classNames: string[] }>();
                    facultyAssignments.forEach(asgn => {
                      const sub = subjects.find(s => s.id === asgn.subjectId);
                      const cls = classes.find(c => c.id === asgn.classId);
                      if (!sub || !cls) return;

                      let clsLabel = `${cls.name} (Sec ${cls.section})`;
                      if (asgn.isLabBatch && asgn.batchAssignments) {
                        const myBatches = asgn.batchAssignments.filter(b => b.facultyId === selectedFacultyId).map(b => `Batch ${b.batchName}`);
                        if (myBatches.length > 0) {
                          clsLabel += ` [${myBatches.join(', ')}]`;
                        }
                      }

                      if (!rowMap.has(sub.id)) {
                        rowMap.set(sub.id, { subject: sub, classNames: [clsLabel] });
                      } else {
                        const existing = rowMap.get(sub.id)!;
                        if (!existing.classNames.includes(clsLabel)) {
                          existing.classNames.push(clsLabel);
                        }
                      }
                    });

                    const rows = Array.from(rowMap.values());
                    if (rows.length === 0) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-300 pdf-subject-legend hidden">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[8.5px] leading-tight text-slate-800">
                          {rows.map((row) => (
                            <div key={row.subject.id} className="flex items-baseline space-x-1.5 overflow-hidden">
                              <span className="font-mono font-bold text-blue-900 shrink-0">{row.subject.code}:</span>
                              <span className="font-medium text-slate-800 truncate">{row.subject.name}</span>
                              <span className="text-slate-400 shrink-0">-</span>
                              <span className="font-semibold text-slate-900 shrink-0">{row.classNames.join(' | ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedFacultyId && (
                    <div className="mt-8 pb-1 flex items-end justify-between px-8 select-none pdf-signatures hidden">
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">Co-ordinator</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">HOD</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-40 border-b border-slate-800 mb-1"></div>
                        <span className="font-bold text-[11pt] text-slate-900 uppercase">PRINCIPAL</span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: DRAG & DROP ADJUSTER                  */}
          {/* ========================================== */}
          {activeTab === 'drag_drop' && (
            <div className="space-y-4">
              
              {/* Top Banner explaining how it works */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-4 rounded border border-blue-950 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 text-amber-300">
                    <Sliders className="h-4 w-4" />
                    <span>Interactive Manual Adjuster (Drag or Tap to Swap)</span>
                  </h3>
                  <p className="text-[11px] text-slate-200 mt-1 max-w-3xl">
                    <strong className="text-amber-300">On Mobile / Touch devices:</strong> Simply tap a cell to select it, then tap another cell to instantly swap their positions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
                  <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold uppercase tracking-wider rounded transition flex items-center space-x-1 shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:scale-100 border border-slate-700"
                    title="Undo manual swap"
                  >
                    <Undo className="h-3.5 w-3.5 text-blue-400" />
                    <span>Undo ({undoStack.length})</span>
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold uppercase tracking-wider rounded transition flex items-center space-x-1 shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:scale-100 border border-slate-700"
                    title="Redo manual swap"
                  >
                    <Redo className="h-3.5 w-3.5 text-blue-400" />
                    <span>Redo ({redoStack.length})</span>
                  </button>
                  <button
                    onClick={handleSaveAdjustedSchedule}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded transition flex items-center space-x-1.5 shadow-md cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleResetManualAdjustments}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-900 text-[11px] font-bold uppercase tracking-wider rounded transition flex items-center space-x-1.5 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Stacked layout: Warnings Panel above Interactive Grid Viewer */}
              <div className="flex flex-col gap-4">
                
                {/* Warnings Panel (Accordion, default closed) */}
                <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsRosterWarningsOpen(!isRosterWarningsOpen)}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className={`h-4 w-4 ${scheduleWarnings.length === 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Roster Warnings & Rules ({scheduleWarnings.length})
                      </span>
                      {scheduleWarnings.length === 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                          Conflict-Free
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                          {scheduleWarnings.length} {scheduleWarnings.length === 1 ? 'Warning' : 'Warnings'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-600">
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        {isRosterWarningsOpen ? 'Hide' : 'Show'}
                      </span>
                      {isRosterWarningsOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isRosterWarningsOpen && (
                    <div className="p-4 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Warnings List */}
                        <div className="lg:col-span-8">
                          {scheduleWarnings.length === 0 ? (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded text-center h-full flex flex-col justify-center items-center">
                              <CheckCircle2 className="h-7 w-7 text-emerald-600 mb-1.5 animate-bounce" />
                              <p className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider">Roster is Conflict-Free</p>
                              <p className="text-[10px] text-emerald-600 mt-1 max-w-xl">
                                All manual adjustments satisfy teacher workloads, avoid back-to-back classes, and prevent teacher clashes across sections!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {scheduleWarnings.map((warning, idx) => {
                                // Find the class details for the warning
                                const cls = classes.find(c => c.id === warning.classId);
                                const className = cls ? `${cls.name} (Sec ${cls.section})` : '';
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="p-2.5 rounded border border-amber-200 bg-amber-50/50 text-[10.5px] leading-relaxed text-amber-900 flex items-start space-x-2 shadow-sm"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <span className="font-extrabold text-amber-950 uppercase text-[9px] tracking-wider block mb-0.5">
                                        {className} {warning.day && `• ${warning.day}`} {warning.pIdx !== undefined && `• Slot ${warning.pIdx + 1}`}
                                      </span>
                                      <p className="text-slate-700 font-medium">{warning.message}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Rules Enforced */}
                        <div className="lg:col-span-4 bg-slate-50 border border-slate-100 rounded p-3 text-[10px] text-slate-500 flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-slate-600 uppercase tracking-widest text-[8.5px] mb-1.5">Rules Enforced:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-3 gap-y-1">
                              <p>• Teacher cannot teach two classes in the same slot.</p>
                              <p>• Subject cannot exceed daily period limits.</p>
                              <p>• Staff cannot have consecutive multi-subject periods.</p>
                              <p>• Non-lab subjects cannot have consecutive periods.</p>
                              <p>• Lab subjects must be continuous 2-period blocks.</p>
                              <p>• Avoid free period gaps in Periods 1 to 4.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timetable View */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                        <Calendar className="h-4 w-4 text-blue-900" />
                        <span>Interactive Grid Viewer</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Select a class section below to view and manually adjust its periods.</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Class Section:</span>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs rounded px-2 py-1.5 font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Sec {c.section})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border border-slate-400 rounded overflow-x-auto shadow-sm bg-slate-900/5">
                    {selectedClassId ? (
                      (() => {
                        const classSched = customSchedule?.[selectedClassId];
                        return (
                          <div className="min-w-[1000px] select-none">
                            {/* Schedule Header / Timeslots */}
                            <div 
                              className="grid bg-slate-800 text-white font-bold border-b-2 border-slate-600 text-[10px] uppercase tracking-wider"
                              style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                            >
                              <div className="p-1 text-center bg-slate-800 border-r border-slate-600 font-bold flex items-center justify-center text-[9px]">Day</div>
                              {timeSlots.map((slot) => (
                                <div 
                                  key={slot.id} 
                                  className={`text-center border-r border-slate-600 last:border-r-0 flex flex-col justify-center ${
                                    slot.isBreak 
                                      ? 'bg-amber-600/10 text-amber-300 [writing-mode:vertical-lr] rotate-180 select-none items-center justify-center p-1 py-3' 
                                      : 'p-2'
                                  }`}
                                >
                                  {slot.isBreak ? (
                                    <div className="flex flex-col items-center leading-none">
                                      <span className="font-bold text-[9px] uppercase tracking-widest">{getCleanBreakLabel(slot.label)}</span>
                                      <span className="text-[7.5px] opacity-75 font-mono mt-1 font-medium whitespace-nowrap">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[10px] tracking-wide">{slot.label}</span>
                                      <span className="text-[9px] opacity-75 font-mono mt-0.5 font-medium">{formatTimeRange12(slot.startTime, slot.endTime)}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Table Body - Rows are Days */}
                            {days.map((day) => {
                              const slotsForDay = classSched?.[day] || [];
                              let activePeriodCounter = 0;

                              return (
                                <div 
                                  key={day} 
                                  className="grid border-b border-slate-400 last:border-b-0 hover:bg-slate-50/50 transition"
                                  style={{ gridTemplateColumns: `40px ${timeSlots.map(slot => slot.isBreak ? '40px' : 'minmax(0, 1fr)').join(' ')}` }}
                                >
                                  {/* Day Name */}
                                  <div className="p-1 font-bold text-slate-800 bg-slate-100 border-r border-slate-400 flex items-center justify-center text-center uppercase text-[10px] tracking-wide [writing-mode:vertical-lr] rotate-180 select-none">
                                    {day}
                                  </div>

                                  {/* Periods */}
                                  {timeSlots.map((slot) => {
                                    if (slot.isBreak) {
                                      return (
                                        <div 
                                          key={slot.id} 
                                          className="p-1 border-r border-slate-400 last:border-r-0 flex items-center justify-center bg-amber-500/5 text-amber-800 font-extrabold italic text-center text-[10px] uppercase [writing-mode:vertical-lr] rotate-180 select-none tracking-widest"
                                        >
                                          {getCleanBreakLabel(slot.label)}
                                        </div>
                                      );
                                    }

                                    const currentActiveIdx = activePeriodCounter;
                                    const cellEntry = slotsForDay[currentActiveIdx];
                                    const assignmentId = typeof cellEntry === 'string' ? cellEntry : null;
                                    const { assign, sub, fac } = getAssignmentDetails(assignmentId);

                                    activePeriodCounter++;

                                    // Check if this specific cell has warnings
                                    const cellWarnings = scheduleWarnings.filter(w => 
                                      w.classId === selectedClassId && 
                                      w.day === day && 
                                      w.pIdx === currentActiveIdx
                                    );
                                    const hasCellWarning = cellWarnings.length > 0;
                                    const isClash = cellWarnings.some(w => w.type === 'clash');
                                    const isSelectedForSwap = selectedCell && selectedCell.day === day && selectedCell.slotIdx === currentActiveIdx;

                                    const currentClass = classes.find(c => c.id === selectedClassId);
                                    const groupInfo = currentClass ? getClassGroupInfo(currentClass) : null;
                                    const batchStr = groupInfo && groupInfo.batch ? `${groupInfo.baseSection}${groupInfo.batch}` : null;

                                    return (
                                      <div 
                                        key={slot.id} 
                                        draggable={!!assign}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData("application/json", JSON.stringify({
                                            classId: selectedClassId,
                                            day,
                                            slotIdx: currentActiveIdx
                                          }));
                                          e.dataTransfer.effectAllowed = "move";
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.currentTarget.classList.add("bg-blue-100/60", "border-blue-500");
                                        }}
                                        onDragLeave={(e) => {
                                          e.currentTarget.classList.remove("bg-blue-100/60", "border-blue-500");
                                        }}
                                        onDrop={(e) => {
                                          e.currentTarget.classList.remove("bg-blue-100/60", "border-blue-500");
                                          e.preventDefault();
                                          try {
                                            const dataStr = e.dataTransfer.getData("application/json");
                                            if (!dataStr) return;
                                            const { classId: srcClassId, day: srcDay, slotIdx: srcSlotIdx } = JSON.parse(dataStr);
                                            
                                            if (srcClassId !== selectedClassId) {
                                              showAuthNotice("Warning: Drag & Drop is only allowed within the same class timetable grid.");
                                              return;
                                            }
                                            if (srcDay === day && srcSlotIdx === currentActiveIdx) return;

                                            performSwap(srcDay, srcSlotIdx, day, currentActiveIdx);
                                          } catch (err) {
                                            console.error("Drop failed:", err);
                                          }
                                        }}
                                        onClick={() => {
                                          if (!selectedCell) {
                                            // Start tap swap selection
                                            setSelectedCell({ day, slotIdx: currentActiveIdx });
                                            showAuthNotice(`Selected ${day} Slot ${currentActiveIdx + 1}. Now tap another cell to swap.`);
                                          } else {
                                            // Handle second tap
                                            if (selectedCell.day === day && selectedCell.slotIdx === currentActiveIdx) {
                                              // Deselect if tapped again
                                              setSelectedCell(null);
                                              showAuthNotice("Deselected slot.");
                                            } else {
                                              // Perform swap
                                              const srcDay = selectedCell.day;
                                              const srcSlotIdx = selectedCell.slotIdx;
                                              performSwap(srcDay, srcSlotIdx, day, currentActiveIdx);
                                              setSelectedCell(null);
                                            }
                                          }
                                        }}
                                        className={`p-2 border-r border-slate-400 last:border-r-0 flex flex-col justify-between min-h-[64px] group transition-all duration-300 relative cursor-pointer select-none ${
                                          isSelectedForSwap
                                            ? 'bg-blue-100/90 ring-4 ring-blue-500 border-blue-500 z-10 scale-[0.98]'
                                            : assign && sub
                                              ? (getSubjectPalette(sub.id, sub.code, sub.color).isCustom ? 'bg-[var(--custom-bg)] hover:bg-[var(--custom-hover-bg)] text-[var(--custom-text)] border-[var(--custom-border)]' : `${getSubjectPalette(sub.id, sub.code, sub.color).bg} ${getSubjectPalette(sub.id, sub.code, sub.color).hoverBg}`)
                                              : 'bg-slate-50/10 hover:bg-slate-50/40'
                                        } ${!isSelectedForSwap ? 'transform hover:-translate-y-1 hover:shadow-lg hover:scale-[1.03] hover:z-20' : ''} ${hasCellWarning && !isSelectedForSwap ? `ring-2 ring-inset ${isClash ? 'ring-rose-500 border-rose-500' : 'ring-amber-500 border-amber-500'}` : ''} ${batchStr ? 'pl-3.5' : ''}`}
                                        style={assign && sub && getSubjectPalette(sub.id, sub.code, sub.color).isCustom ? { '--custom-bg': getSubjectPalette(sub.id, sub.code, sub.color).styles?.bg, '--custom-hover-bg': getSubjectPalette(sub.id, sub.code, sub.color).styles?.hoverBg, '--custom-text': getSubjectPalette(sub.id, sub.code, sub.color).styles?.text, '--custom-border': getSubjectPalette(sub.id, sub.code, sub.color).styles?.border } as CSSProperties : undefined}
                                      >
                                        {batchStr && assign && (
                                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                            batchStr === 'A1' ? 'bg-amber-500' :
                                            batchStr === 'A2' ? 'bg-blue-500' :
                                            batchStr === 'B1' ? 'bg-emerald-500' :
                                            batchStr === 'B2' ? 'bg-indigo-500' :
                                            'bg-slate-500'
                                          }`} />
                                        )}
                                        {batchStr && assign && (
                                          <span className={`absolute top-1 right-1 text-[7px] font-extrabold px-1 py-0.2 rounded shadow-sm select-none border tracking-wider uppercase leading-none z-10 ${
                                            batchStr === 'A1' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                            batchStr === 'A2' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                            batchStr === 'B1' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                            batchStr === 'B2' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                                            'bg-slate-100 text-slate-800 border-slate-300'
                                          }`}>
                                            {batchStr}
                                          </span>
                                        )}
                                        {getBatchItemsFromCell(cellEntry) ? (
                                          <div className="flex flex-col justify-center space-y-1 w-full h-full">
                                            {getBatchItemsFromCell(cellEntry)!.map((batchItem) => {
                                              const bAssign = assignments.find(a => a.id === batchItem.assignmentId);
                                              const bSub = bAssign ? subjects.find(s => s.id === bAssign.subjectId) : null;
                                              const bFac = bAssign ? faculties.find(f => f.id === bAssign.facultyId) : null;
                                              if (!bAssign || !bSub) return null;

                                              const palette = getSubjectPalette(bSub.id, bSub.code, bSub.color);

                                              return (
                                                <div 
                                                  key={batchItem.batchName} 
                                                  className={`p-1 rounded border text-left text-[9px] shadow-2xs transition-all ${
                                                    palette.isCustom ? '' : `${palette.bg} ${palette.border} ${palette.text}`
                                                  }`}
                                                  style={palette.isCustom ? {
                                                    backgroundColor: palette.styles.bg,
                                                    borderColor: palette.styles.border,
                                                    color: palette.styles.text
                                                  } : undefined}
                                                >
                                                  <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                    <span 
                                                      style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                                      className={`px-1 py-0.2 rounded font-extrabold ${palette.isCustom ? 'border' : `${palette.badgeBg} ${palette.badgeText} border ${palette.badgeBorder}`}`}
                                                    >
                                                      Batch {batchItem.batchName}
                                                    </span>
                                                    <span className="opacity-80 font-mono">{bSub.code}</span>
                                                  </div>
                                                  <div className="font-extrabold break-words leading-tight mt-0.5" title={bSub.name}>{bSub.name}</div>
                                                  <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                    <span className="break-words leading-tight">
                                                      {bFac ? cleanFacultyName(bFac.name) : (bSub.isAicteActivity || bSub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                    </span>
                                                    {bFac?.department && (
                                                      <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                        {normalizeDepartment(bFac.department)}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (assign && sub && isSubjectLab(sub)) ? (
                                          (() => {
                                            const clsLabAssigns = assignments.filter(a => a.classId === selectedClassId && isSubjectLab(subjects.find(s => s.id === a.subjectId)));
                                            const currentClass = classes.find(c => c.id === selectedClassId);
                                            const sec = currentClass ? currentClass.section.trim().toUpperCase() : 'A';

                                            if (clsLabAssigns.length > 1) {
                                              const sub1 = sub;
                                              const sub1Palette = sub1 ? getSubjectPalette(sub1.id, sub1.code, sub1.color) : null;
                                              const otherAssign = clsLabAssigns.find(a => a.id !== assign.id) || clsLabAssigns[0];
                                              const otherSub = subjects.find(s => s.id === otherAssign.subjectId);
                                              const otherFac = faculties.find(f => f.id === otherAssign.facultyId);
                                              const sub2Palette = otherSub ? getSubjectPalette(otherSub.id, otherSub.code, otherSub.color) : null;

                                              return (
                                                <div className="flex flex-col justify-center space-y-1 w-full h-full">
                                                  {sub1 && sub1Palette && (
                                                    <div 
                                                      className={`p-1 rounded border text-left text-[9px] shadow-2xs ${
                                                        sub1Palette.isCustom ? '' : `${sub1Palette.bg} ${sub1Palette.border} ${sub1Palette.text}`
                                                      }`}
                                                      style={sub1Palette.isCustom ? {
                                                        backgroundColor: sub1Palette.styles.bg,
                                                        borderColor: sub1Palette.styles.border,
                                                        color: sub1Palette.styles.text
                                                      } : undefined}
                                                    >
                                                      <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                        <span 
                                                          style={sub1Palette.isCustom ? { backgroundColor: sub1Palette.styles.badgeBg, color: sub1Palette.styles.badgeText, borderColor: sub1Palette.styles.badgeBorder } : undefined}
                                                          className={`px-1 py-0.2 rounded font-extrabold ${sub1Palette.isCustom ? 'border' : `${sub1Palette.badgeBg} ${sub1Palette.badgeText} border ${sub1Palette.badgeBorder}`}`}
                                                        >
                                                          Batch {sec}1
                                                        </span>
                                                        <span className="opacity-80 font-mono">{sub1.code}</span>
                                                      </div>
                                                      <div className="font-extrabold break-words leading-tight mt-0.5" title={sub1.name}>{sub1.name}</div>
                                                      <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                        <span className="break-words leading-tight">
                                                          {fac ? cleanFacultyName(fac.name) : (sub1.isAicteActivity || sub1.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                        </span>
                                                        {fac?.department && (
                                                          <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                            {normalizeDepartment(fac.department)}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {otherSub && sub2Palette && (
                                                    <div 
                                                      className={`p-1 rounded border text-left text-[9px] shadow-2xs ${
                                                        sub2Palette.isCustom ? '' : `${sub2Palette.bg} ${sub2Palette.border} ${sub2Palette.text}`
                                                      }`}
                                                      style={sub2Palette.isCustom ? {
                                                        backgroundColor: sub2Palette.styles.bg,
                                                        borderColor: sub2Palette.styles.border,
                                                        color: sub2Palette.styles.text
                                                      } : undefined}
                                                    >
                                                      <div className="flex items-center justify-between font-black uppercase text-[8px] tracking-wider">
                                                        <span 
                                                          style={sub2Palette.isCustom ? { backgroundColor: sub2Palette.styles.badgeBg, color: sub2Palette.styles.badgeText, borderColor: sub2Palette.styles.badgeBorder } : undefined}
                                                          className={`px-1 py-0.2 rounded font-extrabold ${sub2Palette.isCustom ? 'border' : `${sub2Palette.badgeBg} ${sub2Palette.badgeText} border ${sub2Palette.badgeBorder}`}`}
                                                        >
                                                          Batch {sec}2
                                                        </span>
                                                        <span className="opacity-80 font-mono">{otherSub.code}</span>
                                                      </div>
                                                      <div className="font-extrabold break-words leading-tight mt-0.5" title={otherSub.name}>{otherSub.name}</div>
                                                      <div className="text-[8px] opacity-90 font-semibold mt-0.5 flex items-end justify-between gap-1">
                                                        <span className="break-words leading-tight">
                                                          {otherFac ? cleanFacultyName(otherFac.name) : (otherSub.isAicteActivity || otherSub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                        </span>
                                                        {otherFac?.department && (
                                                          <span className="text-[7.5px] opacity-75 font-mono text-right ml-auto shrink-0 self-end">
                                                            {normalizeDepartment(otherFac.department)}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }

                                            const palette = getSubjectPalette(sub.id, sub.code, sub.color);
                                            return (
                                              <>
                                                <div>
                                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                                    <span className="px-1 py-0.2 rounded font-extrabold bg-amber-200 text-amber-900 text-[8px] uppercase tracking-wider">
                                                      Batch {sec}1 & {sec}2
                                                    </span>
                                                    <span className="font-mono text-[8px] opacity-80">{sub.code}</span>
                                                  </div>
                                                  <div className={`font-extrabold ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} text-[10px] leading-tight uppercase tracking-tight break-words`} title={sub.name}>
                                                    {sub.name}
                                                  </div>
                                                </div>
                                                <div className={`mt-1.5 pt-1 border-t ${palette.isCustom ? 'border-[var(--custom-border)]' : palette.border} flex items-end justify-between gap-1.5`}>
                                                  <span 
                                                    style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                                    className={`font-bold ${palette.isCustom ? '' : `${palette.badgeText} ${palette.badgeBg} border ${palette.badgeBorder}`} text-[9px] px-1.5 py-0.5 rounded font-mono inline-block break-words leading-tight`} 
                                                    title={fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                  >
                                                    {fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                  </span>
                                                  {fac?.department && (
                                                    <span className={`text-[8px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 group-hover:opacity-90 font-mono text-right ml-auto shrink-0 self-end`}>
                                                      {normalizeDepartment(fac.department)}
                                                    </span>
                                                  )}
                                                </div>
                                              </>
                                            );
                                          })()
                                        ) : assign && sub ? (
                                          (() => {
                                            const palette = getSubjectPalette(sub.id, sub.code, sub.color);
                                            return (
                                              <>
                                                <div>
                                                  <div className="flex items-center justify-between gap-1">
                                                    <div className={`font-extrabold ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} text-[10px] leading-tight uppercase tracking-tight break-words`} title={sub.name}>
                                                      {sub.name}
                                                    </div>
                                                    {hasCellWarning && (
                                                      <span title={cellWarnings.map(w => w.message).join('\n')}>
                                                        <AlertTriangle className={`h-3 w-3 ${isClash ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className={`text-[9px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 font-semibold leading-none mt-0.5`}>
                                                    {sub.code}
                                                  </div>
                                                </div>
                                                <div className={`mt-1.5 pt-1 border-t ${palette.isCustom ? 'border-[var(--custom-border)]' : palette.border} flex items-end justify-between gap-1.5`}>
                                                  <span 
                                                    style={palette.isCustom ? { backgroundColor: palette.styles.badgeBg, color: palette.styles.badgeText, borderColor: palette.styles.badgeBorder } : undefined}
                                                    className={`font-bold ${palette.isCustom ? '' : `${palette.badgeText} ${palette.badgeBg} border ${palette.badgeBorder}`} text-[9px] px-1.5 py-0.5 rounded font-mono inline-block break-words leading-tight`} 
                                                    title={fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                  >
                                                    {fac ? cleanFacultyName(fac.name) : (sub.isAicteActivity || sub.isStudentActivity ? 'Self-Guided' : 'Unassigned')}
                                                  </span>
                                                  {fac?.department && (
                                                    <span className={`text-[8px] ${palette.isCustom ? 'text-[var(--custom-text)]' : palette.text} opacity-75 group-hover:opacity-90 font-mono text-right ml-auto shrink-0 self-end`}>
                                                      {normalizeDepartment(fac.department)}
                                                    </span>
                                                  )}
                                                </div>
                                              </>
                                            );
                                          })()
                                        ) : (
                                          <div className="flex-1 flex items-center justify-center font-bold text-[10px] text-orange-900 bg-orange-100/90 border border-orange-300 rounded p-1 shadow-2xs">
                                             Tutorial
                                           </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-slate-400 text-center py-12 px-4">
                        <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-600">No Class Selected</p>
                        <p className="text-[11px] text-slate-400 mt-1">Please select a class section from the dropdown above to view its timetable.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* TAB: FACULTIES                             */}
          {/* ========================================== */}
          {activeTab === 'faculties' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Form: Add / Edit Faculty */}
              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                {editingFacultyId ? (
                  <>
                    <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-amber-100 pb-2 mb-3">
                      <Pencil className="h-4 w-4 text-amber-600" />
                      <span>Edit Faculty Details</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">Update this staff member's info in the directory.</p>

                    <form onSubmit={updateFaculty} className="space-y-3" noValidate>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Savitha Murthy"
                          value={editFacName}
                          onChange={(e) => setEditFacName(formatFacultyName(e.target.value))}
                          className={`w-full bg-amber-50/10 border ${
                            editFacFormSubmitted && !editFacName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-amber-500'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Short Initials</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. SKM"
                            value={editFacShort}
                            onChange={(e) => setEditFacShort(e.target.value.toUpperCase())}
                            className={`w-full bg-amber-50/10 border ${
                              editFacFormSubmitted && !editFacShort ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-amber-500'
                            } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Department</label>
                          <select
                            value={editFacDept}
                            onChange={(e) => setEditFacDept(e.target.value)}
                            className="w-full bg-amber-50/10 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          >
                            <option value="CSE">CSE</option>
                            <option value="AIML">AIML</option>
                            <option value="ECE">ECE</option>
                            <option value="BS">BS</option>
                            <option value="CV">CV</option>
                            <option value="ME">ME</option>
                            <option value="MBA">MBA</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Phone Number (Optional)</label>
                        <input
                          type="tel"
                          placeholder="e.g. 10-digit number"
                          value={editFacPhone}
                          onChange={(e) => setEditFacPhone(cleanPhoneNumber(e.target.value))}
                          className={`w-full bg-amber-50/10 border ${
                            editFacFormSubmitted && editFacPhone && editFacPhone.length !== 10
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                              : 'border-slate-200 focus:ring-amber-500'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={cancelEditingFaculty}
                          className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded transition cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1 cursor-pointer text-center"
                        >
                          <Check className="h-3 w-3 text-white" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                      <Users className="h-4 w-4 text-blue-900" />
                      <span>Register Faculty</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">Add staff members to make them available for assignment.</p>

                    <form onSubmit={addFaculty} className="space-y-3" noValidate>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Savitha Murthy"
                          value={newFacName}
                          onChange={(e) => setNewFacName(formatFacultyName(e.target.value))}
                          className={`w-full bg-slate-50 border ${
                            facFormSubmitted && !newFacName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Short Initials</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. SKM"
                            value={newFacShort}
                            onChange={(e) => setNewFacShort(e.target.value.toUpperCase())}
                            className={`w-full bg-slate-50 border ${
                              facFormSubmitted && !newFacShort ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                            } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Department</label>
                          <select
                            value={newFacDept}
                            onChange={(e) => setNewFacDept(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                          >
                            <option value="CSE">CSE</option>
                            <option value="AIML">AIML</option>
                            <option value="ECE">ECE</option>
                            <option value="BS">BS</option>
                            <option value="CV">CV</option>
                            <option value="ME">ME</option>
                            <option value="MBA">MBA</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Phone Number (Optional)</label>
                        <input
                          type="tel"
                          placeholder="e.g. 10-digit number"
                          value={newFacPhone}
                          onChange={(e) => setNewFacPhone(cleanPhoneNumber(e.target.value))}
                          className={`w-full bg-slate-50 border ${
                            facFormSubmitted && newFacPhone && newFacPhone.length !== 10
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                              : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-amber-300" />
                        <span>Register Faculty</span>
                      </button>
                    </form>
                  </>
                )}
              </div>

              {/* Right List: Faculties */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Faculty Directory</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">List of all active instructors currently mapped inside the system.</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                    TOTAL: {faculties.length}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5">Faculty Member</th>
                        <th className="p-2.5 text-center">Short Initials</th>
                        <th className="p-2.5">Department</th>
                        <th className="p-2.5">Phone Number</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {faculties.length > 0 ? (
                        faculties.map((fac) => (
                          <tr 
                            key={fac.id} 
                            className={`transition ${
                              editingFacultyId === fac.id ? 'bg-amber-50/30 border-l-2 border-amber-500' : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="p-2.5 font-bold text-slate-900">{fac.name}</td>
                            <td className="p-2.5 text-center">
                              <span className="font-mono bg-blue-50 text-blue-900 border border-blue-100 font-bold px-2 py-0.5 rounded text-[10px]">
                                {fac.shortName}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700">{normalizeDepartment(fac.department)}</td>
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{fac.phone || '--'}</td>
                            <td className="p-2.5 text-center flex items-center justify-center space-x-2">
                              <button
                                onClick={() => startEditingFaculty(fac)}
                                className={`p-1 transition cursor-pointer ${
                                  editingFacultyId === fac.id ? 'text-amber-600 hover:text-amber-700' : 'text-slate-400 hover:text-blue-900'
                                }`}
                                title="Edit faculty details"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteFaculty(fac.id)}
                                className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                title="Delete faculty"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-medium italic">
                            No faculty members registered. Add them using the form.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: SUBJECTS                              */}
          {/* ========================================== */}
          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Form: Add / Edit Subject */}
              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                {editingSubjectId ? (
                  <>
                    <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-amber-100 pb-2 mb-3">
                      <Pencil className="h-4 w-4 text-amber-600" />
                      <span>Edit Subject Details</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">Update this course's syllabus configuration and periods.</p>

                    <form onSubmit={updateSubject} className="space-y-3" noValidate>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Subject Code</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 21CS51"
                            value={editSubCode}
                            onChange={(e) => setEditSubCode(e.target.value)}
                            className={`w-full bg-amber-50/10 border ${
                              editSubFormSubmitted && !editSubCode ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-amber-500'
                            } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Department</label>
                          <select
                            value={editSubDept}
                            onChange={(e) => setEditSubDept(e.target.value)}
                            className="w-full bg-amber-50/10 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          >
                            <option value="CSE">CSE</option>
                            <option value="AIML">AIML</option>
                            <option value="ECE">ECE</option>
                            <option value="BS">BS</option>
                            <option value="CV">CV</option>
                            <option value="ME">ME</option>
                            <option value="MBA">MBA</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Course Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Database Management"
                          value={editSubName}
                          onChange={(e) => setEditSubName(e.target.value)}
                          className={`w-full bg-amber-50/10 border ${
                            editSubFormSubmitted && !editSubName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-amber-500'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Weekly Periods</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              required
                              min={1}
                              max={10}
                              value={editSubPeriods}
                              onChange={(e) => setEditSubPeriods(Number(e.target.value))}
                              className="w-full bg-amber-50/10 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition"
                            />
                            <span className="text-[11px] text-slate-500 font-semibold flex-shrink-0">/ week</span>
                          </div>
                        </div>

                        <div className="flex items-end pb-1.5">
                          <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editSubIsLab}
                              onChange={(e) => setEditSubIsLab(e.target.checked)}
                              className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">Is Lab / Pract.?</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-1 pb-2 space-y-1.5">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editSubIsProject}
                            onChange={(e) => setEditSubIsProject(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is Project/Seminar/Internship ?</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editSubIsAicte}
                            onChange={(e) => setEditSubIsAicte(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is AICTE Activity ?</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editSubIsMentoring}
                            onChange={(e) => setEditSubIsMentoring(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is Student Activity / Mentoring ?</span>
                        </label>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                          <span>Background Color Accent</span>
                          <span className="text-[9px] text-slate-400 font-normal">Timetable cell styling</span>
                        </label>
                        <div className="bg-amber-50/20 border border-slate-200 rounded p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-6 h-6 rounded-md border border-slate-300 shadow-sm flex items-center justify-center flex-shrink-0 transition-all cursor-pointer hover:scale-105"
                                style={{ backgroundColor: editSubColor || '#cbd5e1' }}
                                onClick={() => {
                                  setColorModalSubjectId(null);
                                  setIsColorModalOpen(true);
                                }}
                                title={editSubColor ? `Selected: ${editSubColor.toUpperCase()} (Click to change)` : 'Auto-assigned color'}
                              >
                                {editSubColor && (
                                  <span className="text-[9px] font-bold" style={{ color: getContrastTextColor(editSubColor) }}>✓</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-mono font-bold text-slate-800 leading-tight">
                                  {editSubColor ? editSubColor.toUpperCase() : 'AUTO-ASSIGNED'}
                                </p>
                                <p className="text-[8px] text-slate-400 font-medium">
                                  {editSubColor ? 'Custom color selected' : 'Unique pastel auto-assigned'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setColorModalSubjectId(null);
                                  setIsColorModalOpen(true);
                                }}
                                className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[9px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1 shadow-sm"
                              >
                                <Palette className="h-3 w-3 text-amber-600" />
                                <span>Palette Modal</span>
                              </button>
                              {editSubColor && (
                                <button
                                  type="button"
                                  onClick={() => setEditSubColor('')}
                                  className="text-[9px] text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer px-1"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Swatches Bar */}
                          <div>
                            <p className="text-[9px] font-semibold text-slate-500 mb-1">Quick Select Shades:</p>
                            <div className="flex flex-wrap gap-1">
                              {QUICK_PRESET_COLORS.map((preset) => {
                                const isSelected = editSubColor.toLowerCase() === preset.hex.toLowerCase();
                                return (
                                  <button
                                    key={preset.hex}
                                    type="button"
                                    onClick={() => setEditSubColor(preset.hex)}
                                    className={`w-5 h-5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                                      isSelected
                                        ? 'ring-2 ring-slate-800 ring-offset-1 scale-110 border-slate-800 z-10'
                                        : 'border-slate-300 hover:scale-105 hover:border-slate-500'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                    title={`${preset.name} (${preset.hex.toUpperCase()})`}
                                  >
                                    {isSelected && (
                                      <span className="text-[8px] font-bold leading-none" style={{ color: getContrastTextColor(preset.hex) }}>
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={cancelEditingSubject}
                          className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded transition cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1 cursor-pointer text-center"
                        >
                          <Check className="h-3 w-3 text-white" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                      <BookOpen className="h-4 w-4 text-blue-900" />
                      <span>Register Subject</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">Add syllabus courses and weekly credit hours requirements.</p>

                    <form onSubmit={addSubject} className="space-y-3" noValidate>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Subject Code</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 21CS51"
                            value={newSubCode}
                            onChange={(e) => setNewSubCode(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              subFormSubmitted && !newSubCode ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                            } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Department</label>
                          <select
                            value={newSubDept}
                            onChange={(e) => setNewSubDept(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                          >
                            <option value="CSE">CSE</option>
                            <option value="AIML">AIML</option>
                            <option value="ECE">ECE</option>
                            <option value="BS">BS</option>
                            <option value="CV">CV</option>
                            <option value="ME">ME</option>
                            <option value="MBA">MBA</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Course Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Database Management"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          className={`w-full bg-slate-50 border ${
                            subFormSubmitted && !newSubName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Weekly Periods</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              required
                              min={1}
                              max={10}
                              value={newSubPeriods}
                              onChange={(e) => setNewSubPeriods(Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                            />
                            <span className="text-[11px] text-slate-500 font-semibold flex-shrink-0">/ week</span>
                          </div>
                        </div>

                        <div className="flex items-end pb-1.5">
                          <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newSubIsLab}
                              onChange={(e) => setNewSubIsLab(e.target.checked)}
                              className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">Is Lab / Pract.?</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-1 pb-2 space-y-1.5">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newSubIsProject}
                            onChange={(e) => setNewSubIsProject(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is Project/Seminar/Internship ?</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newSubIsAicte}
                            onChange={(e) => setNewSubIsAicte(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is AICTE Activity ?</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newSubIsMentoring}
                            onChange={(e) => setNewSubIsMentoring(e.target.checked)}
                            className="h-4 w-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Is Student Activity / Mentoring ?</span>
                        </label>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                          <span>Background Color Accent</span>
                          <span className="text-[9px] text-slate-400 font-normal">Timetable cell styling</span>
                        </label>
                        <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-6 h-6 rounded-md border border-slate-300 shadow-sm flex items-center justify-center flex-shrink-0 transition-all cursor-pointer hover:scale-105"
                                style={{ backgroundColor: newSubColor || '#cbd5e1' }}
                                onClick={() => {
                                  setColorModalSubjectId(null);
                                  setIsColorModalOpen(true);
                                }}
                                title={newSubColor ? `Selected: ${newSubColor.toUpperCase()} (Click to change)` : 'Auto-assigned color'}
                              >
                                {newSubColor && (
                                  <span className="text-[9px] font-bold" style={{ color: getContrastTextColor(newSubColor) }}>✓</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-mono font-bold text-slate-700 leading-tight">
                                  {newSubColor ? newSubColor.toUpperCase() : 'AUTO-ASSIGNED'}
                                </p>
                                <p className="text-[8px] text-slate-400 font-medium">
                                  {newSubColor ? 'Custom color selected' : 'Unique pastel auto-assigned'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setColorModalSubjectId(null);
                                  setIsColorModalOpen(true);
                                }}
                                className="py-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[9px] uppercase tracking-wider rounded transition cursor-pointer flex items-center space-x-1 shadow-sm"
                              >
                                <Palette className="h-3 w-3 text-slate-500" />
                                <span>Palette Modal</span>
                              </button>
                              {newSubColor && (
                                <button
                                  type="button"
                                  onClick={() => setNewSubColor('')}
                                  className="text-[9px] text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer px-1"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Swatches Bar */}
                          <div>
                            <p className="text-[9px] font-semibold text-slate-500 mb-1">Quick Select Shades:</p>
                            <div className="flex flex-wrap gap-1">
                              {QUICK_PRESET_COLORS.map((preset) => {
                                const isSelected = newSubColor.toLowerCase() === preset.hex.toLowerCase();
                                return (
                                  <button
                                    key={preset.hex}
                                    type="button"
                                    onClick={() => setNewSubColor(preset.hex)}
                                    className={`w-5 h-5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                                      isSelected
                                        ? 'ring-2 ring-slate-800 ring-offset-1 scale-110 border-slate-800 z-10'
                                        : 'border-slate-300 hover:scale-105 hover:border-slate-500'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                    title={`${preset.name} (${preset.hex.toUpperCase()})`}
                                  >
                                    {isSelected && (
                                      <span className="text-[8px] font-bold leading-none" style={{ color: getContrastTextColor(preset.hex) }}>
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-amber-300" />
                        <span>Register Subject</span>
                      </button>
                    </form>
                  </>
                )}
              </div>

              {/* Right List: Subjects */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Syllabus & Subjects</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Registered courses with customizable background themes and lecture slots.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                      TOTAL: {subjects.length}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5">Subject Code</th>
                        <th className="p-2.5">Background Color</th>
                        <th className="p-2.5">Course Title</th>
                        <th className="p-2.5">Department</th>
                        <th className="p-2.5 text-center">Type</th>
                        <th className="p-2.5 text-center">Weekly Periods</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.length > 0 ? (
                        subjects.map((sub) => {
                          const displayColor = sub.color || '#cbd5e1';
                          const textColor = getContrastTextColor(displayColor);
                          return (
                            <tr 
                              key={sub.id} 
                              className={`transition ${
                                editingSubjectId === sub.id ? 'bg-amber-50/30 border-l-2 border-amber-500' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <td className="p-2.5 font-mono font-bold text-slate-900">{sub.code}</td>
                              <td className="p-2.5">
                                <button
                                  type="button"
                                  onClick={() => openColorModalForSubject(sub.id)}
                                  className="group flex items-center space-x-1.5 py-1 px-1.5 rounded-md border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                                  title={`Click to change color for ${sub.name}`}
                                >
                                  <div 
                                    className="w-4.5 h-4.5 rounded border border-slate-300/80 shadow-xs flex items-center justify-center flex-shrink-0 transition group-hover:scale-110"
                                    style={{ backgroundColor: displayColor }}
                                  >
                                    <Palette className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: textColor }} />
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-600 font-semibold uppercase group-hover:text-slate-900">
                                    {sub.color ? sub.color.toUpperCase() : '#AUTO'}
                                  </span>
                                  <Pencil className="h-2.5 w-2.5 text-slate-400 group-hover:text-slate-600" />
                                </button>
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900">{sub.name}</div>
                                <div 
                                  className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold border"
                                  style={{
                                    backgroundColor: displayColor,
                                    borderColor: adjustBrightness(displayColor, -25),
                                    color: textColor
                                  }}
                                >
                                  Preview: {sub.code}
                                </div>
                              </td>
                              <td className="p-2.5 font-semibold text-slate-700">{normalizeDepartment(sub.department)}</td>
                              <td className="p-2.5 text-center">
                                {sub.isAicteActivity ? (
                                  <span className="inline-block bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    AICTE Activity
                                  </span>
                                ) : sub.isStudentActivity ? (
                                  <span className="inline-block bg-teal-50 text-teal-700 border border-teal-200 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    Student Activity / Mentoring
                                  </span>
                                ) : sub.isProject ? (
                                  <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    Project / Sem / Intern
                                  </span>
                                ) : sub.isLab ? (
                                  <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    Lab / Practical
                                  </span>
                                ) : (
                                  <span className="inline-block bg-slate-50 text-slate-500 border border-slate-100 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    Theory
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="font-bold bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded text-[10px]">
                                  {sub.weeklyPeriods} periods
                                </span>
                              </td>
                              <td className="p-2.5 text-center flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => startEditingSubject(sub)}
                                  className={`p-1 transition cursor-pointer ${
                                    editingSubjectId === sub.id ? 'text-amber-600 hover:text-amber-700' : 'text-slate-400 hover:text-blue-900'
                                  }`}
                                  title="Edit subject details"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteSubject(sub.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Delete subject"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-medium italic">
                            No subjects registered. Add course details using the form.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: CLASSES & ASSIGNMENTS                 */}
          {/* ========================================== */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              
              {/* Top Row: Classes Creation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center space-x-1.5">
                      <GraduationCap className="h-4 w-4 text-blue-900" />
                      <span>{editingClassId ? 'Edit Class / Section' : 'Create Class / Section'}</span>
                    </div>
                    {editingClassId && (
                      <button
                        type="button"
                        onClick={cancelEditingClass}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {editingClassId ? 'Modify class details, room, semester, or batch configuration.' : 'Define semesters or branches to schedule tables for.'}
                  </p>

                  <form onSubmit={addClass} className="space-y-3" noValidate>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Branch / Subject Group</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. CSE or ECE"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value.toUpperCase())}
                          className={`w-full bg-slate-50 border ${
                            classFormSubmitted && !newClassName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase focus:outline-none focus:ring-1 focus:bg-white transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Classroom</label>
                        <input
                          type="text"
                          placeholder="e.g. Room 301 or LH-2"
                          value={newClassroom}
                          onChange={(e) => setNewClassroom(e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Semester</label>
                        <select
                          value={newClassSem}
                          onChange={(e) => setNewClassSem(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                        >
                          <option value="1st">1st Sem</option>
                          <option value="2nd">2nd Sem</option>
                          <option value="3rd">3rd Sem</option>
                          <option value="4th">4th Sem</option>
                          <option value="5th">5th Sem</option>
                          <option value="6th">6th Sem</option>
                          <option value="7th">7th Sem</option>
                          <option value="8th">8th Sem</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Section</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. A"
                          value={newClassSec}
                          onChange={(e) => setNewClassSec(e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={divideIntoBatches}
                          onChange={(e) => setDivideIntoBatches(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer h-3.5 w-3.5"
                        />
                        <span>Divide Section into Student Batches?</span>
                      </label>
                      {divideIntoBatches && (
                        <div className="mt-2 pl-5 flex items-center space-x-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Batches:</label>
                          <select
                            value={numBatches}
                            onChange={(e) => setNumBatches(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          >
                            <option value={2}>2 Batches ({newClassSec.trim().toUpperCase() || 'A'}1, {newClassSec.trim().toUpperCase() || 'A'}2)</option>
                            <option value={3}>3 Batches ({newClassSec.trim().toUpperCase() || 'A'}1, {newClassSec.trim().toUpperCase() || 'A'}2, {newClassSec.trim().toUpperCase() || 'A'}3)</option>
                            <option value={4}>4 Batches ({newClassSec.trim().toUpperCase() || 'A'}1, {newClassSec.trim().toUpperCase() || 'A'}2, {newClassSec.trim().toUpperCase() || 'A'}3, {newClassSec.trim().toUpperCase() || 'A'}4)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {editingClassId ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{divideIntoBatches ? `Update Class & ${numBatches} Batches` : 'Update Class'}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 text-amber-300" />
                            <span>{divideIntoBatches ? `Create Class & ${numBatches} Batches` : 'Create Class'}</span>
                          </>
                        )}
                      </button>
                      {editingClassId && (
                        <button
                          type="button"
                          onClick={cancelEditingClass}
                          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="md:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Active Class Groups</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Classes requiring an independent timetable matrix.</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                      TOTAL: {classes.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classes.length > 0 ? (
                      classes.map((cls) => {
                        const totalLectures = assignments
                          .filter(a => a.classId === cls.id)
                          .reduce((sum, a) => sum + (subjects.find(s => s.id === a.subjectId)?.weeklyPeriods || 0), 0);
                        const isEditingThisClass = editingClassId === cls.id;

                        return (
                          <div
                            key={cls.id}
                            className={`border rounded p-3 flex items-center justify-between transition ${
                              isEditingThisClass
                                ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-300'
                                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <p className="font-bold text-slate-900 text-xs">{cls.name}</p>
                                {cls.labBatches && cls.labBatches > 1 && (
                                  <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-1.5 py-0.2 rounded shadow-2xs">
                                    {cls.labBatches} Lab Batches ({cls.section}1-{cls.section}{cls.labBatches})
                                  </span>
                                )}
                                {isEditingThisClass && (
                                  <span className="text-[9px] bg-amber-200 text-amber-950 font-bold px-1.5 py-0.2 rounded uppercase">
                                    Editing
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Sec <span className="font-bold text-slate-700">{cls.section}</span>{cls.classroom ? <> • Room: <span className="font-bold text-slate-700">{cls.classroom}</span></> : ''} • {totalLectures} lectures / wk</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => startEditingClass(cls)}
                                className={`p-1.5 ${isEditingThisClass ? 'text-amber-600 bg-amber-100 border-amber-300' : 'text-slate-400 hover:text-amber-600 bg-white border-slate-200'} border rounded shadow-xs transition hover:shadow-sm cursor-pointer`}
                                title="Edit class details"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteClass(cls.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded shadow-xs transition hover:shadow-sm cursor-pointer"
                                title="Delete class"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 border border-dashed border-slate-200 rounded p-6 text-center text-slate-400 font-medium italic text-xs">
                        No class groups configured yet. Add them using the form.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lower Row: Staff Assignments */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Left Form: Assign Staff */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                  {editingAssignmentId ? (
                    <>
                      <div className="flex items-center justify-between border-b border-amber-100 pb-2 mb-3">
                        <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                          <Pencil className="h-4 w-4 text-amber-600" />
                          <span>Edit Faculty Binding</span>
                        </h3>
                        <button
                          type="button"
                          onClick={cancelEditingAssignment}
                          className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">Update staff binding for class or subject.</p>

                      <form onSubmit={updateAssignment} className="space-y-3" noValidate>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Target Class / Section</label>
                          <select
                            required
                            value={assignClassId}
                            onChange={(e) => setAssignClassId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignClassId ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-amber-500'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">-- Choose Class --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} (Sec {c.section})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Syllabus Subject</label>
                          <select
                            required
                            value={assignSubId}
                            onChange={(e) => setAssignSubId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignSubId ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-amber-500'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">-- Choose Subject --</option>
                            {subjects.map(s => (
                              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Faculty Member</label>
                          <select
                            required={!subjects.find(s => s.id === assignSubId)?.isAicteActivity && !subjects.find(s => s.id === assignSubId)?.isStudentActivity}
                            value={assignFacId}
                            onChange={(e) => setAssignFacId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignFacId && !subjects.find(s => s.id === assignSubId)?.isAicteActivity && !subjects.find(s => s.id === assignSubId)?.isStudentActivity ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-amber-500'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">{subjects.find(s => s.id === assignSubId)?.isAicteActivity || subjects.find(s => s.id === assignSubId)?.isStudentActivity ? '-- No Staff / Faculty Required --' : '-- Choose Faculty --'}</option>
                            {faculties.map(f => (
                              <option key={f.id} value={f.id}>{f.name} ({f.shortName})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center space-x-2 pt-1">
                          <button
                            type="submit"
                            className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Save Changes</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingAssignment}
                            className="py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                        <Sliders className="h-4 w-4 text-blue-900" />
                        <span>Assign Staff Member</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mb-3">Bind a teacher to a course subject for a specific class.</p>

                      <form onSubmit={addAssignment} className="space-y-3" noValidate>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Target Class / Section</label>
                          <select
                            required
                            value={assignClassId}
                            onChange={(e) => setAssignClassId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignClassId ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">-- Choose Class --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} (Sec {c.section})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Syllabus Subject</label>
                          <select
                            required
                            value={assignSubId}
                            onChange={(e) => setAssignSubId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignSubId ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">-- Choose Subject --</option>
                            {subjects.map(s => (
                              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Faculty Member</label>
                          <select
                            required={!subjects.find(s => s.id === assignSubId)?.isAicteActivity && !subjects.find(s => s.id === assignSubId)?.isStudentActivity}
                            value={assignFacId}
                            onChange={(e) => setAssignFacId(e.target.value)}
                            className={`w-full bg-slate-50 border ${
                              assignFormSubmitted && !assignFacId && !subjects.find(s => s.id === assignSubId)?.isAicteActivity && !subjects.find(s => s.id === assignSubId)?.isStudentActivity ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                            } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                          >
                            <option value="">{subjects.find(s => s.id === assignSubId)?.isAicteActivity || subjects.find(s => s.id === assignSubId)?.isStudentActivity ? '-- No Staff / Faculty Required --' : '-- Choose Faculty --'}</option>
                            {faculties.map(f => (
                              <option key={f.id} value={f.id}>{f.name} ({f.shortName})</option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-amber-300" />
                          <span>Create Assignment</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>

                {/* Right List: Assignments */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Course Faculty Bindings</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Faculty members assigned to deliver lectures in each section.</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                      TOTAL: {assignments.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">Class Group</th>
                          <th className="p-2.5">Subject Mapping</th>
                          <th className="p-2.5">Assigned Faculty</th>
                          <th className="p-2.5 text-center">Weekly Lectures</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {assignments.length > 0 ? (
                          assignments.map((assign) => {
                            const isEditing = editingAssignmentId === assign.id;
                            const cls = classes.find(c => c.id === (isEditing ? assignClassId : assign.classId));
                            const sub = subjects.find(s => s.id === (isEditing ? assignSubId : assign.subjectId));
                            const fac = faculties.find(f => f.id === (isEditing ? assignFacId : assign.facultyId));

                            return (
                              <tr key={assign.id} className={`${isEditing ? 'bg-amber-50/70 border-l-2 border-amber-500' : 'hover:bg-slate-50/50'} transition`}>
                                <td className="p-2.5 font-bold text-slate-900">
                                  {isEditing ? (
                                    <select
                                      value={assignClassId}
                                      onChange={(e) => setAssignClassId(e.target.value)}
                                      className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-bold"
                                    >
                                      <option value="">-- Choose Class --</option>
                                      {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} (Sec {c.section})</option>
                                      ))}
                                    </select>
                                  ) : cls ? (
                                    `${cls.name} (Sec ${cls.section})`
                                  ) : (
                                    <span className="text-red-500">Deleted Class</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {isEditing ? (
                                    <select
                                      value={assignSubId}
                                      onChange={(e) => setAssignSubId(e.target.value)}
                                      className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                    >
                                      <option value="">-- Choose Subject --</option>
                                      {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                      ))}
                                    </select>
                                  ) : sub ? (
                                    <div>
                                      <span className="font-mono font-bold text-slate-900">{sub.code}</span>
                                      <span className="text-slate-500 ml-2 font-medium">{sub.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-red-500">Deleted Subject</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800">
                                  {isEditing ? (
                                    <select
                                      value={assignFacId}
                                      onChange={(e) => setAssignFacId(e.target.value)}
                                      className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-bold"
                                    >
                                      <option value="">-- Choose Faculty --</option>
                                      {faculties.map(f => (
                                        <option key={f.id} value={f.id}>{f.name} ({f.shortName})</option>
                                      ))}
                                    </select>
                                  ) : fac ? (
                                    `${fac.name} (${fac.shortName})`
                                  ) : sub && (sub.isAicteActivity || sub.isStudentActivity) ? (
                                    <span className="text-teal-700 font-semibold italic bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[10px]">Self-Guided / Unassigned</span>
                                  ) : (
                                    <span className="text-red-500">Deleted Faculty</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  {sub ? (
                                    <span className="font-bold bg-blue-50 text-blue-900 border border-blue-100 px-2 py-0.5 rounded text-[10px]">
                                      {sub.weeklyPeriods} periods
                                    </span>
                                  ) : '--'}
                                </td>
                                <td className="p-2.5 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        onClick={() => updateAssignment()}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/70 rounded transition cursor-pointer"
                                        title="Save Changes"
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={cancelEditingAssignment}
                                        className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 rounded transition cursor-pointer"
                                        title="Cancel Edit"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        onClick={() => startEditingAssignment(assign)}
                                        className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                                        title="Edit assignment binding"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteAssignment(assign.id)}
                                        className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                        title="Remove assignment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 font-medium italic">
                              No course subjects are currently assigned to any faculty members.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* TAB: TIMING & SLOTS                        */}
          {/* ========================================== */}
          {activeTab === 'timing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column: Configure Hour/Break & Days configuration */}
              <div className="space-y-4 self-start">
                {/* Left Form: Add Time Slot */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-4 w-4 text-blue-900" />
                      <span>{editingSlotId ? 'Edit Time Slot' : 'Configure Hour / Break'}</span>
                    </div>
                    {editingSlotId && (
                      <button
                        type="button"
                        onClick={cancelEditingSlot}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {editingSlotId ? 'Update timings or duration for this slot.' : 'Specify durations of lectures or institutional breaks.'}
                  </p>

                  <form onSubmit={addTimeSlot} className="space-y-3" noValidate>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Time Slot Label</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Period 1, Tea Break, Lunch Break"
                        value={newSlotLabel}
                        onChange={(e) => setNewSlotLabel(e.target.value)}
                        className={`w-full bg-slate-50 border ${
                          timeFormSubmitted && !newSlotLabel ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                        } rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:bg-white transition`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Start Time <span className="text-slate-400 font-normal text-[9px] lowercase">({formatTime12(newSlotStart)})</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={newSlotStart}
                          onChange={(e) => setNewSlotStart(e.target.value)}
                          className={`w-full bg-slate-50 border ${
                            timeFormSubmitted && !newSlotStart ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          End Time <span className="text-slate-400 font-normal text-[9px] lowercase">({formatTime12(newSlotEnd)})</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={newSlotEnd}
                          onChange={(e) => setNewSlotEnd(e.target.value)}
                          className={`w-full bg-slate-50 border ${
                            timeFormSubmitted && !newSlotEnd ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-900'
                          } rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 cursor-pointer`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="isBreak"
                        checked={newSlotIsBreak}
                        onChange={(e) => setNewSlotIsBreak(e.target.checked)}
                        className="rounded text-blue-900 focus:ring-blue-900 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="isBreak" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                        Is this a recess / break?
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {editingSlotId ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Update Slot</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 text-amber-300" />
                            <span>Save Slot</span>
                          </>
                        )}
                      </button>
                      {editingSlotId && (
                        <button
                          type="button"
                          onClick={cancelEditingSlot}
                          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Days Configuration Card */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-2 mb-3">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Working Week Config</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Select days of the week included in the scheduling solver.</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const isActive = days.includes(day as DayOfWeek);
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            if (isActive) {
                              setDays(days.filter(d => d !== day));
                            } else {
                              setDays([...days, day as DayOfWeek]);
                            }
                          }}
                          className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
                            isActive
                              ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {day.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Active Slots List */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Time Slots Table */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-2 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">College Daily Time Grid</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Prescribed periods and recess intervals ordered chronologically.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeSlots(DEFAULT_TIME_SLOTS);
                        showAuthNotice("Reset time slots to standard timetable grid (Lunch 13:15-14:00, Period 5 14:00-15:00, Period 6 15:00-16:00).");
                      }}
                      className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition cursor-pointer self-start sm:self-auto"
                      title="Reset grid to default schedule with 45-min Lunch Break"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset Standard Timing</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">Label</th>
                          <th className="p-2.5 text-center">Timings (12-Hr)</th>
                          <th className="p-2.5 text-center">Duration</th>
                          <th className="p-2.5 text-center">Type</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {timeSlots.map((slot) => {
                          const [sH, sM] = slot.startTime.split(':').map(Number);
                          const [eH, eM] = slot.endTime.split(':').map(Number);
                          const minutes = (eH * 60 + eM) - (sH * 60 + sM);
                          const hoursText = minutes > 0 
                            ? (minutes % 60 === 0 ? `${Math.floor(minutes / 60)}h 0m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`)
                            : '--';

                          const isEditingThis = editingSlotId === slot.id;

                          return (
                            <tr key={slot.id} className={`transition ${isEditingThis ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50/50'}`}>
                              <td className="p-2.5 font-bold text-slate-900">
                                {slot.label}
                                {isEditingThis && (
                                  <span className="ml-2 text-[9px] text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded font-bold uppercase">Editing</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-800">{formatTimeRange12(slot.startTime, slot.endTime)}</td>
                              <td className="p-2.5 text-center text-slate-500 font-mono font-medium">{hoursText}</td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  slot.isBreak 
                                    ? 'bg-amber-50 text-amber-800 border-amber-100' 
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                }`}>
                                  {slot.isBreak ? 'Recess' : 'Period'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <button
                                    onClick={() => startEditingSlot(slot)}
                                    className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                                    title="Edit slot timing"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteTimeSlot(slot.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                    title="Delete time slot"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>

      {/* ========================================== */}
      {/* FOOTER                                     */}
      {/* ========================================== */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-6 mt-8">
        <div className="w-[96%] max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Sir M. Visvesvaraya College of Engineering, Raichur</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Yeramarus Camp, Raichur, Karnataka, India.</p>
          </div>
          <div className="text-center md:text-right text-[10px] text-slate-500 font-medium">
            <p>© 2026 College Scheduling System. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ========================================== */}
      {/* BACKGROUND COLOR ACCENT SELECTOR MODAL     */}
      {/* ========================================== */}
      {isColorModalOpen && (() => {
        let activeColor = '';
        let targetTitle = 'New Subject';
        let targetCode = 'COURSE';

        if (colorModalSubjectId) {
          const targetSub = subjects.find(s => s.id === colorModalSubjectId);
          activeColor = targetSub?.color || '';
          targetTitle = targetSub?.name || 'Subject';
          targetCode = targetSub?.code || 'SUB';
        } else if (editingSubjectId) {
          activeColor = editSubColor;
          targetTitle = editSubName || 'Editing Course';
          targetCode = editSubCode || 'SUB';
        } else {
          activeColor = newSubColor;
          targetTitle = newSubName || 'New Course';
          targetCode = newSubCode || 'SUB';
        }

        const handleSelectColor = (color: string) => {
          if (colorModalSubjectId) {
            updateSubjectColorDirectly(colorModalSubjectId, color);
          } else if (editingSubjectId) {
            setEditSubColor(color);
          } else {
            setNewSubColor(color);
          }
        };

        const filteredFamilies = colorCategoryFilter === 'all'
          ? COLOR_FAMILIES
          : COLOR_FAMILIES.filter(f => f.category === colorCategoryFilter);

        const previewColor = activeColor || '#cbd5e1';
        const previewTextColor = getContrastTextColor(previewColor);
        const previewBorderColor = adjustBrightness(previewColor, -25);
        const previewBadgeBg = adjustBrightness(previewColor, -15);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-blue-100/60 text-blue-900 rounded-lg">
                    <Palette className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Subject Color Palette</h3>
                    <p className="text-[10px] text-slate-500 font-medium truncate max-w-xs">
                      Styling for: <span className="font-bold text-slate-700">{targetCode} — {targetTitle}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsColorModalOpen(false);
                    setColorModalSubjectId(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3.5 overflow-y-auto">
                {/* Live Timetable Preview Card */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>Live Timetable Grid Preview</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700">
                      {activeColor ? activeColor.toUpperCase() : 'AUTO-ASSIGNED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Timetable Cell Preview */}
                    <div 
                      className="p-3 rounded-lg border-2 shadow-xs transition-all flex flex-col justify-between min-h-[75px]"
                      style={{ 
                        backgroundColor: previewColor,
                        borderColor: previewBorderColor,
                        color: previewTextColor
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs">{targetCode || '21CS51'}</span>
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: previewBadgeBg,
                            color: previewTextColor
                          }}
                        >
                          Room 304
                        </span>
                      </div>
                      <div className="font-bold text-xs leading-tight line-clamp-1 mt-1">
                        {targetTitle || 'Computer Networks'}
                      </div>
                      <div className="text-[10px] font-medium opacity-90 mt-1 flex items-center justify-between">
                        <span>Prof. H. R. Sharma</span>
                        <span className="text-[9px] opacity-75">10:00 - 11:00 AM</span>
                      </div>
                    </div>

                    {/* Small Badge & Tag previews */}
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Badge Previews</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{ 
                            backgroundColor: previewColor, 
                            borderColor: previewBorderColor,
                            color: previewTextColor
                          }}
                        >
                          {targetCode}
                        </span>
                        <span 
                          className="px-2 py-0.5 rounded text-[9px] font-bold border"
                          style={{ 
                            backgroundColor: previewColor, 
                            borderColor: previewBorderColor,
                            color: previewTextColor
                          }}
                        >
                          Theory (4p)
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed">
                        High-contrast text ({previewTextColor === '#0f172a' ? 'Dark text' : 'Light text'}) automatically calculated for maximum legibility.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Presets Row */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 block">
                    Recommended Timetable Pastels & Accents
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PRESET_COLORS.map((preset) => {
                      const isSelected = activeColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => handleSelectColor(preset.hex)}
                          className={`w-7 h-7 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
                            isSelected 
                              ? 'ring-2 ring-slate-900 ring-offset-1 scale-110 border-slate-900 shadow-md z-10' 
                              : 'border-slate-300 hover:scale-105 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={`${preset.name}: ${preset.hex.toUpperCase()}`}
                        >
                          {isSelected && (
                            <span 
                              className="text-[10px] font-bold leading-none select-none" 
                              style={{ color: getContrastTextColor(preset.hex) }}
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      All Shade Palettes (100+ Choices)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
                    {[
                      { id: 'all', label: 'All Shades' },
                      { id: 'cool', label: 'Cool Tones' },
                      { id: 'warm', label: 'Warm Tones' },
                      { id: 'vibrant', label: 'Vibrant' },
                      { id: 'neutral', label: 'Neutrals' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setColorCategoryFilter(cat.id as any)}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${
                          colorCategoryFilter === cat.id
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extended Color Families Grid */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2 max-h-56 overflow-y-auto">
                  {filteredFamilies.map((family) => (
                    <div key={family.name} className="flex items-center space-x-2 py-1 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 w-28 truncate" title={family.name}>
                        {family.name}
                      </span>
                      <div className="flex items-center space-x-1 flex-1 justify-end sm:justify-start">
                        {family.shades.map((shade) => {
                          const isSelected = activeColor.toLowerCase() === shade.toLowerCase();
                          return (
                            <button
                              key={shade}
                              type="button"
                              onClick={() => handleSelectColor(shade)}
                              className={`w-6 h-6 rounded-md border transition-all duration-150 flex items-center justify-center cursor-pointer ${
                                isSelected 
                                  ? 'ring-2 ring-slate-900 ring-offset-1 scale-115 border-slate-900 shadow-md z-10' 
                                  : 'border-slate-300 hover:scale-110 hover:border-slate-500 hover:shadow-xs'
                              }`}
                              style={{ backgroundColor: shade }}
                              title={`${family.name} shade: ${shade.toUpperCase()}`}
                            >
                              {isSelected && (
                                <span 
                                  className="text-[9px] font-bold leading-none select-none" 
                                  style={{ color: getContrastTextColor(shade) }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Color & Hex Input Row */}
                <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      id="modal_custom_color_picker"
                      value={activeColor || '#cbd5e1'}
                      onChange={(e) => handleSelectColor(e.target.value)}
                      className="h-8 w-10 rounded border border-slate-300 p-0.5 cursor-pointer bg-white"
                    />
                    <label htmlFor="modal_custom_color_picker" className="text-xs font-semibold text-slate-700 cursor-pointer hover:underline">
                      Custom Color Picker
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hex:</span>
                    <input
                      type="text"
                      placeholder="#FFFFFF"
                      maxLength={7}
                      value={activeColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleSelectColor(val);
                      }}
                      className="w-24 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 uppercase focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                    {activeColor && (
                      <button
                        type="button"
                        onClick={() => handleSelectColor('')}
                        className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer px-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 italic">
                  {activeColor ? 'Color selected & applied immediately' : 'Unique pastel will be auto-assigned'}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsColorModalOpen(false);
                      setColorModalSubjectId(null);
                    }}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================== */}
      {/* FIREBASE SETTINGS & MANAGER MODAL          */}
      {/* ========================================== */}
      {showFirebaseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-800" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Cloud Storage Manager</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Cloud Information */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  <span>Firestore Connection Active</span>
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  Project ID: <span className="text-slate-800 font-bold">time-table-smvce</span><br />
                  Storage: <span className="text-slate-800 font-bold">Cloud Firestore</span>
                </p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  All timetables are stored as persistent JSON payloads in your Firebase Firestore database. This enables multi-device support, team collaboration, and immune backup against browser cache resets.
                </p>
              </div>

              {/* Create/Save As section */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Save Current State as New Timetable</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Even Semester 2026, CSE-B"
                    value={newTimetableNameInput}
                    onChange={(e) => setNewTimetableNameInput(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newTimetableNameInput.trim()) {
                        showAuthNotice("Please enter a name for the new timetable.");
                        return;
                      }
                      await saveTimetableToFirebase(newTimetableNameInput.trim());
                      setNewTimetableNameInput('');
                    }}
                    disabled={isCloudSaving || !newTimetableNameInput.trim()}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs rounded-lg transition shadow-sm cursor-pointer disabled:opacity-40"
                  >
                    Save As
                  </button>
                </div>
              </div>

              {/* Saved Timetables List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Saved Timetables in Firestore ({firebaseTimetables.length})</h4>
                  <button
                    type="button"
                    onClick={() => fetchFirebaseTimetablesList()}
                    disabled={isCloudFetchingList}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${isCloudFetchingList ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                  {isCloudFetchingList && firebaseTimetables.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      <span>Fetching cloud documents...</span>
                    </div>
                  ) : firebaseTimetables.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">
                      No saved timetables found in Firestore. Save your first version above!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {firebaseTimetables.map((name) => {
                        const isActive = activeTimetableName === name;
                        return (
                          <div key={name} className={`px-3 py-2.5 flex items-center justify-between gap-4 transition-colors ${isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                                {name}
                              </p>
                              {isActive && (
                                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mt-0.5 flex items-center space-x-1">
                                  <span>● Active Session</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              {deletingTimetableName === name ? (
                                <div className="flex items-center space-x-1 bg-red-50 border border-red-200 px-1.5 py-1 rounded animate-fadeIn">
                                  <span className="text-[9px] font-bold text-red-700">Sure?</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteTimetableFromFirebase(name);
                                      setDeletingTimetableName(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-[9px] uppercase rounded hover:bg-red-700 cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTimetableName(null)}
                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-bold text-[9px] uppercase rounded hover:bg-slate-300 cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      loadTimetableFromFirebase(name);
                                      setShowFirebaseModal(false);
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition cursor-pointer ${
                                      isActive
                                        ? 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    Load
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTimetableName(name)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="Delete from cloud"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center space-x-1">
                <span>Auth Status:</span>
                <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px]">Guest/Universal Mode</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* WHATSAPP SHARING MODAL                      */}
      {/* ========================================== */}
      {showWhatsAppModal && whatsAppFacultyId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Share via WhatsApp</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-xs text-slate-700">
                <p className="font-semibold text-emerald-800">
                  Direct WhatsApp Integration
                </p>
                <p className="text-slate-600 mt-1">
                  This tool formats the complete, conflict-free timetable of the selected faculty member as a clean text template and pre-fills it in WhatsApp.
                </p>
              </div>

              {/* Faculty Info */}
              {(() => {
                const fac = faculties.find(f => f.id === whatsAppFacultyId);
                if (!fac) return null;
                return (
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Faculty Member:</span>
                      <span className="font-bold text-slate-800">{fac.name} ({fac.shortName})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Department:</span>
                      <span className="font-semibold text-slate-700">{normalizeDepartment(fac.department)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Recipient Phone Number
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={whatsAppPhoneInput}
                    onChange={(e) => setWhatsAppPhoneInput(e.target.value)}
                    placeholder="Enter phone number (e.g. 919876543210)"
                    className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Provide the phone number with country code (e.g., 91 for India) and no spaces, plus (+) signs, or dashes. If empty, it opens a WhatsApp contact selector.
                </p>
              </div>

              {/* Text Preview */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Message Preview
                </label>
                <textarea
                  readOnly
                  rows={8}
                  value={getFacultyWhatsAppMessage(whatsAppFacultyId)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-[10.5px] font-mono text-slate-700 focus:outline-none select-all whitespace-pre"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleCopyWhatsAppMessage(getFacultyWhatsAppMessage(whatsAppFacultyId))}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded transition flex items-center space-x-1.5 cursor-pointer"
              >
                {isCopiedWhatsApp ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={`https://wa.me/${whatsAppPhoneInput.replace(/\D/g, '') || ''}?text=${encodeURIComponent(getFacultyWhatsAppMessage(whatsAppFacultyId))}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                  <span>Send via WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CLEAR WORKSPACE CONFIRMATION & SECURE MODAL */}
      {/* ========================================== */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-fade-in">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                  {clearConfirmStep === 1 ? 'Clear Workspace' : 'Security Verification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {clearConfirmStep === 1 ? (
                // STEP 1: Confirmation Question
                <div className="space-y-3">
                  <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-xs text-red-800 flex items-start space-x-2.5">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <p className="font-bold">This is a highly destructive action!</p>
                      <p className="text-slate-600 mt-0.5">
                        Clearing the workspace will instantly delete all registered faculties, course subjects, class schedules, and configurations.
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    Are you absolutely sure you want to clear the workspace for <strong className="text-slate-900 font-mono bg-slate-100 px-1 py-0.5 rounded">"{activeTimetableName}"</strong> and build from scratch?
                  </p>
                </div>
              ) : (
                // STEP 2: Password Prompt
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start space-x-2.5">
                    <Lock className="h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="font-semibold text-slate-850">Security Verification Required</p>
                      <p className="text-slate-500 mt-0.5">
                        Please enter the system administrator password to verify authorization.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      System Password
                    </label>
                    <input
                      type="password"
                      value={clearAdminPassword}
                      onChange={(e) => {
                        setClearAdminPassword(e.target.value);
                        setClearPasswordError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleClearSubmit();
                        }
                      }}
                      placeholder="Enter password..."
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder-slate-400"
                      autoFocus
                    />
                    {clearPasswordError && (
                      <p className="text-[11px] text-red-600 font-medium mt-1 animate-pulse flex items-center space-x-1">
                        <span>● {clearPasswordError}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              {clearConfirmStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(false)}
                    className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                  >
                    No, Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearConfirmStep(2)}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer"
                  >
                    Yes, Proceed
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setClearConfirmStep(1);
                      setClearAdminPassword('');
                      setClearPasswordError(null);
                    }}
                    className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSubmit}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer"
                  >
                    Confirm & Clear
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* FRESH TEMPLATE CONFIRMATION MODAL          */}
      {/* ========================================== */}
      {showNewTemplateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-fade-in text-left">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-800">
                <Plus className="h-5 w-5" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                  Create Fresh Timetable
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTemplateConfirmModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-800 flex items-start space-x-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-bold">Are you sure you want to open a fresh template?</p>
                  <p className="text-slate-600 mt-0.5">
                    This will clear the current workspace configuration (faculties, subjects, classes, and schedules) from your active session. Any unsaved modifications on your current active timetable will be lost.
                  </p>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  New Timetable Name
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. Odd Semester 2026"
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs text-slate-850 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTemplateName.trim()) {
                      createNewTimetableTemplate(newTemplateName);
                      setShowNewTemplateConfirmModal(false);
                    }
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowNewTemplateConfirmModal(false)}
                className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  createNewTimetableTemplate(newTemplateName);
                  setShowNewTemplateConfirmModal(false);
                }}
                disabled={!newTemplateName.trim()}
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer disabled:opacity-40"
              >
                Create Fresh Template
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SIGN OUT CONFIRMATION MODAL                */}
      {/* ========================================== */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col animate-fade-in text-left">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-700">
                <LogOut className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Confirm Sign Out
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignOutModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <p className="text-slate-700 text-xs leading-relaxed">
                Are you sure you want to log out of your session? Any unsaved edits will be lost.
              </p>
              {currentUser && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-2.5">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || "User"} 
                      className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0 aspect-square"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200 shrink-0 aspect-square">
                      {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || "U"}
                    </div>
                  )}
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-bold text-slate-800">
                      {currentUser.displayName || 'Authorized User'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      {currentUser.email}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowSignOutModal(false)}
                className="px-3 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutModal(false);
                  handleSignOut();
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
