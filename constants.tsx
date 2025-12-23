
import React from 'react';
import { Importance, ThemeId } from './types';

export const IMPORTANCE_COLORS: Record<Importance, string> = {
  [Importance.LOW]: 'bg-zinc-800/50 text-zinc-300 border-zinc-700',
  [Importance.MEDIUM]: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  [Importance.HIGH]: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  [Importance.CRITICAL]: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};

export interface ThemePalette {
  id: ThemeId;
  name: string;
  sidebar: string;
  sidebarBorder: string;
  editor: string;
  editorBorder: string;
  textPrimary: string;
  textSecondary: string;
  card: string;
  accent: string;
  accentText: string;
  button: string;
  buttonText: string;
  input: string;
  glow: string;
  glowHover: string;
}

export const THEME_CONFIGS: Record<ThemeId, ThemePalette> = {
  onyx: {
    id: 'onyx',
    name: 'Onyx',
    sidebar: 'bg-zinc-950',
    sidebarBorder: 'border-zinc-800',
    editor: 'bg-black',
    editorBorder: 'border-zinc-800',
    textPrimary: 'text-white',
    textSecondary: 'text-zinc-400',
    card: 'bg-zinc-900/40',
    accent: 'indigo-500',
    accentText: 'text-indigo-400',
    button: 'bg-white',
    buttonText: 'text-black',
    input: 'bg-black',
    glow: 'shadow-[0_0_20px_rgba(79,70,229,0.4)]',
    glowHover: 'hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]',
  },
  quartz: {
    id: 'quartz',
    name: 'Quartz',
    sidebar: 'bg-zinc-50',
    sidebarBorder: 'border-zinc-300',
    editor: 'bg-white',
    editorBorder: 'border-zinc-200',
    textPrimary: 'text-zinc-950',
    textSecondary: 'text-zinc-600',
    card: 'bg-white',
    accent: 'indigo-600',
    accentText: 'text-indigo-600',
    button: 'bg-zinc-950',
    buttonText: 'text-white',
    input: 'bg-white',
    glow: 'shadow-[0_0_20px_rgba(79,70,229,0.15)]',
    glowHover: 'hover:shadow-[0_0_30px_rgba(79,70,229,0.25)]',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    sidebar: 'bg-slate-950',
    sidebarBorder: 'border-slate-800',
    editor: 'bg-[#020617]',
    editorBorder: 'border-slate-800',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
    card: 'bg-slate-900/60',
    accent: 'cyan-500',
    accentText: 'text-cyan-400',
    button: 'bg-cyan-500',
    buttonText: 'text-black',
    input: 'bg-slate-950',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    glowHover: 'hover:shadow-[0_0_35px_rgba(6,182,212,0.7)]',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    sidebar: 'bg-stone-950',
    sidebarBorder: 'border-stone-800',
    editor: 'bg-[#0c0a09]',
    editorBorder: 'border-stone-800',
    textPrimary: 'text-white',
    textSecondary: 'text-stone-400',
    card: 'bg-stone-900/60',
    accent: 'emerald-500',
    accentText: 'text-emerald-400',
    button: 'bg-emerald-500',
    buttonText: 'text-white',
    input: 'bg-stone-950',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',
    glowHover: 'hover:shadow-[0_0_35px_rgba(16,185,129,0.7)]',
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    sidebar: 'bg-black',
    sidebarBorder: 'border-green-600',
    editor: 'bg-black',
    editorBorder: 'border-green-600',
    textPrimary: 'text-[#00ff41]',
    textSecondary: 'text-[#008f11]',
    card: 'bg-black',
    accent: 'green-500',
    accentText: 'text-[#00ff41]',
    button: 'bg-[#00ff41]',
    buttonText: 'text-black',
    input: 'bg-black',
    glow: 'shadow-[0_0_25px_rgba(0,255,65,0.7)]',
    glowHover: 'hover:shadow-[0_0_40px_rgba(0,255,65,0.9)]',
  },
  arcade: {
    id: 'arcade',
    name: 'Arcade',
    sidebar: 'bg-[#1a0731]',
    sidebarBorder: 'border-fuchsia-600',
    editor: 'bg-[#0f0420]',
    editorBorder: 'border-fuchsia-600',
    textPrimary: 'text-yellow-300',
    textSecondary: 'text-fuchsia-400',
    card: 'bg-[#1a0731]',
    accent: 'fuchsia-500',
    accentText: 'text-fuchsia-400',
    button: 'bg-yellow-400',
    buttonText: 'text-black',
    input: 'bg-[#1a0731]',
    glow: 'shadow-[0_0_25px_rgba(232,121,249,0.8)]',
    glowHover: 'hover:shadow-[0_0_45px_rgba(232,121,249,1.0)]',
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    sidebar: 'bg-[#0d0221]',
    sidebarBorder: 'border-rose-700',
    editor: 'bg-[#000814]',
    editorBorder: 'border-rose-700',
    textPrimary: 'text-cyan-400',
    textSecondary: 'text-blue-400',
    card: 'bg-[#0d0221]',
    accent: 'rose-500',
    accentText: 'text-rose-400',
    button: 'bg-cyan-500',
    buttonText: 'text-black',
    input: 'bg-[#0d0221]',
    glow: 'shadow-[0_0_30px_rgba(251,113,133,0.8)]',
    glowHover: 'hover:shadow-[0_0_50px_rgba(251,113,133,1.0)]',
  }
};

export const CATEGORIES = ['General', 'Work', 'Personal', 'Ideas', 'Learning', 'Research', 'Health', 'Finance', 'Projects'];

export const STORAGE_KEY = 'lumina_notes_data_v1';
export const THEME_STORAGE_KEY = 'lumina_theme_v1';
