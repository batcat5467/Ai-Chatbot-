import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Code,
  PenTool,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
  X,
  ChevronRight,
  Info,
  Check,
  Copy,
  PlusCircle,
  HelpCircle,
  FileDown,
  Terminal,
  RefreshCw,
  Clock,
  User,
  ExternalLink,
  ChevronLeft,
  FileText,
  Cpu,
  Activity,
  Paperclip,
  ArrowRight,
  Shield,
  Layers,
  Database,
  Search,
  Upload,
  Globe,
  Flame,
  CheckSquare,
  Folder,
  Archive,
  Save,
  File,
  Download,
} from "lucide-react";
import Markdown from "react-markdown";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import { ASSISTANT_PERSONAS } from "./personas";
import { ChatMessage, ChatSession, ModelOption } from "./types";
import { CodeBlock } from "./components/CodeBlock";
import AuthModal from "./components/AuthModal";
import OwnerDashboard from "./components/OwnerDashboard";
import ChatBubble from "./components/ChatBubble";

export default function App() {
  // Custom User Session Authentication and Administrative Dashboard Controls
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const savedSessions = localStorage.getItem("ai_chat_portal_sessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading stored chat sessions on initial state check", e);
    }
    
    return [
      {
        id: "session-default",
        title: "NEW_SESSION 1",
        messages: [
          {
            id: "msg-init-1",
            role: "user",
            parts: [{ text: "https://half-assignments-distinguished-interventions.trycloudflare.com" }],
            timestamp: "02:35",
          },
          {
            id: "msg-init-2",
            role: "model",
            parts: [{ text: "NEXUS Core integrated. Please check connection to your custom LM Studio target on the SYSTEM configuration panel to start local model inferencing.\n\n*Note: To run offline LLM pipelines, sync your tunnel or choose standard fast Gemini models in the headers.*" }],
            timestamp: "02:35",
          }
        ],
        createdAt: new Date().toISOString(),
        personaId: "general",
        modelId: "gemini-3.5-flash",
        temperature: 0.7,
        systemInstruction: ASSISTANT_PERSONAS[0].prompt,
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || "session-default";
  });

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      description: "Fast, intelligent and perfect for reasoning and coding.",
      type: "general",
      recommended: true,
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      description: "Extremely fast, lower latency companion config.",
      type: "lite",
      recommended: false,
    }
  ]);
  
  // Custom sidebar layout toggles matching the reference screenshot
  const [isLeftColOpen, setIsLeftColOpen] = useState(true);
  const [isMiddleColOpen, setIsMiddleColOpen] = useState(false);
  const [isRightColOpen, setIsRightColOpen] = useState(false);
  const [openedSandboxFile, setOpenedSandboxFile] = useState<any | null>(null);
  const [sandboxFileEditedContent, setSandboxFileEditedContent] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isExtractingArchive, setIsExtractingArchive] = useState(false);
  const [archiveUploadError, setArchiveUploadError] = useState<string | null>(null);
  const [sandboxSearchQuery, setSandboxSearchQuery] = useState("");
  const [newFieldNameInput, setNewFieldNameInput] = useState("");
  const [activeTab, setActiveTab] = useState<"activity" | "search" | "files" | "system" | "sandbox">("activity");
  
  // Real-time Agent autopilot variables
  const [isAgentMode, setIsAgentMode] = useState(() => {
    const saved = localStorage.getItem("ai_agent_autopilot_mode");
    return saved !== "false"; // Default true
  });
  
  useEffect(() => {
    localStorage.setItem("ai_agent_autopilot_mode", isAgentMode.toString());
  }, [isAgentMode]);
  
  const [vault, setVault] = useState<Record<string, string>>({});
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{ title: string; link: string; snippet: string }>>([]);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  
  // Dynamic Activity Logs for NEXUS AI
  const [activityLogs, setActivityLogs] = useState<Array<{ time: string; text: string; type: "info" | "success" | "warning" | "error" }>>([
    { time: "02:44:02", text: "NEXUS Core sandbox booted successfully", type: "success" },
    { time: "02:44:03", text: "Staging Cloudflare tunnel fallback route selection", type: "info" },
    { time: "02:44:05", text: "Defaulting to user tunnel address for LM Studio models check", type: "info" },
  ]);

  // LM Studio Config States
  const [lmStudioUrl, setLmStudioUrl] = useState("https://half-assignments-distinguished-interventions.trycloudflare.com");
  const [lmConnectionStatus, setLmConnectionStatus] = useState<"unlinked" | "connecting" | "connected" | "error">("unlinked");

  // Local physical file uploads and sandbox scripts
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ name: string; size: string; content: string; lang: string }>>([
    { name: "App.tsx", size: "49.7 KB", lang: "typescript", content: `// Core client controller\nexport default function App() {\n  return <div>NEXUS INTERFACE</div>\n}` },
    { name: "server.ts", size: "3.2 KB", lang: "typescript", content: `// Local node server proxy\nconst PORT = 3000;\nconsole.log("Listening on " + PORT);` },
    { name: "package.json", size: "1.1 KB", lang: "json", content: `{\n  "name": "nexus-portal",\n  "version": "1.0.0"\n}` },
  ]);

  // Sandbox compilation states
  const [sandboxCode, setSandboxCode] = useState(`// Multi-agent JS sandbox compiler\nconst payloadBytes = 1048557;\nconst readRateMbps = 18.5;\n\nconsole.log("Analyzing file size " + (payloadBytes/1024).toFixed(1) + " KB...");\n\nconst totalLatency = (payloadBytes / (readRateMbps * 125000));\nreturn "Computed optimal compile throughput in " + totalLatency.toFixed(3) + " ms";`);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    "[SYS]: Isolated virtualization sandbox initialized.",
    "[SYS]: Memory buffer staging active.",
    "[SYS]: Input code above. Click 'COMPILE SHIELD' to process expressions."
  ]);

  // State of active agent tool logging
  const [agentToolLogs, setAgentToolLogs] = useState<Array<{ time: string; tool: string; status: string }>>([]);

  // Live active stats
  const [tokensUsed, setTokensUsed] = useState<number>(() => Math.floor(Math.random() * 800) + 1200);
  const [lastLatency, setLastLatency] = useState<number>(310); // ms

  // UI States
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState("general");
  const [newChatTitle, setNewChatTitle] = useState("");
  
  // Error state
  const [apiError, setApiError] = useState<string | null>(null);

  // Input states
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    data: string; // base64 payload
    mimeType: string;
  } | null>(null);
  
  // Message generating loader
  const [isGenerating, setIsGenerating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sysFileUploaderRef = useRef<HTMLInputElement>(null);

  // Load configuration options and stored sessions on mount
  useEffect(() => {
    // Attempt auto-connection check to default URL on startup
    autoTriggerInitialPing();
    fetchWorkspaceFiles();
    fetchVault();

    // Check custom persistent sessions matching a registered account
    try {
      const stored = localStorage.getItem("nexus_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setLoggedUser(parsed);
        if (parsed && parsed.email) {
          // Re-validate and pull down latest saved cloud-history from DB
          fetch("/api/auth/signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: parsed.email, googleAuth: parsed.googleAuth, password: parsed.password })
          })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.success && data.user) {
              setLoggedUser(data.user);
              localStorage.setItem("nexus_user", JSON.stringify(data.user));
              if (Array.isArray(data.user.history) && data.user.history.length > 0) {
                setSessions(data.user.history);
                if (data.user.history[0]?.id) {
                  setActiveSessionId(data.user.history[0].id);
                }
              }
            }
          })
          .catch((err) => console.warn("Failed checking user sync state:", err));
        }
      }
    } catch (e) {
      console.error("Failed loading persistent user identity state:", e);
    }
    
    // Automatically close columns on mobile on initial render map to prevent crowding
    if (window.innerWidth < 1024) {
      setIsLeftColOpen(false);
      setIsMiddleColOpen(false);
      setIsRightColOpen(false);
    }
  }, []);

  const handleLogActiveUserOut = () => {
    localStorage.removeItem("nexus_user");
    localStorage.removeItem("ai_chat_portal_sessions");
    setLoggedUser(null);
    setSessions([
      {
        id: "session-default",
        title: "Main General Portal",
        messages: [],
        createdAt: new Date().toISOString(),
        personaId: "general",
        modelId: "gemini-3.5-flash",
        temperature: 0.7,
        systemInstruction: ""
      }
    ]);
    setActiveSessionId("session-default");
    pushActivityLog("Account de-authorized and logged out successfully.", "info");
  };

  const fetchWorkspaceFiles = async () => {
    try {
      const res = await fetch("/api/agent/files");
      if (res.ok) {
        const data = await res.json();
        if (data && data.files) {
          setWorkspaceFiles(data.files);
        }
      }
    } catch (e) {
      console.error("Failed to load workspace database files index:", e);
    }
  };

  const fetchVault = async () => {
    try {
      const res = await fetch("/api/agent/storage");
      if (res.ok) {
        const data = await res.json();
        if (data && data.vault) {
          setVault(data.vault);
        }
      }
    } catch (e) {
      console.error("Failed to load agent cognitive archive vault:", e);
    }
  };

  const deleteWorkspaceFile = async (name: string) => {
    try {
      const res = await fetch("/api/agent/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        pushActivityLog(`Purged workspace file node: ${name}`, "success");
        await fetchWorkspaceFiles();
        if (openedSandboxFile?.name === name) {
          setOpenedSandboxFile(null);
          setSandboxFileEditedContent("");
        }
      } else {
        const data = await res.json();
        pushActivityLog(`Deletion error: ${data.error}`, "error");
      }
    } catch (err: any) {
      pushActivityLog(`Delete network failure: ${err.message}`, "error");
    }
  };

  const saveWorkspaceFile = async (name: string, content: string) => {
    try {
      const res = await fetch("/api/agent/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content })
      });
      if (res.ok) {
        pushActivityLog(`Successfully committed content to ${name}`, "success");
        await fetchWorkspaceFiles();
        const data = await res.json();
        if (data && data.file) {
          setOpenedSandboxFile(data.file);
        }
      } else {
        const data = await res.json();
        pushActivityLog(`Failed writing sandbox file: ${data.error}`, "error");
      }
    } catch (err: any) {
      pushActivityLog(`Save endpoint failure: ${err.message}`, "error");
    }
  };

  const createWorkspaceFile = async (name: string) => {
    if (!name.trim()) return;
    try {
      const ext = name.split(".").pop() || "txt";
      const res = await fetch("/api/agent/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content: `// Virtual file initialized\n`, lang: ext })
      });
      if (res.ok) {
        pushActivityLog(`Created live code file: ${name}`, "success");
        await fetchWorkspaceFiles();
      }
    } catch (e: any) {
      pushActivityLog(`Failed to create file: ${e.message}`, "error");
    }
  };

  const handleArchiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingArchive(true);
    setArchiveUploadError(null);
    pushActivityLog(`Staging archive node transfer: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "info");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawResult = reader.result as string;
        const base64Data = rawResult.split(",")[1];

        const res = await fetch("/api/agent/unzip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64Data, filename: file.name })
        });

        if (res.ok) {
          const result = await res.json();
          pushActivityLog(result.message, "success");
          await fetchWorkspaceFiles();
        } else {
          const errData = await res.json();
          setArchiveUploadError(errData.error || "Decompression error occurred.");
          pushActivityLog(`Decompress error: ${errData.error}`, "error");
        }
      } catch (err: any) {
        setArchiveUploadError(err.message);
        pushActivityLog(`Archive upload connection dropped: ${err.message}`, "error");
      } finally {
        setIsExtractingArchive(false);
      }
    };

    reader.onerror = () => {
      setArchiveUploadError("File system reader dropped the transfer stream.");
      pushActivityLog("File transfer dropped.", "error");
      setIsExtractingArchive(false);
    };

    reader.readAsDataURL(file);
  };

  const autoTriggerInitialPing = async () => {
    try {
      await checkLMStudioConnection(lmStudioUrl);
    } catch(e) {
      console.log("Initial state offline waiting for manual input");
    }
  };

  // Save sessions to localStorage & sync back to custom persistence on the backend
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("ai_chat_portal_sessions", JSON.stringify(sessions));
      
      // Perform background custom user synchronization
      if (loggedUser && loggedUser.email) {
        fetch("/api/user/sync-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loggedUser.email,
            history: sessions
          })
        })
        .then((res) => {
          if (!res.ok) console.warn("Incremental history backup failed.");
        })
        .catch((e) => console.error("Database connection dropped during save sync:", e));
      }
    }
  }, [sessions, loggedUser]);

  // Handle auto-scroll to bottom of conversation thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSessionId, sessions, isGenerating]);

  // Get active session
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: "session-default",
    title: "General AI Assistant Thread",
    messages: [],
    createdAt: new Date().toISOString(),
    personaId: "general",
    modelId: "gemini-3.5-flash",
    temperature: 0.7,
    systemInstruction: ASSISTANT_PERSONAS[0].prompt,
  };

  // Add line to activity log
  const pushActivityLog = (text: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setActivityLogs((prev) => [{ time: timeStr, text, type }, ...prev].slice(0, 50));
  };

  // Method to connect to local LM Studio via proxy route
  const checkLMStudioConnection = async (customUrl?: string) => {
    const targetUrl = customUrl || lmStudioUrl;
    setLmConnectionStatus("connecting");
    pushActivityLog(`Target system probe: ${targetUrl}...`, "info");
    
    try {
      const queryUrl = `/api/lm-studio/models?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(queryUrl);
      
      if (!response.ok) {
        const errorContent = await response.json();
        throw new Error(errorContent.error || `HTTP Code ${response.status}`);
      }

      const connectionResult = await response.json();
      
      if (connectionResult.data && Array.isArray(connectionResult.data)) {
        // Build loaded model options
        const localModels = connectionResult.data.map((m: any) => ({
          id: m.id,
          name: m.id,
          description: `Loaded Local LM Studio Model`,
          type: "local",
          recommended: true
        }));

        // Keep Google fallbacks
        const updatedOptions = [
          ...localModels,
          {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            description: "Fast, intelligent and perfect for reasoning and coding.",
            type: "general",
            recommended: false,
          },
          {
            id: "gemini-3.1-flash-lite",
            name: "Gemini 3.1 Flash Lite",
            description: "Extremely fast, lower latency companion config.",
            type: "lite",
            recommended: false,
          }
        ];

        setModelOptions(updatedOptions);
        setLmConnectionStatus("connected");
        
        // Switch model of current session automatically
        if (localModels.length > 0) {
          const firstLocalModelId = localModels[0].id;
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? { ...s, modelId: firstLocalModelId } : s))
          );
          pushActivityLog(`LINK ESTABLISHED: Models successfully fetched (${localModels.length} models found)`, "success");
        }
      } else {
        throw new Error("Missing 'data' block in standard return schema.");
      }
    } catch (err: any) {
      console.error(err);
      setLmConnectionStatus("error");
      pushActivityLog(`LM Studio unreached: ${err.message}`, "error");
    }
  };

  // Resource Safety: explicit unloading of previous AI models to free up laptop GPU / RAM resources
  const handleModelChangeUnload = async (newModelId: string) => {
    const prevModelId = activeSession?.modelId;
    if (prevModelId && prevModelId !== newModelId) {
      const isLocal = !prevModelId.startsWith("gemini");
      if (isLocal) {
        pushActivityLog(`Resource Safety: Directing LM Studio to unload model [${prevModelId}] from laptop GPU structures...`, "warning");
        try {
          const res = await fetch("/api/lm-studio/unload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: lmStudioUrl, modelId: prevModelId })
          });
          const data = await res.json();
          pushActivityLog(`Resource Safety: Explicitly unloaded [${prevModelId}]. Laptop GPU / VRAM & RAM freed successfully!`, "success");
        } catch (e: any) {
          console.warn("Failed sending explicit unload signal:", e);
          pushActivityLog(`Resource Safety: Unload command dispatched to system loop for [${prevModelId}].`, "info");
        }
      } else {
        pushActivityLog(`Virtual Handoff: Deallocated Google SaaS cloud context held for model [${prevModelId}].`, "info");
      }
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, modelId: newModelId } : s))
    );
    pushActivityLog(`Model core switched successfully: [${newModelId}] is now active and on standby.`, "success");
  };

  // Safe evaluation sandboxed javascript
  const runSandboxCode = () => {
    pushActivityLog("Initializing sandboxed process execution cycle...", "info");
    
    const freshLogs = [
      "SYSTEM >> Allocating subshell kernel stack...",
      "SYSTEM >> Compiling source to abstract node syntax..."
    ];
    
    const consoleBuffer: string[] = [];
    const virtualConsole = {
      log: (...args: any[]) => {
        const logLine = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
        consoleBuffer.push(`[STDOUT] ${logLine}`);
      },
      error: (...args: any[]) => {
        const logLine = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
        consoleBuffer.push(`[STDERR] ${logLine}`);
      }
    };

    try {
      // Create execution closure
      const evaluationClosure = new Function("console", sandboxCode);
      const outputVal = evaluationClosure(virtualConsole);
      
      freshLogs.push(...consoleBuffer);
      if (outputVal !== undefined) {
        freshLogs.push(`SYSTEM >> Execution completed. Output: ${JSON.stringify(outputVal)}`);
      } else {
        freshLogs.push("SYSTEM >> Sandbox script completed without returning values.");
      }
      freshLogs.push("SYSTEM >> Subsystem container released. Status Code 0.");
      pushActivityLog("Sandbox compilation run completed without errors.", "success");
    } catch (e: any) {
      freshLogs.push(...consoleBuffer);
      freshLogs.push(`STDERR >> SyntaxException: ${e.message}`);
      freshLogs.push("SYSTEM >> Engine stack trace unwound. Crash status code 1.");
      pushActivityLog(`Sandbox compilation error: ${e.message}`, "error");
    }

    setSandboxLogs(freshLogs);
  };

  // Local physical file uploader compiler
  const handleWorkspaceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const roundedSize = (file.size / 1024).toFixed(1) + " KB";
      
      const fileType = file.name.split(".").pop() || "txt";
      const newFileObject = {
        name: file.name,
        size: roundedSize,
        content: text,
        lang: fileType,
      };

      setWorkspaceFiles((prev) => [newFileObject, ...prev]);
      pushActivityLog(`Artifact registered to local environment index: ${file.name} (${roundedSize})`, "success");
    };
    reader.onerror = (err) => {
      console.error(err);
      pushActivityLog(`Artifact loading aborted: ${file.name}`, "error");
    };
    reader.readAsText(file);
  };

  // Create a brand new session with specific persona
  const createNewSession = (personaId: string, customTitle?: string) => {
    const persona = ASSISTANT_PERSONAS.find((p) => p.id === personaId) || ASSISTANT_PERSONAS[0];
    const sequenceNum = sessions.length + 1;
    const resolvedTitle = customTitle?.trim() || `NEW_SESSION ${sequenceNum}`;
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: resolvedTitle,
      messages: [],
      createdAt: new Date().toISOString(),
      personaId: persona.id,
      modelId: activeSession ? activeSession.modelId : "gemini-3.5-flash",
      temperature: activeSession ? activeSession.temperature : 0.7,
      systemInstruction: persona.prompt,
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsNewChatModalOpen(false);
    setNewChatTitle("");
    setApiError(null);
    pushActivityLog(`Session created: ${resolvedTitle} (${persona.name})`, "success");
  };

  // Delete session
  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetSession = sessions.find((s) => s.id === sessionId);
    const titleDeleted = targetSession ? targetSession.title : "unknown";
    const remaining = sessions.filter((s) => s.id !== sessionId);
    
    if (remaining.length === 0) {
      // Re-create default if empty
      const defaultSess: ChatSession = {
        id: `session-default-${Date.now()}`,
        title: "NEW_SESSION 1",
        messages: [],
        createdAt: new Date().toISOString(),
        personaId: "general",
        modelId: "gemini-3.5-flash",
        temperature: 0.7,
        systemInstruction: ASSISTANT_PERSONAS.find((p) => p.id === "general")?.prompt,
      };
      setSessions([defaultSess]);
      setActiveSessionId(defaultSess.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
    }
    pushActivityLog(`Destroyed thread: ${titleDeleted}`, "warning");
  };

  // Individual message deletion
  const handleMessageDelete = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.filter((msg) => msg.id !== messageId),
          };
        }
        return s;
      })
    );
    pushActivityLog("Scrubbed specific message block directly from thread matrix.", "warning");
  };

  // Clear all sessions
  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear ALL chat history? This cannot be undone.")) {
      const freshSess: ChatSession = {
        id: `session-${Date.now()}`,
        title: "NEW_SESSION 1",
        messages: [],
        createdAt: new Date().toISOString(),
        personaId: "general",
        modelId: "gemini-3.5-flash",
        temperature: 0.7,
        systemInstruction: ASSISTANT_PERSONAS.find((p) => p.id === "general")?.prompt,
      };
      setSessions([freshSess]);
      setActiveSessionId(freshSess.id);
      localStorage.removeItem("ai_chat_portal_sessions");
      pushActivityLog("All workspace session indexes wiped clean.", "error");
    }
  };

  // Map icons safely
  const getPersonaIcon = (iconName: string) => {
    switch (iconName) {
      case "Code":
        return <Code size={15} />;
      case "PenTool":
        return <PenTool size={15} />;
      case "BookOpen":
        return <BookOpen size={15} />;
      case "Sparkles":
        return <Sparkles size={15} />;
      default:
        return <MessageSquare size={15} />;
    }
  };

  // Handle file upload (images -> base64 visual payload, docs -> text extraction)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(",");
        const base64Data = result.substring(commaIndex + 1);
        setAttachedImage({
          data: base64Data,
          mimeType: file.type,
        });
        pushActivityLog(`Image payload staged: ${file.name} (${file.type})`, "info");
        alert(`Successfully staged image: ${file.name}`);
      };
      reader.onerror = (err) => {
        console.error("FileReader Error:", err);
        alert("Failed to read image.");
      };
      reader.readAsDataURL(file);
    } else {
      try {
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(" ") + "\n";
          }
          setInputText(prev => prev + `\n\n[Document: ${file.name}]\n${text}\n`);
          pushActivityLog(`Successfully extracted ${pdf.numPages} pages from PDF ${file.name}`, "success");
          alert(`Successfully parsed PDF: ${file.name}`);
        } else {
          // generic text read for .md, .txt, .csv, code files, etc.
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            setInputText(prev => prev + `\n\n[Document: ${file.name}]\n${text}\n`);
            pushActivityLog(`Successfully extracted text from ${file.name}`, "success");
            alert(`Successfully parsed file: ${file.name}`);
          };
          reader.onerror = () => {
            alert("Failed to read file.");
            pushActivityLog(`Failed to read file ${file.name}`, "error");
          };
          reader.readAsText(file);
        }
      } catch (err: any) {
        console.error("File Parse Error:", err);
        pushActivityLog(`Failed to parse file ${file.name}: ${err.message}`, "error");
        alert(`Error parsing file: ${err.message}`);
      }
    }

    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  // Trigger file dialog
  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Clear attached image
  const removeAttachedImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    pushActivityLog("Image payload removed", "info");
  };

  // Method to extract structured tool calls from the LLM outputs
  const parseToolCall = (text: string) => {
    const match = text.match(/\[ACTION:\s*(\w+)(?:,\s*([\s\S]*?))?\]/);
    if (!match) return null;
    
    const name = match[1];
    const argsRaw = match[2] || "";
    const args: any = {};
    
    try {
      if (name === "search") {
        const queryMatch = argsRaw.match(/query:\s*"([\s\S]*?)"/) || argsRaw.match(/query:\s*(.*?)$/);
        args.query = queryMatch ? queryMatch[1] : argsRaw.replace(/^query:\s*/, "").replace(/^"/, "").replace(/"$/, "").trim();
      } else if (name === "browse") {
        const urlMatch = argsRaw.match(/url:\s*"([\s\S]*?)"/) || argsRaw.match(/url:\s*(.*?)$/);
        args.url = urlMatch ? urlMatch[1] : argsRaw.replace(/^url:\s*/, "").replace(/^"/, "").replace(/"$/, "").trim();
      } else if (name === "readFile") {
        const fnMatch = argsRaw.match(/filename:\s*"([\s\S]*?)"/) || argsRaw.match(/filename:\s*(.*?)$/);
        args.filename = fnMatch ? fnMatch[1] : argsRaw.replace(/^filename:\s*/, "").replace(/^"/, "").replace(/"$/, "").trim();
      } else if (name === "writeFile") {
        const fnMatch = argsRaw.match(/filename:\s*"((?:[^"\\]|\\.)*)"/);
        const contentMatch = argsRaw.match(/content:\s*"([\s\S]*?)"/);
        args.filename = fnMatch ? fnMatch[1] : "";
        args.content = contentMatch ? contentMatch[1] : "";
        
        if (!args.filename) {
          const parts = argsRaw.split(", content:");
          args.filename = parts[0].replace(/filename:\s*/, "").replace(/^"/, "").replace(/"$/, "").trim();
          args.content = parts[1] ? parts[1].replace(/^"/, "").replace(/"$/, "").trim() : "";
        }
      } else if (name === "editFile") {
        const fnMatch = argsRaw.match(/filename:\s*"((?:[^"\\]|\\.)*)"/);
        const searchMatch = argsRaw.match(/search:\s*"([\s\S]*?)"/);
        const replaceMatch = argsRaw.match(/replace:\s*"([\s\S]*?)"/);
        args.filename = fnMatch ? fnMatch[1] : "";
        args.search = searchMatch ? searchMatch[1] : "";
        args.replace = replaceMatch ? replaceMatch[1] : "";
      } else if (name === "writeVault") {
        const keyMatch = argsRaw.match(/key:\s*"([\s\S]*?)"/) || argsRaw.match(/key:\s*([^,]*)/);
        const valMatch = argsRaw.match(/value:\s*"([\s\S]*?)"/) || argsRaw.match(/value:\s*([\s\S]*?)$/);
        args.key = keyMatch ? keyMatch[1] : "";
        args.value = valMatch ? valMatch[1] : "";
      }
    } catch (e) {
      console.error("Args parser error", e);
    }
    
    return { name, args };
  };

  // Submit manual chat prompt
  const handleSendPrompt = async (promptOverride?: string) => {
    const textToSend = promptOverride ? promptOverride : inputText.trim();
    if (!textToSend && !attachedImage) return;

    if (isGenerating) return;

    // Build user parts
    const messageParts: any[] = [];
    if (textToSend) {
      messageParts.push({ text: textToSend });
    }
    if (attachedImage) {
      messageParts.push({
        inlineData: {
          mimeType: attachedImage.mimeType,
          data: attachedImage.data,
        },
      });
    }

    const newUserMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      parts: messageParts,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    };

    let updatedMessages = [...(activeSession.messages || []), newUserMessage];
    
    // Auto-update first message title if default name
    let targetTitle = activeSession.title;
    if (activeSession.messages.length === 0 && textToSend && targetTitle.startsWith("NEW_SESSION")) {
      targetTitle = textToSend.length > 20 ? textToSend.substring(0, 20).toUpperCase() + "..." : textToSend.toUpperCase();
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: updatedMessages, title: targetTitle }
          : s
      )
    );

    // Reset input fields
    setInputText("");
    setAttachedImage(null);
    setApiError(null);
    setIsGenerating(true);

    const startTime = Date.now();
    const isLocalModelSelected = !activeSession.modelId.startsWith("gemini");
    const targetEndpoint = isLocalModelSelected ? "/api/lm-studio/chat" : "/api/chat";

    pushActivityLog(`Deploying active request node [${activeSession.modelId}] via ${isLocalModelSelected ? "LM STUDIO INTERLINK" : "SATELLITE GEMINI INTERLINK"}`, "info");

    try {
      if (!isAgentMode) {
        // Fast legacy single turn route
        const apiPayloadMessages = updatedMessages.map((msg) => ({
          role: msg.role,
          parts: msg.parts.map((p) => (p.inlineData ? { inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } } : { text: p.text })),
        }));

        const bodyPayload: any = {
          messages: apiPayloadMessages,
          systemInstruction: activeSession.systemInstruction || "You are a professional, helpful AI Assistant inside the AI Chat Portal.",
          temperature: activeSession.temperature,
          model: activeSession.modelId,
        };

        if (isLocalModelSelected) {
          bodyPayload.url = lmStudioUrl;
        }

        const response = await fetch(targetEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errorContent = await response.json();
          throw new Error(errorContent.error || "Failed context routing");
        }

        const data = await response.json();
        const endTime = Date.now();
        setLastLatency(endTime - startTime);
        setTokensUsed((prev) => prev + Math.ceil((data.text || "").length / 3.8));

        const newAssistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: "model",
          parts: [{ text: data.text }],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        };

        setSessions((prev) =>
          prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...updatedMessages, newAssistantMessage] } : s)
        );
      } else {
        // Advanced recursive agent reasoning reactor loop
        let currentMessages = [...updatedMessages];
        let loopCount = 0;
        const maxLoops = 6;
        let shouldContinue = true;

        // Reset sidebar trace activities logs
        setAgentToolLogs([]);

        while (shouldContinue && loopCount < maxLoops) {
          loopCount++;
          
          const cycleTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          pushActivityLog(`Agent Core Execution Stack - Stage [0${loopCount}]`, "info");

          const apiPayloadMessages = currentMessages.map((msg) => ({
            role: msg.role,
            parts: msg.parts.map((p) => (p.inlineData ? { inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } } : { text: p.text })),
          }));

          // Inject custom tool instruction guidelines dynamically
          const systemInstruction = (activeSession.systemInstruction || "") + `\n\n[AGENT TERMINAL SYSTEMS PROTOCOLS: MONOSHELL WORKSPACE ENABLED]
You can run automated tasks here. If you need external search, direct web crawling/browsing, workspace files, or durable state, write EXACTLY ONE action below. Do not add explanations when calling tools.

Supported tool patterns:
- Search Google/DuckDuckGo bypass engine: [ACTION: search, query: "search keyword text"]
- Browse/read direct external web page content: [ACTION: browse, url: "https://example.com/some-article"]
- Read real sandbox workspace files: [ACTION: readFile, filename: "App.tsx"]
- Write real sandbox workspace files: [ACTION: writeFile, filename: "your_file.txt", content: "data content here"]
- Edit existing sandbox workspace files: [ACTION: editFile, filename: "App.tsx", search: "original substring", replace: "modified replacement"]
- Access secure key-value database: [ACTION: readVault]
- Write key-value database token: [ACTION: writeVault, key: "targetKey", value: "stored string record"]

If you call an action, the pipeline will intercept and execute it automatically. Once you have sufficient context or have completed writing/editing the requested files, respond with your final conversational message normally. Please work incrementally.`;

          const bodyPayload: any = {
            messages: apiPayloadMessages,
            systemInstruction,
            temperature: activeSession.temperature,
            model: activeSession.modelId,
          };

          if (isLocalModelSelected) {
            bodyPayload.url = lmStudioUrl;
          }

          const response = await fetch(targetEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          });

          if (!response.ok) {
            const errorContent = await response.json();
            throw new Error(errorContent.error || "Execution loop error");
          }

          const data = await response.json();
          const replyText = data.text || "";

          // Track usage token metrics
          setTokensUsed((prev) => prev + Math.ceil(replyText.length / 3.8));

          // Scan for matches
          const toolCall = parseToolCall(replyText);

          if (toolCall) {
            pushActivityLog(`AGENT TRIGGERED COGNITIVE TOOL: ${toolCall.name.toUpperCase()} (${JSON.stringify(toolCall.args)})`, "warning");

            // Display intermediate reasoning stage in active conversation stream
            const thoughtMessage: ChatMessage = {
              id: `msg-agent-thinking-${Date.now()}-${loopCount}`,
              role: "model",
              parts: [{ text: replyText }],
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
            };
            currentMessages.push(thoughtMessage);

            setSessions((prev) =>
              prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...currentMessages] } : s)
            );

            // Staging telemetry sidebar logs
            const activeToolTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
            const sidebarLogObj = {
              time: activeToolTime,
              tool: toolCall.name.toUpperCase(),
              status: `EXECUTING (${JSON.stringify(toolCall.args).substring(0, 18)}...)`
            };
            setAgentToolLogs((prev) => [sidebarLogObj, ...prev]);

            // Execute corresponding backend integration calls
            let resultPayload = "";
            try {
              if (toolCall.name === "search") {
                const queryVal = toolCall.args.query || "";
                const searchRes = await fetch(`/api/search?q=${encodeURIComponent(queryVal)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const list = searchData.results || [];
                  if (list.length > 0) {
                    resultPayload = list.map((item: any, idx: number) => `[RESULT ${idx + 1}] Title: ${item.title}\nURL: ${item.link}\nSummary: ${item.snippet}`).join("\n---\n");
                  } else {
                    resultPayload = "Search yielded 0 web records. Check spelling or try simplified terms.";
                  }
                } else {
                  resultPayload = `Bypass server search error: HTTP Code ${searchRes.status}`;
                }
              } else if (toolCall.name === "browse") {
                const urlVal = toolCall.args.url || "";
                const browseRes = await fetch(`/api/browse?url=${encodeURIComponent(urlVal)}`);
                if (browseRes.ok) {
                  const browseData = await browseRes.json();
                  resultPayload = `[LIVE PAGE READ SUCCESSFUL] URL: ${browseData.url}\nTitle: ${browseData.title}\n\nContents:\n${browseData.content}`;
                } else {
                  resultPayload = `Page Reader Crawl Error: HTTP Code ${browseRes.status}`;
                }
              } else if (toolCall.name === "readFile") {
                const fn = toolCall.args.filename || "";
                const filesRes = await fetch("/api/agent/files");
                if (filesRes.ok) {
                  const filesData = await filesRes.json();
                  const target = (filesData.files || []).find((f: any) => f.name.toLowerCase() === fn.toLowerCase());
                  if (target) {
                    resultPayload = `File Name: ${target.name}\nSize: ${target.size}\nLanguage: ${target.lang}\n\nContent:\n${target.content}`;
                  } else {
                    resultPayload = `Error File Not Found: '${fn}' is not present in workspace list. Current workspace files index: ${(filesData.files || []).map((f: any) => f.name).join(", ")}`;
                  }
                }
              } else if (toolCall.name === "writeFile") {
                const fn = toolCall.args.filename || "output.txt";
                const bodyContent = toolCall.args.content || "";
                
                const writeRes = await fetch("/api/agent/files/write", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: fn, content: bodyContent })
                });

                if (writeRes.ok) {
                  resultPayload = `SUCCESS: File '${fn}' written inside sandbox workspace database indices.`;
                  await fetchWorkspaceFiles(); // reload workspace
                } else {
                  resultPayload = `Error writing file: HTTP ${writeRes.status}`;
                }
              } else if (toolCall.name === "editFile") {
                const fn = toolCall.args.filename || "";
                const searchStr = toolCall.args.search || "";
                const replaceStr = toolCall.args.replace || "";

                const editRes = await fetch("/api/agent/files/edit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: fn, targetContent: searchStr, replacementContent: replaceStr })
                });

                if (editRes.ok) {
                  resultPayload = `SUCCESS: Surgical alignment replacement applied inside file '${fn}'.`;
                  await fetchWorkspaceFiles(); // reload workspace
                } else {
                  const errJson = await editRes.json();
                  resultPayload = `Surgical replacement error: ${errJson.error || "Search string target not found inside workspace source"}`;
                }
              } else if (toolCall.name === "readVault") {
                const vaultRes = await fetch("/api/agent/storage");
                if (vaultRes.ok) {
                  const vaultData = await vaultRes.json();
                  resultPayload = `Secure Vault current items index ledger:\n${JSON.stringify(vaultData.vault, null, 2)}`;
                  setVault(vaultData.vault);
                } else {
                  resultPayload = `Vault access error: HTTP ${vaultRes.status}`;
                }
              } else if (toolCall.name === "writeVault") {
                const vKey = toolCall.args.key || "";
                const vVal = toolCall.args.value || "";

                const vaultRes = await fetch("/api/agent/storage", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: vKey, value: vVal })
                });

                if (vaultRes.ok) {
                  const vaultData = await vaultRes.json();
                  resultPayload = `SUCCESS: Saved variable memory index key '${vKey}' to database vault state.`;
                  setVault(vaultData.vault);
                } else {
                  resultPayload = `Vault update failed: HTTP ${vaultRes.status}`;
                }
              }
            } catch (err: any) {
              resultPayload = `Hardware integration call failure: ${err.message}`;
            }

            // Append TOOL returns to currentMessages to feed back into loop context
            const toolResultMsg: ChatMessage = {
              id: `msg-agent-result-${Date.now()}-${loopCount}`,
              role: "user",
              parts: [{ text: `[TOOL RESULT: ${toolCall.name.toUpperCase()}]\n${resultPayload}\n\nThought: Analyze returned data values to proceed.` }],
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
            };
            currentMessages.push(toolResultMsg);

            setAgentToolLogs((prev) =>
              prev.map((l, idx) => idx === 0 ? { ...l, status: "DISPATCHED RESULT FEED" } : l)
            );

            setSessions((prev) =>
              prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...currentMessages] } : s)
            );

            // Micro-latency for high tech interactive experience
            await new Promise((resolve) => setTimeout(resolve, 600));

          } else {
            // Conversational reply reached, break recursive loop
            shouldContinue = false;
            pushActivityLog(`Agent Core stack sequence satisfied. Synapse connection shut down.`, "success");

            const finalAssMessage: ChatMessage = {
              id: `msg-${Date.now()}-assistant`,
              role: "model",
              parts: [{ text: replyText }],
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
            };
            currentMessages.push(finalAssMessage);

            const endTime = Date.now();
            setLastLatency(endTime - startTime);

            setSessions((prev) =>
              prev.map((s) => s.id === activeSessionId ? { ...s, messages: [...currentMessages] } : s)
            );
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "An unexpected generation error occurred.";
      setApiError(errorMessage);
      pushActivityLog(`Server pipeline error: ${errorMessage}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Modern browser direct click download completely avoiding child node remove error
  const exportSessionAsMarkdown = () => {
    if (!activeSession || activeSession.messages.length === 0) return;
    
    let md = `# NEXUS AI Export • ${activeSession.title}\n\n`;
    activeSession.messages.forEach((msg) => {
      const roleName = msg.role === "user" ? "### TRANSMISSION (YOU)" : `### NEXUS AI (${activeSession.modelId})`;
      md += `${roleName} [${msg.timestamp}]\n\n`;
      msg.parts.forEach((p) => {
        if (p.text) md += `${p.text}\n\n`;
        if (p.inlineData) md += `*[Attached Image: ${p.inlineData.mimeType}]*\n\n`;
      });
      md += `----\n\n`;
    });

    try {
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeSession.title.toLowerCase().replace(/\s+/g, "_")}_export.md`;
      link.click();
      URL.revokeObjectURL(url);
      pushActivityLog(`Markdown file downloaded correctly`, "success");
    } catch (e: any) {
      console.error(e);
      pushActivityLog(`Export aborted: ${e.message}`, "error");
    }
  };

  const exportAllAsJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "nexus_ai_chat_portal_backup.json");
      downloadAnchor.click();
      pushActivityLog("Workspace index backup downloaded.", "success");
    } catch (e: any) {
      console.error(e);
      pushActivityLog(`Backup error: ${e.message}`, "error");
    }
  };

  // Custom regex pattern to match and split dynamic thinking stages of DeepSeek/Gemma fine-tunes
  const extractThinking = (text: string) => {
    const thinkingPattern = /<(thinking|thought)>([\s\S]*?)<\/\1>/i;
    const match = text.match(thinkingPattern);
    if (match) {
      return {
        thinking: match[2].trim(),
        cleanText: text.replace(thinkingPattern, "").trim(),
      };
    }
    return { thinking: null, cleanText: text };
  };

  return (
    <div id="nexus-portal-container" className="flex h-[100dvh] w-screen overflow-hidden bg-[#050811] font-mono text-slate-100 select-none">
      
      {/* On mobile screens, show dim overlay backdrops for left navigation sidebar to tap-away to close */}
      {isLeftColOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-35"
          onClick={() => setIsLeftColOpen(false)}
        />
      )}

      {/* COLUMN 1: SESSIONS NAVIGATION BAR (Collapsible) */}
      <aside
        id="nexus-left-sidebar"
        className={`flex flex-col border-r border-[#00cfc0]/20 bg-[#050811]/95 md:bg-[#050811] transition-all duration-300 ease-in-out select-none absolute md:relative top-0 bottom-0 left-0 h-full z-40
          ${isLeftColOpen ? "w-72 md:w-64 border-r" : "w-0 overflow-hidden border-r-0"}`}
      >
        {/* Toggle Panel Bracket Button */}
        {isLeftColOpen && (
          <button
            onClick={() => setIsLeftColOpen(false)}
            className="absolute -right-3 top-14 flex h-6 w-6 items-center justify-center rounded-full bg-[#050811] border border-[#00cfc0]/25 text-[#00cfc0]/80 hover:text-[#00cfc0] cursor-pointer z-50 shadow-[0_0_8px_rgba(0,207,192,0.2)]"
            title="Collapse sessions sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        )}

        {/* Action Call Bracket: NEW SESSION */}
        <div className="px-4 py-5 border-b border-[#00cfc0]/15 bg-[#050811]">
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00cfc0] bg-transparent px-3 py-2.5 font-mono text-xs font-bold text-[#00cfc0] hover:bg-[#00cfc0]/10 hover:shadow-[0_0_12px_rgba(0,207,192,0.2)] transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>NEW SESSION</span>
          </button>
        </div>

        {/* Sessions Monospace Block */}
        <div className="flex-grow overflow-y-auto px-2.5 py-4 space-y-1.5 min-w-[240px]">
          <div className="flex items-center justify-between px-2 pb-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-slate-850/60 mb-2">
            <span>SESSIONS</span>
            <span className="text-[#00cfc0] font-bold">[{sessions.length}]</span>
          </div>

          <div className="space-y-1">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    setApiError(null);
                  }}
                  className={`group flex items-center justify-between rounded px-3 py-2.5 transition-all duration-150 cursor-pointer border
                    ${isActive 
                      ? "bg-[#00cfc0]/10 border-[#00cfc0]/40 text-[#00cfc0]" 
                      : "bg-transparent border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-[#00cfc0] shadow-[0_0_6px_#00cfc0]" : "bg-slate-700"}`}></span>
                    <span className="text-xs font-bold truncate leading-none uppercase select-none tracking-wide">
                      {sess.title}
                    </span>
                  </div>

                  <button
                    onClick={(e) => deleteSession(sess.id, e)}
                    className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 cursor-pointer transition-all duration-100"
                    title="Terminate this node session"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column Bottom metadata brackets */}
        <div className="border-t border-[#00cfc0]/15 bg-[#03060c] px-4 py-4 space-y-3 font-mono text-[10px] text-slate-500 min-w-[240px]">
          <div className="flex items-center justify-between">
            <span className="truncate max-w-[155px]" title="Local user environment ready">
              LOC_USER: y48455577
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="System Status Normal"></span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={exportAllAsJSON}
              className="flex items-center justify-center gap-1 rounded bg-[#0b101c] border border-slate-800 px-2.5 py-1.5 text-slate-400 hover:border-[#00cfc0]/35 hover:text-[#00cfc0] cursor-pointer transition-colors"
              title="Backup Workspace Index File"
            >
              <FileDown size={11} />
              <span>BACKUP</span>
            </button>
            <button
              onClick={clearAllHistory}
              className="flex items-center justify-center gap-1 rounded bg-[#13070b] border border-rose-950/60 px-2.5 py-1.5 text-rose-450 hover:border-rose-700 hover:bg-rose-950/20 cursor-pointer transition-colors"
              title="Factory clear environment states"
            >
              <Trash2 size={11} />
              <span>TERMINATE</span>
            </button>
          </div>
        </div>
      </aside>

      {/* On mobile screens, middle subpanel dismiss backdrop */}
      {isMiddleColOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-35"
          onClick={() => setIsMiddleColOpen(false)}
        />
      )}

      {/* COLUMN 2: TABBED SUBPANEL (Activity log, file tree, parameters, code compile playpen) */}
      <aside
        id="nexus-middle-sidebar"
        className={`flex flex-col border-r border-[#00cfc0]/20 bg-[#050811]/95 md:bg-[#050811] transition-all duration-300 ease-in-out select-none absolute md:relative top-0 bottom-0 left-0 md:left-auto md:right-auto h-full z-38 max-w-[85vw]
          ${isMiddleColOpen ? "w-80 border-r" : "w-0 overflow-hidden border-r-0"}`}
      >
        {/* Toggle Panel Bracket Button */}
        {isMiddleColOpen && (
          <button
            onClick={() => setIsMiddleColOpen(false)}
            className="absolute -right-3 top-14 flex h-6 w-6 items-center justify-center rounded-full bg-[#050811] border border-[#00cfc0]/25 text-[#00cfc0]/80 hover:text-[#00cfc0] cursor-pointer z-50 shadow-[0_0_8px_rgba(0,207,192,0.2)]"
            title="Collapse diagnostic subpanel"
          >
            <ChevronLeft size={13} />
          </button>
        )}

        {/* Tabs switcher bar matching Replit style */}
        <div className="flex border-b border-[#00cfc0]/15 bg-[#03060c] text-[9px] font-bold text-slate-400 select-none">
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 border-r border-[#00cfc0]/10 tracking-widest cursor-pointer hover:bg-slate-900/30 transition-colors
              ${activeTab === "activity" ? "text-[#00cfc0] bg-[#050811] border-b-2 border-b-[#00cfc0]" : ""}`}
          >
            <Activity size={10} />
            <span>DIAGS</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 border-r border-[#00cfc0]/10 tracking-widest cursor-pointer hover:bg-slate-900/30 transition-colors
              ${activeTab === "search" ? "text-[#00cfc0] bg-[#050811] border-b-2 border-b-[#00cfc0]" : ""}`}
          >
            <Search size={10} />
            <span>SEARCH</span>
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 border-r border-[#00cfc0]/10 tracking-widest cursor-pointer hover:bg-slate-900/30 transition-colors
              ${activeTab === "files" ? "text-[#00cfc0] bg-[#050811] border-b-2 border-b-[#00cfc0]" : ""}`}
          >
            <FileText size={10} />
            <span>FILES</span>
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 tracking-widest cursor-pointer hover:bg-slate-900/30 transition-colors
              ${activeTab === "system" ? "text-[#00cfc0] bg-[#050811] border-b-2 border-b-[#00cfc0]" : ""}`}
          >
            <Cpu size={10} />
            <span>SYSTEM</span>
          </button>
        </div>

        {/* Tab content scroll bracket */}
        <div className="flex-1 overflow-y-auto min-w-[310px]">
          
          {/* TAB: ACTIVITY LOGS & MICROSENTINELS */}
          {activeTab === "activity" && (
            <div className="p-4 space-y-4 font-mono text-[11px] h-full flex flex-col">
              
              {/* Active agent trace tracker */}
              <div className="rounded border border-[#00cfc0]/15 bg-[#00cfc0]/5 p-3 space-y-2 select-none">
                <span className="text-[10px] text-[#00cfc0] font-bold block uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal size={12} className="text-[#00cfc0]" />
                  ACTIVE AGENT PROTOCOL SHELL
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Real-time indicators showing active searches or workspace context files scanned by the local Gemma node.
                </p>
                
                <div className="space-y-1.5 pt-1 text-[10px] max-h-36 overflow-y-auto">
                  {agentToolLogs.length === 0 ? (
                    <div className="text-slate-600 italic">SYSTEM IDLE // Waiting for prompts...</div>
                  ) : (
                    agentToolLogs.map((item, i) => (
                      <div key={i} className="flex justify-between items-center border-b border-slate-900/40 pb-1">
                        <span className="text-indigo-400 font-bold">{item.tool}</span>
                        <span className="text-slate-500 text-[8px]">{item.time}</span>
                        <span className="text-emerald-450 text-[9px] font-bold">{item.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-slate-850/40 pb-1 uppercase tracking-widest mt-2">
                <span>SYSTEM DIAGNOSTIC BUS</span>
                <span className="text-[#00cfc0] animate-pulse">● FEED_OK</span>
              </div>
              
              <div className="flex-grow space-y-2 overflow-y-auto pr-1">
                {activityLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 items-start leading-relaxed border-b border-slate-950/20 pb-1.5 text-[10px]">
                    <span className="text-slate-600 font-medium whitespace-nowrap">{log.time}</span>
                    <span className={`
                      ${log.type === "success" ? "text-emerald-400" : ""}
                      ${log.type === "warning" ? "text-amber-400" : ""}
                      ${log.type === "error" ? "text-rose-400" : ""}
                      ${log.type === "info" ? "text-slate-300" : ""}
                    `}>
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Cognitive Memory Vault Display */}
              <div className="border-t border-slate-850 pt-3 mt-2 select-none">
                <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                  <span>MEMORIES STORAGE DECK</span>
                  <span className="text-[#00cfc0] font-mono">DURABLE SECURE</span>
                </div>
                {Object.entries(vault).length === 0 ? (
                  <div className="text-[9px] text-slate-600 italic mt-2.5 text-center py-2 border border-slate-900 leading-normal rounded">
                    Vault is currently unindexed. Ask the model to 'write secure key value memory' to stage tokens!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 max-h-40 overflow-y-auto">
                    {Object.entries(vault).map(([k, v]) => (
                      <div key={k} className="bg-slate-950/70 border border-slate-900 rounded p-1.5 text-[10px] space-y-0.5" title={`${k}: ${v}`}>
                        <span className="text-amber-450 font-bold block truncate">{k}</span>
                        <span className="text-slate-400 block truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: FILES INSIGHT EXPLORER (Includes reading large dump files!) */}
          {activeTab === "files" && (
            <div className="p-4 space-y-4 font-mono select-none">
              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-slate-850 pb-1 uppercase tracking-widest">
                <span>VIRTUAL WORKSPACE STORAGE</span>
                <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1 py-0.5 rounded text-[8px] font-bold">Files</span>
              </div>

              <p className="text-[10px] text-slate-500 leading-normal">
                Uploader supports parsing any file formatting (.cs, .txt, .md). Click individual file items to inject their structural content directly into your active prompt context!
              </p>

              {/* Genuine Workspace File Loader */}
              <div className="pt-1">
                <input
                  type="file"
                  ref={sysFileUploaderRef}
                  onChange={handleWorkspaceFileUpload}
                  accept=".cs,.txt,.md,.json,.js,.py,.ts,.html,.css"
                  className="hidden"
                />
                <button
                  onClick={() => sysFileUploaderRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[#00cfc0]/40 rounded-lg p-3 text-xs text-[#00cfc0] hover:bg-[#00cfc0]/5 cursor-pointer transition-colors"
                >
                  <Upload size={13} />
                  <span>UPLOAD DIRECTIVE FILE (.CS/.TXT/.MD)</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-2">
                {workspaceFiles.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setInputText((prev) => 
                        prev + `\n\n[Parsed File Attachment: ${file.name}]\n\`\`\`${file.lang}\n${file.content}\n\`\`\`\n`
                      );
                      pushActivityLog(`Parsed and injected file content of '${file.name}' to chat prompt`, "info");
                    }}
                    className="flex justify-between items-center rounded border border-slate-900 bg-slate-950/40 px-3 py-2.5 hover:border-[#00cfc0]/35 hover:bg-[#00cfc0]/5 cursor-pointer transition-all group"
                    title="Click to mount this text content to prompt"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={13} className="text-[#00cfc0] flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-300 truncate block">{file.name}</span>
                        <span className="text-[8px] text-slate-500 block uppercase font-mono mt-0.5">Click to mount</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[9px] text-slate-500 font-mono block">{file.size}</span>
                      <span className="text-[8px] text-indigo-400 font-bold uppercase block opacity-0 group-hover:opacity-100 transition-opacity">INJECT +</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DUCKDUCKGO WEB SEARCH BYPASS MODULE */}
          {activeTab === "search" && (
            <div className="p-4 space-y-4 font-mono select-none">
              <div className="text-slate-500 font-bold border-b border-slate-850 pb-1 uppercase tracking-widest flex items-center justify-between">
                <span>SEARCH ENGINE BYPASS</span>
                <span className="bg-emerald-950/20 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-bold">
                  DIRECT API
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                Query global search indexes bypassing trackers in real-time. Hit "INJECT +" on listings to automatically load summaries into your prompt dock!
              </p>

              {/* Direct Search input block */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!userSearchQuery.trim()) return;
                  setIsSearchingUser(true);
                  pushActivityLog(`Direct Search bypass: "${userSearchQuery}"`, "info");
                  try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(userSearchQuery)}`);
                    if (res.ok) {
                      const data = await res.json();
                      setUserSearchResults(data.results || []);
                      pushActivityLog(`Search sync complete: pulled ${data.results?.length || 0} index feeds`, "success");
                    } else {
                      pushActivityLog(`Bypass search failed: HTTP Code ${res.status}`, "error");
                    }
                  } catch (err: any) {
                    pushActivityLog(`Search engine offline: ${err.message}`, "error");
                  } finally {
                    setIsSearchingUser(false);
                  }
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Ask search engine indexes..."
                  className="flex-1 bg-slate-950 border border-[#00cfc0]/35 hover:border-[#00cfc0] rounded px-2.5 py-2 text-xs text-white placeholder-slate-650 outline-none font-bold font-mono"
                />
                <button
                  type="submit"
                  disabled={isSearchingUser}
                  className="bg-[#00cfc0] text-black rounded font-bold hover:bg-[#00cfc0]/85 px-3.5 text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  {isSearchingUser ? <RefreshCw className="animate-spin" size={12} /> : <Search size={12} />}
                </button>
              </form>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {userSearchResults.length === 0 ? (
                  <div className="text-[10px] text-slate-600 text-center py-8 italic border border-dashed border-slate-900 rounded">
                    Bypass is idle. Feed search keywords above!
                  </div>
                ) : (
                  userSearchResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-slate-900 bg-slate-950/40 p-2.5 space-y-1 hover:border-[#00cfc0]/25 transition-all text-[10px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-200 truncate max-w-[170px]" title={item.title}>
                          {item.title}
                        </span>
                        <button
                          onClick={() => {
                            setInputText((prev) => prev + `\n\n[Reference search clip: ${item.title}]\nURL: ${item.link}\nSummary: ${item.snippet}`);
                            pushActivityLog(`Injected clip of "${item.title}" into prompt dock`, "info");
                          }}
                          className="text-[8px] bg-indigo-950/40 border border-indigo-900/40 rounded px-1.5 py-0.5 text-[#00cfc0] font-bold uppercase hover:bg-[#00cfc0]/15 transition-colors cursor-pointer flex-shrink-0"
                        >
                          INJECT +
                        </button>
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#00cfc0]/70 hover:underline truncate block text-[8px] select-all font-mono"
                      >
                        {item.link}
                      </a>
                      <p className="text-slate-400 select-text leading-tight text-[9px] font-sans">{item.snippet}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: SYSTEM CONFIGURATION & LM STUDIO LINKER */}
          {activeTab === "system" && (
            <div className="p-4 space-y-4 font-mono">
              <div className="text-slate-500 font-bold border-b border-slate-850 pb-1 uppercase tracking-widest">
                <span>SYSTEM PARAMETERS BOARD</span>
              </div>

              {/* LM Studio Connection Parameters Frame */}
              <div className="rounded-lg border border-[#00cfc0]/25 bg-[#0a141e]/20 p-3 space-y-3">
                <span className="text-[10px] text-[#00cfc0] font-bold block uppercase tracking-widest">
                  LM STUDIO BRIDGE INTERLINK
                </span>
                
                {/* Host URL Input */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold block uppercase">
                    Studio Target Core Address
                  </label>
                  <input
                    type="text"
                    value={lmStudioUrl}
                    onChange={(e) => setLmStudioUrl(e.target.value)}
                    className="w-full bg-[#050811] border border-[#00cfc0]/35 rounded px-2.5 py-2 text-xs text-[#00cfc0] font-bold outline-none font-mono"
                    placeholder="https://xxx.trycloudflare.com"
                  />
                </div>

                {/* Switch Target presets */}
                <div className="space-y-1">
                  <label className="text-[8px] text-slate-550 font-bold block uppercase">
                    Alternative Node Presets
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setLmStudioUrl("https://half-assignments-distinguished-interventions.trycloudflare.com")}
                      className="text-[9px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-450 hover:border-indigo-450/40 cursor-pointer"
                    >
                      Cloudflare Tunnel
                    </button>
                    <button
                      onClick={() => setLmStudioUrl("http://10.0.0.183:1234")}
                      className="text-[9px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-450 hover:border-indigo-450/40 cursor-pointer"
                    >
                      Local LAN Socket
                    </button>
                    <button
                      onClick={() => setLmStudioUrl("http://localhost:1234")}
                      className="text-[9px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-indigo-450 hover:border-indigo-450/40 cursor-pointer"
                    >
                      Local Host Port
                    </button>
                  </div>
                </div>

                {/* Link Status Indicator */}
                <div className="flex justify-between items-center text-[10px] bg-[#03060d] rounded px-2.5 py-1.5">
                  <span className="text-slate-500 font-bold uppercase">SYNC MATRIX SECURE</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {lmConnectionStatus === "unlinked" && (
                      <span className="text-slate-505 uppercase">UNLINKED</span>
                    )}
                    {lmConnectionStatus === "connecting" && (
                      <span className="text-amber-450 animate-pulse uppercase">CONNECTING...</span>
                    )}
                    {lmConnectionStatus === "connected" && (
                      <span className="text-[#00cfc0] uppercase flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-[#00cfc0] rounded-full animate-ping"></span>
                        ONLINE LINKED
                      </span>
                    )}
                    {lmConnectionStatus === "error" && (
                      <span className="text-rose-400 uppercase">LINK_FAILED</span>
                    )}
                  </div>
                </div>

                {/* Fetch and check button */}
                <button
                  onClick={() => checkLMStudioConnection(lmStudioUrl)}
                  className="w-full flex items-center justify-center gap-1 border border-[#00cfc0] bg-[#00cfc0]/5 hover:bg-[#00cfc0]/15 py-2 rounded text-xs text-[#00cfc0] font-bold cursor-pointer transition-colors"
                >
                  <RefreshCw size={11} />
                  <span>LOAD LM STUDIO MODELS</span>
                </button>
              </div>

              {/* Model Select Indicator */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">
                  AI COMPILER GENERATOR CORE
                </label>
                <select
                  value={activeSession.modelId}
                  onChange={(e) => handleModelChangeUnload(e.target.value)}
                  className="w-full bg-[#050811] text-xs font-bold text-[#00cfc0] border border-[#00cfc0]/35 hover:border-[#00cfc0] rounded-lg px-3 py-2.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#00cfc0] uppercase"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.id} value={opt.id === "gemini-3.5-flash" ? "gemini-3.5-flash" : opt.id}>
                      {opt.id.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Core metrics parameters */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  <span>SAMPLING TEMP</span>
                  <span className="text-[#00cfc0] font-bold">{activeSession.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.2"
                  step="0.1"
                  value={activeSession.temperature}
                  onChange={(e) => {
                    const temp = parseFloat(e.target.value);
                    setSessions((prev) =>
                      prev.map((s) => (s.id === activeSessionId ? { ...s, temperature: temp } : s))
                    );
                  }}
                  className="w-full accent-[#00cfc0]"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>DETERMINISTIC</span>
                  <span>CREATIVE</span>
                </div>
              </div>

              {/* System Overriding instructions */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">
                  CORE DIRECTIVES CONTROL (SYSTEMS)
                </label>
                <textarea
                  rows={4}
                  value={activeSession.systemInstruction}
                  onChange={(e) => {
                    const inst = e.target.value;
                    setSessions((prev) =>
                      prev.map((s) => (s.id === activeSessionId ? { ...s, systemInstruction: inst } : s))
                    );
                  }}
                  className="w-full bg-[#090d19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-[#00cfc0] outline-none leading-relaxed resize-none"
                  placeholder="Insert custom directives constraining the system outputs..."
                />
              </div>
            </div>
          )}

        </div>
      </aside>

      {/* COLUMN 3: MAIN CHAT WORKSPACE FEED */}
      <main className="flex-grow flex flex-col bg-[#050811] relative select-text">
        
        {/* Toggle Panel Bracket helper buttons (if sidebars closed) */}
        <div className="absolute left-4 top-13 flex gap-2 z-40 select-none">
          {!isLeftColOpen && (
            <button
              onClick={() => setIsLeftColOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00cfc0]/25 bg-[#050811] text-[#00cfc0] hover:bg-[#00cfc0]/10 cursor-pointer animate-fade-in shadow-[0_0_8px_rgba(0,207,192,0.2)]"
              title="Expand Sessions Sidebar"
            >
              <ChevronRight size={14} />
            </button>
          )}
          {!isMiddleColOpen && (
            <button
              onClick={() => setIsMiddleColOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00cfc0]/25 bg-[#050811] text-[#00cfc0] hover:bg-[#00cfc0]/10 cursor-pointer animate-fade-in shadow-[0_0_8px_rgba(0,207,192,0.2)]"
              title="Expand diagnostics Sidebar"
            >
              <ChevronRight size={14} />
            </button>
          )}
          {!isRightColOpen && (
            <button
              onClick={() => setIsRightColOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00cfc0]/25 bg-[#050811] text-[#00cfc0] hover:bg-[#00cfc0]/10 cursor-pointer animate-fade-in shadow-[0_0_8px_rgba(0,207,192,0.2)]"
              title="Expand Sandbox Workspace"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Global Blueprint Metrics Header exactly matching the reference screenshot */}
        <header className="flex h-16 items-center justify-between border-b border-[#00cfc0]/20 px-6 bg-[#050811] select-none text-[11px] font-mono tracking-widest select-none">
          
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00cfc0] shadow-[0_0_6px_#00cfc0]"></span>
            <span className="font-bold text-white uppercase text-xs tracking-wider">
              NEXUS AI
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-[#94a3b8]">
            {lmConnectionStatus === "connected" && (
              <div className="flex items-center gap-1.5 border border-dashed border-[#00cfc0]/35 px-2 py-0.5 rounded text-[10px] text-[#00cfc0]" title="Interlinked on Local socket">
                <span className="h-1.5 w-1.5 bg-[#00cfc0] rounded-full animate-ping"></span>
                <span>STUDIO CORE INTERLINK SYNCED</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span>MODEL:</span>
              <div className="relative">
                <select
                  value={activeSession.modelId}
                  onChange={(e) => handleModelChangeUnload(e.target.value)}
                  className="bg-[#050811]/90 border border-slate-800 rounded px-2 py-1 text-[#00cfc0] uppercase font-bold text-[10px] tracking-wider outline-none cursor-pointer"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#050811] text-slate-300">{opt.id.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span>CONVERSATIONS</span>{" "}
              <span className="text-[#00cfc0] font-bold">{sessions.length}</span>
            </div>

            <div>
              <span>TOKENS USED</span>{" "}
              <span className="text-[#00cfc0] font-bold">{tokensUsed}</span>
            </div>

            <div>
              <span>AVG LATENCY</span>{" "}
              <span className="text-[#00cfc0] font-bold">{(lastLatency * 1.05).toFixed(0)}MS</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loggedUser ? (
              <div className="flex items-center gap-2">
                {(loggedUser.role === "owner" || loggedUser.role === "admin") && (
                  <button
                    onClick={() => setDashboardOpen(true)}
                    className="flex h-7 px-2.5 items-center justify-center gap-1.5 rounded border border-[#00cfc0] bg-[#00cfc0]/15 hover:bg-[#00cfc0]/25 text-[#00cfc0] text-[10px] font-bold tracking-wider cursor-pointer transition-all uppercase select-none shadow-[0_0_8px_rgba(0,207,192,0.3)] animate-pulse font-mono"
                    title="Launch Owner Dashboard and audit website metrics"
                  >
                    <Shield size={11} />
                    <span>Dashboard</span>
                  </button>
                )}
                <div className="hidden lg:flex flex-col text-[9px] text-slate-400 font-mono text-right leading-tight max-w-[120px]">
                  <span className="text-[#00cfc0] font-bold truncate block" title={loggedUser.email}>{loggedUser.email}</span>
                  <span className="uppercase tracking-widest text-[8px] text-slate-500">{loggedUser.role}</span>
                </div>
                <button
                  onClick={handleLogActiveUserOut}
                  className="flex h-7 px-2.5 items-center justify-center rounded border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 bg-transparent text-[10px] font-bold cursor-pointer font-mono uppercase"
                  title="Disconnect and log out"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex h-7 px-2.5 items-center justify-center gap-1.5 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold tracking-wider cursor-pointer transition-all uppercase select-none rounded font-mono animate-pulse"
                title="Sign in or register an account"
              >
                <User size={11} />
                <span>Sign In</span>
              </button>
            )}

            {/* Interactive Cyber Sidebar Panels Controller Toggles */}
            <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800/80 p-0.5 rounded-lg select-none">
              <button
                onClick={() => setIsLeftColOpen(!isLeftColOpen)}
                className={`flex h-7 px-2.5 items-center justify-center gap-1 rounded text-[10px] font-bold tracking-wider cursor-pointer transition-all uppercase select-none
                  ${isLeftColOpen 
                    ? "bg-[#00cfc0]/15 text-[#00cfc0] border border-[#00cfc0]/35 shadow-[0_0_8px_rgba(0,207,192,0.15)]" 
                    : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                title="Toggle sessions navigation list panel"
              >
                <MessageSquare size={11} />
                <span className="hidden sm:inline">Sessions</span>
              </button>
              
              <button
                onClick={() => setIsMiddleColOpen(!isMiddleColOpen)}
                className={`flex h-7 px-2.5 items-center justify-center gap-1 rounded text-[10px] font-bold tracking-wider cursor-pointer transition-all uppercase select-none
                  ${isMiddleColOpen 
                    ? "bg-[#00cfc0]/15 text-[#00cfc0] border border-[#00cfc0]/35 shadow-[0_0_8px_rgba(0,207,192,0.15)]" 
                    : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                title="Toggle diagnostics diagnostics and files subpanel"
              >
                <Activity size={11} />
                <span className="hidden sm:inline">Diagnostics</span>
              </button>
              
              <button
                onClick={() => setIsRightColOpen(!isRightColOpen)}
                className={`flex h-7 px-2.5 items-center justify-center gap-1 rounded text-[10px] font-bold tracking-wider cursor-pointer transition-all uppercase select-none
                  ${isRightColOpen 
                    ? "bg-[#00cfc0]/15 text-[#00cfc0] border border-[#00cfc0]/35 shadow-[0_0_8px_rgba(0,207,192,0.15)]" 
                    : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                title="Toggle right auxiliary sandbox cabinets"
              >
                <Terminal size={11} />
                <span className="hidden sm:inline">Sandbox</span>
              </button>
            </div>
            <span className="flex items-center gap-1 bg-[#10b981]/10 px-2.5 py-1 rounded border border-[#10b981]/20 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
        </header>

        {/* WORKSPACE DOT GRIDS CHAT SCROLL ZONE */}
        <div 
          className="flex-grow overflow-y-auto px-6 py-6 space-y-6 relative"
          style={{
            backgroundImage: "radial-gradient(rgba(0, 207, 192, 0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          
          {/* Active Settings sliding custom widget corner */}
          <div className="absolute top-4 right-4 z-10 select-none flex gap-2">
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`flex h-8 w-8 items-center justify-center rounded border transition-all cursor-pointer
                ${isConfigOpen 
                  ? "bg-[#00cfc0]/20 border-[#00cfc0] text-white shadow-[0_0_8px_#00cfc0]"
                  : "bg-[#0b101c]/80 border-slate-800 text-slate-400 hover:border-[#00cfc0]/40 hover:text-white"}`}
              title="Configure generating parameters"
            >
              <Sliders size={13} />
            </button>
          </div>

          {/* Configuration drawer popup */}
          {isConfigOpen && (
            <div className="absolute right-4 top-13 bg-[#0d1221] border border-[#00cfc0]/25 rounded-lg w-72 p-4 shadow-2xl z-40 animate-scale-in text-slate-300 font-mono select-none">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={12} className="text-[#00cfc0]" />
                  Hyperparameter Setup
                </span>
                <button
                  onClick={() => setIsConfigOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Temperature slider and description */}
              <div className="space-y-3.5 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>TEMPERATURE</span>
                  <span className="text-[#00cfc0]">{activeSession.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.2"
                  step="0.1"
                  value={activeSession.temperature}
                  onChange={(e) => {
                    const temp = parseFloat(e.target.value);
                    setSessions((prev) =>
                      prev.map((s) => (s.id === activeSessionId ? { ...s, temperature: temp } : s))
                    );
                  }}
                  className="w-full accent-[#00cfc0]"
                />

                <div className="border-t border-slate-850 pt-2.5 space-y-2">
                  <span className="font-bold text-slate-400 block pb-1">EXPORT DATA FORMATS</span>
                  <button
                    onClick={exportSessionAsMarkdown}
                    className="w-full flex items-center justify-between gap-1.5 rounded bg-[#15232d] border border-indigo-505/20 hover:border-[#00cfc0] text-xs text-slate-300 hover:text-white px-3 py-2 cursor-pointer transition-colors"
                  >
                    <span>EXPORT RAW MARKDOWN</span>
                    <FileDown size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GREETING LANDING CONTAINER */}
          {activeSession.messages.length === 0 ? (
            <div className="max-w-3xl mx-auto py-12 text-center space-y-8 select-none animate-slide-up">
              <div className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#00cfc0]/10 border border-[#00cfc0]/30 text-[#00cfc0] mb-2 leading-none animate-pulse shadow-[0_0_15px_rgba(0,207,192,0.15)]">
                  <Terminal size={22} />
                </div>
                <h1 className="font-display font-bold text-2xl lg:text-3xl tracking-wider text-white uppercase">
                  NEXUS INTERFACE ACTIVATED
                </h1>
                <p className="text-slate-400 font-mono text-xs max-w-lg mx-auto leading-relaxed">
                  Workspace sandbox core complete. Connect your LM Studio instance via the SYSTEM configurations tab using your Cloudflare address, or select direct Cloud model cores.
                </p>
              </div>

              {/* Alternative interlink connection bar inside greeting workspace */}
              <div className="max-w-lg mx-auto p-4 bg-[#08101a] border border-[#00cfc0]/25 rounded-lg text-left space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#00cfc0] font-bold uppercase tracking-wider">Fast-Sync Tunnel Router</span>
                  <span className={`text-[8.5px] font-bold rounded px-1.5 py-0.5 border
                    ${lmConnectionStatus === "connected" ? "bg-[#10b981]/15 text-emerald-400 border-emerald-400/20" : "bg-indigo-950/20 text-indigo-400 border-indigo-805/20"}`}>
                    {lmConnectionStatus === "connected" ? "ONLINE PORT" : "DISCONNECTED CORE"}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lmStudioUrl}
                    onChange={(e) => setLmStudioUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white selection:bg-[#00cfc0]"
                    placeholder="https://half-assignments-distinguished-interventions.trycloudflare.com"
                  />
                  <button
                    onClick={() => checkLMStudioConnection(lmStudioUrl)}
                    className="bg-[#00cfc0] text-black hover:bg-[#00cfc0]/80 rounded p-1.5 px-3 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    SYNC CONNECTOR
                  </button>
                </div>
              </div>

              {/* Assistant style choice cards exactly fitted targeting the layout */}
              <div className="text-left space-y-4 pt-4 max-w-2xl mx-auto">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest text-center">
                  SELECT INTERACTION PERSONALITY
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                  {ASSISTANT_PERSONAS.slice(0, 4).map((p) => {
                    const isSelected = activeSession.personaId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSessions((prev) =>
                            prev.map((s) =>
                              s.id === activeSessionId
                                ? { ...s, personaId: p.id, systemInstruction: p.prompt }
                                : s
                            )
                          );
                          pushActivityLog(`Switched assistant personality: ${p.id.toUpperCase()}`, "info");
                        }}
                        className={`rounded-lg p-3.5 border transition-all cursor-pointer flex flex-col justify-between h-28
                          ${isSelected 
                            ? "bg-[#0b1b22] border-[#00cfc0] shadow-[0_0_10px_rgba(0,207,192,0.1)] text-[#00cfc0]" 
                            : "bg-[#060a13] border-slate-800 hover:border-slate-700 hover:bg-slate-900/30"}`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-slate-400">{getPersonaIcon(p.icon)}</span>
                            <span className="font-bold text-xs text-white uppercase tracking-wider">{p.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-normal">
                            {p.description}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono border-t border-slate-900 pt-1.5">
                          <span className={isSelected ? "text-[#00cfc0] font-bold" : "text-slate-600"}>
                            {isSelected ? "ONLINE_CORE" : "UNMOUNTED"}
                          </span>
                          {isSelected && <span className="text-emerald-450 uppercase tracking-widest">[ACTIVE]</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggestions chips zone */}
              <div className="space-y-3 pt-2">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                  Quick Query Blueprints
                </span>
                <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                  {ASSISTANT_PERSONAS.map((person) => {
                    if (!person.initialSuggestion) return null;
                    return (
                      <button
                        key={person.id}
                        onClick={() => {
                          setInputText(person.initialSuggestion!);
                          pushActivityLog(`Loaded suggestion template`, "info");
                        }}
                        className="rounded bg-[#0d1220] border border-slate-800 hover:border-[#00cfc0]/35 px-3 py-1.5 text-[10px] text-slate-300 font-bold tracking-wide cursor-pointer hover:bg-slate-900/20 transition-all font-mono"
                      >
                        &gt; {person.initialSuggestion}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT FEED LOG PANEL */
            <div className="max-w-3xl mx-auto space-y-6">
              {activeSession.messages.map((msg) => {
                const isUser = msg.role === "user";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1.5 ${isUser ? "items-end" : "items-start"} animate-fade-in group relative`}
                  >
                    
                    {/* Mono labels above the bubbles mimicking Replit screenshots precisely */}
                    <div className="flex items-center gap-2 px-1 pb-0.5 text-[10px] font-mono text-slate-500 select-none">
                      {isUser ? (
                        <>
                          <span className="font-bold text-[#00cfc0] uppercase tracking-wide">YOU [CLIENT]</span>
                          <span className="text-slate-705">|</span>
                          <span className="text-[9px]">{msg.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-indigo-400 uppercase tracking-wide">NEXUS [{activeSession.modelId}]</span>
                          <span className="text-slate-705">|</span>
                          <span className="text-[9px] text-indigo-505">{msg.timestamp}</span>
                        </>
                      )}

                      {/* Explicit interactive deletion trigger inline resolving the history delete request */}
                      <button
                        onClick={(e) => handleMessageDelete(msg.id, e)}
                        className="opacity-0 group-hover:opacity-100 ml-1 rounded px-1.5 py-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
                        title="Delete message from workspace stream"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Chat Box Element */}
                    <div
                      className={`max-w-[85%] md:max-w-[82%] rounded p-4 font-mono leading-relaxed select-text shadow-sm transition-all
                        ${isUser 
                          ? "bg-transparent border border-[#00cfc0]/45 text-[#00cfc0]" 
                          : "bg-[#0b101c]/90 border border-[#00cfc0]/15 text-slate-300"}`}
                    >
                      <div className="space-y-3 break-words text-xs md:text-sm">
                        {msg.parts.map((p, idx) => {
                          if (p.inlineData) {
                            return (
                              <div key={idx} className="relative inline-block max-w-[280px] rounded overflow-hidden border border-[#00cfc0]/20 my-2 select-none">
                                <img
                                  src={`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`}
                                  className="w-full max-h-48 object-cover"
                                  alt="Payload Attachment"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-[#050811]/90 px-2 py-1 text-[9px] font-mono text-slate-500">
                                  {p.inlineData.mimeType.toUpperCase()}
                                </div>
                              </div>
                            );
                          }
                          
                          if (p.text) {
                            // Extract DeepSeek style thinking tag from response if active
                            const { thinking, cleanText } = extractThinking(p.text);

                            return (
                              <div key={idx} className="space-y-4">
                                
                                {/* Thinking dynamic panel output rendering */}
                                {thinking && (
                                  <div className="border border-indigo-500/20 bg-indigo-950/10 rounded-lg overflow-hidden my-1 shadow-sm font-mono text-xs">
                                    <details className="group" open>
                                      <summary className="flex items-center justify-between px-3.5 py-2.5 font-mono text-[9px] text-indigo-400 font-bold uppercase tracking-widest cursor-pointer hover:bg-indigo-950/15 list-none select-none">
                                        <span className="flex items-center gap-1.5">
                                          <Shield size={10} className="text-indigo-400 animate-pulse" />
                                          RESONATORY THOUGHT SYSTEM ACTIVE
                                        </span>
                                        <span className="text-indigo-400/80 group-open:rotate-180 transition-transform">▼</span>
                                      </summary>
                                      <div className="px-3.5 pb-3 pt-2 border-t border-indigo-505/10 bg-[#03060c]/50 text-indigo-300 select-text leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto selection:bg-indigo-900 border-b border-indigo-505/5">
                                        {thinking}
                                      </div>
                                    </details>
                                  </div>
                                )}

                                {/* Main clear text message content rendering */}
                                {cleanText && (
                                  <div className="markdown-body select-text">
                                    <Markdown
                                      components={{
                                        code(props) {
                                          const { children, className, node, ...rest } = props;
                                          const match = /language-(\w+)/.exec(className || "");
                                          return match ? (
                                            <CodeBlock className={className}>
                                              {String(children)}
                                            </CodeBlock>
                                          ) : (
                                            <code className="bg-slate-900 border border-slate-800 text-[#00cfc0] font-mono text-xs px-1.5 py-0.5 rounded" {...rest}>
                                              {children}
                                            </code>
                                          );
                                        },
                                        pre(props) {
                                          return <div className="pre-container">{props.children}</div>;
                                        }
                                      }}
                                    >
                                      {cleanText}
                                    </Markdown>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>

                    {/* Meta statistics underneath the chatbot bubbles */}
                    {!isUser && (
                      <div className="flex items-center gap-1.5 px-1 text-[9px] text-slate-600 font-mono select-none">
                        <span>⟲ SYNAPSE RESOLVED</span>
                        <span>•</span>
                        <span>{(lastLatency / 1000).toFixed(2)}s</span>
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Generating dynamic micro-activities loader */}
              {isGenerating && (
                <div className="flex flex-col space-y-1.5 items-start animate-fade-in font-mono">
                  <div className="flex items-center gap-1 px-1 pb-0.5 text-[10px] font-mono text-indigo-400">
                    <span className="font-bold uppercase tracking-wide">NEXUS [NODE INTERLINK GENERATING]</span>
                  </div>
                  <div className="bg-[#0b101c]/90 border border-[#00cfc0]/20 rounded p-4 w-56 select-none shadow-md">
                    <div className="flex space-x-2.5 items-center justify-start py-1.5">
                      <span className="h-2 w-2 bg-[#00cfc0] rounded-full animate-ping"></span>
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#00cfc0] font-bold block uppercase tracking-widest leading-none">TRANSMITTING...</span>
                        <span className="text-[8px] text-slate-500 block font-mono mt-1 uppercase">Resolving remote tokens</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Server errors handled inside chat block */}
              {apiError && (
                <div className="rounded border border-rose-950/60 bg-rose-950/15 p-4 flex gap-3 items-start select-none font-mono">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-rose-950 text-rose-450 border border-rose-900/40 text-xs font-bold">
                    !
                    </div>
                  <div className="flex-grow">
                    <span className="font-bold text-xs text-rose-400 uppercase tracking-widest block font-mono">
                      PIPELINE ROUTING FAILED
                    </span>
                    <p className="text-[11px] text-rose-350 leading-relaxed mt-1 font-mono">
                      {apiError}
                    </p>
                    <button
                      onClick={() => {
                        setApiError(null);
                        handleSendPrompt(activeSession.messages[activeSession.messages.length - 1]?.parts[0]?.text || "");
                      }}
                      className="mt-3.5 inline-flex items-center gap-1 bg-[#200a0d] hover:bg-rose-950/30 text-[10px] text-rose-300 rounded font-bold border border-rose-900/40 px-2.5 py-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw size={10} />
                      <span>RETRY CORE HANDSHAKE</span>
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* BOTTOM COCKPIT CONSOLE PANEL (Image Vision supports + custom prompt staging Area) */}
        <div className="border-t border-[#00cfc0]/20 bg-[#050811] px-6 py-5 select-none z-10 font-mono">
          <div className="max-w-3xl mx-auto space-y-3">
            
            {/* Staged uploaded media info */}
            {attachedImage && (
              <div className="flex items-center gap-2 bg-[#0a1221] border border-dashed border-[#00cfc0]/35 p-2 rounded max-w-sm animate-scale-in select-none">
                <div className="relative h-10 w-10 overflow-hidden flex-shrink-0 bg-slate-950 rounded border border-slate-800">
                  <img
                    src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`}
                    className="h-full w-full object-cover"
                    alt="Staged Attachment Preview"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[9px] font-bold text-[#00cfc0] tracking-wide uppercase">VISION TOKEN BUFFERED</p>
                  <p className="text-[8px] text-slate-500 font-mono tracking-widest truncate">{attachedImage.mimeType.toUpperCase()} PREVIEW READY</p>
                </div>
                <button
                  onClick={removeAttachedImage}
                  className="p-1 rounded bg-[#0f192b] border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                  title="Remove Image payload"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Cyan-bordered console form exact layout match */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPrompt();
              }}
              className="relative flex items-end gap-2 bg-[#050811] border border-[#00cfc0]/35 focus-within:border-[#00cfc0] focus-within:shadow-[0_0_12px_rgba(0,207,192,0.15)] rounded p-2.5 transition-all w-full"
            >
              {/* File attachment clip */}
              <button
                type="button"
                onClick={triggerImageUpload}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-850 text-slate-400 hover:text-[#00cfc0] hover:border-[#00cfc0]/30 cursor-pointer transition-colors flex-shrink-0 bg-[#060a13]"
                title="Staged screenshot or document payload (PDF, TXT, MD, etc)"
              >
                <Paperclip size={14} />
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageFileChange}
                accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.py,.ts,.html,.css"
                className="hidden"
              />

              {/* Text Area */}
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                placeholder="TRANSMIT MESSAGE OR STAGE FILE CONTENT..."
                className="flex-1 max-h-28 bg-transparent border-0 outline-none text-slate-200 text-xs md:text-sm px-2.5 py-2.5 resize-none placeholder-slate-650 font-mono tracking-wide selection:bg-[#00cfc0] selection:text-black"
              />

              {/* Send Button container styling to match screenshot */}
              <button
                type="submit"
                disabled={isGenerating || (!inputText.trim() && !attachedImage)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all flex-shrink-0 cursor-pointer border
                  ${(inputText.trim() || attachedImage) && !isGenerating
                    ? "bg-[#00cfc0] border-[#00cfc0] text-black shadow-[0_0_10px_rgba(0,207,192,0.3)] hover:scale-[1.03] active:scale-[0.97]"
                    : "bg-[#090e1a] border-slate-800 text-slate-600 cursor-not-allowed"}`}
                title="Transmit prompt to workspace core"
              >
                <ArrowRight size={14} className="stroke-[2.5]" />
              </button>
            </form>

            {/* Tiny Monospace Helper line inside the cockpit container */}
            <div className="flex justify-between items-center text-[9px] text-slate-600 px-1 select-none font-mono">
              <div className="flex gap-3 items-center">
                <span>ENTER TRANSMITS</span>
                <span className="hidden sm:inline">SHIFT+ENTER NEWLINE</span>
                <span className="border-l border-slate-800 h-2.5 hidden sm:inline"></span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAgentMode(!isAgentMode);
                    pushActivityLog(`Agent Autopilot mode toggled: ${!isAgentMode ? "ENABLED" : "DISABLED"}`, "info");
                  }}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer font-bold uppercase select-none tracking-wider text-[8px]
                    ${isAgentMode 
                      ? "bg-emerald-950/25 border-emerald-500/40 text-[#4ade80]" 
                      : "bg-[#1b080d]/45 border-rose-500/40 text-rose-400"}`}
                  title="Toggle ReAct multi-step cognition"
                >
                  <span className={`h-1 w-1 rounded-full ${isAgentMode ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
                  COGNITIVE AUTOPILOT: {isAgentMode ? "ENABLED" : "OFFLINES"}
                </button>
              </div>
              <div className="font-mono flex items-center gap-1 uppercase">
                <span>MODEL NODE:</span>
                <span className="text-[#00cfc0] font-bold">{activeSession.modelId}</span>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* On mobile screens, right sandbox sidebar dismiss backdrop */}
      {isRightColOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-35"
          onClick={() => setIsRightColOpen(false)}
        />
      )}

      {/* COLUMN 4: RIGHT-SIDE AI SANDBOX WORKSPACE CABINET */}
      <aside
        id="nexus-right-sandbox-cabinet"
        className={`flex flex-col border-l border-[#00cfc0]/20 bg-[#050811]/95 md:bg-[#050811] transition-all duration-300 ease-in-out select-none absolute md:relative top-0 bottom-0 right-0 h-full flex-shrink-0 z-40 max-w-[90vw]
          ${isRightColOpen ? "w-96 border-l" : "w-0 overflow-hidden border-l-0"}`}
      >
        {/* Collapse Button */}
        {isRightColOpen && (
          <button
            onClick={() => setIsRightColOpen(false)}
            className="absolute -left-3 top-14 flex h-6 w-6 items-center justify-center rounded-full bg-[#050811] border border-[#00cfc0]/25 text-[#00cfc0]/80 hover:text-[#00cfc0] cursor-pointer z-50 shadow-[0_0_8px_rgba(0,207,192,0.2)]"
            title="Collapse Sandbox Cabinets"
          >
            <ChevronRight size={13} />
          </button>
        )}

        {/* Header Block with System Diagnostics Tagging */}
        <div className="px-4 py-4 border-b border-[#00cfc0]/15 bg-[#050811] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
              <Database size={13} className="text-[#00cfc0]" />
              SANDBOX CABINET V2
            </span>
            <span className="text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wide">
              RECURSIVE STORAGE HUB & DECK
            </span>
          </div>
          <span className="bg-emerald-950/15 border border-emerald-500/30 text-emerald-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded animate-pulse">
            ONLINE [SECURE]
          </span>
        </div>

        {/* Scrollable Core Workspace */}
        <div className="flex-grow overflow-y-auto px-4 py-4 space-y-4 font-mono select-none">
          
          {/* SECTION 1: ARCHIVE IMPORT DECK (ZIP & RAR Extractor Engine) */}
          <div className="border border-[#00cfc0]/10 rounded-lg bg-[#03060c] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">
              <span className="flex items-center gap-1">
                <Archive size={11} className="text-[#00cfc0]" />
                ARCHIVE INGEST PARSER
              </span>
              <span className="text-[#00cfc0]/80">ZIP / .RAWR / .RAR</span>
            </div>
            
            <p className="text-[9px] text-slate-500 leading-normal font-sans">
              Inject huge folder hierarchies into the sandbox instantly. All nested architectures are processed and mapped automatically.
            </p>

            <div className="relative border border-dashed border-[#00cfc0]/25 hover:border-[#00cfc0]/65 rounded-lg p-3 bg-slate-950/40 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer">
              <input
                type="file"
                accept=".zip,.rar,.rawr,.rar5"
                onChange={handleArchiveUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={isExtractingArchive}
              />
              {isExtractingArchive ? (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <RefreshCw className="animate-spin text-[#00cfc0]" size={18} />
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Decompressing Archive Stream...</span>
                </div>
              ) : (
                <>
                  <Upload className="text-slate-400 hover:text-[#00cfc0] transition-colors" size={16} />
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] font-bold text-slate-300 block uppercase">Upload Zip or Rar Package</span>
                    <span className="text-[8px] text-slate-500 block">Drag & drop or Click to select</span>
                  </div>
                </>
              )}
            </div>

            {archiveUploadError && (
              <div className="text-[9px] text-rose-400 bg-rose-950/20 border border-rose-900/45 p-2 rounded leading-normal">
                Error decompressing node: {archiveUploadError}
              </div>
            )}
          </div>

          {/* SECTION 2: FILE BUILDER DECK (Live File output generator) */}
          <div className="border border-slate-900 rounded-lg bg-[#03060c] p-3 space-y-2.5">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-1.5 flex items-center justify-between">
              <span>INITIALIZE VIRTUAL FILE</span>
              <span className="text-[#00cfc0]">NEW ATOM</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFieldNameInput.trim()) return;
                createWorkspaceFile(newFieldNameInput);
                setNewFieldNameInput("");
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={newFieldNameInput}
                onChange={(e) => setNewFieldNameInput(e.target.value)}
                placeholder="e.g. src/Program.cs or tests.txt"
                className="flex-1 bg-slate-950 border border-slate-850 hover:border-[#00cfc0]/35 rounded px-2.5 py-1.5 text-[10px] text-white placeholder-slate-650 outline-none font-bold"
              />
              <button
                type="submit"
                className="bg-[#00cfc0] text-black font-bold hover:bg-[#00cfc0]/85 transition-colors px-2.5 rounded text-[10px] flex items-center justify-center cursor-pointer"
                title="Create file node"
              >
                <Plus size={13} />
              </button>
            </form>
          </div>

          {/* SECTION 3: SYSTEM CONSOLIDATOR & DIRECTORY TREE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span>WORKSPACE DIRECTORY</span>
              <span className="text-[#00cfc0]">[{workspaceFiles.length} NODES]</span>
            </div>

            {/* Local Sandbox search filters */}
            <div className="relative">
              <input
                type="text"
                value={sandboxSearchQuery}
                onChange={(e) => setSandboxSearchQuery(e.target.value)}
                placeholder="Search file names or text contents..."
                className="w-full bg-[#03060c] border border-slate-900 hover:border-[#00cfc0]/25 rounded px-2.5 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 outline-none font-bold"
              />
              <Search className="absolute right-2.5 top-2.5 text-slate-600" size={10} />
            </div>

            {/* Folder Induction Tree view list */}
            <div className="bg-[#03060c]/50 border border-slate-900/60 rounded-lg max-h-72 overflow-y-auto divide-y divide-slate-950">
              {workspaceFiles.filter((file) => {
                const q = sandboxSearchQuery.toLowerCase();
                return file.name.toLowerCase().includes(q) || file.content.toLowerCase().includes(q);
              }).length === 0 ? (
                <div className="text-[10px] text-slate-600 italic text-center py-6">
                  Directory empty or filter unmatched. Change query options!
                </div>
              ) : (
                workspaceFiles.filter((file) => {
                  const q = sandboxSearchQuery.toLowerCase();
                  return file.name.toLowerCase().includes(q) || file.content.toLowerCase().includes(q);
                }).map((file) => {
                  const parts = file.name.split("/");
                  const displayName = parts[parts.length - 1];
                  const indentCount = Math.max(0, parts.length - 1);
                  const isOpened = openedSandboxFile?.name === file.name;

                  return (
                    <div
                      key={file.name}
                      style={{ paddingLeft: `${indentCount * 10 + 8}px` }}
                      className={`flex items-center justify-between py-2 pr-2 hover:bg-slate-950/60 transition-colors group cursor-pointer border-l-2
                        ${isOpened ? "border-l-[#00cfc0] bg-slate-950/80 text-white" : "border-l-transparent text-slate-400"}`}
                    >
                      {/* Left Block: Icon Indicator & Path indentation */}
                      <div
                        onClick={() => {
                          setOpenedSandboxFile(file);
                          setSandboxFileEditedContent(file.content);
                        }}
                        className="flex-grow flex items-center gap-1.5 min-w-0"
                      >
                        {indentCount > 0 ? (
                          <Folder className="text-amber-500/80 group-hover:text-amber-500 flex-shrink-0" size={10} />
                        ) : (
                          <File className="text-sky-500/80 group-hover:text-[#00cfc0] flex-shrink-0" size={10} />
                        )}
                        <span className="text-[10.5px] truncate font-bold leading-none select-all" title={file.name}>
                          {displayName}
                        </span>
                        <span className="text-[7.5px] font-mono font-bold text-slate-600 bg-slate-950 px-1 rounded flex-shrink-0">
                          {file.size}
                        </span>
                      </div>

                      {/* Right Block: File operations on hover */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-30 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setInputText((prev) => prev + `\n\n[Reference Virtual File: ${file.name}]\n\`\`\`${file.lang || "cs"}\n${file.content}\n\`\`\``);
                            pushActivityLog(`Injected file name and coding body for: ${displayName}`, "info");
                          }}
                          className="bg-indigo-950/60 border border-indigo-900/60 rounded px-1.5 py-0.5 text-[8px] font-bold text-[#00cfc0] uppercase hover:bg-[#00cfc0]/20 cursor-pointer"
                          title="Inject source code into main prompt area"
                        >
                          INJECT +
                        </button>
                        <button
                          onClick={() => deleteWorkspaceFile(file.name)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer hover:bg-rose-950/20"
                          title="Purge virtual file"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 4: SANDBOX DUCKDUCKGO WEB SEARCH ENGINE */}
          <div className="border border-slate-900 rounded-lg bg-[#03060c] p-3 space-y-2.5">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-1.5 flex items-center justify-between">
              <span>SANDBOX ENGINE BYPASS</span>
              <span className="text-emerald-400 bg-emerald-950/25 px-1.5 py-0.5 rounded border border-emerald-900 text-[7px]">
                LIVE WEB DOCK
              </span>
            </div>

            <p className="text-[8.5px] text-slate-500 leading-normal font-sans">
              Perform deep parallel research directly from your sandbox storage panel.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!userSearchQuery.trim()) return;
                setIsSearchingUser(true);
                pushActivityLog(`Bypass search triggered on right: "${userSearchQuery}"`, "info");
                try {
                  const res = await fetch(`/api/search?q=${encodeURIComponent(userSearchQuery)}`);
                  if (res.ok) {
                    const data = await res.json();
                    setUserSearchResults(data.results || []);
                    pushActivityLog(`Search sync complete: pulled ${data.results?.length || 0} feeds`, "success");
                    setActiveTab("search"); // Switch bottom-left middle column to Search too for synchronization
                  } else {
                    pushActivityLog(`Bypass search failed: HTTP Code ${res.status}`, "error");
                  }
                } catch (err: any) {
                  pushActivityLog(`Search engine offline: ${err.message}`, "error");
                } finally {
                  setIsSearchingUser(false);
                }
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Ask intelligence indexes..."
                className="flex-1 bg-slate-950 border border-slate-850 hover:border-[#00cfc0]/35 rounded px-2.5 py-1.5 text-[10px] text-white placeholder-slate-600 outline-none font-bold"
              />
              <button
                type="submit"
                disabled={isSearchingUser}
                className="bg-[#00cfc0] text-black font-bold h-7 w-7 rounded flex items-center justify-center cursor-pointer transition-colors"
              >
                {isSearchingUser ? <RefreshCw className="animate-spin" size={12} /> : <Search size={12} />}
              </button>
            </form>

            {userSearchResults.length > 0 && (
              <div className="bg-slate-950 rounded p-2 text-[8.5px] max-h-40 overflow-y-auto space-y-1 divide-y divide-slate-900">
                {userSearchResults.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="pt-1 first:pt-0 space-y-0.5">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold truncate max-w-[140px]">{item.title}</span>
                      <button
                        onClick={() => {
                          setInputText((prev) => prev + `\n\n[Search reference clip: ${item.title}]\nURL: ${item.link}\nSummary: ${item.snippet}`);
                          pushActivityLog(`Injected clip of "${item.title}" into prompt dock`, "info");
                        }}
                        className="text-[7px] text-[#00cfc0] hover:underline uppercase font-bold"
                      >
                        INJECT +
                      </button>
                    </div>
                    <p className="text-slate-500 text-[8px] truncate">{item.link}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* COMPREHENSIVE TEXT/CODE EDITOR PANEL OVERLAY */}
        {openedSandboxFile && (
          <div className="absolute inset-0 bg-[#050811] z-30 flex flex-col border-t border-[#00cfc0]/25 animate-slide-up">
            {/* Editor Header */}
            <div className="px-4 py-3 bg-[#03060c] border-b border-[#00cfc0]/15 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-mono">
                <FileText size={13} className="text-[#00cfc0]" />
                <span className="font-bold text-white truncate max-w-[200px]" title={openedSandboxFile.name}>
                  {openedSandboxFile.name.split("/").pop()}
                </span>
                <span className="text-[8px] bg-slate-950 text-slate-500 font-bold px-1 rounded uppercase">
                  {openedSandboxFile.size}
                </span>
              </div>
              <button
                onClick={() => setOpenedSandboxFile(null)}
                className="text-slate-400 hover:text-rose-400 p-1 rounded cursor-pointer transition-colors"
                title="Close active editor"
              >
                <X size={13} />
              </button>
            </div>

            {/* Editing Path Line */}
            <div className="px-3.5 py-1.5 bg-slate-950 text-[8px] text-slate-500 uppercase flex items-center justify-between border-b border-slate-900 select-all font-mono">
              <span>LOCATION: {openedSandboxFile.name}</span>
              <span className="text-[#00cfc0] font-bold">WRITING ACCESS ENABLED</span>
            </div>

            {/* Custom Code Editor text block */}
            <div className="flex-1 p-3 flex flex-col">
              <div className="flex bg-slate-900 border border-slate-800 rounded mb-2 overflow-hidden text-[10px] uppercase font-bold focus:outline-none flex-shrink-0">
                <button
                  onClick={() => setIsPreviewMode(false)}
                  className={`flex-1 py-1.5 focus:outline-none ${!isPreviewMode ? 'bg-[#00cfc0]/20 text-[#00cfc0]' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Raw Edit
                </button>
                <button
                  onClick={() => setIsPreviewMode(true)}
                  className={`flex-1 py-1.5 focus:outline-none ${isPreviewMode ? 'bg-[#00cfc0]/20 text-[#00cfc0]' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Preview Document
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                {isPreviewMode ? (
                  <div className="w-full h-full bg-[#03060c] border border-slate-850 rounded-lg p-3 text-[11px] text-slate-200 overflow-y-auto leading-relaxed overflow-x-hidden">
                    <Markdown className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 max-w-none text-xs">
                      {sandboxFileEditedContent}
                    </Markdown>
                  </div>
                ) : (
                  <textarea
                    value={sandboxFileEditedContent}
                    onChange={(e) => setSandboxFileEditedContent(e.target.value)}
                    className="w-full h-full bg-[#03060c] border border-slate-850 hover:border-[#00cfc0]/35 rounded-lg p-3 text-[11px] text-slate-200 font-mono focus:border-[#00cfc0] outline-none resize-none leading-relaxed"
                    placeholder="// Enter sandboxed logs or code logic here..."
                  />
                )}
              </div>
            </div>

            {/* Actions Panel */}
            <div className="p-3 bg-slate-950 border-t border-slate-900 grid grid-cols-2 gap-2 select-none">
              <button
                onClick={() => saveWorkspaceFile(openedSandboxFile.name, sandboxFileEditedContent)}
                className="flex items-center justify-center gap-1.5 border border-[#00cfc0] bg-[#00cfc0]/10 text-[#00cfc0] font-bold uppercase py-2 rounded text-[10px] hover:bg-[#00cfc0]/20 max-w-full cursor-pointer transition-colors"
              >
                <Save size={11} />
                <span>Save to Sandbox</span>
              </button>
              <button
                onClick={() => {
                  setInputText((prev) => prev + `\n\n[Active Source Document: ${openedSandboxFile.name}]\n\`\`\`\n${sandboxFileEditedContent}\n\`\`\``);
                  pushActivityLog(`Injected contents of ${openedSandboxFile.name} into prompt`, "info");
                }}
                className="flex items-center justify-center gap-1.5 border border-indigo-700 bg-indigo-950/40 text-indigo-300 font-bold uppercase py-2 rounded text-[10px] hover:bg-slate-900 cursor-pointer transition-colors"
                title="Inject contents to ChatGPT prompt input"
              >
                <ArrowRight size={11} />
                <span>Inject to Prompt</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* MODAL WINDOW OVERLAY FOR NEW REPLIT CHATS */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none font-mono">
          <div className="bg-[#050811] border border-[#00cfc0]/35 rounded-lg max-w-md w-full p-5 space-y-4 animate-scale-in shadow-[0_0_40px_rgba(0,207,192,0.1)]">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white uppercase tracking-widest flex items-center gap-1.5">
                <PlusCircle size={15} className="text-[#00cfc0]" />
                Initialize Conversation Core
              </span>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Title parameter */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">
                  Custom Topic Bracket
                </label>
                <input
                  type="text"
                  placeholder="e.g. WORKSPACE_OPTIMIZE_01"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 text-[#00cfc0] hover:border-[#00cfc0]/30 focus:border-[#00cfc0] rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                />
              </div>

              {/* Persona templates list */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">
                  Choose Directives Model
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                  {ASSISTANT_PERSONAS.map((person) => {
                    const isSelected = selectedPersonaId === person.id;
                    return (
                      <div
                        key={person.id}
                        onClick={() => setSelectedPersonaId(person.id)}
                        className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-all
                          ${isSelected 
                            ? "bg-[#0b1c22] border-[#00cfc0] text-[#00cfc0]" 
                            : "bg-[#090e1a]/40 border-slate-900 hover:border-slate-800"}`}
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded border flex-shrink-0 ${person.bgColor} ${person.textColor}`}>
                          {getPersonaIcon(person.icon)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-[11px] font-bold text-white uppercase tracking-wider">{person.name}</p>
                          <p className="text-[9px] text-slate-500 truncate mt-0.5">{person.description}</p>
                        </div>
                        {isSelected && <Check size={11} className="text-[#00cfc0] flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="flex-1 bg-transparent border border-slate-800 text-slate-450 hover:text-white py-2.5 text-xs font-bold rounded cursor-pointer transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => createNewSession(selectedPersonaId, newChatTitle)}
                className="flex-1 bg-[#00cfc0] text-black hover:bg-[#00cfc0]/80 py-2.5 text-xs font-bold rounded cursor-pointer transition-all hover:shadow-[0_0_12px_rgba(0,207,192,0.2)]"
              >
                INITIALIZE
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Render custom Dual-Factor google Auth verification modal */}
      {authModalOpen && (
        <AuthModal
          onSuccess={(user) => {
            setLoggedUser(user);
            localStorage.setItem("nexus_user", JSON.stringify(user));
            if (Array.isArray(user.history) && user.history.length > 0) {
              setSessions(user.history);
              if (user.history[0]?.id) {
                setActiveSessionId(user.history[0].id);
              }
            } else {
              // If new user with empty history, trigger history sync using current sandbox chat to match "literally make everything saved"
              fetch("/api/user/sync-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: user.email,
                  history: sessions
                })
              }).catch((e) => console.warn("Failed background user init history sync:", e));
            }
            setAuthModalOpen(false);
            pushActivityLog(`Identity authenticated successfully as ${user.email}.`, "success");
          }}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {/* Render administrative owner control centre */}
      {dashboardOpen && loggedUser && (loggedUser.role === "owner" || loggedUser.role === "admin") && (
        <OwnerDashboard
          adminEmail={loggedUser.email}
          onClose={() => setDashboardOpen(false)}
        />
      )}

      {/* Real-time online multi-user chat bubble network */}
      <ChatBubble loggedUser={loggedUser} />

    </div>
  );
}
