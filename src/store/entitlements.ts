import type { StateCreator } from 'zustand';
import type { Store } from './index';

/**
 * Placeholder for RevenueCat. NO subscriptions/paywall in the MVP.
 * When RevenueCat is added, this slice is the only thing that changes:
 * initialize the SDK, map CustomerInfo -> `isPro`, keep everything else.
 * Product code should read `useStore(s => s.isPro)` and never touch RevenueCat.
 */
export interface EntitlementsSlice {
  isPro: boolean;
  entitlementsReady: boolean;
  refreshEntitlements: () => Promise<void>;
}

export const createEntitlementsSlice: StateCreator<
  Store,
  [],
  [],
  EntitlementsSlice
> = (set) => ({
  isPro: false,
  entitlementsReady: true, // flips meaningfully once RevenueCat is wired
  refreshEntitlements: async () => {
    // no-op in MVP
    set({ isPro: false, entitlementsReady: true });
  },
});
