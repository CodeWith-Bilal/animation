"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { Mic, User, Volume2, Send } from "lucide-react";

const STATE_MACHINE = "State Machine 1";
const LISTENING_INPUT = "Boolean 1";
const VOICE_LEVEL_INPUT = "Number 1";

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
  // Use UTC to ensure consistency across server and client
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
};

// Separate RiveAvatar component to avoid nesting
const RiveAvatar = ({ isActive }: { isActive: boolean }) => {
  const { rive, RiveComponent } = useRive({
    src: "/rive_avatar.riv",
    stateMachines: "AvatarStateMachine",
    autoplay: true,
    onLoadError: (error) => {
      console.error("Avatar Rive load error:", error);
    },
  });

  const avatarInput = useStateMachineInput(rive, "AvatarStateMachine", "isActive");

  useEffect(() => {
    if (avatarInput) {
      avatarInput.value = isActive;
    }
  }, [isActive, avatarInput]);

  return (
    <RiveComponent
      style={{
        width: "100px",
        height: "100px",
        filter: "drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))",
      }}
    />
  );
};

export default function ChatBotWithVoice() {
  // Initialize initial message with a fixed timestamp to avoid hydration issues
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
  const [audioLevel, setAudioLevel] = useState(0);
  const [smoothedAudioLevel, setSmoothedAudioLevel] = useState(0);
  const [inputText, setInputText] = useState("");
  const [voiceGlowIntensity, setVoiceGlowIntensity] = useState(0);
  const [loadingMessageId] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const glowIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // Track component mount status

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
      }
      cleanupAudio();
    };
  }, []);

  // Rive setup with proper error handling
  const { rive, RiveComponent } = useRive({
    src: "/ai_reactive_glow.riv",
    stateMachines: STATE_MACHINE,
    autoplay: true,
    onStateChange: (event) => {
      console.log("State changed:", event.data);
    },
    onLoadError: (error) => {
      console.error("Main Rive load error:", error);
    },
  });

  const listeningInput = useStateMachineInput(rive, STATE_MACHINE, LISTENING_INPUT);
  const voiceLevelInput = useStateMachineInput(rive, STATE_MACHINE, VOICE_LEVEL_INPUT);

  // Safe input updater function
  const updateRiveInputs = useCallback(
    (listening: boolean, voiceLevel: number) => {
      try {
        if (listeningInput && listeningInput.value !== undefined) {
          listeningInput.value = listening;
          console.log("Updated listening input:", listening);
        }
        if (voiceLevelInput && voiceLevelInput.value !== undefined) {
          voiceLevelInput.value = voiceLevel;
          console.log("Updated voice level input:", voiceLevel);
        }
      } catch (error) {
        console.error("Error updating Rive inputs:", error);
      }
    },
    [listeningInput, voiceLevelInput]
  );

  // Enhanced processing animation effect
  useEffect(() => {
    if (!rive) return;

    console.log("Updating inputs - Listening:", isRecording, "Voice Level:", isRecording ? 500 : 0);

    if (isRecording) {
      updateRiveInputs(true, 0);

      // Gradual intensity increase
      let intensity = 0;
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
      }

      glowIntervalRef.current = setInterval(() => {
        intensity = Math.min(intensity + 50, 500);
        updateRiveInputs(true, intensity);
        console.log("Setting voice level to:", intensity);

        if (intensity >= 500) {
          if (glowIntervalRef.current) {
            clearInterval(glowIntervalRef.current);
            glowIntervalRef.current = null;
          }
        }
      }, 50);
    } else if (isProcessing) {
      // Processing animation without loading message
      let processingIntensity = 200;
      let increasing = true;

      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
      }

      glowIntervalRef.current = setInterval(() => {
        if (increasing) {
          processingIntensity += 25;
          if (processingIntensity >= 500) {
            increasing = false;
          }
        } else {
          processingIntensity -= 25;
          if (processingIntensity <= 200) {
            increasing = true;
          }
        }

        updateRiveInputs(true, processingIntensity);
        if (isMountedRef.current) {
          setVoiceGlowIntensity(processingIntensity / 500);
        }
      }, 100);
    } else {
      updateRiveInputs(false, 0);
      if (isMountedRef.current) {
        setVoiceGlowIntensity(0);
      }
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
        glowIntervalRef.current = null;
      }
    }
  }, [isRecording, isProcessing, rive, updateRiveInputs]);

  const setupAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // @ts-expect-error: webkitAudioContext is not in TS types but needed for Safari
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.3;
      microphoneRef.current.connect(analyserRef.current);

      return stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      return null;
    }
  };

  const getAudioLevel = () => {
    if (!analyserRef.current) return 0;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const speechStart = Math.floor(300 * dataArray.length / (audioContextRef.current?.sampleRate / 2 || 22050));
    const speechEnd = Math.floor(3400 * dataArray.length / (audioContextRef.current?.sampleRate / 2 || 22050));

    let sum = 0,
      count = 0;
    for (let i = speechStart; i < Math.min(speechEnd, dataArray.length); i++) {
      sum += dataArray[i];
      count++;
    }

    const average = count > 0 ? sum / count : 0;
    return Math.min(average / 128, 1);
  };

  const animateAudioLevel = () => {
    if (isRecording && isMountedRef.current) {
      const rawLevel = getAudioLevel();
      const smoothingFactor = 0.8;
      const newSmoothedLevel = smoothedAudioLevel * smoothingFactor + rawLevel * (1 - smoothingFactor);

      setAudioLevel(rawLevel);
      setSmoothedAudioLevel(newSmoothedLevel);
      setVoiceGlowIntensity(newSmoothedLevel);

      // Update Rive voice level with dynamic audio
      updateRiveInputs(true, Math.floor(newSmoothedLevel * 500));

      animationRef.current = requestAnimationFrame(animateAudioLevel);
    }
  };

  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }
  };

  const startListening = async () => {
    // @ts-expect-error: webkitSpeechRecognition is not in TS types but needed for Safari
    const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Speech Recognition not supported in this browser");
      return;
    }

    const stream = await setupAudioVisualization();
    if (!stream) return;

    if (!isMountedRef.current) return;

    setIsRecording(true);
    updateRiveInputs(true, 200);

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      animateAudioLevel();
    };

    recognition.onresult = async (event: any) => {
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

      // Simulate AI processing delay
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
      console.error("Speech recognition error:", event.error);

      if (!isMountedRef.current) return;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const errorMessage: Message = {
        sender: "bot",
        text: "Sorry, I didn't catch that. Please try again.",
        timestamp: new Date(),
        id: generateUniqueId(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsProcessing(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      stopRecording();
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const stopRecording = () => {
    if (!isMountedRef.current) return;
    setIsRecording(false);
    setAudioLevel(0);
    setSmoothedAudioLevel(0);
    setVoiceGlowIntensity(0);
    updateRiveInputs(false, 0);
    cleanupAudio();
  };

  const handleSendMessage = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
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

      // Simulate AI processing delay
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
    if (!isRecording) {
      startListening();
    } else {
      stopListening();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl mx-auto bg-gradient-to-br from-gray-900/95 to-slate-800/95 backdrop-blur-xl text-white rounded-3xl shadow-2xl border border-purple-500/20 overflow-hidden flex flex-col h-[90vh] relative">
        {/* Animated background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse" />

        {/* Header */}
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

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gradient-to-b from-gray-900/50 to-slate-900/50 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-gray-800/50 relative">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2 ${
                msg.sender === "user" ? "justify-end flex-row-reverse space-x-reverse" : "justify-start"
              } animate-fade-in`}
            >
              {/* Avatar */}
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
                      filter: `drop-shadow(0 0 ${25 + voiceGlowIntensity * 35}px rgba(0, 191, 255, ${
                        0.4 + voiceGlowIntensity * 0.8
                      }))`,
                    }}
                    className="relative"
                  >
                    {/* Dynamic glow background */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `radial-gradient(circle, rgba(0, 191, 255, ${0.15 + voiceGlowIntensity * 0.5}) 0%, transparent 70%)`,
                        filter: `blur(${15 + voiceGlowIntensity * 25}px)`,
                        transform: `scale(${1 + voiceGlowIntensity * 0.4})`,
                      }}
                    />
                    {RiveComponent && (
                      <RiveComponent
                        style={{
                          width: "140px",
                          height: "140px",
                          position: "relative",
                          zIndex: 10,
                          filter: `drop-shadow(0 0 20px rgba(0, 191, 255, 0.8))`,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Message Bubble */}
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

        {/* Voice Interface and Input */}
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

              {!isRecording && (
                <button
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className={`px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 ${
                    isProcessing ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "text-white shadow-lg hover:shadow-xl"
                  } transform hover:scale-105 active:scale-95 transition-all border border-cyan-400/30`}
                >
                  <Mic className="w-6 h-6" />
                </button>
              )}

              {isRecording && (
                <div className="relative" style={{ minWidth: "150px", minHeight: "150px" }}>
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background: `radial-gradient(circle, rgba(6, 182, 212, ${0.2 + voiceGlowIntensity * 0.6}) 0%, transparent 70%)`,
                      filter: `blur(${15 + voiceGlowIntensity * 25}px)`,
                      transform: `scale(${1.2 + voiceGlowIntensity * 0.8})`,
                    }}
                  />
                  {RiveComponent && (
                    <RiveComponent
                      style={{
                        width: "150px",
                        height: "150px",
                        position: "relative",
                        zIndex: 10,
                        filter: `drop-shadow(0 0 ${10 + voiceGlowIntensity * 20}px rgba(6, 182, 212, ${
                          0.5 + voiceGlowIntensity * 0.5
                        }))`,
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

              {isRecording && (
                <div className="flex items-center space-x-4 text-xs text-gray-400 font-mono bg-gray-800/70 px-3 py-1 rounded-lg border border-gray-600/30 backdrop-blur-sm">
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <span>Voice Level: {Math.floor(smoothedAudioLevel * 100)}%</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    <span>Raw: {Math.floor(audioLevel * 100)}%</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}