// App settings. Fill in the RevenueCat keys and store links before release;
// see docs/MONETIZATION.md.
window.APP_CONFIG = {
  freeSaveLimit: 3,

  revenueCat: {
    iosApiKey: '',       // appl_...
    androidApiKey: '',   // goog_...
    entitlement: 'pro',
  },

  // Shown on the web, where purchases aren't available, and as a fallback
  // when the store can't be reached. Real prices come from the stores.
  plans: [
    { id: '$rc_monthly', title: 'Monthly', price: '$4.99', period: 'per month' },
    { id: '$rc_annual', title: 'Yearly', price: '$29.99', period: 'per year', note: 'Save 50%' },
    { id: '$rc_lifetime', title: 'Lifetime', price: '$49.99', period: 'one time', note: 'Best value' },
  ],

  // Apple requires both links on the purchase screen.
  legal: {
    termsUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    privacyUrl: 'https://octopisceslabs.com/rental-calc/privacy.html',
  },

  storeLinks: {
    ios: '',             // https://apps.apple.com/app/id...
    android: '',         // https://play.google.com/store/apps/details?id=...
  },
};
