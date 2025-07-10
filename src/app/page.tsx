"use client";
import React, { useEffect, useRef, useState } from "react";
import { Mic, User, Volume2, Send } from "lucide-react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

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

interface Message {
  sender: string;
  text: string;
  timestamp: Date;
  id: string;
}

const STATE_MACHINE_1 = "State Machine 1";
const STATE_MACHINE_2 = "State Machine 2";
const LISTENING_INPUT = "start voice";
const GLOW_INPUT = "glow";
const VOICE_CONTROL_INPUT = "voice control";
const GLOW_ROTATE_INPUT = "glow rotate";
const BOUNCE_INPUT = "bounce";

// Separate RiveAvatar component to avoid nesting
const RiveAvatar = ({
  isRecording,
  isProcessing,
  onClick,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  onClick?: () => void;
}) => {
  const { rive, RiveComponent } = useRive({
    src: "trailmate-ai-animation.riv",
    stateMachines: [STATE_MACHINE_1, STATE_MACHINE_2],
    autoplay: true,
    onLoadError: (error) => {
      console.error("Avatar Rive load error:", error);
    },
    onLoad: () => {
      console.log("Avatar Rive component loaded successfully");
      if (rive) {
        const inputs1 = rive.stateMachineInputs(STATE_MACHINE_1) || [];
        const inputs2 = rive.stateMachineInputs(STATE_MACHINE_2) || [];
        console.log(
          `Avatar State Machine 1 inputs:`,
          inputs1.map((input) => input.name),
          `Total inputs: ${inputs1.length}`
        );
        console.log(
          `Avatar State Machine 2 inputs:`,
          inputs2.map((input) => input.name),
          `Total inputs: ${inputs2.length}`
        );
      }
    },
    onStateChange: (event) => {
      console.log("Avatar Rive state changed:", event.data);
    },
  });

  const avatarInput = useStateMachineInput(rive, STATE_MACHINE_1, LISTENING_INPUT);
  const glowInput = useStateMachineInput(rive, STATE_MACHINE_1, GLOW_INPUT);
  const voiceControlInput = useStateMachineInput(rive, STATE_MACHINE_1, VOICE_CONTROL_INPUT);
  const glowRotateInput = useStateMachineInput(rive, STATE_MACHINE_1, GLOW_ROTATE_INPUT);
  const bounceInput = useStateMachineInput(rive, STATE_MACHINE_2, BOUNCE_INPUT);

  useEffect(() => {
    // Default all to false/0
    if (avatarInput) avatarInput.value = false;
    if (glowInput) glowInput.value = false;
    if (voiceControlInput) voiceControlInput.value = 0;
    if (glowRotateInput) glowRotateInput.value = false;
    if (bounceInput) bounceInput.value = false;

    // When AI is generating response, rotate
    if (isProcessing && glowRotateInput) {
      glowRotateInput.value = true;
      console.log("Avatar glow rotate input updated: true (AI processing)");
    }
    // When user is recording, bounce
    if (isRecording && bounceInput) {
      bounceInput.value = true;
      console.log("Avatar bounce input updated: true (user recording)");
    }
  }, [isRecording, isProcessing, avatarInput, glowInput, voiceControlInput, glowRotateInput, bounceInput]);

  return (
    <div
      className="relative cursor-pointer"
      style={{
        width: "100px",
        height: "100px",
        background: "transparent",
      }}
      onClick={onClick}
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
          width: "140px",
          height: "140px",
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

  const startListening = async () => {
    console.log("startListening called");
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

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      if (!isMountedRef.current) return;
    };

    recognition.onresult = async (event: any) => {
      console.log("Speech recognition result received:", event.results[0][0].transcript);
      if (!isMountedRef.current) return;

      setInputText(event.results[0][0].transcript);
      setIsRecording(false);
      setShowRiveAnimation(false);
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
          errorText = "Network error occurred. Please check your connection.";
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
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      if (!isMountedRef.current) return;
      setIsRecording(false);
      setShowRiveAnimation(false);
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

  const stopListening = () => {
    console.log("stopListening called");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const handleSendMessage = async (
    e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    console.log("handleSendMessage called");
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
      setShowRiveAnimation(true);
      startListening();
    } else {
      setShowRiveAnimation(false);
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
                    <RiveAvatar
                      isRecording={isRecording}
                      isProcessing={isProcessing}
                      onClick={handleVoiceInput}
                    />
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
                  className="relative cursor-pointer"
                  style={{
                    minWidth: "150px",
                    minHeight: "150px",
                    background: "transparent",
                  }}
                  onClick={handleVoiceInput}
                  title="Click to start/stop recording"
                >
                  <RiveAvatar
                    isRecording={isRecording}
                    isProcessing={isProcessing}
                    onClick={handleVoiceInput}
                  />
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