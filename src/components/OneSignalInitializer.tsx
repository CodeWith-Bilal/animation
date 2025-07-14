"use client";
import { useEffect } from 'react';

// Extend the Window interface to allow OneSignal to be either an array or the OneSignal object
declare global {
  interface Window {
    OneSignal: any[] | {
      init: (options: any) => void;
      showHttpPrompt: () => void;
      getPermissionStatus: () => Promise<PermissionStatus>;
      Notifications: { requestPermission: () => Promise<void>; };
      isPushNotificationsEnabled: () => Promise<boolean>;
      isPushEnabled: () => Promise<boolean>;
      getUserId: () => Promise<string | null>;
      setExternalUserId: (id: string) => Promise<void>;
    };
  }
}               

function OneSignalInitializer() {
  useEffect(() => {
    async function initializeOneSignal() {
      if (typeof window !== 'undefined') {
        window.OneSignal = window.OneSignal || [];
        (window.OneSignal as any[]).push(function() {
          (window.OneSignal as any).init({
            appId: "2a7921f2-9d04-4745-92db-34f17bf58079",
            allowLocalhostAsSecureOrigin: true
          });
        });
      }else{
        console.log("window is undefined");
      }
    }

    initializeOneSignal();
  }, []);

  return null;
}

export default OneSignalInitializer;
