import { useState, useEffect } from "react";
import { 
  Users, 
  Database, 
  MessageSquare, 
  Shield, 
  Activity, 
  Plus, 
  Trash2, 
  ArrowRight, 
  RefreshCw, 
  Eye, 
  UserPlus, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  ShieldAlert, 
  Server, 
  Cpu, 
  HardDrive, 
  Flame, 
  Check, 
  RotateCcw,
  CheckSquare,
  Slash
} from "lucide-react";

interface UserInfo {
  email: string;
  role: "owner" | "admin" | "user";
  createdAt: string;
  signInCount: number;
  lastSignInAt: string | null;
  googleAuth: boolean;
  status: "active" | "suspended";
  sessionCount: number;
  history?: any[]; // ChatSession[]
}

interface SystemLog {
  timestamp: string;
  level: "info" | "warning" | "success" | "error";
  event: string;
}

interface OwnerDashboardProps {
  adminEmail: string;
  onClose: () => void;
}

export default function OwnerDashboard({ adminEmail, onClose }: OwnerDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    googleUsersCount: 0,
    totalSessions: 0,
    totalMessages: 0,
    dbSizeKb: "0.0"
  });
  const [usersList, setUsersList] = useState<UserInfo[]>([]);
  const [logsList, setLogsList] = useState<SystemLog[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // User list searches and filter criteria
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Telemetry status
  const [cpuUsage, setCpuUsage] = useState(24);
  const [ramUsage, setRamUsage] = useState(132);
  const [pingSpeed, setPingSpeed] = useState(32);

  // User archive inspector states
  const [inspectedUser, setInspectedUser] = useState<UserInfo | null>(null);
  const [activeInspectedSession, setActiveInspectedSession] = useState<any | null>(null);

  // Creator form inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  // Fetch full metrics
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/admin/metrics?adminEmail=${encodeURIComponent(adminEmail)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed compiling administration statistics.");
      }

      setStats(data.stats);
      setUsersList(data.users || []);
      setLogsList(data.systemLogs || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [adminEmail]);

  // App configurations
  const [appSettings, setAppSettings] = useState({
    maintenanceMode: false,
    allowSignups: true,
    agentAiCore: true,
    debugTracing: false
  });
  const [totalRam, setTotalRam] = useState(512);

  // Telemetry real fetch loop
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/admin/telemetry?adminEmail=${encodeURIComponent(adminEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setCpuUsage(data.cpuUsage || 0);
          setRamUsage(data.ramUsage || 0);
          setPingSpeed(data.pingSpeed || 1);
          setTotalRam(data.totalRam || 512);
          if (data.settings) {
             setAppSettings(data.settings);
          }
        }
      } catch (err) {
        // fail silently on telemetry
      }
    };
    
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, [adminEmail]);

  // Command Action execution wrapper
  const handleAction = async (endpoint: string, payload: any, successFeedback: string) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, ...payload })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Operation failed.");
      }

      setSuccessMessage(successFeedback);
      // Re-trigger global pull
      await fetchDashboardData();

      // Clear states if required
      if (inspectedUser) {
        const updated = (data.users || []).find((u: UserInfo) => u.email === inspectedUser.email) || null;
        setInspectedUser(updated);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Clear system logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to flush and wipe the system event audit trail?")) return;
    try {
      setMaintenanceLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const res = await fetch("/api/admin/logs/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed clearing audit logs.");
      
      setSuccessMessage("Database audit logs successfully cleared.");
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // Reset multipayer chat systems
  const handleResetChatSystem = async () => {
    const confirmation = confirm("WARNING: This will completely restore all public multiplayer channels and reset default friends/connections inside Chat Bubble network. This is non-reversible. Proceed?");
    if (!confirmation) return;
    try {
      setMaintenanceLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const res = await fetch("/api/admin/chat/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed resetting chat system.");
      
      setSuccessMessage("Global Chat Bubble databases fully reset to factory defaults.");
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // 1. Spawning new user accounts
  const handleSubmitNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    await handleAction(
      "/api/admin/users/create",
      { email: newEmail.trim(), password: newPassword || "user123", role: newRole },
      `Account [${newEmail.trim()}] spawned successfully.`
    );

    setNewEmail("");
    setNewPassword("");
    setShowAddForm(false);
  };

  // 2. Change roles (promote / demote)
  const handleRoleChange = async (targetUserEmail: string, newRole: "user" | "admin" | "owner") => {
    await handleAction(
      "/api/admin/users/update-role",
      { targetUserEmail, newRole },
      `Role for [${targetUserEmail}] updated to [${newRole.toUpperCase()}].`
    );
  };

  // 3. Suspend / restore users
  const handleToggleStatus = async (targetUserEmail: string) => {
    await handleAction(
      "/api/admin/users/toggle-status",
      { targetUserEmail },
      `Swapped status for user [${targetUserEmail}].`
    );
  };

  // 4. Deleting account profile
  const handleDeleteUser = async (targetUserEmail: string) => {
    if (!confirm(`Are you absolutely sure you want to completely purge and delete user profile [${targetUserEmail}]? All their saved chat histories will be permanently destroyed.`)) {
      return;
    }
    
    await handleAction(
      "/api/admin/users/delete",
      { targetUserEmail },
      `Record for [${targetUserEmail}] terminated from registry.`
    );

    if (inspectedUser?.email === targetUserEmail) {
      setInspectedUser(null);
      setActiveInspectedSession(null);
    }
  };

  // Toggle app setting
  const handleToggleSetting = async (settingKey: string, currentValue: boolean) => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/admin/settings/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, settingKey, value: !currentValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed updating server setting.");
      setAppSettings(data.settings);
      setSuccessMessage(`System variable ${settingKey} updated.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Filter & Search users list
  const filteredUsers = usersList.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div id="owner-backstage-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 md:p-4 overflow-y-auto backdrop-blur-md">
      <div 
        id="owner-backstage-container" 
        className="w-full max-w-6xl rounded-none md:rounded-xl border-y md:border border-[#00cfc0]/30 bg-[#060a16] text-[#e2e8f0] shadow-[0_0_35px_rgba(0,207,192,0.25)] flex flex-col h-full md:max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dashboard top banner */}
        <header className="border-b border-[#00cfc0]/20 bg-[#050811] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00cfc0]/15 text-[#00cfc0] shadow-[0_0_12px_rgba(0,207,192,0.25)]">
              <Shield size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-mono text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#00cfc0] flex items-center gap-1.5 flex-wrap">
                Administration Hub
                <span className="text-[9px] bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-normal">
                  SysAdmin Console
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] sm:max-w-none">
                Datastore Interface: <span className="text-[#00cfc0] font-bold">{adminEmail}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded border border-slate-800 bg-[#050811] hover:bg-slate-800 text-[10px] font-mono font-bold uppercase transition-all tracking-wide text-slate-300 disabled:opacity-50 cursor-pointer min-h-[36px]"
              title="Poll database values"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Reload Database</span>
              <span className="sm:hidden">Reload</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer font-bold text-sm min-h-[36px]"
              title="Close Panel and return"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Dashboard notifications */}
        {errorMessage && (
          <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-950/20 px-4 sm:px-6 py-2.5 text-xs text-rose-400 font-mono flex-shrink-0">
            <AlertTriangle size={13} className="flex-shrink-0 text-rose-500" />
            <span className="line-clamp-1">[ERROR]: {errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/20 px-4 sm:px-6 py-2.5 text-xs text-emerald-300 font-mono flex-shrink-0">
            <CheckCircle size={13} className="flex-shrink-0 text-emerald-400" />
            <span className="line-clamp-1">[SUCCESS]: {successMessage}</span>
          </div>
        )}

        {/* Core content scroll panel */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#040812]">
          
          {/* Section A: KPI Stat Boxes */}
          <section id="backstage-kpis" className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#050811] border border-slate-800/60 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Accounts</span>
                <Users size={12} className="text-[#00cfc0]" />
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">{stats.totalUsers}</span>
                <p className="text-[9px] text-slate-500 mt-0.5">Registered members</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/60 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Google Auth</span>
                <span className="text-cyan-400 font-mono text-[9px]">OTP</span>
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">{stats.googleUsersCount}</span>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {stats.totalUsers > 0 ? ((stats.googleUsersCount / stats.totalUsers) * 100).toFixed(0) : 0}% of total
                </p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/60 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Chat Nodes</span>
                <FileText size={12} className="text-yellow-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">{stats.totalSessions}</span>
                <p className="text-[9px] text-slate-500 mt-0.5">Stored directories</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/60 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Global Messages</span>
                <MessageSquare size={12} className="text-emerald-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">{stats.totalMessages}</span>
                <p className="text-[9px] text-slate-500 mt-0.5">Exchanged events</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/60 p-3.5 rounded-lg col-span-2 md:col-span-1 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Database Weight</span>
                <Database size={12} className="text-indigo-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-base sm:text-lg font-extrabold text-slate-100 font-mono">{stats.dbSizeKb} KB</span>
                <p className="text-[9px] text-slate-500 mt-0.5">JSON Payload scale</p>
              </div>
            </div>
          </section>

          {/* Section B: New Live Server Real-Time Diagnostics & Maintenance Protocols */}
          <section id="owner-diagnostics-panels" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live simulated server diagnostic metrics (Virtual gateway telemetry) */}
            <div className="bg-[#050811] border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-1">
                  <Server size={14} className="text-[#00cfc0]" />
                  Virtual Node Telemetry
                </h3>
                <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                  Active diagnostic engine monitoring processes on host container.
                </p>
              </div>

              {/* Progress Gauges */}
              <div className="space-y-4">
                {/* Simulated CPU Load */}
                <div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><Cpu size={12} /> Cpu Core workload</span>
                    <span className={cpuUsage > 75 ? "text-rose-400" : cpuUsage > 45 ? "text-yellow-400" : "text-emerald-400"}>{cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-[#0d1527] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${cpuUsage > 75 ? "bg-rose-500" : cpuUsage > 45 ? "bg-yellow-500" : "bg-teal-400"}`}
                      style={{ width: `${cpuUsage}%` }}
                    />
                  </div>
                </div>

                {/* Simulated Dynamic Memory Usage */}
                <div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><HardDrive size={12} /> Virtual Memory footprint</span>
                    <span className="text-slate-300">{ramUsage} MB / 512 MB</span>
                  </div>
                  <div className="w-full bg-[#0d1527] h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000"
                      style={{ width: `${(ramUsage / 512) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Simulated Database Response speed */}
                <div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><Flame size={12} /> DB Response Time</span>
                    <span className="text-emerald-400">{pingSpeed} ms</span>
                  </div>
                  <div className="w-full bg-[#0d1527] h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (pingSpeed / 120) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Server heartbeat */}
              <div className="bg-[#0b1021] border border-slate-900 rounded p-2 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-500">Gateway Status</span>
                <span className="inline-flex items-center gap-1.5 text-[9px] text-emerald-400 font-extrabold uppercase font-mono">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                  ONLINE & ASYNC READY
                </span>
              </div>
            </div>

            {/* High-tier Management Actions & Multiuser Controls */}
            <div className="lg:col-span-2 bg-[#050811] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-1">
                  <ShieldAlert size={14} className="text-red-400" />
                  Datastore Maintenance protocols
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  Execute secure system routines to flush data, maintain database index sizes, and inspect system consistency.
                </p>
              </div>

              {/* Action buttons list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Reset public channels / chat database */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-200 block">Reset Chat Bubble System</span>
                    <span className="text-[9px] text-slate-500 font-sans block mt-1">
                      Flushes and restores custom messages, groups, and server channels back to pristine default entities.
                    </span>
                  </div>
                  <button
                    onClick={handleResetChatSystem}
                    disabled={maintenanceLoading}
                    className="mt-3.5 w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[9px] font-mono uppercase font-extrabold tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded cursor-pointer leading-none min-h-[34px] disabled:opacity-50"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Chat Workspace</span>
                  </button>
                </div>

                {/* Flush auditing log file */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-200 block">Wipe Event Audit Logs</span>
                    <span className="text-[9px] text-slate-500 font-sans block mt-1">
                      Empties the database history trail logs to save disk size and rebuild fresh trace entries.
                    </span>
                  </div>
                  <button
                    onClick={handleClearLogs}
                    disabled={maintenanceLoading}
                    className="mt-3.5 w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[9px] font-mono uppercase font-extrabold tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded cursor-pointer leading-none min-h-[34px] disabled:opacity-50"
                  >
                    <Trash2 size={11} />
                    <span>Flush All Logs</span>
                  </button>
                </div>
              </div>

              {/* Maintenance guidelines warning note */}
              <div className="bg-amber-500/5 border border-amber-500/15 p-2.5 rounded text-[9.5px] font-mono text-amber-400 leading-relaxed">
                <span className="font-extrabold uppercase">Notice:</span> Operations executed in this administrative scope apply directly into the shared file systems without temporary buffer storage. Use containing guidelines with authority control.
              </div>
            </div>

            {/* Application Configuration Feature Toggles */}
            <div className="lg:col-span-3 bg-[#050811] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-1">
                  <CheckSquare size={14} className="text-[#00cfc0]" />
                  Global Workspace Settings
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  Modify live parameters and user-accessible interfaces at runtime.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Maintenance Mode</span>
                    <span className="text-[9px] text-slate-500">Lock out all users</span>
                  </div>
                  <div 
                    onClick={() => handleToggleSetting("maintenanceMode", appSettings.maintenanceMode)}
                    className={`h-4 w-8 rounded-full border relative cursor-pointer transition-colors ${appSettings.maintenanceMode ? "bg-rose-950 border-rose-900" : "bg-slate-950 border-slate-700"}`}
                  >
                    <span className={`absolute top-0 bottom-0 w-4 rounded-full border transition-all ${appSettings.maintenanceMode ? "right-0 bg-[#00cfc0] border-emerald-400" : "left-0 bg-slate-500 border-slate-400"}`}></span>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Allow Sign-ups</span>
                    <span className="text-[9px] text-slate-500">New OTP/Auth accounts</span>
                  </div>
                  <div 
                    onClick={() => handleToggleSetting("allowSignups", appSettings.allowSignups)}
                    className={`h-4 w-8 rounded-full border relative cursor-pointer transition-colors ${appSettings.allowSignups ? "bg-emerald-950 border-emerald-900" : "bg-slate-950 border-slate-700"}`}
                  >
                    <span className={`absolute top-0 bottom-0 w-4 rounded-full border transition-all ${appSettings.allowSignups ? "right-0 bg-[#00cfc0] border-emerald-400" : "left-0 bg-slate-500 border-slate-400"}`}></span>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Agent AI Core</span>
                    <span className="text-[9px] text-slate-500">Global AI integration</span>
                  </div>
                  <div 
                    onClick={() => handleToggleSetting("agentAiCore", appSettings.agentAiCore)}
                    className={`h-4 w-8 rounded-full border relative cursor-pointer transition-colors ${appSettings.agentAiCore ? "bg-emerald-950 border-emerald-900" : "bg-slate-950 border-slate-700"}`}
                  >
                    <span className={`absolute top-0 bottom-0 w-4 rounded-full border transition-all ${appSettings.agentAiCore ? "right-0 bg-[#00cfc0] border-emerald-400" : "left-0 bg-slate-500 border-slate-400"}`}></span>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Debug Tracing</span>
                    <span className="text-[9px] text-slate-500">Capture verbose events</span>
                  </div>
                  <div 
                    onClick={() => handleToggleSetting("debugTracing", appSettings.debugTracing)}
                    className={`h-4 w-8 rounded-full border relative cursor-pointer transition-colors ${appSettings.debugTracing ? "bg-amber-950 border-amber-900" : "bg-slate-950 border-slate-700"}`}
                  >
                    <span className={`absolute top-0 bottom-0 w-4 rounded-full border transition-all ${appSettings.debugTracing ? "right-0 bg-[#00cfc0] border-emerald-400" : "left-0 bg-slate-500 border-slate-400"}`}></span>
                  </div>
                </div>
              </div>
            </div>

          </section>

          {/* Section C: User Directory Management & Search Filter Control Panel */}
          <section id="backstage-user-directory" className="bg-[#050811] border border-slate-800/80 rounded-xl overflow-hidden">
            
            {/* Header controls */}
            <div className="px-4 sm:px-5 py-4 border-b border-slate-800 bg-[#090f1d] flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Users size={14} className="text-[#00cfc0]" />
                  User Registry Management({filteredUsers.length})
                </h3>
                
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 rounded bg-[#00cfc0]/15 hover:bg-[#00cfc0]/25 text-[#00cfc0] border border-[#00cfc0]/20 px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all tracking-wider cursor-pointer"
                >
                  <UserPlus size={12} />
                  <span>Spawn Account</span>
                </button>
              </div>

              {/* Filters & search line */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search query input */}
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by user email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-[11px] font-mono rounded bg-slate-950 border border-slate-800/80 py-1.5 pl-8 pr-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00cfc0]/40"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm("")} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter privileges dropdown */}
                <div className="relative flex items-center">
                  <Filter size={11} className="absolute left-3 text-slate-500 pointer-events-none" />
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full text-[11px] font-mono rounded bg-slate-950 border border-slate-800/80 py-1.5 pl-8 pr-2 text-slate-300 appearance-none focus:outline-none focus:border-[#00cfc0]/40 cursor-pointer"
                  >
                    <option value="all">Filtre: All Roles</option>
                    <option value="owner">Role: Owner</option>
                    <option value="admin">Role: Admin</option>
                    <option value="user">Role: User</option>
                  </select>
                  <span className="absolute right-3 pointer-events-none text-[8px] text-slate-500">▼</span>
                </div>

                {/* Filter status dropdown */}
                <div className="relative flex items-center">
                  <Activity size={11} className="absolute left-3 text-slate-500 pointer-events-none" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-[11px] font-mono rounded bg-slate-950 border border-slate-800/80 py-1.5 pl-8 pr-2 text-slate-300 appearance-none focus:outline-none focus:border-[#00cfc0]/40 cursor-pointer"
                  >
                    <option value="all">Filtre: All Statuses</option>
                    <option value="active">Status: Active</option>
                    <option value="suspended">Status: Suspended</option>
                  </select>
                  <span className="absolute right-3 pointer-events-none text-[8px] text-slate-500">▼</span>
                </div>
              </div>
            </div>

            {/* Quick Register User Inline Drawer */}
            {showAddForm && (
              <form onSubmit={handleSubmitNewUser} className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-end gap-3.5 animate-fadeIn">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Email Identifier</label>
                  <input
                    type="email"
                    required
                    placeholder="name@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded border border-slate-800 bg-[#050811] py-1.5 px-2.5 font-mono text-[11px] text-slate-100 focus:outline-none focus:border-[#00cfc0]/40 placeholder-slate-600"
                  />
                </div>
                <div className="w-[150px]">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded border border-slate-800 bg-[#050811] py-1.5 px-2.5 font-mono text-[11px] text-slate-100 focus:outline-none focus:border-[#00cfc0]/40 placeholder-slate-600"
                  />
                </div>
                <div className="w-[120px]">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Privilege Designation</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full rounded border border-slate-800 bg-[#050811] py-1.5 px-2 select-dark font-mono text-[11px] text-slate-100 focus:outline-none focus:border-[#00cfc0]/40"
                  >
                    <option value="user">User Role</option>
                    <option value="admin">Admin Role</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded bg-gradient-to-r from-[#00cfc0] to-[#01a399] py-1.5 px-4 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:brightness-110 active:scale-[0.98] cursor-pointer min-h-[32px]"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded bg-slate-800 text-slate-400 hover:text-white py-1.5 px-3 border border-slate-700 font-mono text-[10px] font-bold uppercase cursor-pointer min-h-[32px]"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* RESPONSIVE LAYOUTS FOR TABLE: TABLE on Desktop, ADAPTIVE CARDS on Mobile */}
            
            {/* 1. Desktop Users Table (hidden on small viewports) */}
            <div id="users-table-viewport-desktop" className="hidden md:block overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">User Email / Auth Code</th>
                    <th className="px-3 py-3 font-semibold text-center">Designated Role</th>
                    <th className="px-3 py-3 font-semibold text-center">Auth Method</th>
                    <th className="px-3 py-3 font-semibold text-center">Sessions</th>
                    <th className="px-3 py-3 font-semibold">Last login</th>
                    <th className="px-3 py-3 font-semibold text-center">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/65">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 font-mono text-xs">
                        No database records matches search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isMe = user.email.toLowerCase() === adminEmail.toLowerCase();
                      const signupStr = new Date(user.createdAt).toLocaleDateString();
                      
                      return (
                        <tr key={user.email} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-slate-100 block">{user.email}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">Joined: {signupStr}</span>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {isMe ? (
                              <span className="text-[10px] bg-[#00cfc0]/20 text-[#00cfc0] border border-[#00cfc0]/40 px-2 py-0.5 rounded font-bold uppercase">
                                OWNER (YOU)
                              </span>
                            ) : (
                              <select
                                value={user.role}
                                disabled={user.role === "owner"}
                                onChange={(e) => handleRoleChange(user.email, e.target.value as any)}
                                className="bg-[#050811] border border-slate-800/80 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-bold uppercase font-mono focus:outline-none checked:bg-[#00cfc0] cursor-pointer"
                              >
                                <option value="user">USER</option>
                                <option value="admin">ADMIN</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {user.googleAuth ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-cyan-900 bg-cyan-950/30 text-cyan-400">
                                Google OTP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-slate-800 bg-slate-950 text-slate-400">
                                Email/PW
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span className="font-bold text-yellow-400">{user.sessionCount} nodes</span>
                          </td>
                          <td className="px-3 py-3.5 text-slate-400">
                            {user.lastSignInAt ? (
                              <div>
                                <span className="text-[10px] text-slate-300 font-semibold block">{new Date(user.lastSignInAt).toLocaleDateString()}</span>
                                <span className="text-[9px] text-slate-500">{new Date(user.lastSignInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({user.signInCount}x)</span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[10px]">Never active</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {user.status === "suspended" ? (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 border border-rose-900 bg-rose-950/40 text-rose-400 rounded">
                                SUSPENDED
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 border border-emerald-900 bg-emerald-950/40 text-emerald-400 rounded">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {/* Inspect chat database */}
                              <button
                                onClick={() => {
                                  setInspectedUser(user);
                                  setActiveInspectedSession(user.history?.[0] || null);
                                }}
                                className="flex items-center justify-center gap-1 border border-slate-800 bg-[#050811] hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded transition-all cursor-pointer text-[10px] uppercase font-bold"
                                title="Inspect synchronized chat sessions"
                              >
                                <Eye size={11} className="text-[#00cfc0]" />
                                <span>Inspect</span>
                              </button>

                              {!isMe && user.role !== "owner" && (
                                <>
                                  {/* Toggle block/suspension */}
                                  <button
                                    onClick={() => handleToggleStatus(user.email)}
                                    className={`px-2 py-1 rounded transition-all cursor-pointer font-bold text-[10px] uppercase border
                                      ${user.status === "suspended"
                                        ? "border-emerald-900/60 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-900/20"
                                        : "border-amber-900/60 bg-amber-950/10 text-amber-500 hover:bg-amber-900/20"}`}
                                    title={user.status === "suspended" ? "Restore user privileges" : "Temporarily block account log-ins"}
                                  >
                                    <span>{user.status === "suspended" ? "Unban" : "Suspend"}</span>
                                  </button>

                                  {/* Purge user */}
                                  <button
                                    onClick={() => handleDeleteUser(user.email)}
                                    className="p-1 px-1.5 rounded border border-rose-950 bg-rose-950/10 text-rose-500 hover:bg-rose-900/30 transition-all cursor-pointer"
                                    title="Purge user record"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. Mobile Responsive Card List (shown on small viewports instead of broken table) */}
            <div id="users-table-viewport-mobile" className="block md:hidden border-t border-slate-800 divide-y divide-slate-800/80 bg-slate-950/30">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-mono text-xs">
                  No database records matches search filters.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isMe = user.email.toLowerCase() === adminEmail.toLowerCase();
                  const signupStr = new Date(user.createdAt).toLocaleDateString();
                  
                  return (
                    <div key={user.email} className="p-4 space-y-3.5 tracking-wide text-xs font-mono">
                      {/* Email block and status indicators */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1">
                          <span className="font-extrabold text-slate-100 block break-all text-xs sm:text-sm">{user.email}</span>
                          <span className="text-[10px] text-slate-500 block">Joined: {signupStr}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {user.status === "suspended" ? (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border border-rose-900/60 bg-rose-950/40 text-rose-400 rounded">
                              SUSPENDED
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border border-emerald-950 bg-emerald-950/40 text-emerald-400 rounded">
                              ACTIVE
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400">
                            {user.sessionCount} chats
                          </span>
                        </div>
                      </div>

                      {/* Info grid detail column */}
                      <div className="grid grid-cols-2 gap-2.5 bg-slate-950/50 border border-slate-900/60 p-2.5 rounded text-[10px]">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Role</span>
                          {isMe ? (
                            <span className="text-[#00cfc0] font-extrabold uppercase mt-0.5 block">Owner (You)</span>
                          ) : (
                            <select
                              value={user.role}
                              disabled={user.role === "owner"}
                              onChange={(e) => handleRoleChange(user.email, e.target.value as any)}
                              className="bg-[#050811] mt-1 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-300 font-bold uppercase font-mono block w-full focus:outline-none"
                            >
                              <option value="user">USER</option>
                              <option value="admin">ADMIN</option>
                            </select>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Auth Engine</span>
                          <span className="text-slate-300 font-mono block mt-1">
                            {user.googleAuth ? "Google OTP" : "Email / Pass"}
                          </span>
                        </div>

                        <div className="col-span-2 border-t border-slate-900/60 pt-2">
                          <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Last Interaction</span>
                          <span className="text-slate-300 font-mono block mt-0.5">
                            {user.lastSignInAt 
                              ? `${new Date(user.lastSignInAt).toLocaleDateString()} at ${new Date(user.lastSignInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : "No documented login interactions."}
                          </span>
                        </div>
                      </div>

                      {/* Mobile action touch targets inline */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          onClick={() => {
                            setInspectedUser(user);
                            setActiveInspectedSession(user.history?.[0] || null);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-slate-800 bg-[#050811] hover:bg-slate-800 text-slate-200 py-2 rounded text-[10px] uppercase font-bold transition-all cursor-pointer min-h-[38px]"
                        >
                          <Eye size={12} className="text-[#00cfc0]" />
                          <span>Inspect Chats</span>
                        </button>

                        {!isMe && user.role !== "owner" && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(user.email)}
                              className={`px-3 py-2 rounded text-[10px] uppercase font-bold transition-all cursor-pointer border min-h-[38px]
                                ${user.status === "suspended"
                                  ? "border-emerald-900 bg-emerald-950/10 text-emerald-400"
                                  : "border-amber-900 bg-amber-950/10 text-amber-400"}`}
                            >
                              {user.status === "suspended" ? "Unban" : "Ban"}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user.email)}
                              className="p-2 border border-rose-950 bg-rose-950/10 text-rose-500 rounded cursor-pointer min-h-[38px] flex items-center justify-center"
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </section>

          {/* Expanded Session Registry Viewer Drawer */}
          {inspectedUser && (
            <section id="inspected-user-history" className="bg-[#050811] border border-[#00cfc0]/30 rounded-xl p-4 sm:p-5 animate-slideIn">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4 flex-wrap gap-4">
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                    <FileText size={13} className="text-yellow-400" />
                    Historic Sync Inspector: <span className="text-[#00cfc0] font-extrabold break-all">{inspectedUser.email}</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Viewing real-time persistent nodes stored securely for this account.
                  </p>
                </div>
                <button
                  onClick={() => { setInspectedUser(null); setActiveInspectedSession(null); }}
                  className="text-[10px] text-slate-400 hover:text-white px-2.5 py-1.5 border border-slate-800 rounded bg-[#010610] cursor-pointer uppercase font-bold font-mono tracking-wide min-h-[34px]"
                >
                  Close Inspector
                </button>
              </div>

              {/* Inspector columns adaptable grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Synced sessions list */}
                <div className="border border-slate-800/80 rounded-lg bg-slate-950/60 p-3 max-h-[250px] md:max-h-[350px] overflow-y-auto">
                  <span className="block text-[8.5px] uppercase tracking-wider text-slate-500 font-extrabold mb-2.5 text-center">
                    Saved Chat Session Nodes ({inspectedUser.history?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {!inspectedUser.history || inspectedUser.history.length === 0 ? (
                      <div className="text-center py-10 text-slate-600 text-[10px]">
                        No active conversations registered to this accounts yet.
                      </div>
                    ) : (
                      inspectedUser.history.map((sess: any) => (
                        <button
                          key={sess.id}
                          onClick={() => setActiveInspectedSession(sess)}
                          className={`w-full text-left p-2 rounded text-[10px] font-mono transition-colors block cursor-pointer border
                            ${activeInspectedSession?.id === sess.id 
                              ? "bg-[#00cfc0]/15 text-[#00cfc0] border-[#00cfc0]/35 font-bold"
                              : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/30"}`}
                        >
                          <div className="truncate font-semibold">{sess.title || "Untitled Session Node"}</div>
                          <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                            <span>{new Date(sess.createdAt).toLocaleDateString()}</span>
                            <span className="text-[#00cfc0]">[{sess.messages?.length || 0} msgs]</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Messages transcript */}
                <div className="md:col-span-2 border border-slate-800/80 rounded-lg bg-slate-950/60 p-3 sm:p-4 font-mono text-[11px] max-h-[300px] md:max-h-[350px] overflow-y-auto flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="block text-[8.5px] uppercase tracking-wider text-slate-500 font-extrabold mb-3 text-center border-b border-slate-800 pb-1.5">
                      {activeInspectedSession 
                        ? `Session Transcript: "${activeInspectedSession.title || "Untitled Session"}"`
                        : "Messages Transcript Console"}
                    </span>

                    {!activeInspectedSession ? (
                      <div className="text-center py-12 text-slate-600">
                        Please highlight an active session node from the left channel list.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {activeInspectedSession.messages?.map((msg: any, idx: number) => {
                          const isUser = msg.role === "user";
                          const textContent = msg.parts?.map((p: any) => p.text || "").join("\n") || "";
                          const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
                          
                          return (
                            <div key={idx} className="p-3 rounded-lg border border-slate-900 bg-[#050811]/40">
                              <div className="flex justify-between items-center text-[8.5px] text-slate-500 font-bold uppercase mb-1.5 border-b border-slate-950 pb-1">
                                <span className={isUser ? "text-[#00cfc0]" : "text-yellow-400"}>
                                  {isUser ? "● TERMINAL OPERATOR" : "▲ NEXUS AI CORES"}
                                </span>
                                <span>{timestamp}</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap select-text text-[10.5px]">
                                {textContent}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section D: System Audit StreamLogs */}
          <section id="backstage-audit-logs" className="bg-[#050811] border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-[#090f1d] flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Activity size={14} className="text-[#00cfc0]" />
                Cyber Event Audit Log Trail
              </h3>
              <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                Active Disk Stream
              </span>
            </div>

            <div className="p-4 bg-slate-950/85 max-h-[180px] overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin">
              {logsList.length === 0 ? (
                <div className="text-slate-600 text-center py-4">No audit logs indexed yet.</div>
              ) : (
                logsList.map((log, i) => {
                  let badgeColor = "text-slate-400 border-slate-800";
                  if (log.level === "success") badgeColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 pb-0.5";
                  if (log.level === "warning") badgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400 pb-0.5";
                  if (log.level === "error") badgeColor = "bg-rose-500/10 border-rose-500/30 text-rose-400 pb-0.5";

                  return (
                    <div key={i} className="flex items-start gap-2 border-b border-slate-900/40 pb-1 flex-wrap sm:flex-nowrap">
                      <span className="text-slate-500 flex-shrink-0 text-[9px] w-[65px]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className={`px-1.5 rounded border text-[8px] font-extrabold uppercase select-none flex-shrink-0 ${badgeColor}`}>
                        {log.level}
                      </span>
                      <span className="text-slate-300 break-all sm:break-normal leading-relaxed select-text">{log.event}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
