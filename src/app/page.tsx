// app/components/ChatBotWithVoice.jsx
"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { Mic, User, Volume2, Send } from "lucide-react";

const STATE_MACHINE = "State Machine 1";
const LISTENING_INPUT = "start voice ";
const GLOW_INPUT = "glow";
const VOICE_CONTROL_INPUT = "voice control";
const GLOW_ROTATE_INPUT = "glow rotate";

interface Message {
  sender: string;
  text: string;
  timestamp: Date;
  id: string;
}

// Generate unique IDs to avoid collisions
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Format time consistently for server and client
const formatTime = (date: Date) => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
};

// Separate RiveAvatar component to avoid nesting
const RiveAvatar = ({ isActive, isProcessing }: { isActive: boolean; isProcessing: boolean }) => {
  const { rive, RiveComponent } = useRive({
    src: "https://public.rive.app/community/runtime-files/21478-40369-ai-voice-tm.riv",
    stateMachines: "State Machine 1",
    autoplay: true,
    onLoadError: (error) => {
      console.error("Avatar Rive load error:", error);
    },
    onLoad: () => {
      console.log("Avatar Rive component loaded successfully");
    },
  });

  const avatarInput = useStateMachineInput(rive, "State Machine 1", "start voice ");
  const glowInput = useStateMachineInput(rive, "State Machine 1", "glow");
  const voiceControlInput = useStateMachineInput(rive, "State Machine 1", "voice control");
  const glowRotateInput = useStateMachineInput(rive, "State Machine 1", "glow rotate");

  useEffect(() => {
    if (avatarInput) {
      avatarInput.value = isActive;
      console.log("Avatar start voice input updated:", isActive);
    }
    if (glowInput) {
      glowInput.value = isActive;
      console.log("Avatar glow input updated:", isActive);
    }
    if (voiceControlInput) {
      voiceControlInput.value = isActive ? 30 : 0; // Set voice control to 30 when active
      console.log("Avatar voice control input updated:", isActive ? 30 : 0);
    }
    if (glowRotateInput) {
      glowRotateInput.value = isActive;
      console.log("Avatar glow rotate input updated:", isActive);
    }
  }, [isActive, isProcessing, avatarInput, glowInput, voiceControlInput, glowRotateInput]);

  return (
    <div
      className="relative"
      style={{
        width: "100px",
        height: "100px",
        background: "transparent",
      }}
    >
      {isProcessing && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle at center, rgba(99, 102, 241, 0.3) 0%, transparent 70%)`,
            filter: `blur(20px)`,
            transform: `scale(1.3)`,
            borderRadius: "50%",
          }}
        />
      )}
      <RiveComponent
        style={{
          width: "100px",
          height: "100px",
          position: "relative",
          zIndex: 10,
          filter: isProcessing
            ? "drop-shadow(0 0 25px rgba(99, 102, 241, 1))"
            : "drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))",
          background: "transparent",
          borderRadius: "50%",
        }}
      />
    </div>
  );
};

export default function ChatBotWithVoice() {
  const initialTimestamp = new Date();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I'm your professional AI assistant. Type your message or use the voice feature to speak naturally.",
      timestamp: initialTimestamp,
      id: generateUniqueId(),
    },
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showRiveAnimation, setShowRiveAnimation] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const { rive, RiveComponent } = useRive({
    src: "https://public.rive.app/community/runtime-files/21478-40369-ai-voice-tm.riv",
    stateMachines: STATE_MACHINE,
    autoplay: true,
    onStateChange: (event) => {
      console.log("Main Rive state changed:", event.data);
    },
    onLoadError: (error) => {
      console.error("Main Rive load error:", error);
    },
    onLoad: () => {
      console.log("Main Rive component loaded successfully");
    },
  });

  const listeningInput = useStateMachineInput(rive, STATE_MACHINE, LISTENING_INPUT);
  const glowInput = useStateMachineInput(rive, STATE_MACHINE, GLOW_INPUT);
  const voiceControlInput = useStateMachineInput(rive, STATE_MACHINE, VOICE_CONTROL_INPUT);
  const glowRotateInput = useStateMachineInput(rive, STATE_MACHINE, GLOW_ROTATE_INPUT);

  const updateRiveInputs = useCallback(
    (listening: boolean, glow: boolean, voiceControl: number, glowRotate: boolean) => {
      try {
        if (listeningInput && listeningInput.value !== undefined) {
          listeningInput.value = listening;
          console.log("Main start voice input updated:", listening);
        }
        if (glowInput && glowInput.value !== undefined) {
          glowInput.value = glow;
          console.log("Main glow input updated:", glow);
        }
        if (voiceControlInput && voiceControlInput.value !== undefined) {
          voiceControlInput.value = voiceControl;
          console.log("Main voice control input updated:", voiceControl);
        }
        if (glowRotateInput && glowRotateInput.value !== undefined) {
          glowRotateInput.value = glowRotate;
          console.log("Main glow rotate input updated:", glowRotate);
        }
      } catch (error) {
        console.error("Error updating Rive inputs:", error);
      }
    },
    [listeningInput, glowInput, voiceControlInput, glowRotateInput]
  );

  useEffect(() => {
    if (!rive) return;
    if (isRecording) {
      updateRiveInputs(true, true, 30, true);
    } else if (isProcessing) {
      updateRiveInputs(true, false, 0, false);
    } else {
      updateRiveInputs(false, false, 0, false);
    }
  }, [isRecording, isProcessing, rive, updateRiveInputs]);

  const startListening = async () => {
    console.log("startListening called");
    // @ts-expect-error: webkitSpeechRecognition is not in TS types but needed for Safari
    const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.error("SpeechRecognition not supported");
      alert("Speech Recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    console.log("SpeechRecognitionClass available:", SpeechRecognitionClass.name);

    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      console.log("Microphone permission status:", permissionStatus.state);
      if (permissionStatus.state === "denied") {
        alert("Microphone access is denied. Please enable it in your browser settings.");
        return;
      }
    } catch (error) {
      console.error("Permission check error:", error);
    }

    if (!isMountedRef.current) return;

    setIsRecording(true);
    setShowRiveAnimation(true);
    updateRiveInputs(true, true, 30, true);

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      if (!isMountedRef.current) return;
      updateRiveInputs(true, true, 30, true);
    };

    recognition.onresult = async (event: any) => {
      console.log("Speech recognition result received:", event.results[0][0].transcript);
      if (!isMountedRef.current) return;

      const transcript = event.results[0][0].transcript;
      const userMessage: Message = {
        sender: "user",
        text: transcript,
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);
      setShowRiveAnimation(false);

      await new Promise((resolve) => setTimeout(resolve, 2500));

      if (!isMountedRef.current) return;

      const responses = [
        "That's interesting! Can you tell me more about that?",
        "I understand. How can I help you with that?",
        "Thanks for sharing that with me. What would you like to know?",
        "I see. Is there anything specific you'd like assistance with?",
        "Got it! Let me help you with that.",
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const botMessage: Message = {
        sender: "bot",
        text: randomResponse,
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsProcessing(false);
    };

    recognition.onerror = async (event: any) => {
      console.error("Speech recognition error:", event.error, event.message);
      if (!isMountedRef.current) return;

      let errorText = "Sorry, I didn't catch that. Please try again.";
      switch (event.error) {
        case "no-speech":
          errorText = "No speech detected. Please try speaking clearly.";
          break;
        case "audio-capture":
          errorText = "Microphone not detected. Please check your audio input.";
          break;
        case "not-allowed":
          errorText = "Microphone access denied. Please allow microphone access.";
          break;
        case "network":
          errorText = "Network error occurred. Karla check your connection.";
          break;
        default:
          errorText = `An error occurred: ${event.error}. Please try again.`;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const errorMessage: Message = {
        sender: "bot",
        text: errorText,
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsProcessing(false);
      setIsRecording(false);
      setShowRiveAnimation(false);
      updateRiveInputs(false, false, 0, false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      if (!isMountedRef.current) return;
      setIsRecording(false);
      setShowRiveAnimation(false);
      updateRiveInputs(false, false, 0, false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      console.log("Speech recognition start attempted");
      recognitionRef.current = recognition;
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setIsRecording(false);
      setShowRiveAnimation(false);
      updateRiveInputs(false, false, 0, false);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Failed to start speech recognition. Please try again.",
          timestamp: new Date(),
          id: generateUniqueId(),
        },
      ]);
    }
  };
//
  const stopListening = () => {
    console.log("stopListening called");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const stopRecording = () => {
    console.log("stopRecording called");
    if (!isMountedRef.current) return;
    setIsRecording(false);
    setShowRiveAnimation(false);
    updateRiveInputs(false, false, 0, false);
  };

  const handleSendMessage = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    console.log("handleSendMessage called");
// Handling the event for both keyboard and mouse input
    const isEnterKey = e.type === "keydown" && (e as React.KeyboardEvent<HTMLInputElement>).key === "Enter";
    const isClick = e.type === "click";

    if ((isEnterKey || isClick) && inputText.trim()) {
      e.preventDefault();

      const userMessage: Message = {
        sender: "user",
        text: inputText.trim(),
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsProcessing(true);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (!isMountedRef.current) return;

      const responses = [
        "That's interesting! Can you tell me more about that?",
        "I understand. How can I help you with that?",
        "Thanks for sharing that with me. What would you like to know?",
        "I see. Is there anything specific you'd like assistance with?",
        "Got it! Let me help you with that.",
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const botMessage: Message = {
        sender: "bot",
        text: randomResponse,
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsProcessing(false);
    }
  };

  const handleVoiceInput = () => {
    console.log("handleVoiceInput called, isRecording:", isRecording);
    if (!isRecording) {
      setShowRiveAnimation(true); // Show Rive animation when mic is clicked
      updateRiveInputs(true, true, 30, true); // Set start voice to true and voice control to 30
      startListening();
    } else {
      setShowRiveAnimation(false);
      updateRiveInputs(false, false, 0, false);
      stopListening();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl mx-auto bg-gradient-to-br from-gray-900/95 to-slate-800/95 backdrop-blur-xl text-white rounded-3xl shadow-2xl border border-purple-500/20 overflow-hidden flex flex-col h-[90vh] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />
        <div className="bg-gradient-to-r from-indigo-600/90 via-purple-600/90 to-cyan-600/90 p-6 flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse" />
          <div className="flex items-center space-x-4 relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center animate-pulse shadow-lg">
              <Volume2 className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Professional AI Assistant
              </h2>
              <p className="text-blue-100/90 text-sm font-medium">Advanced voice recognition • Real-time responses</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gradient-to-b from-gray-900/50 to-slate-900/50 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-gray-800/50 relative">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2 ${
                msg.sender === "user" ? "justify-end flex-row-reverse space-x-reverse" : "justify-start"
              } animate-fade-in`}
            >
              <div className="flex-shrink-0">
                {msg.sender === "user" ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-emerald-400/50">
                    <User size={20} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "140px",
                      height: "140px",
                    }}
                    className="relative"
                  >
                    <RiveAvatar isActive={isProcessing || isRecording} isProcessing={isProcessing} />
                  </div>
                )}
              </div>
              <div className="max-w-xs lg:max-w-md">
                <div
                  className={`px-4 py-3 rounded-2xl backdrop-blur-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white shadow-lg border border-blue-400/30"
                      : "bg-gray-800/70 text-gray-100 border border-gray-600/50 shadow-lg"
                  }`}
                >
                  <p className="text-sm leading-relaxed break-words font-medium">{msg.text}</p>
                  <p
                    className={`text-xs mt-2 font-medium ${
                      msg.sender === "user" ? "text-blue-100/80" : "text-gray-400"
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-gradient-to-r from-gray-800/90 via-slate-800/90 to-gray-800/90 border-t border-purple-500/20 flex-shrink-0 backdrop-blur-sm relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5" />
          <div className="flex flex-col items-center space-y-4 relative z-10">
            <div className="w-full flex items-center space-x-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleSendMessage}
                placeholder="Type your message here..."
                className="flex-1 px-4 py-3 bg-gray-800/80 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-600/50 border border-gray-600/50 backdrop-blur-sm transition-all font-medium"
                disabled={isProcessing || isRecording}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || isRecording || !inputText.trim()}
                className={`px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl transition-all shadow-lg ${
                  !inputText.trim() ? "opacity-50" : "hover:shadow-xl hover:scale-105"
                } disabled:bg-gray-600 disabled:cursor-not-allowed border border-indigo-500/30`}
              >
                <Send className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleVoiceInput}
                disabled={isProcessing}
                className={`px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 ${
                  isProcessing ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "text-white shadow-lg hover:shadow-xl"
                } transform hover:scale-105 active:scale-95 transition-all border border-cyan-400/30`}
              >
                <Mic className="w-6 h-6" />
              </button>
              {showRiveAnimation && (
                <div
                  className="relative"
                  style={{
                    minWidth: "150px",
                    minHeight: "150px",
                    background: "transparent",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background: `radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)`,
                      filter: `blur(15px)`,
                      transform: `scale(1.2)`,
                      borderRadius: "50%",
                    }}
                  />
                  {RiveComponent && (
                    <RiveComponent
                      style={{
                        width: "150px",
                        height: "150px",
                        position: "relative",
                        zIndex: 10,
                        filter: `drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))`,
                        background: "transparent",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`text-sm font-semibold px-4 py-2 rounded-full backdrop-blur-sm border ${
                  isRecording
                    ? "text-red-400 animate-pulse bg-red-500/10 border-red-500/30"
                    : isProcessing
                    ? "text-purple-400 animate-pulse bg-purple-500/20 border-purple-500/40"
                    : "text-gray-400 bg-gray-800/50 border-gray-600/30"
                }`}
              >
                {isRecording
                  ? "🎙️ Listening... Speak clearly"
                  : isProcessing
                  ? "✨ AI is thinking..."
                  : "💬 Ready for voice or text input"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}