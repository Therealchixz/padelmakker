import { create } from 'zustand'

export const useUIStore = create((set) => ({
  bottomNavVisible: true,
  setBottomNavVisible: (visible) => set({ bottomNavVisible: visible }),
  
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
