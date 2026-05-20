import { useState, useEffect } from "react";
import { Users, Database, MessageSquare, Shield, Activity, Plus, Trash2, ArrowRight, RefreshCw, Eye, UserPlus, FileText, CheckCircle, AlertTriangle } from "lucide-react";

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

  return (
    <div id="nexus-dashboard-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 overflow-y-auto backdrop-blur-md">
      <div 
        id="nexus-dashboard-container" 
        className="w-full max-w-6xl rounded-xl border border-[#00cfc0]/30 bg-[#060a16] text-[#e2e8f0] shadow-[0_0_35px_rgba(0,207,192,0.15)] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dashboard Top Header */}
        <header className="border-b border-[#00cfc0]/20 bg-[#050811] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00cfc0]/10 text-[#00cfc0] shadow-[0_0_10px_rgba(0,207,192,0.2)] animate-pulse">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-mono text-base font-extrabold uppercase tracking-widest text-[#00cfc0] flex items-center gap-2">
                Executive Owner Dashboard
                <span className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-2 py-0.5 rounded uppercase font-sans animate-pulse">
                  System Admin Mode
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Log analysis & persistent datastore interface: logged as <span className="text-[#00cfc0] font-bold">{adminEmail}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded border border-slate-700 bg-[#050811] hover:bg-slate-800 px-3 py-1.5 font-mono text-[11px] font-bold uppercase transition-all tracking-wider text-slate-300 hover:text-white cursor-pointer disabled:opacity-50"
              title="Poll database values"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>Synch Data</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer font-bold text-sm"
              title="Close Panel and return to main console"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Dashboard Alert Area */}
        {errorMessage && (
          <div className="flex items-start gap-2 border-b border-rose-500/15 bg-rose-950/20 px-6 py-3 text-xs text-rose-400 font-mono">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>[DB RUNTIME EXCEPTION]: {errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-start gap-2 border-b border-emerald-500/15 bg-emerald-950/20 px-6 py-3 text-xs text-emerald-300 font-mono">
            <CheckCircle size={14} className="mt-0.5" />
            <span>[DB TRANSACTION EXECUTED]: {successMessage}</span>
          </div>
        )}

        {/* Core content grid */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section A: Analytics Row */}
          <section id="dashboard-analytics-cards" className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[#050811] border border-slate-800/80 p-4 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Account Index</span>
                <Users size={12} className="text-[#00cfc0]" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-slate-100">{stats.totalUsers}</span>
                <p className="text-[9px] text-slate-500 mt-1">Registered users</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/80 p-4 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Google Users</span>
                <span className="text-cyan-400 font-mono text-[9px]">OTP</span>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-slate-100">{stats.googleUsersCount}</span>
                <p className="text-[9px] text-slate-500 mt-1">
                  {stats.totalUsers > 0 ? ((stats.googleUsersCount / stats.totalUsers) * 100).toFixed(0) : 0}% of accounts
                </p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/80 p-4 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Conversations</span>
                <FileText size={12} className="text-yellow-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-slate-100">{stats.totalSessions}</span>
                <p className="text-[9px] text-slate-500 mt-1">Synced session nodes</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/80 p-4 rounded-lg flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Messages Logged</span>
                <MessageSquare size={12} className="text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-slate-100">{stats.totalMessages}</span>
                <p className="text-[9px] text-slate-500 mt-1">Total chat messages</p>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800/80 p-4 rounded-lg col-span-2 md:col-span-1 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Database Weight</span>
                <Database size={12} className="text-indigo-400" />
              </div>
              <div className="mt-2">
                <span className="text-lg font-extrabold text-slate-100 font-mono">{stats.dbSizeKb} KB</span>
                <p className="text-[9px] text-slate-500 mt-1">nexus_db.json payload</p>
              </div>
            </div>
          </section>

          {/* Section B: User Directory Table */}
          <section id="dashboard-user-management" className="bg-[#050811] border border-slate-800/80 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-[#090f1d] flex items-center justify-between flex-wrap gap-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users size={14} className="text-[#00cfc0]" />
                User Profiles Directory & Status Controls ({usersList.length})
              </h3>
              
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded bg-[#00cfc0]/15 hover:bg-[#00cfc0]/25 text-[#00cfc0] border border-[#00cfc0]/20 px-3 py-1 font-mono text-[10px] font-bold uppercase transition-all tracking-wider cursor-pointer"
              >
                <UserPlus size={11} />
                <span>Spawn User Account</span>
              </button>
            </div>

            {/* Quick Register User Inline Drawer */}
            {showAddForm && (
              <form onSubmit={handleSubmitNewUser} className="p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-end gap-3.5 animate-fadeIn">
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
                    className="w-full rounded border border-slate-800 bg-[#050811] py-1.5 px-2 font-mono text-[11px] text-slate-100 focus:outline-none focus:border-[#00cfc0]/40"
                  >
                    <option value="user">User Role</option>
                    <option value="admin">Admin Role</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded bg-gradient-to-r from-[#00cfc0] to-[#01a399] py-1.5 px-4 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950 hover:brightness-110 active:scale-[0.98] cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded bg-slate-800 text-slate-400 hover:text-white py-1.5 px-3 border border-slate-700 font-mono text-[10px] font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Main table design */}
            <div id="users-table-viewport" className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">User Email / Auth Code</th>
                    <th className="px-3 py-3 font-semibold text-center">Designated Role</th>
                    <th className="px-3 py-3 font-semibold text-center">Auth Method</th>
                    <th className="px-3 py-3 font-semibold text-center">Logs count</th>
                    <th className="px-3 py-3 font-semibold">Last login</th>
                    <th className="px-3 py-3 font-semibold text-center">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-500">
                        No custom database records loaded.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((user) => {
                      const isMe = user.email.toLowerCase() === adminEmail.toLowerCase();
                      const signupStr = new Date(user.createdAt).toLocaleDateString();
                      
                      return (
                        <tr key={user.email} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-slate-100 block">{user.email}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">Signed Up: {signupStr}</span>
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
                                className="bg-[#050811] border border-slate-800/80 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-bold uppercase font-mono focus:outline-none checked:bg-[#00cfc0]"
                              >
                                <option value="user">USER</option>
                                <option value="admin">ADMIN</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {user.googleAuth ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-cyan-900 bg-cyan-950/30 text-cyan-400">
                                <span>Google OTP</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-slate-800 bg-slate-950 text-slate-400">
                                <span>Email/PW</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span className="font-bold text-yellow-400">{user.sessionCount} sessions</span>
                          </td>
                          <td className="px-3 py-3.5 text-slate-400">
                            {user.lastSignInAt ? (
                              <div>
                                <span className="text-[10px] text-slate-300 font-semibold block">{new Date(user.lastSignInAt).toLocaleDateString()}</span>
                                <span className="text-[9px] text-slate-500">{new Date(user.lastSignInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({user.signInCount}x)</span>
                              </div>
                            ) : (
                              <span className="text-slate-600">Never active</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {user.status === "suspended" ? (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 border border-rose-900 bg-rose-950/40 text-rose-400 rounded animate-pulse">
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
                                className="flex items-center justify-center gap-1 border border-slate-800 bg-[#050811] hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer text-[10px] uppercase font-bold"
                                title="Inspect synchronized chat sessions"
                              >
                                <Eye size={11} className="text-[#00cfc0]" />
                                <span>Inspect History</span>
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
                                    title={user.status === "suspended" ? "Unblock account access" : "Temporarily block account log-ins"}
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
          </section>

          {/* Expanded Session Registry Viewer Drawer (If user row clicks "Inspect Archive") */}
          {inspectedUser && (
            <section id="inspected-user-history" className="bg-[#050811] border border-[#00cfc0]/30 rounded-lg p-5 animate-slideIn">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4 flex-wrap gap-4">
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                    <FileText size={13} className="text-yellow-400" />
                    Historic Sync Inspector: <span className="text-[#00cfc0] font-extrabold">{inspectedUser.email}</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Viewing real-time persistent nodes stored securely for this account.
                  </p>
                </div>
                <button
                  onClick={() => { setInspectedUser(null); setActiveInspectedSession(null); }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-800 rounded bg-[#010610] cursor-pointer uppercase font-bold"
                >
                  Close Sync Inspector
                </button>
              </div>

              {/* Inspector Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Synced sessions list */}
                <div className="border border-slate-800/80 rounded bg-slate-950/60 p-3 max-h-[300px] overflow-y-auto">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-extrabold mb-2 text-center">
                    Saved Chat Session Nodes ({inspectedUser.history?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {!inspectedUser.history || inspectedUser.history.length === 0 ? (
                      <div className="text-center py-6 text-slate-600 text-[10px]">
                        No active conversations registered to this traveler.
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
                          <div className="truncate font-semibold">{sess.title || "Untitled Terminal Session"}</div>
                          <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                            <span>{new Date(sess.createdAt).toLocaleDateString()}</span>
                            <span className="text-yellow-500">[{sess.messages?.length || 0} msgs]</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Messages transcript */}
                <div className="col-span-2 border border-slate-800/80 rounded bg-slate-950/60 p-4 font-mono text-[11px] max-h-[300px] overflow-y-auto flex flex-col justify-between">
                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-extrabold mb-3 text-center border-b border-slate-800 pb-1.5">
                      {activeInspectedSession 
                        ? `Session Transcript: "${activeInspectedSession.title || "Untitled Session"}"`
                        : "Messages Transcript Console"}
                    </span>

                    {!activeInspectedSession ? (
                      <div className="text-center py-10 text-slate-600">
                        Please highlight an active session node from the left channel list.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {activeInspectedSession.messages?.map((msg: any) => {
                          const isUser = msg.role === "user";
                          const textContent = msg.parts?.map((p: any) => p.text || "").join("\n") || "";
                          const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : "";
                          
                          return (
                            <div key={msg.id} className="p-2.5 rounded border border-slate-900 bg-[#050811]/40">
                              <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase mb-1.5 border-b border-slate-950 pb-0.5">
                                <span className={isUser ? "text-[#00cfc0]" : "text-yellow-400"}>
                                  {isUser ? "● TERMINAL OPERATOR (USER)" : "▲ NEXUS COMPILER (GEMINI AI)"}
                                </span>
                                <span>{timestamp}</span>
                              </div>
                              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap select-text text-[10.5px]">
                                {textContent}
                              </p>
                              {msg.parts?.some((p: any) => p.inlineData) && (
                                <div className="mt-1.5 text-[9px] text-teal-400 font-semibold uppercase tracking-wider">
                                  [Attach payload image content present in transcript]
                                </div>
                              )}
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

          {/* Section C: System Audit StreamLogs */}
          <section id="dashboard-audit-logs" className="bg-[#050811] border border-slate-800/80 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 bg-[#090f1d] flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Activity size={14} className="text-[#00cfc0]" />
                Real-Time Cyber Portal Event Auditing Log Stream
              </h3>
              <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold px-2 py-0.5 rounded font-mono">
                PERSISTENT DISK STREAM
              </span>
            </div>

            <div className="p-4 bg-slate-950/80 max-h-[220px] overflow-y-auto font-mono text-[10px] space-y-1.5">
              {logsList.length === 0 ? (
                <div className="text-slate-600 text-center py-4">No audit logs indexed yet.</div>
              ) : (
                logsList.map((log, i) => {
                  let badgeColor = "text-slate-400 border-slate-800";
                  if (log.level === "success") badgeColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 pb-0.5";
                  if (log.level === "warning") badgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400 pb-0.5";
                  if (log.level === "error") badgeColor = "bg-rose-500/10 border-rose-500/30 text-rose-400 pb-0.5";

                  return (
                    <div key={i} className="flex items-start gap-2.5 border-b border-slate-900 pb-1">
                      <span className="text-slate-500 flex-shrink-0 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`px-1.5 rounded border text-[9px] font-extrabold uppercase select-none ${badgeColor}`}>
                        {log.level}
                      </span>
                      <span className="text-slate-300 select-all leading-relaxed">{log.event}</span>
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
