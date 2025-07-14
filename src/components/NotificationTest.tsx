'use client';

import React, { useState, useEffect } from 'react';

// Remove the global Window.OneSignal declaration and use type guards in the component

const NotificationTest = () => {
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPushEnabled, setIsPushEnabled] = useState<boolean | null>(null);

  function isOneSignalV16(obj: any): obj is { Notifications: any; User: any } {
    return (
      obj &&
      typeof obj === 'object' &&
      'Notifications' in obj &&
      'User' in obj
    );
  }

  useEffect(() => {
    async function fetchOneSignalStatus() {
      if (
        typeof window !== 'undefined' &&
        window.OneSignal &&
        !Array.isArray(window.OneSignal) &&
        isOneSignalV16(window.OneSignal)
      ) {
        try {
          const permission = await window.OneSignal.Notifications.permission;
          setPermissionStatus(permission);

          const id = await window.OneSignal.User.getPushSubscriptionId();
          if (id) {
            setUserId(id);
            console.log('OneSignal Player ID (Push Subscription ID):', id); // <-- Added for backend testing
          }

          const pushEnabled = await window.OneSignal.Notifications.isPushEnabled();
          setIsPushEnabled(pushEnabled);

          window.OneSignal.Notifications.addEventListener('permissionChange', (event: any) => {
            setPermissionStatus(event.permission);
          });
        } catch (error) {
          console.error("Error fetching OneSignal status:", error);
        }
      }
    }

    fetchOneSignalStatus();
  }, []);

  const requestNotificationPermission = async () => {
    if (
      typeof window !== 'undefined' &&
      window.OneSignal &&
      !Array.isArray(window.OneSignal) &&
      isOneSignalV16(window.OneSignal)
    ) {
      try {
        await window.OneSignal.Notifications.requestPermission();
        const permission = await window.OneSignal.Notifications.permission;
        setPermissionStatus(permission);
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    }
  };

  // Sending notifications from client-side is not supported directly in OneSignal v16+ (should be done from server)
  // This button can be left as a placeholder or removed
  const sendTestNotification = async () => {
    alert('Sending notifications from client-side is not supported in OneSignal v16+. Use your server to trigger notifications.');
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold mb-4">OneSignal Notification Tester</h2>
      
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Permission Status</h3>
        <div className={`px-4 py-2 rounded ${
          permissionStatus === 'granted' ? 'bg-green-100 text-green-800' :
          permissionStatus === 'denied' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {permissionStatus === 'granted' ? 'Allowed' :
          permissionStatus === 'denied' ? 'Denied' :
          'Not requested'}
        </div>
      </div>

      <button
        onClick={requestNotificationPermission}
        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${
          permissionStatus === 'granted' ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        disabled={permissionStatus === 'granted'}
      >
        Request Notification Permission
      </button>

      <button
        onClick={sendTestNotification}
        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${
          !userId ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        disabled={!userId}
      >
        Send Test Notification
      </button>

      {userId && (
        <div className="mt-4">
          <h3 className="font-semibold">OneSignal User ID</h3>
          <p className="px-4 py-2 bg-gray-100 rounded">{userId}</p>
        </div>
      )}

      <div className="mt-4">
        <h3 className="font-semibold">Instructions:</h3>
        <ul className="list-disc list-inside mt-2">
          <li>Click &quot;Request Notification Permission&quot; to allow notifications</li>
          <li>Once permission is granted, you can send a test notification</li>
          <li>Check your browser notifications for the test message</li>
          <li>Your OneSignal user ID is displayed above once retrieved</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationTest;
