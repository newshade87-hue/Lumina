
import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Note, Task, Importance, TaskStatus, ThemeId, AIResult } from '../types';
import ImportanceBadge from './ImportanceBadge';
import { CATEGORIES, THEME_CONFIGS } from '../constants';
import { analyzeNote } from '../services/geminiService';

interface NoteEditorProps {
  note: Note;
  onUpdate: (updatedNote: Note) => void;
  onDelete: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestore: (id: string) => void;
  currentTheme: ThemeId;
  onOpenMenu: () => void;
  onClose: () => void;
  allCategories: string[];
}

type TaskFilter = 'all' | 'pending' | 'completed' | 'dropped' | 'cancelled';
type SaveStatus = 'idle' | 'saving' | 'saved';
type ExportFormat = 'json' | 'txt' | 'md' | 'pdf' | 'docx' | 'xlsx';

const detectImportance = (text: string): Importance | null => {
  const lower = text.toLowerCase();
  if (/\b(urgent|asap|critical|emergency|immediately|instant)\b/.test(lower)) return Importance.CRITICAL;
  if (/\b(important|priority|high|must|vital)\b/.test(lower)) return Importance.HIGH;
  if (/\b(medium|normal|standard|routine)\b/.test(lower)) return Importance.MEDIUM;
  if (/\b(low|later|someday|minor|trivial)\b/.test(lower)) return Importance.LOW;
  return null;
};

