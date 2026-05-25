import React from 'react';
import { Home, Users, MapPin, Swords, Trophy, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export const BottomNav = ({ 
  activeTab, 
  onTabChange, 
  hasKampeAttention, 
  kampeTabBadge, 
  unreadMessages, 
  onMoreClick,
  className,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasKampeAttention: boolean;
  kampeTabBadge: number | null;
  unreadMessages: number;
  onMoreClick: () => void;
  className?: string;
}) => {
  const tabs = [
    { id: 'hjem', label: 'Hjem', icon: Home },
    { id: 'makkere', label: 'Makkere', icon: Users },
    { id: 'baner', label: 'Baner', icon: MapPin },
    { id: 'kampe', label: 'Kampe', icon: Swords, badge: kampeTabBadge, attention: hasKampeAttention },
  ];

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-50 bg-pm-surface/80 backdrop-blur-lg border-t border-pm-border px-2 pb-safe-area-inset-bottom pt-2 md:hidden transition-opacity',
      className,
    )}>
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tour={`mobile-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 p-2 rounded-xl transition-colors"
            >
              <div className={cn(
                "p-1 rounded-lg transition-all duration-200",
                isActive ? "text-pm-accent scale-110" : "text-pm-text-light"
              )}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {tab.badge && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-pm-surface">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
                {!tab.badge && tab.attention && !isActive && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-pm-surface" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-wide uppercase transition-colors",
                isActive ? "text-pm-accent" : "text-pm-text-light"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute -bottom-1 w-1 h-1 bg-pm-accent rounded-full"
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          data-tour="mobile-tab-mere"
          onClick={onMoreClick}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-pm-text-light"
        >
          <div className="p-1 relative">
            <Menu size={22} />
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-pm-surface">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-wide uppercase">Mere</span>
        </button>
      </div>
    </nav>
  );
};
