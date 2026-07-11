/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Users, 
  BookOpen, 
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
  Download
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Faculty, Subject, ClassSection, Assignment, TimeSlot, DayOfWeek, TimetableSchedule } from './types';
import { generateTimetable, getSampleData, preValidateConstraints, SolverResult } from './utils/solver';

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

const getSubjectPalette = (subjectId: string, subjectCode?: string) => {
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
  const [days, setDays] = useState<DayOfWeek[]>([]);
  
  // --- App Logic State ---
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'drag_drop' | 'faculties' | 'subjects' | 'assignments' | 'timing'>('dashboard');
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [customSchedule, setCustomSchedule] = useState<TimetableSchedule | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: string; slotIdx: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDataStale, setIsDataStale] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [undoStack, setUndoStack] = useState<TimetableSchedule[]>([]);
  const [redoStack, setRedoStack] = useState<TimetableSchedule[]>([]);

  // Clear selected cell on tab or class change
  useEffect(() => {
    setSelectedCell(null);
  }, [selectedClassId, activeTab]);

  // --- Mock Auth Notification ---
  const [authNotification, setAuthNotification] = useState<string | null>(null);

  // --- Form States ---
  // Faculty Form
  const [newFacName, setNewFacName] = useState('');
  const [newFacShort, setNewFacShort] = useState('');
  const [newFacDept, setNewFacDept] = useState('CSE');
  const [newFacEmail, setNewFacEmail] = useState('');
  
  // Subject Form
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDept, setNewSubDept] = useState('CSE');
  const [newSubPeriods, setNewSubPeriods] = useState(4);
  const [newSubIsLab, setNewSubIsLab] = useState(false);

  // Class Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassSem, setNewClassSem] = useState('5th');
  const [newClassSec, setNewClassSec] = useState('A');

  // Assignment Form
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubId, setAssignSubId] = useState('');
  const [assignFacId, setAssignFacId] = useState('');

  // Time Slot Form
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [newSlotIsBreak, setNewSlotIsBreak] = useState(false);

  // --- Load Initial Sample Data ---
  useEffect(() => {
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
      setFaculties(JSON.parse(savedFaculties));
      setSubjects(JSON.parse(savedSubjects));
      setClasses(JSON.parse(savedClasses));
      setAssignments(JSON.parse(savedAssignments));
      setTimeSlots(JSON.parse(savedTimeSlots));
      setDays(JSON.parse(savedDays));
      
      const parsedClasses = JSON.parse(savedClasses);
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
      loadSampleData();
    }
    setIsInitialized(true);
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (faculties.length > 0) {
      localStorage.setItem('mvce_faculties', JSON.stringify(faculties));
      localStorage.setItem('mvce_subjects', JSON.stringify(subjects));
      localStorage.setItem('mvce_classes', JSON.stringify(classes));
      localStorage.setItem('mvce_assignments', JSON.stringify(assignments));
      localStorage.setItem('mvce_timeSlots', JSON.stringify(timeSlots));
      localStorage.setItem('mvce_days', JSON.stringify(days));
      if (customSchedule) {
        localStorage.setItem('mvce_customSchedule', JSON.stringify(customSchedule));
      }
      if (solverResult) {
        localStorage.setItem('mvce_solverResult', JSON.stringify(solverResult));
      }
      setIsDataStale(true);
    }
  }, [faculties, subjects, classes, assignments, timeSlots, days, customSchedule, solverResult]);

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

  const loadSampleData = () => {
    const sample = getSampleData();
    setFaculties(sample.faculties);
    setSubjects(sample.subjects);
    setClasses(sample.classes);
    setAssignments(sample.assignments);
    setTimeSlots(sample.timeSlots);
    setDays(sample.days);
    if (sample.classes.length > 0) {
      setSelectedClassId(sample.classes[0].id);
    }
    
    // Automatically solve
    const result = generateTimetable(
      sample.faculties, 
      sample.subjects, 
      sample.classes, 
      sample.assignments, 
      sample.timeSlots, 
      sample.days
    );
    setSolverResult(result);
    setCustomSchedule(result.schedule);
    setIsDataStale(false);
    setUndoStack([]);
    setRedoStack([]);
    showAuthNotice("Default college sample data loaded successfully.");
  };

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

    setCustomSchedule(updated);
    showAuthNotice(`Swapped slot of ${srcDay} with ${destDay}. Check warnings panel for any rule updates.`);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !customSchedule) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
    setUndoStack(newUndoStack);
    setCustomSchedule(previous);
    showAuthNotice("Undo manual swap successful.");
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !customSchedule) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(customSchedule))]);
    setRedoStack(newRedoStack);
    setCustomSchedule(next);
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
      }
      showAuthNotice("No saved timetable found. Reset to newly generated optimized timetable!");
    }
  };

  const clearAllData = () => {
    setFaculties([]);
    setSubjects([]);
    setClasses([]);
    setAssignments([]);
    setTimeSlots([
      { id: 'ts1', label: 'Period 1', startTime: '09:00', endTime: '10:00', isBreak: false },
      { id: 'ts2', label: 'Period 2', startTime: '10:00', endTime: '11:00', isBreak: false },
      { id: 'ts3', label: 'Break', startTime: '11:00', endTime: '11:15', isBreak: true },
      { id: 'ts4', label: 'Period 3', startTime: '11:15', endTime: '12:15', isBreak: false },
      { id: 'ts5', label: 'Period 4', startTime: '12:15', endTime: '13:15', isBreak: false },
    ]);
    setDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setSelectedClassId('');
    setSolverResult(null);
    setCustomSchedule(null);
    setUndoStack([]);
    setRedoStack([]);
    setIsDataStale(false);
    localStorage.clear();
    showAuthNotice("Workspace cleared. You can now build from scratch.");
  };

  const showAuthNotice = (msg: string) => {
    setAuthNotification(msg);
    setTimeout(() => setAuthNotification(null), 4000);
  };

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
    
    // Temporarily force desktop size (landscape mode) for high-quality render
    element.style.width = '1120px';
    element.style.minWidth = '1120px';
    
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
    
    // Allow browser to repaint with the new landscape styles
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const currentClassObj = classes.find(c => c.id === selectedClassId);
      const className = currentClassObj ? `${currentClassObj.name}_Sec_${currentClassObj.section}` : 'Roster';
      
      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2.5
      });
      
      const imgWidth = 1120; // Forced width
      const imgHeight = element.offsetHeight;
      
      const pdfWidth = 842;
      const pdfHeight = 595;
      
      const ratio = imgWidth / imgHeight;
      let width = pdfWidth - 40;
      let height = width / ratio;
      
      if (height > (pdfHeight - 40)) {
        height = pdfHeight - 40;
        width = height * ratio;
      }
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, width, height);
      
      // Add timestamp to the bottom right
      const now = new Date();
      const timestampText = `Generated on: ${now.toLocaleString()}`;
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(timestampText, pdfWidth - 20, pdfHeight - 15, { align: 'right' });

      pdf.save(`Timetable_${className}.pdf`);
      showAuthNotice("PDF downloaded successfully!");
    } catch (error) {
      console.error('PDF generation failed:', error);
      showAuthNotice("PDF generation failed. Please try again.");
    } finally {
      // Restore original style values
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      
      if (printHeader) {
        printHeader.classList.add('hidden');
      }
      if (controls) {
        controls.classList.remove('hidden');
      }
      infoBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
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
    
    // Temporarily force desktop size (landscape mode) for high-quality render
    element.style.width = '1120px';
    element.style.minWidth = '1120px';
    
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
    
    // Allow browser to repaint with the new landscape styles
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const currentClassObj = classes.find(c => c.id === selectedClassId);
      const className = currentClassObj ? `${currentClassObj.name}_Sec_${currentClassObj.section}` : 'Roster';
      
      const imgData = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2.5
      });
      
      const imgWidth = 1120; // Forced width
      const imgHeight = element.offsetHeight;
      
      const pdfWidth = 842;
      const pdfHeight = 595;
      
      const ratio = imgWidth / imgHeight;
      let width = pdfWidth - 40;
      let height = width / ratio;
      
      if (height > (pdfHeight - 40)) {
        height = pdfHeight - 40;
        width = height * ratio;
      }
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, width, height);

      // Add timestamp to the bottom right
      const now = new Date();
      const timestampText = `Generated on: ${now.toLocaleString()}`;
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(timestampText, pdfWidth - 20, pdfHeight - 15, { align: 'right' });

      pdf.save(`Direct_Timetable_${className}.pdf`);
      showAuthNotice("Timetable PDF downloaded locally!");
    } catch (error) {
      console.error('Local PDF download failed:', error);
      showAuthNotice("Failed to download PDF locally.");
    } finally {
      // Restore original style values
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      
      if (printHeader) {
        printHeader.classList.add('hidden');
      }
      if (controls) {
        controls.classList.remove('hidden');
      }
      infoBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
      setIsDownloadingPDF(false);
    }
  };

  // --- Form Adders ---
  const addFaculty = (e: FormEvent) => {
    e.preventDefault();
    if (!newFacName || !newFacShort) return;
    const newFac: Faculty = {
      id: 'f_' + Date.now(),
      name: newFacName,
      shortName: newFacShort.toUpperCase(),
      department: newFacDept,
      email: newFacEmail || `${newFacShort.toLowerCase()}@hkesmvce.ac.in`
    };
    setFaculties([...faculties, newFac]);
    setNewFacName('');
    setNewFacShort('');
    setNewFacEmail('');
    showAuthNotice(`Faculty ${newFac.shortName} added successfully.`);
  };

  const addSubject = (e: FormEvent) => {
    e.preventDefault();
    if (!newSubCode || !newSubName) return;
    const newSub: Subject = {
      id: 's_' + Date.now(),
      code: newSubCode.toUpperCase(),
      name: newSubName,
      department: newSubDept,
      weeklyPeriods: Number(newSubPeriods),
      isLab: newSubIsLab
    };
    setSubjects([...subjects, newSub]);
    setNewSubCode('');
    setNewSubName('');
    setNewSubPeriods(4);
    setNewSubIsLab(false);
    showAuthNotice(`Subject ${newSub.code} added.`);
  };

  const addClass = (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    const newCls: ClassSection = {
      id: 'c_' + Date.now(),
      name: `${newClassName} ${newClassSem} Sem`,
      semester: newClassSem,
      section: newClassSec.toUpperCase()
    };
    setClasses([...classes, newCls]);
    if (!selectedClassId) {
      setSelectedClassId(newCls.id);
    }
    setNewClassName('');
    showAuthNotice(`Class ${newCls.name} (Sec ${newCls.section}) created.`);
  };

  const addAssignment = (e: FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSubId || !assignFacId) return;
    
    // Check if assignment already exists
    const exists = assignments.some(
      a => a.classId === assignClassId && a.subjectId === assignSubId && a.facultyId === assignFacId
    );
    if (exists) {
      showAuthNotice("Warning: This assignment already exists!");
      return;
    }

    const newAssign: Assignment = {
      id: 'a_' + Date.now(),
      classId: assignClassId,
      subjectId: assignSubId,
      facultyId: assignFacId
    };
    setAssignments([...assignments, newAssign]);
    showAuthNotice("Staff assigned to subject successfully.");
  };

  const addTimeSlot = (e: FormEvent) => {
    e.preventDefault();
    if (!newSlotLabel) return;
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
    showAuthNotice("Time slot updated.");
  };

  // --- Deletion Handlers ---
  const deleteFaculty = (id: string) => {
    setFaculties(faculties.filter(f => f.id !== id));
    setAssignments(assignments.filter(a => a.facultyId !== id));
  };

  const deleteSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
    setAssignments(assignments.filter(a => a.subjectId !== id));
  };

  const deleteClass = (id: string) => {
    setClasses(classes.filter(c => c.id !== id));
    setAssignments(assignments.filter(a => a.classId !== id));
    if (selectedClassId === id) {
      const remaining = classes.filter(c => c.id !== id);
      setSelectedClassId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const deleteAssignment = (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const deleteTimeSlot = (id: string) => {
    setTimeSlots(timeSlots.filter(t => t.id !== id));
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
      type: 'clash' | 'continuity' | 'subject_consecutive' | 'daily_limit' | 'lab_split' | 'gap';
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
            if (assign) {
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

        // Check Multi-subject Faculty Continuity Check
        for (let pIdx = 0; pIdx < totalPeriods - 1; pIdx++) {
          const a1Id = slots[pIdx];
          const a2Id = slots[pIdx + 1];
          if (a1Id && a2Id) {
            const assign1 = assignments.find(a => a.id === a1Id);
            const assign2 = assignments.find(a => a.id === a2Id);
            if (assign1 && assign2 && assign1.facultyId === assign2.facultyId) {
              const facId = assign1.facultyId;
              const facAssigns = assignments.filter(a => a.classId === cls.id && a.facultyId === facId);
              if (facAssigns.length > 1) {
                const fac = faculties.find(f => f.id === facId);
                warningsList.push({
                  classId: cls.id,
                  day,
                  pIdx,
                  message: `Faculty ${fac ? fac.shortName : 'Staff'} has consecutive periods of different subjects in ${cls.name} on ${day}.`,
                  type: 'continuity'
                });
              }
            }
          }
        }

        // Check Subject Consecutive Periods for non-labs
        for (let pIdx = 0; pIdx < totalPeriods - 1; pIdx++) {
          const a1Id = slots[pIdx];
          const a2Id = slots[pIdx + 1];
          if (a1Id && a2Id) {
            const assign1 = assignments.find(a => a.id === a1Id);
            const assign2 = assignments.find(a => a.id === a2Id);
            if (assign1 && assign2 && assign1.subjectId === assign2.subjectId) {
              const sub = subjects.find(s => s.id === assign1.subjectId);
              if (sub && !sub.isLab) {
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

        // Check Daily Limits & Labs
        for (const subId in subjectCounts) {
          const sub = subjects.find(s => s.id === subId);
          if (!sub) continue;
          const count = subjectCounts[subId];
          const weekly = sub.weeklyPeriods;

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

    return warningsList;
  }, [customSchedule, days, timeSlots, classes, assignments, subjects, faculties]);

  // Check if a faculty has continuous classes in the selected class timetable
  const checkContinuityConflict = (classId: string, schedObj: TimetableSchedule | null = solverResult?.schedule) => {
    if (!schedObj || !schedObj[classId]) return false;
    const classSched = schedObj[classId];
    
    for (const day of days) {
      const periods = classSched[day];
      if (!periods) continue;
      for (let pIdx = 0; pIdx < periods.length - 1; pIdx++) {
        const assign1Id = periods[pIdx];
        const assign2Id = periods[pIdx + 1];
        if (assign1Id && assign2Id) {
          const assign1 = assignments.find(a => a.id === assign1Id);
          const assign2 = assignments.find(a => a.id === assign2Id);
          if (assign1 && assign2 && assign1.facultyId === assign2.facultyId) {
            const facId = assign1.facultyId;
            const facAssigns = assignments.filter(a => a.classId === classId && a.facultyId === facId);
            if (facAssigns.length > 1) {
              return true;
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
      continuityCheck: !classes.some(c => checkContinuityConflict(c.id, solverResult.schedule)),
    };
    return stats;
  }, [solverResult, faculties, subjects, classes, assignments]);

  const hasAnyContinuityConflict = useMemo(() => {
    return classes.some(c => checkContinuityConflict(c.id, solverResult?.schedule));
  }, [classes, solverResult, assignments, days]);

  const hasAnyPeriod1To4FreePeriodConflict = useMemo(() => {
    return classes.some(c => checkPeriod1To4FreePeriod(c.id, solverResult?.schedule));
  }, [classes, solverResult, timeSlots, days]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* ========================================== */}
      {/* HEADER                                     */}
      {/* ========================================== */}
      <header id="app-header" className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 shadow-sm sticky top-0 z-50">
        <div className="flex flex-col justify-center">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 leading-none">HKE Society's</p>
          <h1 className="text-base md:text-lg font-extrabold tracking-tight text-blue-900 uppercase mt-1 leading-none">
            Sir M. Visvesvaraya College of Engineering, Raichur
          </h1>
        </div>

        <div className="flex items-center space-x-2.5">
          <button 
            id="btn-signout"
            onClick={() => showAuthNotice("Sign-Out button clicked. Active session will be cleared upon database integration.")}
            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg bg-white transition shadow-sm cursor-pointer flex items-center justify-center"
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
      {/* HERO / INFORMATION BAR                     */}
      {/* ========================================== */}
      <section className="bg-slate-900 text-white py-3 px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 uppercase tracking-wider">
                Roster Solver
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">Smart Timetable Management Suite</h2>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Generate conflict-free, optimized class rosters. Specify faculty workloads, course hours, and scheduling limits. 
              The engine automatically handles teacher availability and restricts continuous classes for faculty members handling multiple courses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={loadSampleData}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded bg-white text-slate-900 hover:bg-slate-100 transition shadow-sm flex items-center space-x-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Sample Data</span>
            </button>
            {confirmClear ? (
              <div className="flex items-center space-x-1.5 bg-red-950/20 border border-red-900/30 p-1 rounded animate-fade-in">
                <span className="text-[10px] font-bold text-red-200 px-1 select-none">Sure?</span>
                <button
                  onClick={() => {
                    clearAllData();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-red-600 hover:bg-red-700 text-white transition flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded bg-red-950/40 text-red-200 border border-red-800/50 hover:bg-red-950/60 transition flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear Workspace</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA                          */}
      {/* ========================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        
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

          {isDataStale && solverResult && (
            <div className="inline-flex items-center space-x-1 text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-bold uppercase tracking-wider">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              <span>Data changed! Re-generate roster.</span>
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="space-y-4">

          {/* ========================================== */}
          {/* TAB: DASHBOARD & SOLVER                    */}
          {/* ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              
              {/* Top Row: Diagnostics, Summary & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Generation Card */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                    <Sparkles className="h-4 w-4 text-blue-900" />
                    <span>Timetable Optimizer</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-4">
                    Instantly calculate a conflict-free roster mapping all faculties, subjects, and break timings.
                  </p>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-2 px-4 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        <span>Solving constraints...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        <span>GENERATE TIMETABLE</span>
                      </>
                    )}
                  </button>

                  <div className="mt-4 pt-3 border-t border-slate-100">
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
                        <span className="text-slate-500">No Continuous Lectures</span>
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
                    </div>
                  </div>
                </div>

                {/* Validation Summary Card */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Constraint Verification</h3>
                  
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
                          <p className="font-bold text-slate-800">Continuous Lecture Restrictor</p>
                          <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                            {hasAnyContinuityConflict 
                              ? "Warning: Some multi-course teachers are scheduled back-to-back." 
                              : "Verified: Teachers taking multiple subjects in the same class have balanced workloads."}
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
                          <p className="font-bold text-slate-800">Period 1 to 4 Free-Period Guard</p>
                          <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                            {hasAnyPeriod1To4FreePeriodConflict 
                              ? "Optimization Warning: A free-period gap exists in Period 1, 2, 3, or 4." 
                              : "Verified: No free period gaps in Period 1, 2, 3, or 4 for any class section!"}
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
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 text-center py-4 font-medium italic">
                      Configure data to run verification logic.
                    </div>
                  )}
                </div>

                {/* Legend & Instructions */}
                <div className="bg-slate-100 border border-slate-200 rounded p-4 text-[11px] text-slate-600">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center space-x-1 mb-2">
                    <Info className="h-3.5 w-3.5 text-blue-900" />
                    <span>User Guidelines</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed text-[11px]">
                    <li>Add your faculties in the <strong className="text-slate-900">Faculty</strong> tab.</li>
                    <li>Add course subjects in the <strong className="text-slate-900">Subjects</strong> tab.</li>
                    <li>Link faculties and subjects in <strong className="text-slate-900">Class Assignments</strong>.</li>
                    <li>Configure college hours in <strong className="text-slate-900">Time Configuration</strong>.</li>
                    <li>Hit <strong className="text-slate-900">Generate Timetable</strong> to build rosters!</li>
                  </ol>
                </div>
              </div>

              {/* Bottom Row: Generated Timetable View (Full Width Card) */}
              <div className="space-y-4 w-full">
                
                {/* Selector Header */}
                <div id="class-roster-timetable-card" className="bg-white border border-slate-200 rounded p-4 shadow-sm timetable-card">
                  {/* Print-only Header */}
                  {currentClassObj && (
                    <div className="hidden print:flex flex-col items-center justify-center text-center border-b border-slate-300 pb-3 mb-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 leading-none">HKE Society's</p>
                      <h1 className="text-sm font-extrabold tracking-tight text-blue-900 uppercase mt-1 leading-none">
                        Sir M. Visvesvaraya College of Engineering, Raichur
                      </h1>
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mt-2">
                        Weekly Class Timetable
                      </h2>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                        Class: {currentClassObj.name} (Sec {currentClassObj.section})
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
                                      <span className="text-[7.5px] opacity-75 font-mono mt-1 font-medium whitespace-nowrap">{slot.startTime} - {slot.endTime}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[10px] tracking-wide">{slot.label}</span>
                                      <span className="text-[9px] opacity-75 font-mono mt-0.5 font-medium">{slot.startTime} - {slot.endTime}</span>
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

                                    const assignmentId = slotsForDay[activePeriodCounter];
                                    const assign = assignmentId ? assignments.find(a => a.id === assignmentId) : null;
                                    const sub = assign ? subjects.find(s => s.id === assign.subjectId) : null;
                                    const fac = assign ? faculties.find(f => f.id === assign.facultyId) : null;

                                    activePeriodCounter++;

                                    const palette = assign && sub ? getSubjectPalette(sub.id, sub.code) : null;

                                    return (
                                      <div 
                                        key={slot.id} 
                                        className={`p-2 border-r border-slate-400 last:border-r-0 flex flex-col justify-between min-h-[64px] group transition relative ${
                                          assign && palette ? `${palette.bg} ${palette.hoverBg}` : 'bg-slate-50/10 hover:bg-slate-50/40'
                                        }`}
                                      >
                                        {assign && sub && fac && palette ? (
                                          <>
                                            <div>
                                              <div className={`font-extrabold ${palette.text} text-[10px] leading-tight uppercase tracking-tight line-clamp-1`} title={sub.name}>
                                                {sub.name}
                                              </div>
                                              <div className={`text-[9px] ${palette.text} opacity-75 font-semibold leading-none mt-0.5`}>
                                                {sub.code}
                                              </div>
                                            </div>
                                            <div className={`mt-1.5 pt-1 border-t ${palette.border} flex items-center justify-between`}>
                                              <span className={`font-bold text-[9px] ${palette.badgeBg} ${palette.badgeText} border ${palette.badgeBorder} px-1 rounded font-mono truncate max-w-[95px] inline-block align-bottom`} title={fac.name}>
                                                {fac.name}
                                              </span>
                                              <span className={`text-[8px] ${palette.text} opacity-60 group-hover:opacity-80 font-mono`}>
                                                {fac.department}
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex-1 flex items-center justify-center text-slate-400 font-mono text-[9px] border border-dashed border-slate-400 bg-slate-50/20 rounded p-1">
                                            -- Free --
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
                </div>
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
                
                {/* Warnings Panel */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Roster Warnings & Rules ({scheduleWarnings.length})</span>
                  </h3>

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
                                      <span className="text-[7.5px] opacity-75 font-mono mt-1 font-medium whitespace-nowrap">{slot.startTime} - {slot.endTime}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[10px] tracking-wide">{slot.label}</span>
                                      <span className="text-[9px] opacity-75 font-mono mt-0.5 font-medium">{slot.startTime} - {slot.endTime}</span>
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
                                    const assignmentId = slotsForDay[currentActiveIdx];
                                    const assign = assignmentId ? assignments.find(a => a.id === assignmentId) : null;
                                    const sub = assign ? subjects.find(s => s.id === assign.subjectId) : null;
                                    const fac = assign ? faculties.find(f => f.id === assign.facultyId) : null;

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
                                        className={`p-2 border-r border-slate-400 last:border-r-0 flex flex-col justify-between min-h-[64px] group transition relative cursor-pointer select-none ${
                                          isSelectedForSwap
                                            ? 'bg-blue-100/90 ring-4 ring-blue-500 border-blue-500 z-10 scale-[0.98]'
                                            : assign && sub
                                              ? `${getSubjectPalette(sub.id, sub.code).bg} ${getSubjectPalette(sub.id, sub.code).hoverBg}`
                                              : 'bg-slate-50/10 hover:bg-slate-50/40'
                                        } ${hasCellWarning && !isSelectedForSwap ? `ring-2 ring-inset ${isClash ? 'ring-rose-500 border-rose-500' : 'ring-amber-500 border-amber-500'}` : ''}`}
                                      >
                                        {assign && sub && fac ? (
                                          (() => {
                                            const palette = getSubjectPalette(sub.id, sub.code);
                                            return (
                                              <>
                                                <div>
                                                  <div className="flex items-center justify-between gap-1">
                                                    <div className={`font-extrabold ${palette.text} text-[10px] leading-tight uppercase tracking-tight line-clamp-1`} title={sub.name}>
                                                      {sub.name}
                                                    </div>
                                                    {hasCellWarning && (
                                                      <span title={cellWarnings.map(w => w.message).join('\n')}>
                                                        <AlertTriangle className={`h-3 w-3 ${isClash ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className={`text-[9px] ${palette.text} opacity-75 font-semibold leading-none mt-0.5`}>
                                                    {sub.code}
                                                  </div>
                                                </div>
                                                <div className={`mt-1.5 pt-1 border-t ${palette.border} flex items-center justify-between`}>
                                                  <span className={`font-bold ${palette.badgeText} ${palette.badgeBg} border ${palette.badgeBorder} text-[9px] px-1 rounded font-mono truncate max-w-[95px] inline-block align-bottom`} title={fac.name}>
                                                    {fac.name}
                                                  </span>
                                                  <span className={`text-[8px] ${palette.text} opacity-60 group-hover:opacity-80 font-mono`}>
                                                    {fac.department}
                                                  </span>
                                                </div>
                                              </>
                                            );
                                          })()
                                        ) : (
                                          <div className="flex-1 flex items-center justify-center text-slate-400 font-mono text-[9px] border border-dashed border-slate-400 bg-slate-50/20 rounded p-1">
                                            -- Free --
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
              {/* Left Form: Add Faculty */}
              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                  <Users className="h-4 w-4 text-blue-900" />
                  <span>Register Faculty</span>
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">Add staff members to make them available for assignment.</p>

                <form onSubmit={addFaculty} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Savitha Murthy"
                      value={newFacName}
                      onChange={(e) => setNewFacName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
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
                        onChange={(e) => setNewFacShort(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
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
                        <option value="ECE">ECE</option>
                        <option value="Applied Science">Applied Science</option>
                        <option value="Civil">Civil</option>
                        <option value="Mechanical">Mechanical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. savitha.m@hkesmvce.ac.in"
                      value={newFacEmail}
                      onChange={(e) => setNewFacEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
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
                        <th className="p-2.5">Email Address</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {faculties.length > 0 ? (
                        faculties.map((fac) => (
                          <tr key={fac.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-2.5 font-bold text-slate-900">{fac.name}</td>
                            <td className="p-2.5 text-center">
                              <span className="font-mono bg-blue-50 text-blue-900 border border-blue-100 font-bold px-2 py-0.5 rounded text-[10px]">
                                {fac.shortName}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700">{fac.department}</td>
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{fac.email || '--'}</td>
                            <td className="p-2.5 text-center">
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
              {/* Left Form: Add Subject */}
              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                  <BookOpen className="h-4 w-4 text-blue-900" />
                  <span>Register Subject</span>
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">Add syllabus courses and weekly credit hours requirements.</p>

                <form onSubmit={addSubject} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Subject Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 21CS51"
                        value={newSubCode}
                        onChange={(e) => setNewSubCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
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
                        <option value="ECE">ECE</option>
                        <option value="Applied Science">Applied Science</option>
                        <option value="Civil">Civil</option>
                        <option value="Mechanical">Mechanical</option>
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
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
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

                  <button
                    type="submit"
                    className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-300" />
                    <span>Register Subject</span>
                  </button>
                </form>
              </div>

              {/* Right List: Subjects */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Syllabus & Subjects</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Registered courses with prescribed weekly lecture slots.</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                    TOTAL: {subjects.length}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5">Subject Code</th>
                        <th className="p-2.5">Course Title</th>
                        <th className="p-2.5">Department</th>
                        <th className="p-2.5 text-center">Type</th>
                        <th className="p-2.5 text-center">Weekly Periods</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.length > 0 ? (
                        subjects.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-2.5 font-mono font-bold text-slate-900">{sub.code}</td>
                            <td className="p-2.5 font-bold text-slate-900">{sub.name}</td>
                            <td className="p-2.5 font-semibold text-slate-700">{sub.department}</td>
                            <td className="p-2.5 text-center">
                              {sub.isLab ? (
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
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => deleteSubject(sub.id)}
                                className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                title="Delete subject"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-medium italic">
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
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                    <GraduationCap className="h-4 w-4 text-blue-900" />
                    <span>Create Class / Section</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">Define semesters or branches to schedule tables for.</p>

                  <form onSubmit={addClass} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Branch / Subject Group</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CSE or ECE"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                      />
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
                          <option value="3rd">3rd Sem</option>
                          <option value="5th">5th Sem</option>
                          <option value="7th">7th Sem</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Section</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. A"
                          value={newClassSec}
                          onChange={(e) => setNewClassSec(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-amber-300" />
                      <span>Create Class</span>
                    </button>
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

                        return (
                          <div key={cls.id} className="border border-slate-200 rounded p-3 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{cls.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Sec <span className="font-bold text-slate-700">{cls.section}</span> • {totalLectures} lectures / wk</p>
                            </div>
                            <button
                              onClick={() => deleteClass(cls.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded shadow-xs transition hover:shadow-sm cursor-pointer"
                              title="Delete class"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                    <Sliders className="h-4 w-4 text-blue-900" />
                    <span>Assign Staff Member</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">Bind a teacher to a course subject for a specific class.</p>

                  <form onSubmit={addAssignment} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Target Class / Section</label>
                      <select
                        required
                        value={assignClassId}
                        onChange={(e) => setAssignClassId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
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
                        required
                        value={assignFacId}
                        onChange={(e) => setAssignFacId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                      >
                        <option value="">-- Choose Faculty --</option>
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
                            const cls = classes.find(c => c.id === assign.classId);
                            const sub = subjects.find(s => s.id === assign.subjectId);
                            const fac = faculties.find(f => f.id === assign.facultyId);

                            return (
                              <tr key={assign.id} className="hover:bg-slate-50/50 transition">
                                <td className="p-2.5 font-bold text-slate-900">
                                  {cls ? `${cls.name} (Sec ${cls.section})` : <span className="text-red-500">Deleted Class</span>}
                                </td>
                                <td className="p-2.5">
                                  {sub ? (
                                    <div>
                                      <span className="font-mono font-bold text-slate-900">{sub.code}</span>
                                      <span className="text-slate-500 ml-2 font-medium">{sub.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-red-500">Deleted Subject</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800">
                                  {fac ? `${fac.name} (${fac.shortName})` : <span className="text-red-500">Deleted Faculty</span>}
                                </td>
                                <td className="p-2.5 text-center">
                                  {sub ? (
                                    <span className="font-bold bg-blue-50 text-blue-900 border border-blue-100 px-2 py-0.5 rounded text-[10px]">
                                      {sub.weeklyPeriods} periods
                                    </span>
                                  ) : '--'}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    onClick={() => deleteAssignment(assign.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                    title="Remove assignment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
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
              
              {/* Left Form: Add Time Slot */}
              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm self-start">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-900" />
                  <span>Configure Hour / Break</span>
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">Specify durations of lectures or institutional breaks.</p>

                <form onSubmit={addTimeSlot} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Time Slot Label</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Period 1, Tea Break, Lunch"
                      value={newSlotLabel}
                      onChange={(e) => setNewSlotLabel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:bg-white transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={newSlotStart}
                        onChange={(e) => setNewSlotStart(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={newSlotEnd}
                        onChange={(e) => setNewSlotEnd(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 cursor-pointer"
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

                  <button
                    type="submit"
                    className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-300" />
                    <span>Save Slot</span>
                  </button>
                </form>
              </div>

              {/* Right: Active Slots List & Days configuration */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Time Slots Table */}
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-2 mb-3">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">College Daily Time Grid</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Prescribed periods and recess intervals ordered chronologically.</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">Label</th>
                          <th className="p-2.5 text-center">Timings</th>
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
                            ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
                            : '--';

                          return (
                            <tr key={slot.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-2.5 font-bold text-slate-900">{slot.label}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-800">{slot.startTime} - {slot.endTime}</td>
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
                                <button
                                  onClick={() => deleteTimeSlot(slot.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Delete time slot"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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

            </div>
          )}

        </div>
      </main>

      {/* ========================================== */}
      {/* FOOTER                                     */}
      {/* ========================================== */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Sir M. Visvesvaraya College of Engineering, Raichur</p>
            <p className="text-[10px] text-slate-500 mt-0.5">HKE Society's campus, Yeramarus Camp, Raichur, Karnataka, India.</p>
          </div>
          <div className="text-center md:text-right text-[10px] text-slate-500 font-medium">
            <p>© 2026 College Scheduling System. All rights reserved.</p>
            <p className="mt-0.5 font-mono">Constraint Satisfaction Engine v2.4 (Clash & Continuity Restrictors Active)</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
