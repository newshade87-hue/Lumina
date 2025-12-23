
import React from 'react';
import { Importance } from '../types';
import { IMPORTANCE_COLORS } from '../constants';

interface ImportanceBadgeProps {
  importance: Importance;
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
}

const ImportanceBadge: React.FC<ImportanceBadgeProps> = ({ importance, onClick, interactive, className }) => {
  const getDotColor = (level: Importance) => {
    switch (level) {
      case Importance.LOW: return 'bg-zinc-500';
      case Importance.MEDIUM: return 'bg-blue-400';
      case Importance.HIGH: return 'bg-orange-400';
      case Importance.CRITICAL: return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
      default: return 'bg-zinc-500';
    }
  };

  return (
    <span 
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border 
        ${IMPORTANCE_COLORS[importance]} 
        ${interactive ? 'cursor-pointer hover:bg-zinc-800 transition-colors' : ''}
        ${className}
      `}
    >
      <span className={`w-1 h-1 rounded-full ${getDotColor(importance)}`} />
      {importance}
    </span>
  );
};

export default ImportanceBadge;
