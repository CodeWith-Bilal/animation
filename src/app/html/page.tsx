"use client";
import React, { useEffect, useState } from "react";

const ONESIGNAL_APP_ID = "2a7921f2-9d04-4745-92db-34f17bf58079"; // Your App ID

declare global {
  interface Window {
    OneSignal: any;
  }
}

const OneSignalTokenTester: React.FC = () => {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load OneSignal SDK
    if (!window.OneSignal) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.async = true;
      document.head.appendChild(script);

      script.onload = () => {
        console.log("OneSignal SDK loaded");
        initializeOneSignal();
      };

      script.onerror = () => {
        setError("Failed to load OneSignal SDK. Check your network.");
      };
    } else {
      console.log("OneSignal SDK already loaded");
      initializeOneSignal();
    }

    // Cleanup
    return () => {
      const script = document.querySelector(
        'script[src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"]'
      );
      if (script) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const initializeOneSignal = () => {
    window.OneSignal = window.OneSignal || [];
    window.OneSignal.push(() => {
      console.log("Initializing OneSignal with appId:", ONESIGNAL_APP_ID);
      window.OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: true,
          showWelcomeNotification: false,
        },
      })
        .then(() => {
          console.log("OneSignal initialized successfully on", window.location.origin);
          // Log SDK state for debugging
          console.log("OneSignal.User:", window.OneSignal.User);
          console.log("OneSignal.User.PushSubscription:", window.OneSignal.User?.PushSubscription);
          console.log("OneSignal.User.PushSubscription.id:", window.OneSignal.User?.PushSubscription?.id);
          // Check initial permission state
          checkPermissionState();
        })
        .catch((err: any) => {
          console.error("OneSignal initialization error:", err);
          setError(`OneSignal initialization failed: ${err.message}`);
        });
    });
  };

  const checkPermissionState = async () => {
    try {
      const oneSignalPermission = await window.OneSignal.Notifications?.permission;
      const browserPermission = "Notification" in window ? Notification.permission : "unavailable";
      console.log("OneSignal permission:", oneSignalPermission);
      console.log("Browser permission:", browserPermission);
      if (oneSignalPermission === "granted" || browserPermission === "granted") {
        const id = await getPlayerId();
        console.log("Player ID on init:", id);
        if (id) {
          setPlayerId(id);
        }
      } else if (oneSignalPermission === "denied" || browserPermission === "denied") {
        setError(
          "Notifications are blocked. Please enable notifications for this site in your browser settings (e.g., chrome://settings/content/notifications for Chrome) and try again."
        );
      }
    } catch (err: any) {
      console.error("Error checking permission state:", err);
      setError(`Error checking permission state: ${err.message}`);
    }
  };

  const getPlayerId = async () => {
    try {
      // Prefer OneSignal.User.getId() for v16
      if (window.OneSignal.User?.getId) {
        console.log("Using OneSignal.User.getId()");
        return await window.OneSignal.User.getId();
      }
      // Fallback to OneSignal.getUserId() for older SDK versions
      if (window.OneSignal.getUserId) {
        console.log("Falling back to OneSignal.getUserId()");
        return await new Promise((resolve) => {
          window.OneSignal.getUserId((userId: string | null) => {
            resolve(userId);
          });
        });
      }
      // Fallback to OneSignal.User.PushSubscription.id
      if (window.OneSignal.User?.PushSubscription?.id) {
        console.log("Using OneSignal.User.PushSubscription.id");
        return window.OneSignal.User.PushSubscription.id;
      }
      throw new Error("No method available to retrieve player ID");
    } catch (err: any) {
      console.error("Error retrieving player ID:", err);
      throw err;
    }
  };

  const getToken = async () => {
    setIsLoading(true);
    setError(null);

    const OneSignal = window.OneSignal;
    if (!OneSignal || typeof OneSignal.push !== "function") {
      setError("OneSignal SDK is not loaded. Please try again.");
      setIsLoading(false);
      return;
    }

    try {
      // Ensure OneSignal is initialized
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: true,
          showWelcomeNotification: false,
        },
      });

      // Log SDK state for debugging
      console.log("OneSignal.User after init:", window.OneSignal.User);
      console.log("OneSignal.User.PushSubscription:", window.OneSignal.User?.PushSubscription);
      console.log("OneSignal.User.PushSubscription.id:", window.OneSignal.User?.PushSubscription?.id);

      // Check current permission state
      const oneSignalPermission = await OneSignal.Notifications?.permission;
      const browserPermission = "Notification" in window ? Notification.permission : "unavailable";
      console.log("OneSignal permission:", oneSignalPermission);
      console.log("Browser permission:", browserPermission);

      if (oneSignalPermission === "granted" || browserPermission === "granted") {
        console.log("Permission already granted, fetching player ID");
        const id = await getPlayerId();
        if (id) {
          setPlayerId(id);
        } else {
          setError("No Player ID found. Try again.");
        }
      } else if (oneSignalPermission === "denied" || browserPermission === "denied") {
        setError(
          "Notifications are blocked. Please enable notifications in your browser settings (e.g., chrome://settings/content/notifications for Chrome) and try again."
        );
      } else {
        // Request permission (default state)
        if (OneSignal.Notifications && "Notification" in window) {
          console.log("Requesting notification permission");
          const permission = await OneSignal.Notifications.requestPermission();
          console.log("Requested permission result:", permission);
          console.log("Browser permission after request:", Notification.permission);
          if (permission === true || Notification.permission === "granted") {
            console.log("Permission granted, fetching player ID");
            const id = await getPlayerId();
            if (id) {
              setPlayerId(id);
            } else {
              setError("No Player ID found after granting permission. Try again.");
            }
          } else if (permission === false || Notification.permission === "denied") {
            setError(
              "Notification permission was not granted. Please allow notifications in your browser settings and try again."
            );
          } else {
            setError(
              "Unexpected permission result from OneSignal. Please try again or check browser notification settings (e.g., chrome://settings/content/notifications)."
            );
          }
        } else {
          setError(
            "Notification API is not available. Ensure your browser supports notifications and you’re running on a secure context."
          );
        }
      }
    } catch (err: any) {
      console.error("Error getting OneSignal ID:", err);
      if (err.message.includes("This web push config can only be used")) {
        setError(
          `Origin mismatch: Your app is running on ${window.location.origin}, but OneSignal is configured for a different origin. Please ensure the Site URL in your OneSignal dashboard is set to ${window.location.origin}.`
        );
      } else {
        setError(`Error getting OneSignal ID: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (playerId) {
      navigator.clipboard.writeText(playerId);
      alert("Copied to clipboard!");
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: "2em" }}>
      <h2>OneSignal Player ID Tester</h2>
      <p>
        Click the button below to register for push notifications and get your
        OneSignal Player ID (token):
      </p>
      <button onClick={getToken} disabled={isLoading}>
        {isLoading ? "Loading..." : "Get OneSignal Token"}
      </button>

      {error && (
        <div style={{ color: "red", marginTop: "1em", maxWidth: "600px" }}>
          {error}
        </div>
      )}

      {playerId && (
        <div style={{ marginTop: "2em" }}>
          <div>Your OneSignal Player ID (token):</div>
          <div
            style={{
              fontWeight: "bold",
              color: "#2a7ae2",
              wordBreak: "break-word",
            }}
          >
            {playerId}
          </div>
          <button style={{ marginTop: "0.5em" }} onClick={copyToClipboard}>
            Copy
          </button>
        </div>
      )}
    </div>
  );
};

export default OneSignalTokenTester;