const NoteEditor: React.FC<NoteEditorProps> = ({ 
  note, onUpdate, onDelete, onPermanentDelete, onRestore, 
  currentTheme, onOpenMenu, onClose, allCategories 
}) => {
  const t = THEME_CONFIGS[currentTheme];
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskImportance, setNewTaskImportance] = useState<Importance>(Importance.MEDIUM);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [fontSize, setFontSize] = useState<number>(window.innerWidth < 768 ? 15 : 16);
  const [showConfirmModal, setShowConfirmModal] = useState<'delete' | 'export' | null>(null);
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [tagInput, setTagInput] = useState('');
  const [isActionHubExpanded, setIsActionHubExpanded] = useState(window.innerWidth > 1024);
  
  const historyRef = useRef<{ undo: Partial<Note>[], redo: Partial<Note>[] }>({ undo: [], redo: [] });
  const isUndoRedoAction = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setAiResult(null);
    setViewMode('edit');
    historyRef.current = { undo: [], redo: [] };
    setSaveStatus('idle');
  }, [note.id]);

  const triggerSaveIndicator = () => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1000);
  };

  const saveHistory = (oldNote: Note) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    const snapshot = { title: oldNote.title, content: oldNote.content, tags: [...(oldNote.tags || [])] };
    historyRef.current.undo.push(snapshot);
    if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
    historyRef.current.redo = [];
  };

  const undo = () => {
    const history = historyRef.current;
    if (history.undo.length === 0) return;
    isUndoRedoAction.current = true;
    const previous = history.undo.pop()!;
    history.redo.push({ title: note.title, content: note.content, tags: [...(note.tags || [])] });
    onUpdate({ ...note, ...previous, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const redo = () => {
    const history = historyRef.current;
    if (history.redo.length === 0) return;
    isUndoRedoAction.current = true;
    const next = history.redo.pop()!;
    history.undo.push({ title: note.title, content: note.content, tags: [...(note.tags || [])] });
    onUpdate({ ...note, ...next, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    saveHistory(note);
    onUpdate({ ...note, title: e.target.value, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    saveHistory(note);
    onUpdate({ ...note, content: e.target.value, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleManualSave = () => {
    onUpdate({ ...note, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleSaveAndClose = () => {
    handleManualSave();
    onClose();
  };

  const handleArchive = () => {
    onUpdate({ ...note, isArchived: true, updatedAt: Date.now() });
    onClose();
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ ...note, category: e.target.value, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!note.tags?.includes(newTag)) {
        saveHistory(note);
        onUpdate({ ...note, tags: [...(note.tags || []), newTag], updatedAt: Date.now() });
        triggerSaveIndicator();
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    saveHistory(note);
    onUpdate({ ...note, tags: note.tags.filter(t => t !== tag), updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const addTask = (text: string, importance: Importance, dueDate?: string) => {
    if (!text.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      status: TaskStatus.PENDING,
      importance,
      createdAt: Date.now(),
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
    };
    onUpdate({ ...note, tasks: [...note.tasks, newTask], updatedAt: Date.now() });
    setNewTaskText('');
    setNewTaskImportance(Importance.MEDIUM);
    setNewTaskDueDate('');
    triggerSaveIndicator();
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    const updatedTasks = note.tasks.map(t => 
      t.id === taskId ? { ...t, status, completed: status === TaskStatus.COMPLETED } : t
    );
    onUpdate({ ...note, tasks: updatedTasks, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const setTaskReminder = (taskId: string, time: string) => {
    const updatedTasks = note.tasks.map(t => t.id === taskId ? { ...t, reminderAt: new Date(time).getTime() } : t);
    onUpdate({ ...note, tasks: updatedTasks, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const deleteTask = (taskId: string) => {
    const updatedTasks = note.tasks.filter(t => t.id !== taskId);
    onUpdate({ ...note, tasks: updatedTasks, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleExport = (format: ExportFormat) => {
    let contentBlob: Blob;
    let extension = format;
    const fileName = `${note.title || 'untitled'}.${extension}`;

    if (format === 'json') {
      contentBlob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    } else if (format === 'pdf') {
      window.print();
      setShowConfirmModal(null);
      return;
    } else if (format === 'xlsx' || format === 'docx') {
      const html = `<html><body><h1>${note.title}</h1><p>${note.content}</p></body></html>`;
      contentBlob = new Blob([html], { type: 'application/msword' });
    } else {
      const metadata = `---\ntitle: ${note.title}\ncategory: ${note.category}\ntags: ${note.tags?.join(', ')}\nupdated: ${new Date(note.updatedAt).toISOString()}\n---\n\n`;
      const taskList = note.tasks.length > 0 ? `\n## Tasks\n${note.tasks.map(t => `- [${t.status}] ${t.text} (${t.importance})${t.dueDate ? ` [Due: ${new Date(t.dueDate).toLocaleDateString()}]` : ''}`).join('\n')}\n` : '';
      contentBlob = new Blob([metadata + note.content + taskList], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(contentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setShowConfirmModal(null);
  };

  const handleAnalyze = async () => {
    if (!note.content) return;
    setIsAnalyzing(true);
    const result = await analyzeNote(note.content);
    if (result) {
      setAiResult(result);
      const currentTaskTexts = note.tasks.map(t => t.text.toLowerCase());
      const newTasks: Task[] = result.suggestedTasks
        .filter(st => !currentTaskTexts.includes(st.text.toLowerCase()))
        .map(st => ({ 
          id: crypto.randomUUID(), 
          text: st.text, 
          importance: st.importance, 
          completed: false, 
          status: TaskStatus.PENDING,
          createdAt: Date.now() 
        }));
      if (newTasks.length > 0) onUpdate({ ...note, tasks: [...note.tasks, ...newTasks], updatedAt: Date.now() });
    }
    setIsAnalyzing(false);
  };

  const getPriorityScore = (importance: Importance) => {
    switch(importance) { case Importance.CRITICAL: return 4; case Importance.HIGH: return 3; case Importance.MEDIUM: return 2; case Importance.LOW: return 1; default: return 0; }
  };

  const getPriorityColor = (importance: Importance) => {
    switch(importance) {
      case Importance.CRITICAL: return 'bg-rose-500';
      case Importance.HIGH: return 'bg-orange-500';
      case Importance.MEDIUM: return 'bg-blue-500';
      case Importance.LOW: return 'bg-zinc-500';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'text-emerald-500';
      case TaskStatus.CANCELLED: return 'text-rose-500';
      case TaskStatus.DROPPED: return 'text-zinc-500';
      default: return 'text-amber-500';
    }
  };

  const filteredTasks = note.tasks.filter(t => {
    const status = t.status || (t.completed ? TaskStatus.COMPLETED : TaskStatus.PENDING);
    if (taskFilter === 'pending') return status === TaskStatus.PENDING;
    if (taskFilter === 'completed') return status === TaskStatus.COMPLETED;
    if (taskFilter === 'dropped') return status === TaskStatus.DROPPED;
    if (taskFilter === 'cancelled') return status === TaskStatus.CANCELLED;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const statusA = a.status || (a.completed ? TaskStatus.COMPLETED : TaskStatus.PENDING);
    const statusB = b.status || (b.completed ? TaskStatus.COMPLETED : TaskStatus.PENDING);
    if (statusA !== statusB) {
      if (statusA === TaskStatus.PENDING) return -1;
      if (statusB === TaskStatus.PENDING) return 1;
    }
    const scoreA = getPriorityScore(a.importance);
    const scoreB = getPriorityScore(b.importance);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });

  const getImportanceIndicator = (level: Importance) => {
    switch (level) { case Importance.LOW: return 'L'; case Importance.MEDIUM: return 'M'; case Importance.HIGH: return 'H'; case Importance.CRITICAL: return 'C'; default: return 'M'; }
  };

  const renderedMarkdown = marked.parse(note.content || '') as string;
  const getInnerBg = () => {
    switch(currentTheme) {
      case 'quartz': return 'white';
      case 'midnight': return '#0f172a';
      case 'forest': return '#1c1917';
      case 'matrix': return '#000500';
      case 'arcade': return '#0f0420';
      case 'nebula': return '#000814';
      default: return 'black';
    }
  };
  const glowStyles = { '--inner-bg': getInnerBg() } as React.CSSProperties;

  return (
    <div key={note.id} className={`flex-1 h-full overflow-y-auto ${t.editor} p-3 sm:p-5 md:p-8 lg:p-10 flex flex-col gap-4 md:gap-6 max-w-6xl mx-auto scrollbar-hide transition-all duration-300 animate-in fade-in slide-in-from-bottom-1 relative`}>
      
      {/* Action Modals */}
      {showConfirmModal === 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`${t.sidebar} ${t.editorBorder} border p-6 rounded-[25px] shadow-2xl max-w-sm w-full text-center space-y-4`} style={glowStyles}>
            <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            </div>
            <div className="space-y-1">
              <h3 className={`text-lg font-black tracking-tighter ${t.textPrimary}`}>{note.isArchived ? 'Permanent Erase' : 'Archive Draft'}</h3>
              <p className={`text-[11px] leading-relaxed opacity-60 ${t.textSecondary}`}>Move this record to the vault or destroy it forever?</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {!note.isArchived && <button onClick={handleArchive} className="w-full py-2.5 bg-zinc-800 text-white font-black text-[9px] uppercase tracking-widest rounded-lg border border-zinc-700 active:scale-95 transition-all">Archive</button>}
              <button onClick={() => { if(note.isArchived) onPermanentDelete(note.id); else onDelete(note.id); setShowConfirmModal(null); }} className="w-full py-2.5 bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg active:scale-95 transition-all">Destroy Forever</button>
              <button onClick={() => setShowConfirmModal(null)} className={`w-full py-1 ${t.textSecondary} text-[8px] font-black uppercase tracking-[0.2em]`}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal === 'export' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`${t.sidebar} ${t.editorBorder} border p-6 rounded-[25px] shadow-2xl max-w-md w-full text-center space-y-4`} style={glowStyles}>
            <h3 className={`text-lg font-black tracking-tighter ${t.textPrimary}`}>Export Entry</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['json', 'txt', 'md', 'pdf', 'docx', 'xlsx'] as ExportFormat[]).map(format => (
                <button key={format} onClick={() => handleExport(format)} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg hover:bg-indigo-600/10 hover:border-indigo-500/20 transition-all text-[9px] font-black uppercase tracking-widest text-indigo-400">{format}</button>
              ))}
            </div>
            <button onClick={() => setShowConfirmModal(null)} className={`w-full py-1 ${t.textSecondary} text-[8px] font-black uppercase tracking-[0.2em]`}>Close</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`flex flex-col gap-3 glow-outline-flow pb-4 rounded-[1rem] p-4 md:p-6 print:hidden transition-all duration-500`} style={glowStyles}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button onClick={onOpenMenu} className={`md:hidden p-1.5 rounded-lg border ${t.editorBorder} ${t.textSecondary} transition-all`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <input type="text" value={note.title} onChange={handleTitleChange} placeholder="Draft Title" className={`flex-1 text-xl sm:text-2xl font-black ${t.textPrimary} border-none focus:outline-none placeholder:opacity-20 bg-transparent tracking-tight truncate`} />
            {note.isArchived && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/10">Vault</span>}
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/10 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {note.tags?.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/30 border border-zinc-800/50 text-[8px] font-bold text-indigo-400/70 uppercase tracking-widest">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="opacity-40 hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg></button>
                </span>
              ))}
              <input type="text" placeholder="+ Tag" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} className={`px-2 py-0.5 rounded-md border border-dashed ${t.editorBorder} bg-transparent text-[8px] font-bold text-zinc-600 w-14 focus:w-20 focus:outline-none focus:border-indigo-500/30`} />
            </div>
            
            <div className="flex items-center gap-1.5">
               <div className="flex items-center p-0.5 bg-zinc-900/20 rounded-lg border border-zinc-800/30">
                  <button onClick={() => setViewMode('edit')} className={`px-2.5 py-0.5 text-[7px] font-black rounded-md uppercase transition-all ${viewMode === 'edit' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-300'}`}>Edit</button>
                  <button onClick={() => setViewMode('preview')} className={`px-2.5 py-0.5 text-[7px] font-black rounded-md uppercase transition-all ${viewMode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-300'}`}>Read</button>
               </div>
               <div className="flex items-center p-0.5 bg-zinc-900/20 rounded-lg border border-zinc-800/30">
                  <button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className={`w-6 h-4 text-[8px] font-black text-zinc-600`}>A-</button>
                  <button onClick={() => setFontSize(Math.min(24, fontSize + 1))} className={`w-6 h-4 text-[8px] font-black text-zinc-600 border-l border-zinc-800/50`}>A+</button>
               </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {note.isArchived ? (
              <button onClick={() => onRestore(note.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/></svg>Restore</button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={handleManualSave} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm hover:bg-indigo-500 active:scale-95 transition-all">Save</button>
                <button onClick={handleSaveAndClose} className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 active:scale-95 transition-all">Done</button>
              </div>
            )}
            
            <div className="flex-1" />

            <div className="flex items-center gap-0.5">
              <button onClick={undo} disabled={historyRef.current.undo.length === 0} className={`p-1.5 rounded-lg transition-all ${historyRef.current.undo.length === 0 ? 'opacity-10' : 'hover:bg-zinc-800/30 text-zinc-500'}`}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
              <button onClick={redo} disabled={historyRef.current.redo.length === 0} className={`p-1.5 rounded-lg transition-all ${historyRef.current.redo.length === 0 ? 'opacity-10' : 'hover:bg-zinc-800/30 text-zinc-500'}`}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
              <div className="w-px h-4 bg-zinc-800/20 mx-1" />
              <button onClick={() => setShowConfirmModal('export')} className={`p-1.5 text-indigo-400 opacity-60 hover:opacity-100 rounded-lg hover:bg-indigo-500/5 transition-all`} title="Export"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
              <button onClick={() => setShowConfirmModal('delete')} className={`p-1.5 text-rose-500 opacity-60 hover:opacity-100 rounded-lg hover:bg-rose-500/5 transition-all`} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
            </div>
          </div>
        </div>
      </header>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={handleAnalyze} disabled={isAnalyzing || !note.content} className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black tracking-widest uppercase transition-all border ${isAnalyzing ? `${t.sidebar} ${t.textSecondary}` : `bg-indigo-600 text-white border-indigo-500 shadow-lg active:scale-95 transition-all`}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              {isAnalyzing ? 'Extracting...' : 'Extract Intelligence'}
            </button>
            <div className="relative">
              <select value={note.category || 'General'} onChange={handleCategoryChange} className={`appearance-none text-[8px] font-black uppercase tracking-widest px-4 py-1.5 border ${t.editorBorder} rounded-lg ${t.sidebar} ${t.textSecondary} focus:outline-none focus:ring-1 focus:ring-indigo-500/30 pr-8 cursor-pointer`}>{allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>
            </div>
          </div>

          {aiResult && (
            <div className={`relative p-[1.5px] rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 animate-in zoom-in-98 duration-500 shadow-xl ${t.glow}`}>
              <div className={`${t.sidebar === 'bg-white' ? 'bg-zinc-50' : t.sidebar} p-4 rounded-[11px] space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] ${t.id === 'quartz' ? 'text-indigo-600' : 'text-indigo-400'}`}>Gemini Insights</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${aiResult.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400' : aiResult.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-500/10 text-zinc-400'}`}>{aiResult.sentiment} Tone</span>
                </div>
                <p className={`text-xs font-bold leading-relaxed ${t.id === 'quartz' ? 'text-zinc-800' : 'text-white'}`}>{aiResult.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {aiResult.keywords.map(kw => (<span key={kw} className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${t.id === 'quartz' ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-500'}`}>{kw}</span>))}
                </div>
              </div>
            </div>
          )}

          <section className="animate-in fade-in duration-500">
            {viewMode === 'edit' ? (
              <textarea value={note.content} onChange={handleContentChange} placeholder="Write your reflections..." style={{ fontSize: `${fontSize}px` }} className={`w-full min-h-[350px] md:min-h-[500px] leading-[1.6] border-none focus:outline-none resize-none bg-transparent ${t.textPrimary} placeholder:opacity-10`} />
            ) : (
              <div className={`markdown-preview ${t.textPrimary} min-h-[350px] md:min-h-[500px] prose prose-invert max-w-none opacity-80 leading-[1.6]`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
            )}
          </section>
        </div>

        {/* Backlog Action Hub */}
        <div className="lg:col-span-5 print:hidden">
          <section className={`${t.sidebar} rounded-[20px] p-5 md:p-6 border ${t.editorBorder} h-fit sticky top-4 shadow-xl transition-all duration-300`} style={glowStyles}>
            <button onClick={() => setIsActionHubExpanded(!isActionHubExpanded)} className="w-full flex flex-col gap-2 group mb-1.5">
              <header className="w-full flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h2 className={`text-[9px] font-black uppercase tracking-[0.3em] ${t.textSecondary}`}>Backlog Flow</h2>
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${t.textSecondary} ${isActionHubExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-0.5 w-10 sm:w-16 ${t.id === 'quartz' ? 'bg-zinc-200' : 'bg-zinc-800'} rounded-full overflow-hidden shadow-inner`}><div className={`h-full bg-indigo-500 transition-all duration-700 shadow-[0_0_8px_rgba(99,102,241,0.5)]`} style={{ width: `${note.tasks.length ? (note.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / note.tasks.length) * 100 : 0}%` }} /></div>
                  <span className={`text-[9px] font-black font-mono ${t.textPrimary}`}>{note.tasks.filter(t => t.status === TaskStatus.COMPLETED).length}/{note.tasks.length}</span>
                </div>
              </header>
            </button>
            
            {isActionHubExpanded && (
              <div className="space-y-5 mt-5 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex p-0.5 bg-zinc-950/30 rounded-md border border-zinc-900/50 overflow-x-auto scrollbar-hide">
                  {(['all', 'pending', 'completed', 'dropped', 'cancelled'] as TaskFilter[]).map(filter => (
                    <button key={filter} onClick={() => setTaskFilter(filter)} className={`flex-1 py-1 px-2 text-[7px] font-black rounded uppercase transition-all whitespace-nowrap ${taskFilter === filter ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{filter}</button>
                  ))}
                </div>
                
                <div className="space-y-4">
                  <div className={`group ${t.id === 'quartz' ? 'bg-white border-zinc-200' : 'bg-black/20 border-zinc-800/60'} rounded-xl p-1 border focus-within:border-indigo-500/30 transition-all shadow-sm`}>
                    <input type="text" value={newTaskText} onChange={(e) => { const val = e.target.value; setNewTaskText(val); const detected = detectImportance(val); if (detected) setNewTaskImportance(detected); }} onKeyDown={(e) => e.key === 'Enter' && addTask(newTaskText, newTaskImportance, newTaskDueDate)} placeholder="New task..." className={`w-full px-3 py-2 text-[12px] font-bold ${t.textPrimary} focus:outline-none placeholder:opacity-10 bg-transparent`} />
                    <div className="flex items-center justify-between p-1.5 pt-0">
                      <div className="flex items-center gap-1">
                        <div className={`flex p-0.5 ${t.id === 'quartz' ? 'bg-zinc-100' : 'bg-zinc-900/40'} rounded-md border ${t.editorBorder}`}>{Object.values(Importance).map(lvl => { const isActive = newTaskImportance === lvl; return (<button key={lvl} onClick={() => setNewTaskImportance(lvl)} className={`px-1.5 py-0.5 text-[7px] font-black rounded transition-all uppercase ${isActive ? `${t.id === 'quartz' ? 'bg-white text-indigo-600' : 'bg-zinc-800 text-white'} shadow-xs` : `${t.textSecondary} opacity-40`}`}>{getImportanceIndicator(lvl)}</button>); })}</div>
                        <div className="relative group/due">
                          <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <button className={`p-1 rounded border border-transparent ${newTaskDueDate ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10' : 'text-zinc-600 hover:text-indigo-400'}`}><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></button>
                        </div>
                      </div>
                      <button onClick={() => addTask(newTaskText, newTaskImportance, newTaskDueDate)} disabled={!newTaskText.trim()} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${newTaskText.trim() ? `${t.button} ${t.buttonText} shadow-md active:scale-95 transition-all` : `opacity-20 cursor-not-allowed`}`}>Deploy</button>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto scrollbar-hide">
                    {sortedTasks.length === 0 ? (
                      <div className="text-center py-10 opacity-5 font-black uppercase text-[8px] tracking-[0.4em]">Empty Stack</div>
                    ) : (
                      sortedTasks.map(task => {
                        const status = task.status || (task.completed ? TaskStatus.COMPLETED : TaskStatus.PENDING);
                        return (
                          <div key={task.id} className={`group flex relative overflow-hidden flex-col gap-1.5 p-3 rounded-xl border transition-all ${status !== TaskStatus.PENDING ? `${t.id === 'quartz' ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-800/10 border-zinc-800/30'}` : `${t.id === 'quartz' ? 'bg-white border-zinc-100 shadow-sm' : 'bg-zinc-900/30 border-zinc-800/40'} hover:border-indigo-500/20`}`}>
                            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${getPriorityColor(task.importance)}`} />
                            
                            <div className="flex items-center gap-3 pl-1">
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => updateTaskStatus(task.id, status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED)} 
                                  className={`shrink-0 h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-all ${status === TaskStatus.COMPLETED ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : `bg-transparent ${t.editorBorder} hover:border-emerald-500`}`}
                                  title="Complete"
                                >
                                  {status === TaskStatus.COMPLETED && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                </button>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] leading-snug break-words font-bold ${status !== TaskStatus.PENDING ? 'text-zinc-500 line-through opacity-40' : t.textPrimary}`}>
                                  {task.text}
                                </p>
                              </div>

                              {/* Flow Control Buttons */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {status === TaskStatus.PENDING ? (
                                  <>
                                    <button onClick={() => updateTaskStatus(task.id, TaskStatus.COMPLETED)} className="p-1 text-emerald-500/60 hover:text-emerald-500 transition-colors" title="Mark Completed"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                                    <button onClick={() => updateTaskStatus(task.id, TaskStatus.DROPPED)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors" title="Drop"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                                    <button onClick={() => updateTaskStatus(task.id, TaskStatus.CANCELLED)} className="p-1 text-rose-500/60 hover:text-rose-500 transition-colors" title="Cancel"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg></button>
                                  </>
                                ) : (
                                  <button onClick={() => updateTaskStatus(task.id, TaskStatus.PENDING)} className="p-1 text-indigo-400 hover:text-indigo-300 transition-colors" title="Reset to Pending"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9c2.39 0 4.68.94 6.4 2.6l3.1 3.4"/><path d="M16 8h5V3"/></svg></button>
                                )}
                                <button onClick={() => deleteTask(task.id)} className={`p-1 text-zinc-500 hover:text-rose-400 transition-all`} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pl-1">
                              <div className="flex items-center gap-1.5">
                                <ImportanceBadge importance={task.importance} className="scale-75 origin-left" />
                                <span className={`text-[7px] font-black uppercase tracking-widest ${getStatusColor(status)}`}>{status}</span>
                                {task.dueDate && <span className="text-[6px] font-black text-rose-500/80 uppercase tracking-widest bg-rose-500/5 px-1 rounded">Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                              </div>
                              <div className="relative"><input type="datetime-local" onChange={e => setTaskReminder(task.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" /><button className={`p-1 text-zinc-600 hover:text-indigo-400 opacity-40 transition-colors`}><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><polyline points="12 6 12 12 16 14"/></svg></button></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className={`fixed bottom-3 right-3 items-center gap-1 px-2 py-1 rounded-full border ${t.editorBorder} transition-all duration-500 bg-black/60 backdrop-blur-md z-50 flex ${saveStatus !== 'idle' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className={`w-1 h-1 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
        <span className={`text-[7px] font-black uppercase tracking-widest ${t.textPrimary}`}>
          {saveStatus === 'saving' ? 'Syncing' : 'Synced'}
        </span>
      </div>
    </div>
  );
};

export default NoteEditor;
