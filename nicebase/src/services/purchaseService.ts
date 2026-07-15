import { isNativePlatform } from '../utils/platform'

/**
 * A single purchasable Premium plan.
 *
 * `titleKey` / `period` are i18n keys the UI localizes with `t()`. `price` is a
 * pre-formatted display string (placeholder until a real store provider returns
 * localized prices from the platform storefront).
 */
export interface PurchasePlan {
  id: 'monthly' | 'yearly' | 'lifetime'
  titleKey: string
  price: string
  period: string
  badgeKey?: 'mostPopular' | 'bestValue'
}

/**
 * Result of a purchase/restore attempt.
 *
 * `reason` explains a non-success:
 * - `web-unavailable` — running on the web, where no native billing exists.
 * - `coming-soon`     — native, but no billing provider is wired yet.
 * - `cancelled`       — the user dismissed the store sheet (future providers).
 * - `error`           — the provider surfaced an unexpected failure.
 */
export interface PurchaseResult {
  ok: boolean
  reason?: 'coming-soon' | 'web-unavailable' | 'cancelled' | 'error'
}

// Static plan catalog. Prices are placeholders shown until a real storefront
// provides localized pricing. Premium itself is server-granted (RLS blocks a
// client self-grant), so this catalog is presentation-only.
const PLANS: PurchasePlan[] = [
  {
    id: 'monthly',
    titleKey: 'premiumMonthly',
    price: '₺29,99',
    period: 'perMonth',
  },
  {
    id: 'yearly',
    titleKey: 'premiumYearly',
    price: '₺199,99',
    period: 'perYear',
    badgeKey: 'mostPopular',
  },
  {
    id: 'lifetime',
    titleKey: 'premiumLifetime',
    price: '₺499,99',
    period: 'oneTime',
    badgeKey: 'bestValue',
  },
]

export const purchaseService = {
  /**
   * Whether a native in-app billing provider is ready to transact.
   *
   * Returns `false` for now: no billing SDK is installed and no store
   * credentials exist. The `isNativePlatform()` guard stays here so that once a
   * provider is added, this single check governs the whole purchase seam.
   *
   * SEAM — integrate `@revenuecat/purchases-capacitor` here:
   *   1. Read the platform key, e.g. `import.meta.env.VITE_REVENUECAT_ANDROID_KEY`.
   *   2. On first use: `await Purchases.configure({ apiKey })`.
   *   3. `purchase()` -> `Purchases.getOfferings()` + `Purchases.purchasePackage()`.
   *   4. `restore()`  -> `Purchases.restorePurchases()`.
   * Then return `isNativePlatform() && Boolean(apiKey)` below.
   */
  isNativeBillingAvailable(): boolean {
    if (!isNativePlatform()) return false
    // No provider/SDK wired yet — never claim billing is available.
    return false
  },

  getPlans(): PurchasePlan[] {
    return PLANS
  },

  async purchase(_planId: PurchasePlan['id']): Promise<PurchaseResult> {
    // Web has no native billing — direct the user to the mobile app.
    if (!isNativePlatform()) {
      return { ok: false, reason: 'web-unavailable' }
    }
    // Native, but no provider is wired yet. Never fake a success: Premium is
    // server-granted, so a fake `ok:true` would mislead the user without
    // actually unlocking anything.
    return { ok: false, reason: 'coming-soon' }
  },

  async restore(): Promise<PurchaseResult> {
    // No provider to restore from yet.
    return { ok: false, reason: 'coming-soon' }
  },
}
