import { create } from 'zustand';
import type { PageSummary } from '@shared/domain';

interface MigrationState {
  activeSpaceKey?: string;
  selectedPageId?: string;
  pages: PageSummary[];
  setActiveSpace: (key: string) => void;
  setPages: (pages: PageSummary[]) => void;
  setSelectedPage: (id?: string) => void;
  reset: () => void;
}

export const useMigrationStore = create<MigrationState>((set) => ({
  pages: [],
  setActiveSpace: (key) => set({ activeSpaceKey: key }),
  setPages: (pages) => set({ pages }),
  setSelectedPage: (id) => set({ selectedPageId: id }),
  reset: () => set({ activeSpaceKey: undefined, selectedPageId: undefined, pages: [] }),
}));
