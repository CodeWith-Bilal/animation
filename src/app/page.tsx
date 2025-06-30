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
  loading?: boolean;
  timestamp: Date;
  id: string;
}

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
        width: '100px', 
        height: '100px', 
        filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))' 
      }} 
    />
  );
};

// Separate ProgressCircle component
const ProgressCircle = ({ progress }: { progress: number }) => {
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const outerCircumference = 2 * Math.PI * 23;
  
  return (
    <div className="relative w-16 h-16 flex items-center justify-center select-none" style={{ background: 'transparent' }}>
      <svg
        className="absolute"
        width={74} 
        height={74} 
        viewBox="0 0 74 74"
        style={{ zIndex: 6, background: 'transparent' }}
      >
        <circle
          cx="37"
          cy="37"
          r="30"
          stroke="#06b6d4"
          strokeWidth="6"
          fill="none"
          strokeDasharray={outerCircumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="animate-spin"
        />
      </svg>
      <div className="relative w-10 h-10 flex items-center justify-center mx-2 mb-3 mr-3">
        <div className="relative z-10">
          <RiveAvatar isActive={true} />
        </div>
      </div>
    </div>
  );
};

export default function ChatBotWithVoice() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      sender: "bot", 
      text: "Hello! I'm your AI assistant. Type your message or use the mic to speak.", 
      timestamp: new Date(), 
      id: Date.now().toString() 
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [smoothedAudioLevel, setSmoothedAudioLevel] = useState(0);
  const [inputText, setInputText] = useState("");
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const glowIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rive setup with proper error handling
  const { rive, RiveComponent } = useRive({
    src: "/ai_reactive_glow.riv",
    stateMachines: STATE_MACHINE,
    autoplay: true,
    onStateChange: (event) => {
      console.log("State changed to:", event.data?.stateName || "unknown");
    },
    onLoadError: (error) => {
      console.error("Main Rive load error:", error);
    },
  });

  const listeningInput = useStateMachineInput(rive, STATE_MACHINE, LISTENING_INPUT);
  const voiceLevelInput = useStateMachineInput(rive, STATE_MACHINE, VOICE_LEVEL_INPUT);

  // Safe input updater function
  const updateRiveInputs = useCallback((listening: boolean, voiceLevel: number) => {
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
  }, [listeningInput, voiceLevelInput]);

  // Update Rive inputs when recording state changes
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
    } else {
      updateRiveInputs(false, 0);
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
        glowIntervalRef.current = null;
      }
    }

    // Cleanup function
    return () => {
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
        glowIntervalRef.current = null;
      }
    };
  }, [isRecording, rive, updateRiveInputs]);

  const setupAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }
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
    
    let sum = 0, count = 0;
    for (let i = speechStart; i < Math.min(speechEnd, dataArray.length); i++) {
      sum += dataArray[i];
      count++;
    }
    
    const average = count > 0 ? sum / count : 0;
    return Math.min(average / 128, 1);
  };

  const animateAudioLevel = () => {
    if (isRecording) {
      const rawLevel = getAudioLevel();
      const smoothingFactor = 0.8;
      const newSmoothedLevel = smoothedAudioLevel * smoothingFactor + rawLevel * (1 - smoothingFactor);
      
      setAudioLevel(rawLevel);
      setSmoothedAudioLevel(newSmoothedLevel);
      
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
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const userMessage: Message = { 
        sender: "user", 
        text: transcript, 
        timestamp: new Date(), 
        id: Date.now().toString() 
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsProcessing(true);
      
      setTimeout(() => {
        const responses = [
          "That's interesting! Can you tell me more about that?",
          "I understand. How can I help you with that?",
          "Thanks for sharing that with me. What would you like to know?",
          "I see. Is there anything specific you'd like assistance with?",
          "Got it! Let me help you with that."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const botMessage: Message = { 
          sender: "bot", 
          text: randomResponse, 
          timestamp: new Date(), 
          id: Date.now().toString() + "_ai_complete" 
        };
        
        setMessages(prev => [...prev, botMessage]);
        setIsProcessing(false);
      }, 1500);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      const errorMessage: Message = { 
        sender: "bot", 
        text: "Sorry, I didn't catch that. Please try again.", 
        timestamp: new Date(), 
        id: Date.now().toString() + "_ai_error" 
      };
      
      setMessages(prev => [...prev, errorMessage]);
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
    setIsRecording(false);
    setAudioLevel(0);
    setSmoothedAudioLevel(0);
    updateRiveInputs(false, 0);
    cleanupAudio();
  };

  const handleSendMessage = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    const isEnterKey = e.type === "keydown" && (e as React.KeyboardEvent<HTMLInputElement>).key === "Enter";
    const isClick = e.type === "click";
    
    if ((isEnterKey || isClick) && inputText.trim()) {
      e.preventDefault();
      
      const userMessage: Message = { 
        sender: "user", 
        text: inputText.trim(), 
        timestamp: new Date(), 
        id: Date.now().toString() 
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputText("");
      setIsProcessing(true);
      
      setTimeout(() => {
        const responses = [
          "That's interesting! Can you tell me more about that?",
          "I understand. How can I help you with that?",
          "Thanks for sharing that with me. What would you like to know?",
          "I see. Is there anything specific you'd like assistance with?",
          "Got it! Let me help you with that."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const botMessage: Message = { 
          sender: "bot", 
          text: randomResponse, 
          timestamp: new Date(), 
          id: Date.now().toString() + "_ai_complete" 
        };
        
        setMessages(prev => [...prev, botMessage]);
        setIsProcessing(false);
      }, 1500);
    }
  };

  const handleVoiceInput = () => {
    if (!isRecording) {
      startListening();
    } else {
      stopListening();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
      }
      cleanupAudio();
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-3 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <Volume2 className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Voice Assistant</h2>
            <p className="text-indigo-100 text-xs">Speak naturally or type, I'm listening</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-0.5 space-y-0 bg-gray-900/90 scrollbar-thin scrollbar-thumb-indigo-900 scrollbar-track-gray-800">
        {messages.map((msg, idx) => (
          <div 
            key={msg.id} 
            className={`flex items-center space-x-0 ${
              msg.sender === "user" ? "justify-end flex-row-reverse space-x-reverse" : "justify-start"
            }`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {msg.sender === "user" ? (
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold animate-bounce-in">
                  <User size={24} />
                </div>
              ) : (
                <div className="relative">
                  {isProcessing && msg.sender === "bot" && messages.length - 1 === idx ? (
                    <ProgressCircle progress={100} />
                  ) : (
                    <div style={{ width: '150px', height: '150px' }}>
                      {RiveComponent && (
                        <RiveComponent 
                          style={{ 
                            width: '150px', 
                            height: '150px', 
                            filter: 'drop-shadow(0 0 30px rgba(0, 191, 255, 0.9))' 
                          }} 
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Message Bubble */}
            <div className="max-w-xs lg:max-w-md">
              <div className={`px-0.5 py-0.5 rounded-xl ${
                msg.sender === "user" 
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg" 
                  : "bg-gray-800/80 text-gray-100 border border-gray-700 shadow-lg"
              }`}>
                {!msg.loading && <p className="text-sm leading-tight break-words">{msg.text}</p>}
                {msg.loading && msg.sender === "bot" && (
                  <div className="flex items-center space-x-0.5">
                    <div className="flex space-x-0.5">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                    </div>
                    <span className="text-xs text-gray-400">AI is thinking...</span>
                  </div>
                )}
                <p className={`text-xs mt-0 ${
                  msg.sender === "user" ? "text-blue-100" : "text-gray-500"
                }`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Voice Interface and Input */}
      <div className="p-3 bg-gradient-to-br from-gray-850 to-gray-900 border-t border-indigo-900 flex-shrink-0">
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleSendMessage}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 bg-gray-800/70 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-600"
              disabled={isProcessing || isRecording}
            />
            <button
              onClick={handleSendMessage}
              disabled={isProcessing || isRecording || !inputText.trim()}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg ${!inputText.trim() ? "opacity-50" : ""} disabled:bg-gray-600 disabled:cursor-not-allowed`}
            >
              <Send className="w-5 h-5 text-white" />
            </button>
            {!isRecording && (
              <button
                onClick={handleVoiceInput}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 ${isProcessing ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "text-white"} transform hover:scale-105 active:scale-95`}
              >
                <Mic className="w-6 h-6" />
              </button>
            )}
            {isRecording && (
              <div className="relative" style={{ minWidth: '120px', minHeight: '120px' }}>
                {RiveComponent && (
                  <RiveComponent 
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      filter: 'drop-shadow(0 0 30px rgba(0, 191, 255, 0.9))' 
                    }} 
                  />
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center space-y-1 mt-2">
            <div className={`text-sm font-medium ${isRecording ? "text-red-400 animate-pulse" : isProcessing ? "text-yellow-400" : "text-gray-400"}`}>
              {isRecording ? "🔴 Listening... Speak now" : isProcessing ? "⏳ Processing..." : "💬 Ready to listen"}
            </div>
            {isRecording && (
              <div className="text-xs text-gray-500 font-mono bg-gray-800/50 px-1 py-0.5 rounded">
                Level: {Math.floor(smoothedAudioLevel * 100)}% | Raw: {Math.floor(audioLevel * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}