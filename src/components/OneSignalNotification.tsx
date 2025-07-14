'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    OneSignal: any;
  }
}

const OneSignalNotification = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // The initialization is now handled in OneSignalInitializer
      window.OneSignal = window.OneSignal || [];
    }
  }, []);

  return null;
};

export default OneSignalNotification;
