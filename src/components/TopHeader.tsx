import React from 'react';
import { Bell, ChevronDown, Settings, LogOut, Compass, Bug, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { NotificationBell } from './NotificationBell';

export const TopHeader = ({ 
  user, 
  displayName, 
  userInitial, 
  isAdmin, 
  unreadNotifs, 
  adminAttentionCount,
  onLogout, 
  onProfileClick, 
  onTourClick, 
  onFeedbackClick, 
  onLandingClick, 
  onAdminClick,
  dark,
  onTabChange,
  tourOnNotificationStep = false,
  forceAccountMenuOpen = false,
}: {
  user: any;
  displayName: string;
  userInitial: string;
  isAdmin: boolean;
  unreadNotifs: number;
  adminAttentionCount: number;
  onLogout: () => void;
  onProfileClick: () => void;
  onTourClick: () => void;
  onFeedbackClick: () => void;
  onLandingClick: () => void;
  onAdminClick: () => void;
  dark: boolean;
  onTabChange: (tab: string) => void;
  tourOnNotificationStep?: boolean;
  forceAccountMenuOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (forceAccountMenuOpen) setIsOpen(true);
  }, [forceAccountMenuOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (forceAccountMenuOpen) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [forceAccountMenuOpen]);

  return (
    <header className="sticky top-4 z-40 w-[95%] max-w-7xl mx-auto bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
      <div className="px-4 h-16 flex items-center justify-between">
        <button 
          onClick={() => onTabChange('hjem')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
        >
          <div className="w-8 h-8 bg-pm-accent rounded-lg flex items-center justify-center text-white shadow-lg shadow-pm-accent/20 group-hover:scale-110 transition-transform">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="font-display uppercase italic text-xl tracking-tighter">PadelMakker</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <NotificationBell tourForceOpen={tourOnNotificationStep} />
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              data-tour="account-menu-btn"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-pm-surface-alt border border-pm-border transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-pm-accent-bg flex items-center justify-center text-pm-accent font-black text-sm relative">
                {userInitial}
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-pm-surface" />
                )}
              </div>
              <span className="hidden md:block text-sm font-bold text-pm-text mr-1">
                {displayName}
              </span>
              <ChevronDown 
                size={16} 
                className={cn("text-pm-text-light transition-transform duration-200", isOpen && "rotate-180")} 
              />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  data-tour="account-menu-dropdown"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-pm-surface border border-pm-border rounded-2xl shadow-xl overflow-hidden py-2"
                >
                  <div className="px-4 py-3 border-b border-pm-border mb-2">
                    <p className="text-[10px] font-black text-pm-text-light uppercase tracking-wider">Logget ind som</p>
                    <p className="text-sm font-bold text-pm-text truncate">{displayName}</p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => { onAdminClick(); setIsOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-pm-text hover:bg-pm-surface-alt transition-colors relative"
                    >
                      <ShieldCheck size={18} className="text-pm-accent" />
                      Admin Panel
                      {adminAttentionCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                          {adminAttentionCount}
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    data-tour="account-menu-profile-btn"
                    onClick={() => { onProfileClick(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-pm-text hover:bg-pm-surface-alt transition-colors"
                  >
                    <Settings size={18} className="text-pm-text-light" />
                    Min profil
                  </button>

                  <button
                    onClick={() => { onTourClick(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-pm-text hover:bg-pm-surface-alt transition-colors"
                  >
                    <Compass size={18} className="text-pm-text-light" />
                    Start guide
                  </button>

                  <button
                    onClick={() => { onFeedbackClick(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-pm-text hover:bg-pm-surface-alt transition-colors"
                  >
                    <Bug size={18} className="text-pm-text-light" />
                    Rapportér fejl
                  </button>

                  <button
                    onClick={() => { onLandingClick(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-pm-text hover:bg-pm-surface-alt transition-colors"
                  >
                    <ExternalLink size={18} className="text-pm-text-light" />
                    Se forsiden
                  </button>

                  <div className="h-px bg-pm-border my-2 mx-2" />

                  <button
                    onClick={() => { onLogout(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    Log ud
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
