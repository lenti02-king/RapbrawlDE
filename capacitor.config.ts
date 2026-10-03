import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId is a PROTOTYPE identifier. The final store bundle id is permanent once
// published and must be chosen by the product owner before any store submission.
const config: CapacitorConfig = {
  appId: 'com.rapbrawl.prototype',
  appName: 'RAPBRAWL',
  webDir: 'dist',
  backgroundColor: '#07050d',
  android: {
    backgroundColor: '#07050d',
  },
  ios: {
    backgroundColor: '#07050d',
    contentInset: 'never',
  },
};

export default config;
