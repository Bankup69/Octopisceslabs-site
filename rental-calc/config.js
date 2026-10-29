// App settings. Fill in the RevenueCat keys and store links before release;
// see docs/MONETIZATION.md.
window.APP_CONFIG = {
  freeSaveLimit: 3,

  // Accounts (email sign-in) and the app launch list. The publishable key is
  // meant to be public; the database only lets visitors join the list.
  supabase: {
    // Shows "Sign in". Turn on once Supabase has custom SMTP set up: its
    // built-in email only reaches your own team (docs/MONETIZATION.md).
    accountsEnabled: false,
    url: 'https://wyyytsftkxxqkrekvtkx.supabase.co',
    publishableKey: 'sb_publishable_VGlh7a6qxGWBRvCHtolKhQ_wyf9AoZO',
  },

  revenueCat: {
    iosApiKey: '',       // appl_...
    androidApiKey: '',   // goog_...
    // Web Billing (Stripe) public key, rcb_... Leave empty to keep web
    // checkout off; the paywall then points to the apps.
    webBillingKey: '',
    entitlement: 'pro',
  },

  // Shown when the store can't be reached. Real prices come from the stores
  // and RevenueCat.
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

  // "Notify me" sign-ups for the iPhone and Android launch.
  launchList: { app: 'rental-calc' },
};
