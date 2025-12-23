
import React, { useState } from 'react';
import { ThemeId, User } from '../types';
import { THEME_CONFIGS } from '../constants';

interface AuthProps {
  currentTheme: ThemeId;
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ currentTheme, onLogin }) => {
  const t = THEME_CONFIGS[currentTheme];
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLocalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const user: User = {
        id: crypto.randomUUID(),
        email: email,
        name: isLogin ? email.split('@')[0] : name,
        provider: 'local'
      };
      onLogin(user);
      setIsLoading(false);
    }, 1500);
  };

  const handleGoogleAuth = () => {
    setIsLoading(true);
    // Simulate Google OAuth Popup
    setTimeout(() => {
      const user: User = {
        id: crypto.randomUUID(),
        email: 'google_user@gmail.com',
        name: 'Lumina Explorer',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lumina',
        provider: 'google'
      };
      onLogin(user);
      setIsLoading(false);
    }, 1200);
  };

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
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-6 ${t.editor}`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className={`absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-[120px] bg-indigo-500/30 animate-pulse`} />
        <div className={`absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-[120px] bg-purple-500/30 animate-pulse delay-700`} />
      </div>

      <div className={`w-full max-w-md ${t.sidebar} rounded-[40px] border ${t.sidebarBorder} p-10 relative overflow-hidden shadow-2xl glow-outline-flow transition-all duration-500 ${t.glow}`} style={glowStyles}>
        <div className="flex flex-col items-center text-center gap-6 mb-10">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 glow-outline-flow`} style={{ ...glowStyles, backgroundColor: '#4f46e5' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
          </div>
          <div>
            <h1 className={`text-3xl font-black tracking-tighter ${t.textPrimary} mb-2`}>LUMINA</h1>
            <p className={`text-[11px] font-black uppercase tracking-[0.4em] ${t.textSecondary} opacity-60`}>Workspace Intelligence</p>
          </div>
        </div>

        <form onSubmit={handleLocalAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className={`text-[9px] font-black uppercase tracking-widest ${t.textSecondary} px-1`}>Full Name</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Lumina Explorer" 
                className={`w-full px-5 py-3.5 rounded-2xl border ${t.editorBorder} bg-black/40 ${t.textPrimary} focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:opacity-20`}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className={`text-[9px] font-black uppercase tracking-widest ${t.textSecondary} px-1`}>Identity (Email)</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@nexus.com" 
              className={`w-full px-5 py-3.5 rounded-2xl border ${t.editorBorder} bg-black/40 ${t.textPrimary} focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:opacity-20`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`text-[9px] font-black uppercase tracking-widest ${t.textSecondary} px-1`}>Access Code (Password)</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" 
              className={`w-full px-5 py-3.5 rounded-2xl border ${t.editorBorder} bg-black/40 ${t.textPrimary} focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:opacity-20`}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all duration-300 relative overflow-hidden group active:scale-95 ${t.button} ${t.buttonText}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              isLogin ? 'Initialize Session' : 'Create Credentials'
            )}
          </button>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center"><div className={`w-full border-t ${t.editorBorder} opacity-30`}></div></div>
          <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest"><span className={`${t.sidebar} px-4 ${t.textSecondary} opacity-40`}>Universal Link</span></div>
        </div>

        <button 
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className={`w-full py-4 rounded-2xl border ${t.editorBorder} bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95`}
        >
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
          <span className={`text-[10px] font-black uppercase tracking-widest ${t.textPrimary}`}>Sync with Google</span>
        </button>

        <p className="mt-8 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className={`text-[10px] font-black uppercase tracking-widest ${t.textSecondary} opacity-40 hover:opacity-100 transition-all`}>
            {isLogin ? "No Access? Request Credentials" : "Existing Identity? Authenticate"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
