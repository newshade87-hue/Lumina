
import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Note, Task, Importance, TaskStatus, ThemeId, AIResult, Page } from '../types';
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  // Fixed: taskFilter initialization was incorrectly using the variable before declaration.
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [tagInput, setTagInput] = useState('');
  
  const historyRef = useRef<{ undo: Partial<Note>[], redo: Partial<Note>[] }>({ undo: [], redo: [] });
  const isUndoRedoAction = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pages = note.pages || [{ id: 'page-1', title: 'Main', content: note.content || '' }];
  const activePageIndex = note.activePageIndex ?? 0;
  const currentPage = pages[activePageIndex] || pages[0];

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
    const snapshot = { 
      title: oldNote.title, 
      content: oldNote.content, 
      tags: [...(oldNote.tags || [])], 
      pages: JSON.parse(JSON.stringify(oldNote.pages || [])) 
    };
    historyRef.current.undo.push(snapshot);
    if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
    historyRef.current.redo = [];
  };

  const undo = () => {
    const history = historyRef.current;
    if (history.undo.length === 0) return;
    isUndoRedoAction.current = true;
    const previous = history.undo.pop()!;
    history.redo.push({ 
      title: note.title, 
      content: note.content, 
      tags: [...(note.tags || [])],
      pages: JSON.parse(JSON.stringify(note.pages || []))
    });
    onUpdate({ ...note, ...previous, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const redo = () => {
    const history = historyRef.current;
    if (history.redo.length === 0) return;
    isUndoRedoAction.current = true;
    const next = history.redo.pop()!;
    history.undo.push({ 
      title: note.title, 
      content: note.content, 
      tags: [...(note.tags || [])],
      pages: JSON.parse(JSON.stringify(note.pages || []))
    });
    onUpdate({ ...note, ...next, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    saveHistory(note);
    onUpdate({ ...note, title: e.target.value, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handlePageContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    saveHistory(note);
    const updatedPages = [...pages];
    updatedPages[activePageIndex] = { ...currentPage, content: e.target.value };
    const firstPageContent = updatedPages[0]?.content || '';
    onUpdate({ ...note, pages: updatedPages, content: firstPageContent, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handlePageTitleChange = (index: number, newTitle: string) => {
    const updatedPages = [...pages];
    updatedPages[index] = { ...updatedPages[index], title: newTitle };
    onUpdate({ ...note, pages: updatedPages, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const addPage = () => {
    saveHistory(note);
    const newPage: Page = { id: crypto.randomUUID(), title: `Page ${pages.length + 1}`, content: '' };
    const updatedPages = [...pages, newPage];
    onUpdate({ ...note, pages: updatedPages, activePageIndex: updatedPages.length - 1, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const closePage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pages.length <= 1) return;
    saveHistory(note);
    const updatedPages = pages.filter((_, i) => i !== index);
    let newIndex = activePageIndex;
    if (newIndex >= updatedPages.length) newIndex = updatedPages.length - 1;
    onUpdate({ ...note, pages: updatedPages, activePageIndex: newIndex, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const switchPage = (index: number) => {
    onUpdate({ ...note, activePageIndex: index, updatedAt: Date.now() });
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const newContent = `${before}${prefix}${selection}${suffix}${after}`;
    const updatedPages = [...pages];
    updatedPages[activePageIndex] = { ...currentPage, content: newContent };
    onUpdate({ ...note, pages: updatedPages, updatedAt: Date.now() });
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
      }
    }, 0);
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

  const deleteTask = (taskId: string) => {
    const updatedTasks = note.tasks.filter(t => t.id !== taskId);
    onUpdate({ ...note, tasks: updatedTasks, updatedAt: Date.now() });
    triggerSaveIndicator();
  };

  const handleExport = (format: ExportFormat) => {
    let contentBlob: Blob;
    const fileName = `${note.title || 'untitled'}.${format}`;
    const fullContent = pages.map(p => `### ${p.title}\n\n${p.content}`).join('\n\n---\n\n');

    if (format === 'json') {
      contentBlob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    } else {
      const metadata = `---\ntitle: ${note.title}\ncategory: ${note.category}\ntags: ${note.tags?.join(', ')}\nupdated: ${new Date(note.updatedAt).toISOString()}\n---\n\n`;
      const taskList = note.tasks.length > 0 ? `\n## Tasks\n${note.tasks.map(t => `- [${t.status}] ${t.text} (${t.importance})${t.dueDate ? ` [Due: ${new Date(t.dueDate).toLocaleDateString()}]` : ''}`).join('\n')}\n` : '';
      const text = metadata + fullContent + taskList;
      contentBlob = new Blob([text], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    }

    const url = URL.createObjectURL(contentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowConfirmModal(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAnalyze = async () => {
    if (!currentPage.content) return;
    setIsAnalyzing(true);
    const result = await analyzeNote(currentPage.content);
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

  const getPriorityColor = (importance: Importance) => {
    switch(importance) {
      case Importance.CRITICAL: return 'bg-rose-500';
      case Importance.HIGH: return 'bg-orange-500';
      case Importance.MEDIUM: return 'bg-blue-500';
      case Importance.LOW: return 'bg-zinc-500';
      default: return 'bg-zinc-500';
    }
  };

  const getPriorityScore = (importance: Importance) => {
    switch(importance) {
      case Importance.CRITICAL: return 4;
      case Importance.HIGH: return 3;
      case Importance.MEDIUM: return 2;
      case Importance.LOW: return 1;
      default: return 0;
    }
  };

  const sortedTasks = [...note.tasks].filter(t => {
    if (taskFilter === 'pending') return t.status === TaskStatus.PENDING;
    if (taskFilter === 'completed') return t.status === TaskStatus.COMPLETED;
    return true;
  }).sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === TaskStatus.PENDING) return -1;
      if (b.status === TaskStatus.PENDING) return 1;
    }
    const scoreA = getPriorityScore(a.importance);
    const scoreB = getPriorityScore(b.importance);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });

  const completedCount = note.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalCount = note.tasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const renderedMarkdown = marked.parse(currentPage.content || '') as string;
  const getInnerBg = () => {
    switch(currentTheme) {
      case 'quartz': return 'white';
      case 'midnight': return '#020617';
      case 'forest': return '#0c0a09';
      case 'matrix': return 'black';
      case 'arcade': return '#0f0420';
      case 'nebula': return '#000814';
      default: return 'black';
    }
  };
  const glowStyles = { '--inner-bg': getInnerBg() } as React.CSSProperties;

  return (
    <div key={note.id} className={`flex-1 h-full overflow-y-auto ${t.editor} p-3 sm:p-5 md:p-8 lg:p-10 flex flex-col gap-4 md:gap-6 max-w-6xl mx-auto scrollbar-hide transition-all duration-300 animate-in fade-in slide-in-from-bottom-1 relative`}>
      
      {/* Confirm Export Modal */}
      {showConfirmModal === 'export' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`${t.sidebar} ${t.editorBorder} border p-6 rounded-[25px] shadow-2xl max-w-md w-full text-center space-y-4 glow-outline-flow`} style={glowStyles}>
            <h3 className={`text-lg font-black tracking-tighter ${t.textPrimary}`}>Choose Export Format</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['json', 'txt', 'md', 'docx'] as ExportFormat[]).map(format => (
                <button key={format} onClick={() => handleExport(format)} className={`p-3 bg-zinc-900/40 border ${t.editorBorder} rounded-lg hover:bg-indigo-600/10 hover:border-indigo-500/20 transition-all text-[9px] font-black uppercase tracking-widest text-indigo-400`}>{format}</button>
              ))}
            </div>
            <button onClick={() => setShowConfirmModal(null)} className={`w-full py-1 ${t.textSecondary} text-[8px] font-black uppercase tracking-[0.2em]`}>Close</button>
          </div>
        </div>
      )}

      {/* Pop-up Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          <div className={`w-full max-w-5xl h-full max-h-[90vh] ${t.sidebar} rounded-[30px] border ${t.editorBorder} flex flex-col overflow-hidden shadow-2xl glow-outline-flow`} style={glowStyles}>
            <header className="p-4 md:p-6 border-b border-zinc-800/20 flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <h2 className={`text-sm md:text-lg font-black tracking-tight ${t.textPrimary} truncate max-w-[200px] md:max-w-md`}>{note.title || 'Untitled Draft'}</h2>
                <span className={`text-[8px] font-black uppercase tracking-widest ${t.textSecondary} opacity-40`}>Reading Experience</span>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button onClick={handlePrint} className="p-2 md:px-4 md:py-1.5 rounded-lg bg-indigo-600 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                  <span className="hidden md:inline">Print</span>
                </button>
                <button onClick={() => setShowConfirmModal('export')} className={`p-2 md:px-4 md:py-1.5 rounded-lg ${t.button} ${t.buttonText} text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span className="hidden md:inline">Export</span>
                </button>
                <div className="w-px h-6 bg-zinc-800/20 mx-1" />
                <button onClick={() => setShowPreviewModal(false)} className={`p-2 rounded-lg hover:bg-zinc-800/30 ${t.textSecondary} transition-all`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                </button>
              </div>
            </header>
            
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide p-2 bg-black/30 border-b border-zinc-800/10 no-print">
              {pages.map((p, idx) => (
                <button 
                  key={p.id}
                  onClick={() => switchPage(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all min-w-[100px] max-w-[150px] border ${activePageIndex === idx ? `bg-zinc-800/60 border-indigo-500/50` : 'opacity-40 border-transparent hover:bg-zinc-900/40'}`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider truncate w-full text-left">{p.title}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide bg-zinc-950/20 print-area">
              <div className={`markdown-preview ${t.textPrimary} prose prose-invert max-w-none opacity-90 leading-relaxed`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          
          <header className={`flex flex-col gap-3 glow-outline-flow pb-4 rounded-3xl p-4 md:p-6 no-print transition-all duration-500 ${t.glow}`} style={glowStyles}>
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
                    <button onClick={() => setShowPreviewModal(true)} className={`px-2.5 py-0.5 text-[7px] font-black rounded-md uppercase transition-all text-zinc-600 hover:text-zinc-300`}>Read</button>
                 </div>
                 <div className="flex items-center p-0.5 bg-zinc-900/20 rounded-lg border border-zinc-800/30">
                    <button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className={`w-6 h-4 text-[8px] font-black text-zinc-600`}>A-</button>
                    <button onClick={() => setFontSize(Math.min(24, fontSize + 1))} className={`w-6 h-4 text-[8px] font-black text-zinc-600 border-l border-zinc-800/50`}>A+</button>
                 </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handleManualSave} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg ${t.button} ${t.buttonText} active:scale-95 transition-all`}>Save</button>
              <button onClick={handleSaveAndClose} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${t.editorBorder} ${t.textPrimary} bg-black/40 active:scale-95 transition-all`}>Done</button>
              <div className="flex-1" />
              <button onClick={() => setShowConfirmModal('delete')} className={`p-2 text-rose-500 opacity-60 hover:opacity-100 rounded-xl hover:bg-rose-500/10 transition-all`} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
            </div>
          </header>

          <button onClick={handleAnalyze} disabled={isAnalyzing || !currentPage.content} className={`w-full relative flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase transition-all border ${isAnalyzing ? `${t.sidebar} ${t.textSecondary}` : `bg-indigo-600 text-white border-indigo-400 shadow-xl ${t.glow} active:scale-[0.99]`}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            {isAnalyzing ? 'Extracting Intelligence...' : 'Extract Intelligence'}
          </button>

          <div className={`rounded-3xl border ${t.editorBorder} overflow-hidden bg-black/20 shadow-2xl flex flex-col glow-outline-flow transition-all duration-500 ${t.glow}`} style={glowStyles}>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide p-2 bg-black/40 border-b border-zinc-800/20">
              {pages.map((p, idx) => (
                <div 
                  key={p.id}
                  onClick={() => switchPage(idx)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer min-w-[120px] max-w-[180px] border ${activePageIndex === idx ? `bg-zinc-800/70 border-indigo-500/60 shadow-lg` : 'opacity-40 border-transparent hover:bg-zinc-900/60'}`}
                >
                  <input 
                    type="text" 
                    value={p.title} 
                    onChange={(e) => handlePageTitleChange(idx, e.target.value)}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest border-none focus:outline-none w-full truncate cursor-pointer"
                  />
                  {pages.length > 1 && (
                    <button onClick={(e) => closePage(idx, e)} className="hover:text-rose-500 transition-colors p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addPage} className="p-2 hover:bg-zinc-800/50 rounded-xl text-zinc-500 hover:text-indigo-400 transition-all ml-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </button>
            </div>

            <div className="flex items-center gap-1 p-2 border-b border-zinc-800/20 bg-black/30 overflow-x-auto scrollbar-hide">
              <button onClick={() => insertFormatting('**', '**')} className={`px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black uppercase transition-all ${t.textPrimary}`} title="Bold">B</button>
              <button onClick={() => insertFormatting('_', '_')} className={`px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black italic uppercase transition-all ${t.textPrimary}`} title="Italic">I</button>
              <button onClick={() => insertFormatting('- ')} className={`px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black uppercase transition-all ${t.textPrimary}`} title="List">• List</button>
              <button onClick={() => insertFormatting('<mark>', '</mark>')} className="px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black uppercase transition-all text-amber-400" title="Highlight">HL</button>
              <div className="w-px h-5 bg-zinc-800/30 mx-2 shrink-0" />
              <button onClick={() => insertFormatting('# ')} className={`px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black uppercase transition-all ${t.textPrimary}`} title="Header">H1</button>
              <button onClick={() => insertFormatting('## ')} className={`px-3 py-2 hover:bg-zinc-800 rounded-lg text-[10px] font-black uppercase transition-all ${t.textPrimary}`} title="Header 2">H2</button>
              <div className="flex-1" />
              <button onClick={() => { if(confirm('Clear current page?')) handlePageContentChange({ target: { value: '' } } as any); }} className="px-3 py-2 hover:bg-rose-500/20 text-rose-500 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] transition-all">Clear</button>
            </div>
            
            <div className="p-6 md:p-10 flex-1 min-h-[550px] flex flex-col">
              {viewMode === 'edit' ? (
                <textarea 
                  ref={textareaRef}
                  value={currentPage.content} 
                  onChange={handlePageContentChange} 
                  placeholder="Drafting the next big thing..." 
                  style={{ fontSize: `${fontSize}px` }} 
                  className={`w-full flex-1 leading-[1.8] border-none focus:outline-none resize-none bg-transparent ${t.textPrimary} placeholder:opacity-10`} 
                />
              ) : (
                <div className={`markdown-preview ${t.textPrimary} flex-1 prose prose-invert max-w-none opacity-90 leading-[1.8] print-area`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
              )}
            </div>
          </div>
        </div>

        {/* Improved Backlog Action Hub */}
        <div className="lg:col-span-5 no-print">
          <section className={`${t.sidebar} rounded-3xl p-6 border ${t.editorBorder} h-fit sticky top-4 shadow-2xl transition-all duration-500 overflow-hidden glow-outline-flow ${t.glow}`} style={glowStyles}>
            
            <header className="flex flex-col gap-5 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className={`text-[11px] font-black uppercase tracking-[0.3em] ${t.textPrimary}`}>Backlog Flow</h2>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${t.textSecondary} opacity-40`}>Priority Engine</span>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex flex-col items-end">
                      <span className={`text-[12px] font-black font-mono ${t.textPrimary}`}>{completedCount}/{totalCount}</span>
                      <span className={`text-[7px] font-black uppercase tracking-widest ${t.textSecondary} opacity-60`}>Milestones</span>
                   </div>
                   {/* Improved progress circle container to prevent overflow */}
                   <div className="w-12 h-12 flex items-center justify-center bg-black/20 rounded-full p-1 border border-zinc-800/40 relative">
                      <svg className="w-10 h-10 -rotate-90">
                        <circle cx="20" cy="20" r="17" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-zinc-800/50" />
                        <circle cx="20" cy="20" r="17" fill="transparent" stroke="currentColor" strokeWidth="4" 
                                strokeDasharray={`${2 * Math.PI * 17}`} 
                                strokeDashoffset={`${2 * Math.PI * 17 * (1 - progressPercent / 100)}`}
                                strokeLinecap="round"
                                className="text-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                      </svg>
                      <span className="absolute text-[8px] font-black font-mono text-indigo-400">{Math.round(progressPercent)}%</span>
                   </div>
                </div>
              </div>
              
              <div className={`flex p-1 bg-zinc-950/60 rounded-2xl border ${t.editorBorder} shadow-inner`}>
                {(['all', 'pending', 'completed'] as TaskFilter[]).map(filter => (
                  <button key={filter} onClick={() => setTaskFilter(filter as any)} className={`flex-1 py-2 text-[8px] font-black rounded-xl uppercase tracking-widest transition-all ${taskFilter === filter ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}>{filter}</button>
                ))}
              </div>
            </header>
            
            <div className="space-y-6">
              <div className={`group bg-black/40 border-zinc-800/80 rounded-[22px] p-2 border focus-within:border-indigo-500/70 transition-all shadow-2xl`}>
                <input type="text" value={newTaskText} onChange={(e) => { setNewTaskText(e.target.value); const detected = detectImportance(e.target.value); if (detected) setNewTaskImportance(detected); }} onKeyDown={(e) => e.key === 'Enter' && addTask(newTaskText, newTaskImportance, newTaskDueDate)} placeholder="Capture task..." className={`w-full px-4 py-3 text-[14px] font-bold ${t.textPrimary} focus:outline-none placeholder:opacity-10 bg-transparent`} />
                <div className="flex items-center justify-between px-3 pb-3 pt-2 border-t border-zinc-800/30 mt-1">
                  <div className="flex items-center gap-2">
                    {Object.values(Importance).map(lvl => {
                      const isActive = newTaskImportance === lvl;
                      return (
                        <button key={lvl} onClick={() => setNewTaskImportance(lvl)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${isActive ? `${getPriorityColor(lvl)} border-white/30 text-white shadow-xl scale-110` : `bg-zinc-900 border-zinc-800 ${t.textSecondary} opacity-40 hover:opacity-100 hover:bg-zinc-800`}`}>
                          <span className="text-[10px] font-black">{lvl[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => addTask(newTaskText, newTaskImportance, newTaskDueDate)} disabled={!newTaskText.trim()} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all ${newTaskText.trim() ? `bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30 active:scale-95 hover:bg-indigo-500` : `bg-zinc-900 text-zinc-700 cursor-not-allowed`}`}>Deploy</button>
                </div>
              </div>

              <div className="space-y-4 max-h-[580px] overflow-y-auto scrollbar-hide pr-1">
                {sortedTasks.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    <span className="mt-5 text-[10px] font-black uppercase tracking-[0.6em]">Clear Stack</span>
                  </div>
                ) : (
                  sortedTasks.map(task => {
                    const isCompleted = task.status === TaskStatus.COMPLETED;
                    return (
                      <div key={task.id} className={`group flex relative overflow-hidden flex-col gap-3 p-4 rounded-[22px] border transition-all duration-500 ${isCompleted ? 'bg-zinc-900/10 border-zinc-800/30 grayscale opacity-50 shadow-inner' : `bg-zinc-900/40 border-zinc-800/60 shadow-lg hover:border-indigo-500/50 hover:shadow-2xl hover:-translate-y-1`}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${getPriorityColor(task.importance)}`} />
                        
                        <div className="flex items-start gap-4 pl-1">
                          <button onClick={() => updateTaskStatus(task.id, isCompleted ? TaskStatus.PENDING : TaskStatus.COMPLETED)} className={`shrink-0 mt-1 h-6 w-6 rounded-xl border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl' : 'bg-black/40 border-zinc-700 hover:border-emerald-500/70 hover:scale-110'}`}>
                            {isCompleted && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                          
                          <div className="flex-1">
                            <p className={`text-[13px] leading-relaxed font-black break-words transition-all ${isCompleted ? 'text-zinc-600 line-through' : t.textPrimary}`}>{task.text}</p>
                            <div className="flex items-center gap-3 mt-2">
                               <ImportanceBadge importance={task.importance} className="scale-100 origin-left" />
                               <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 shadow-inner" />
                               <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isCompleted ? 'text-emerald-500/60' : `${t.textSecondary} opacity-60`}`}>{task.status}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-3 group-hover:translate-x-0">
                            <button onClick={() => deleteTask(task.id)} className="p-2 rounded-xl bg-rose-500/5 text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/15 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg></button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      
      <div className={`fixed bottom-4 right-4 items-center gap-2 px-4 py-2 rounded-full border ${t.editorBorder} transition-all duration-700 bg-black/80 backdrop-blur-xl z-50 flex shadow-2xl ${saveStatus !== 'idle' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
        <div className={`w-2 h-2 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
        <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${t.textPrimary}`}>
          {saveStatus === 'saving' ? 'Syncing' : 'Vault Synced'}
        </span>
      </div>
    </div>
  );
};

export default NoteEditor;
