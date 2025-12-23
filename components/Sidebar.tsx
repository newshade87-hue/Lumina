
import React, { useState, useRef } from 'react';
import { Note, ThemeId, User } from '../types';
import { THEME_CONFIGS, CATEGORIES } from '../constants';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (category?: string) => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  isOpen: boolean;
  onClose: () => void;
  customCategories: string[];
  onAddCategory: (name: string) => void;
  viewingArchive: boolean;
  setViewingArchive: (v: boolean) => void;
  onImport: (notes: Note[]) => void;
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  notes, 
  activeNoteId, 
  onSelectNote, 
  onCreateNote,
  activeCategory,
  onSelectCategory,
  currentTheme,
  onThemeChange,
  isOpen,
  onClose,
  customCategories,
  onAddCategory,
  viewingArchive,
  setViewingArchive,
  onImport,
  user,
  onLogout
}) => {
  const [search, setSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);
  const [isFeedExpanded, setIsFeedExpanded] = useState(true);
  const [isVaultExpanded, setIsVaultExpanded] = useState(false);
  const t = THEME_CONFIGS[currentTheme];
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const allCategoriesList = [...(CATEGORIES || []), ...customCategories];

  const getFilteredNotes = (archived: boolean) => {
    return notes
      .filter(n => archived ? !!n.isArchived : !n.isArchived)
      .filter(n => activeCategory === 'All' || n.category === activeCategory)
      .map(n => {
        let score = 0;
        const lowerSearch = search.toLowerCase();
        if (search) {
          if (n.title.toLowerCase().includes(lowerSearch)) score += 10;
          if (n.content?.toLowerCase().includes(lowerSearch)) score += 2;
          if (n.tags?.some(tag => tag.toLowerCase().includes(lowerSearch))) score += 5;
        } else {
          score = 1;
        }
        return { note: n, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
      .map(item => item.note);
  };

  const activeNotes = getFilteredNotes(false);
  const archivedNotes = getFilteredNotes(true);

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim());
      setNewCatName('');
      setShowAddCat(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          const notesArray = Array.isArray(parsed) ? parsed : [parsed];
          onImport(notesArray);
        } else {
          // Fallback manual ID generation
          const safeId = Math.random().toString(36).substring(2, 11);
          const newNote: Note = {
            id: safeId,
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: content,
            updatedAt: Date.now(),
            tasks: [],
            tags: ['imported'],
            category: 'General',
            pages: [{ id: safeId + '-p1', title: 'Main', content: content }],
            activePageIndex: 0
          };
          onImport([newNote]);
        }
      } catch (err) {
        alert("Import Error: Lumina could not parse this file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getInnerBg = (isPrimaryButton = false) => {
    if (isPrimaryButton) {
      switch(currentTheme) {
        case 'onyx': return 'white';
        case 'quartz': return '#18181b';
        case 'midnight': return '#06b6d4';
        case 'forest': return '#059669';
        case 'matrix': return '#00ff41';
        case 'arcade': return '#facc15';
        case 'nebula': return '#06b6d4';
        default: return 'white';
      }
    }
    switch(currentTheme) {
      case 'quartz': return '#f4f4f5';
      case 'midnight': return '#020617';
      case 'forest': return '#0c0a09';
      case 'matrix': return '#000000';
      case 'arcade': return '#1a0731';
      case 'nebula': return '#0d0221';
      default: return '#09090b';
    }
  };

  const getThemePreviewColor = (themeId: ThemeId) => {
    if (themeId === 'onyx') return '#18181b';
    if (themeId === 'quartz') return '#ffffff';
    if (themeId === 'midnight') return '#0f172a';
    if (themeId === 'forest') return '#1c1917';
    if (themeId === 'matrix') return '#003b00';
    if (themeId === 'arcade') return '#1a0731';
    if (themeId === 'nebula') return '#0d0221';
    return '#000000';
  };

  const defaultStyles = { '--inner-bg': getInnerBg() } as React.CSSProperties;
  const buttonStyles = { '--inner-bg': getInnerBg(true) } as React.CSSProperties;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json,.txt,.md,.docx,.pdf" />
      {isOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden transition-all duration-300" onClick={onClose} />}
      
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] sm:w-72 border-r ${t.sidebarBorder} ${t.sidebar} flex flex-col overflow-hidden transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 shadow-2xl shadow-indigo-500/10' : '-translate-x-full md:translate-x-0 md:static md:w-[220px] lg:w-64'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-lg border border-white/10 ${t.glow}`} style={{ backgroundColor: '#4f46e5' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
              </div>
              <h1 className={`text-[10px] font-black uppercase tracking-[0.4em] ${t.textPrimary}`}>Lumina</h1>
            </div>
            <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div className="relative group glow-outline-flow rounded-lg" style={defaultStyles}>
            <input type="text" placeholder="Search Intel..." value={search} onChange={(e) => setSearch(e.target.value)} className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-transparent ${t.textPrimary} focus:outline-none transition-all placeholder:opacity-30`} />
            <svg className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${t.textSecondary} opacity-40`} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => { onCreateNote(activeCategory === 'All' ? undefined : activeCategory); if(window.innerWidth < 768) onClose(); }}
              className={`w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm ${t.button} ${t.buttonText} hover:opacity-90 glow-outline-flow`}
              style={buttonStyles}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              New Draft
            </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
          <div className="space-y-5">
            {/* Collections Section */}
            <section>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <h2 className={`text-[9px] font-black uppercase tracking-[0.2em] ${t.textSecondary}`}>Collections</h2>
                <button onClick={() => setShowAddCat(!showAddCat)} className={`p-1 rounded-md hover:bg-zinc-800 transition-colors ${t.textSecondary} opacity-60 hover:opacity-100`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </button>
              </div>

              <button onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all glow-outline-flow group ${t.glow}`} style={defaultStyles}>
                <span className={`text-[10px] font-bold ${t.textPrimary} truncate`}>{activeCategory}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${t.textSecondary} ${isCollectionsExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {isCollectionsExpanded && (
                <div className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto scrollbar-hide py-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <button onClick={() => { onSelectCategory('All'); setIsCollectionsExpanded(false); }} className={`w-full text-left px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeCategory === 'All' ? `bg-zinc-800/40 ${t.accentText}` : `${t.textSecondary} hover:text-zinc-200 hover:bg-zinc-900/30`}`}>All Items</button>
                  {allCategoriesList.map(cat => (
                    <button key={cat} onClick={() => { onSelectCategory(cat); setIsCollectionsExpanded(false); }} className={`w-full text-left px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeCategory === cat ? `bg-zinc-800/40 ${t.accentText}` : `${t.textSecondary} hover:text-zinc-200 hover:bg-zinc-900/30`}`}>{cat}</button>
                  ))}
                </div>
              )}

              {showAddCat && (
                <div className="mt-2 flex gap-1 px-1">
                  <input type="text" autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} placeholder="New group..." className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] bg-zinc-900 border ${t.sidebarBorder} ${t.textPrimary} focus:outline-none`} />
                  <button onClick={handleAddCategory} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase">Add</button>
                </div>
              )}
            </section>

            {/* Recent Feed Section */}
            <section>
              <button onClick={() => setIsFeedExpanded(!isFeedExpanded)} className="w-full flex items-center justify-between mb-2 px-1 group cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <h2 className={`text-[9px] font-black uppercase tracking-[0.2em] ${t.textSecondary}`}>Recent Feed</h2>
                  <span className={`text-[8px] font-black ${t.textSecondary} opacity-40 bg-zinc-800/50 px-1 rounded`}>{activeNotes.length}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${t.textSecondary} ${isFeedExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {isFeedExpanded && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {activeNotes.length === 0 ? (
                    <div className="px-1 py-4 text-center">
                      <p className={`text-[10px] font-medium italic ${t.textSecondary} opacity-30`}>No active drafts...</p>
                    </div>
                  ) : (
                    activeNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => { onSelectNote(note.id); if(window.innerWidth < 768) onClose(); }}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all group border glow-outline-flow ${activeNoteId === note.id ? `${t.card} border-indigo-500/50 ${t.glow} translate-x-1` : `border-zinc-800/40 hover:bg-zinc-900/30 hover:border-zinc-700 shadow-sm`}`}
                        style={activeNoteId === note.id ? { '--inner-bg': getInnerBg() } as any : {}}
                      >
                        <span className={`block font-bold text-[11px] truncate mb-0.5 ${activeNoteId === note.id ? t.textPrimary : `${t.textSecondary} group-hover:text-zinc-200`}`}>
                          {note.title || 'Untitled Draft'}
                        </span>
                        <p className={`text-[9px] line-clamp-1 opacity-50 font-medium ${t.textSecondary}`}>
                          {note.content || '...'}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[7px] font-black uppercase tracking-widest opacity-40">
                          <span>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          {note.tasks.length > 0 && <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-emerald-500"/>{note.tasks.filter(t => t.status === 'Completed').length}/{note.tasks.length}</span>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* The Vault Section */}
            <section>
              <button onClick={() => setIsVaultExpanded(!isVaultExpanded)} className="w-full flex items-center justify-between mb-2 px-1 group cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <h2 className={`text-[9px] font-black uppercase tracking-[0.2em] ${t.textSecondary}`}>The Vault</h2>
                  <span className={`text-[8px] font-black ${t.textSecondary} opacity-40 bg-zinc-800/50 px-1 rounded`}>{archivedNotes.length}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${t.textSecondary} ${isVaultExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {isVaultExpanded && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {archivedNotes.length === 0 ? (
                    <div className="px-1 py-4 text-center">
                      <p className={`text-[10px] font-medium italic ${t.textSecondary} opacity-30`}>The vault is empty...</p>
                    </div>
                  ) : (
                    archivedNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => { onSelectNote(note.id); if(window.innerWidth < 768) onClose(); }}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all group border glow-outline-flow ${activeNoteId === note.id ? `${t.card} border-indigo-500/50 ${t.glow} translate-x-1` : `border-zinc-800/40 hover:bg-zinc-900/30 hover:border-zinc-700 shadow-sm opacity-60 grayscale hover:grayscale-0 hover:opacity-100`}`}
                        style={activeNoteId === note.id ? { '--inner-bg': getInnerBg() } as any : {}}
                      >
                        <span className={`block font-bold text-[11px] truncate mb-0.5 ${activeNoteId === note.id ? t.textPrimary : `${t.textSecondary} group-hover:text-zinc-200`}`}>
                          {note.title || 'Untitled Draft'}
                        </span>
                        <div className="mt-2 flex items-center justify-between text-[7px] font-black uppercase tracking-widest opacity-40">
                          <span>Archived</span>
                          <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Profile Section */}
        <div className={`p-4 border-t ${t.sidebarBorder} bg-black/20 space-y-4`}>
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 overflow-hidden shadow-lg shrink-0">
                  <img src={user.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.email}`} alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col overflow-hidden">
                   <span className={`text-[10px] font-black uppercase tracking-tight truncate ${t.textPrimary}`}>{user.name}</span>
                   <span className={`text-[7px] font-bold opacity-40 truncate ${t.textSecondary}`}>{user.email}</span>
                </div>
                <button onClick={onLogout} className="ml-auto p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-500 transition-all" title="Logout">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
             </div>
          </div>

          <div className="space-y-2">
            <h2 className={`text-[8px] font-black uppercase tracking-[0.25em] ${t.textSecondary} px-1 opacity-60`}>Themes</h2>
            <div className="flex gap-2 justify-center flex-wrap">
              {(Object.keys(THEME_CONFIGS) as ThemeId[]).map((themeId) => {
                const isActive = currentTheme === themeId;
                const theme = THEME_CONFIGS[themeId];
                return (
                  <button
                    key={themeId}
                    onClick={() => onThemeChange(themeId)}
                    className={`w-6 h-6 rounded-full border transition-all relative overflow-hidden flex items-center justify-center ${isActive ? `border-indigo-500 ring-2 ring-indigo-500/30 scale-110 ${theme.glow}` : 'border-zinc-800 opacity-60 hover:opacity-100 hover:scale-105'}`}
                    style={{ backgroundColor: getThemePreviewColor(themeId) }}
                    title={theme.name}
                  >
                    {isActive && <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
