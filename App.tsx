
import React, { useState, useEffect } from 'react';
import { Note, ThemeId } from './types';
import Sidebar from './components/Sidebar';
import NoteEditor from './components/NoteEditor';
import { STORAGE_KEY, THEME_STORAGE_KEY, THEME_CONFIGS, CATEGORIES } from './constants';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('onyx');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [viewingArchive, setViewingArchive] = useState(false);

  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    const savedCustomCats = localStorage.getItem(STORAGE_KEY + '_cats');
    
    if (savedNotes) {
      try {
        const parsed = JSON.parse(savedNotes);
        setNotes(parsed);
        if (parsed.length > 0) {
          const firstNonArchived = parsed.find((n: Note) => !n.isArchived);
          if (firstNonArchived) setActiveNoteId(firstNonArchived.id);
        }
      } catch (e) {
        console.error("Failed to parse saved notes", e);
      }
    }

    if (savedCustomCats) {
      try {
        setCustomCategories(JSON.parse(savedCustomCats));
      } catch(e) {
        console.error("Failed to parse custom categories", e);
      }
    }
    
    if (savedTheme && THEME_CONFIGS[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    }
  }, [currentTheme, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY + '_cats', JSON.stringify(customCategories));
    }
  }, [customCategories, isLoading]);

  const handleCreateNote = (category?: string) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      category: category || 'General',
      updatedAt: Date.now(),
      tasks: [],
      tags: [],
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
    setViewingArchive(false);
  };

  const handleUpdateNote = (updatedNote: Note) => {
    setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const handleDeleteNote = (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (noteToDelete?.isArchived) {
      const newNotes = notes.filter(n => n.id !== id);
      setNotes(newNotes);
      if (activeNoteId === id) setActiveNoteId(null);
    } else {
      handleUpdateNote({ ...noteToDelete!, isArchived: true, updatedAt: Date.now() });
      setActiveNoteId(null);
    }
  };

  const handlePermanentDelete = (id: string) => {
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const handleRestoreNote = (id: string) => {
    const noteToRestore = notes.find(n => n.id === id);
    if (noteToRestore) {
      handleUpdateNote({ ...noteToRestore, isArchived: false, updatedAt: Date.now() });
      setViewingArchive(false);
      setActiveNoteId(id);
    }
  };

  const handleImport = (importedNotes: Note[]) => {
    setNotes(prev => [...importedNotes, ...prev]);
  };

  const handleAddCategory = (name: string) => {
    if (!customCategories.includes(name) && !CATEGORIES.includes(name)) {
      setCustomCategories([...customCategories, name]);
    }
  };

  const activeNote = notes.find(n => n.id === activeNoteId);
  const t = THEME_CONFIGS[currentTheme];

  if (isLoading) {
    return (
      <div className={`flex h-screen items-center justify-center bg-black`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(79,70,229,0.2)]" />
          <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[8px]">Synchronizing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans transition-all duration-300 ${t.editor} ${t.textPrimary} selection:bg-indigo-500/20`}>
      <Sidebar 
        notes={notes} 
        activeNoteId={activeNoteId} 
        onSelectNote={setActiveNoteId}
        onCreateNote={handleCreateNote}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        customCategories={customCategories}
        onAddCategory={handleAddCategory}
        viewingArchive={viewingArchive}
        setViewingArchive={setViewingArchive}
        onImport={handleImport}
      />
      
      <main className="flex-1 h-full overflow-hidden flex flex-col relative transition-all duration-300">
        {activeNote ? (
          <NoteEditor 
            note={activeNote} 
            onUpdate={handleUpdateNote} 
            onDelete={handleDeleteNote}
            onPermanentDelete={handlePermanentDelete}
            onRestore={handleRestoreNote}
            currentTheme={currentTheme}
            onOpenMenu={() => setIsSidebarOpen(true)}
            onClose={() => setActiveNoteId(null)}
            allCategories={[...CATEGORIES, ...customCategories]}
          />
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center ${t.editor}`}>
             {!isSidebarOpen && (
               <button onClick={() => setIsSidebarOpen(true)} className={`md:hidden absolute top-6 left-6 p-3 rounded-xl border ${t.editorBorder} ${t.textSecondary} shadow-sm active:scale-95 transition-all`}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
               </button>
             )}
            <div className="max-w-xs sm:max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-700">
              <div className={`mx-auto w-16 h-16 md:w-20 md:h-20 ${t.sidebar} rounded-2xl md:rounded-[30px] border ${t.editorBorder} flex items-center justify-center mb-6 shadow-xl`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" md:width="32" md:height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${t.accentText} opacity-40`}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h2 className={`text-2xl md:text-3xl font-black tracking-tighter ${t.textPrimary}`}>
                {viewingArchive ? 'Archive Vault' : 'Deep Work'}
              </h2>
              <p className={`text-[11px] md:text-sm leading-relaxed font-medium ${t.textSecondary} opacity-60 px-4`}>
                {viewingArchive ? 'Browse through your past records. You can restore them anytime or erase them forever.' : 'Select an entry or start a new draft to enter your distraction-free workspace.'}
              </p>
              {!viewingArchive && (
                <button onClick={() => handleCreateNote()} className={`inline-flex items-center gap-2 px-6 py-2.5 md:px-8 md:py-3.5 ${t.button} ${t.buttonText} font-black uppercase tracking-widest text-[9px] md:text-[10px] rounded-xl hover:opacity-90 transition-all shadow-lg mt-4 active:scale-95`}>
                  Start New Draft
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
