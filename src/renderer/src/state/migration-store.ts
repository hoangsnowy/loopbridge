import { create } from 'zustand';
import type { PageSummary } from '@shared/domain';

interface MigrationState {
  activeSpaceKey?: string;
  selectedPageId?: string;
  pages: PageSummary[];
  listingProgress: number | null;
  setActiveSpace: (key: string) => void;
  setPages: (pages: PageSummary[]) => void;
  setSelectedPage: (id?: string) => void;
  setListingProgress: (n: number | null) => void;
  reset: () => void;
}

export const useMigrationStore = create<MigrationState>((set) => ({
  pages: [],
  listingProgress: null,
  setActiveSpace: (key) => set({ activeSpaceKey: key }),
  setPages: (pages) => set({ pages }),
  setSelectedPage: (id) => set({ selectedPageId: id }),
  setListingProgress: (n) => set({ listingProgress: n }),
  reset: () =>
    set({
      activeSpaceKey: undefined,
      selectedPageId: undefined,
      pages: [],
      listingProgress: null,
    }),
}));
