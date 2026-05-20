import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Terminal, 
  Plus, 
  Hash, 
  Send, 
  X, 
  Users, 
  UserPlus, 
  Compass, 
  AlertCircle 
} from "lucide-react";

interface ChatChannel {
  id: string;
  name: string;
  description: string;
}

interface ChatServer {
  id: string;
  name: string;
  icon?: string;
  channels: ChatChannel[];
}

interface ChatMessage {
  id: string;
  serverId: string;
  channelId: string;
  sender: string;
  text: string;
  timestamp: string;
  isAgent?: boolean;
}

interface ChatFriend {
  id: string;
  name: string;
  status: "online" | "idle" | "offline";
  isAgent?: boolean;
  role?: string;
  avatarColor?: string;
}

interface ChatBubbleProps {
  loggedUser?: { email: string; role: string } | null;
}

export default function ChatBubble({ loggedUser }: ChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [userColor, setUserColor] = useState("#00cfc0");
  const [isRegistered, setIsRegistered] = useState(false);

  // Core synchronized data states
  const [servers, setServers] = useState<ChatServer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friends, setFriends] = useState<ChatFriend[]>([]);

  // Navigation and focus
  const [activeTab, setActiveTab] = useState<"servers" | "dms">("servers");
  const [selectedServerId, setSelectedServerId] = useState("server-1");
  const [selectedChannelId, setSelectedChannelId] = useState("chan-12"); // default lounge
  const [selectedFriendId, setSelectedFriendId] = useState(""); // active DM recipient

  // User input forms
  const [typedMessage, setTypedMessage] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [inviteJoinCode, setInviteJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [inviteGenStats, setInviteGenStats] = useState<Record<string, string>>({});
  
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);
  
  const [newFriendName, setNewFriendName] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync user values if authenticated in parent dashboard
  useEffect(() => {
    if (loggedUser?.email) {
      const defaultNick = loggedUser.email.split("@")[0];
      setUsername(defaultNick);
      setIsRegistered(true);
    } else {
      const storedNick = localStorage.getItem("chat_bubble_nick");
      const storedColor = localStorage.getItem("chat_bubble_color");
      if (storedNick) {
        setUsername(storedNick);
        setIsRegistered(true);
      }
      if (storedColor) {
        setUserColor(storedColor);
      }
    }
  }, [loggedUser]);

  // Handle register/save user tag
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    localStorage.setItem("chat_bubble_nick", username.trim());
    localStorage.setItem("chat_bubble_color", userColor);
    setIsRegistered(true);
  };

  // Fetch entire bubble state
  const fetchBubbleState = async (currentUsername: string, currentUserColor: string) => {
    try {
      const params = new URLSearchParams();
      if (currentUsername) {
        params.append("nickname", currentUsername);
        params.append("color", currentUserColor);
      }
      const res = await fetch(`/api/bubble/state?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        setMessages(data.messages || []);
        
        let mergedFriends = [...(data.friends || [])];
        
        // Reset all online statuses of dynamically added humans first
        mergedFriends.forEach(f => {
          if (!f.isAgent && f.id.startsWith("online-")) {
            f.status = "offline";
          }
        });

        if (data.activePresences) {
          data.activePresences.forEach((presence: any) => {
            if (presence.nickname !== currentUsername && !mergedFriends.some(f => f.name === presence.nickname)) {
              mergedFriends.push({
                id: `online-${presence.nickname}`,
                name: presence.nickname,
                status: "online",
                isAgent: false,
                role: "Online User",
                avatarColor: presence.color
              });
            } else if (presence.nickname !== currentUsername) {
              const existing = mergedFriends.find(f => f.name === presence.nickname);
              if (existing) {
                existing.status = "online";
                if (existing.avatarColor !== presence.color) {
                   existing.avatarColor = presence.color;
                }
              }
            }
          });
        }
        
        // Filter out completely offline guests that were just ephemeral presences
        mergedFriends = mergedFriends.filter(f => !(f.id.startsWith("online-") && f.status === "offline"));

        setFriends(mergedFriends);
      }
    } catch (err) {
      console.warn("Failed fetching multi-user chat state synchronizer:", err);
    }
  };

  // Synchronizer Interval
  useEffect(() => {
    fetchBubbleState(username, userColor);
    const interval = setInterval(() => {
      fetchBubbleState(username, userColor);
    }, 2500); // Polling every 2.5s for seamless real-time sync across multi-user nodes
    return () => clearInterval(interval);
  }, [username, userColor]);

  // Post scrolling trigger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedChannelId, selectedFriendId, isOpen]);

  // Compute Active Entities
  const currentServer = servers.find(s => s.id === selectedServerId);
  const activeChannelMessages = messages.filter(
    m => m.serverId === selectedServerId && m.channelId === selectedChannelId
  );
  const activeDmMessages = messages.filter(
    m => m.serverId === "dm" && m.channelId === selectedFriendId
  );
  const currentFriend = friends.find(f => f.id === selectedFriendId);

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedMessage.trim() || isLoading) return;

    const messageText = typedMessage.trim();
    setTypedMessage("");

    const targetServerId = activeTab === "servers" ? selectedServerId : "dm";
    const targetChannelId = activeTab === "servers" ? selectedChannelId : selectedFriendId;

    // Optimistic UI state appending
    const tempId = "temp-" + Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      serverId: targetServerId,
      channelId: targetChannelId,
      sender: username || "Guest",
      text: messageText,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      setIsLoading(true);
      const res = await fetch("/api/bubble/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: targetServerId,
          channelId: targetChannelId,
          sender: username || "Guest",
          text: messageText,
          isAgent: false
        })
      });
      if (res.ok) {
        await fetchBubbleState(username, userColor); // Pull fresh data
      }
    } catch (err) {
      console.warn("Failed posting live message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create server
  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    try {
      const res = await fetch("/api/bubble/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServerName.trim(), nickname: username })
      });
      if (res.ok) {
        const data = await res.json();
        setNewServerName("");
        setShowAddServer(false);
        await fetchBubbleState(username, userColor);
        if (data.server?.id) {
          setSelectedServerId(data.server.id);
          if (data.server.channels?.length > 0) {
            setSelectedChannelId(data.server.channels[0].id);
          }
        }
      }
    } catch (err) {
      console.warn("Failed creating new chat workspace guild:", err);
    }
  };

  const handleJoinServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteJoinCode.trim()) return;
    setJoinError(null);
    try {
      const res = await fetch("/api/bubble/servers/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteJoinCode.trim(), nickname: username })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteJoinCode("");
        setShowAddServer(false);
        await fetchBubbleState(username, userColor);
        if (data.server?.id) {
          setSelectedServerId(data.server.id);
          if (data.server.channels?.length > 0) {
            setSelectedChannelId(data.server.channels[0].id);
          }
        }
      } else {
        setJoinError(data.error || "Failed to join");
      }
    } catch (err: any) {
      setJoinError(err.message);
    }
  };

  const handleGenerateInvite = async (serverId: string) => {
    try {
      const res = await fetch(`/api/bubble/servers/${serverId}/invite`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setInviteGenStats(prev => ({ ...prev, [serverId]: data.inviteCode }));
      }
    } catch (err) {
      console.warn("Failed to generate invite:", err);
    }
  };

  // Create Channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const res = await fetch("/api/bubble/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: selectedServerId,
          name: newChannelName.trim(),
          description: newChannelDesc.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNewChannelName("");
        setNewChannelDesc("");
        setShowAddChannel(false);
        await fetchBubbleState(username, userColor);
        if (data.channel?.id) {
          setSelectedChannelId(data.channel.id);
        }
      }
    } catch (err) {
      console.warn("Failed creating subchannel in workspace server:", err);
    }
  };

  // Create Friend
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;

    try {
      const res = await fetch("/api/bubble/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFriendName.trim(),
          isAgent: false
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNewFriendName("");
        setShowAddFriend(false);
        await fetchBubbleState(username, userColor);
        if (data.friend?.id) {
          setSelectedFriendId(data.friend.id);
          setActiveTab("dms");
        }
      }
    } catch (err) {
      console.warn("Failed adding new peer connection:", err);
    }
  };

  return (
    <>
      {/* 1. Glass Floating Interactive Bubble (Bottom-Right overlay) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">
        
        {/* Floating Bubble Badge Indicator */}
        {!isOpen && (
          <div className="absolute -top-11 right-0 pointer-events-none transition-all duration-300">
            <div className="bg-[#00cfc0]/10 border border-[#00cfc0]/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-bold text-[#00cfc0] tracking-widest uppercase animate-pulse shadow-[0_0_8px_rgba(0,207,192,0.25)]">
              CHAT ONLINE
            </div>
          </div>
        )}

        <button
          id="community-chat-bubble-toggle"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative border shadow-lg group
            ${isOpen 
              ? "bg-slate-900 border-[#f43f5e] text-[#f43f5e] hover:bg-slate-950" 
              : "bg-[#050811]/90 border-[#00cfc0]/40 text-[#00cfc0] hover:border-[#00cfc0] hover:shadow-[0_0_15px_rgba(0,207,192,0.3)] hover:scale-105"
            }`}
          title="Toggle Portal Multiplayer Online Chat Bubble"
        >
          {isOpen ? (
            <X size={24} className="transition-transform group-hover:rotate-90 duration-300" />
          ) : (
            <div className="relative">
              <MessageSquare size={22} className="animate-pulse" />
              {/* Online Green Pulsing Beacon Node */}
              <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-emerald-500 border border-[#050811] animate-bounce" />
            </div>
          )}
        </button>
      </div>

      {/* 2. Cozy Expanded Multi-Panel Interface Overlay */}
      <div
        className={`fixed md:bottom-24 md:right-6 bottom-0 right-0 z-50 w-full md:w-[94vw] h-[100dvh] md:h-[75vh] md:max-w-[850px] md:max-h-[650px] bg-[#070b19]/95 border md:border-[#00cfc0]/25 rounded-none md:rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-lg flex flex-col overflow-hidden font-mono text-xs select-none transition-all duration-300 ease-out transform
          ${isOpen 
            ? "translate-y-0 md:scale-100 opacity-100 pointer-events-auto" 
            : "translate-y-full md:translate-y-8 md:scale-95 opacity-0 pointer-events-none"
          }`}
      >
        {/* GATEWAY GATE REGISTRATION / CHOOSE NICKNAME SCREEN */}
        {!isRegistered ? (
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-[#050814]/80">
            <div className="h-16 w-16 bg-[#00cfc0]/15 rounded-full border border-[#00cfc0]/40 flex items-center justify-center text-[#00cfc0] mb-4 shadow-[0_0_12px_rgba(0,207,192,0.2)]">
              <Terminal className="animate-spin text-[#00cfc0]" size={30} style={{ animationDuration: '6s' }} />
            </div>
            <h3 className="text-[#00cfc0] text-sm uppercase tracking-widest font-bold mb-2">MULTIPLAYER ID PROTOCOL</h3>
            <p className="text-slate-400 text-[11px] mb-6 max-w-sm">Enter the virtual portal workspace network. Pick a unique name and indicator ring color to chat live with others.</p>

            <form onSubmit={handleRegister} className="w-full max-w-xs space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 text-left font-bold">CYBERNETIC NICKNAME</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00cfc0]/65 text-xs font-mono"
                  placeholder="e.g. NeoExplorer"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, "").substring(0, 16))}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 text-left font-bold">INDICATOR GLOW ACCENT</label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    className="h-7 w-12 cursor-pointer bg-transparent border-0 rounded"
                    value={userColor}
                    onChange={(e) => setUserColor(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{userColor}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#00cfc0]/15 hover:bg-[#00cfc0]/25 border border-[#00cfc0]/45 hover:border-[#00cfc0]/85 text-[#00cfc0] font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer"
              >
                SYNC WORKSPACE GATEWAY
              </button>
            </form>
          </div>
        ) : (
          
          /* DISCORD TERMINAL WORKSPACE INTERFACE */
          <div className="flex-1 flex overflow-hidden">
            
            {/* COLUMN 1: DISCORD-STYLE SERVER VERTICAL BAR */}
            <div className="w-12 md:w-14 bg-slate-955 flex flex-col items-center py-3 gap-2.5 border-r border-[#00cfc0]/15 select-none shrink-0 overflow-y-auto scrollbar-none">
              
              {/* Home DM Hub Toggle */}
              <button
                onClick={() => {
                  setActiveTab("dms");
                  setSelectedFriendId(friends[0]?.id || "");
                }}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all bg-slate-900 cursor-pointer border
                  ${activeTab === "dms"
                    ? "border-[#00cfc0] text-[#00cfc0] shadow-[0_0_8px_rgba(0,207,192,0.3)] bg-[#00cfc0]/10"
                    : "border-slate-800 text-slate-400 hover:text-[#00cfc0] hover:border-[#00cfc0]/40"
                  }`}
                title="Direct Messages & Friend Connections"
              >
                <Compass size={18} />
              </button>

              <div className="w-6 h-[1px] bg-slate-800/60 my-1" />

              {/* Servers List */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto scrollbar-none w-full items-center">
                {servers.map((srv) => {
                  const isActive = activeTab === "servers" && selectedServerId === srv.id;
                  return (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setActiveTab("servers");
                        setSelectedServerId(srv.id);
                        if (srv.channels && srv.channels.length > 0) {
                          setSelectedChannelId(srv.channels[0].id);
                        }
                      }}
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold tracking-tight text-[11px] transition-all relative cursor-pointer border
                        ${isActive
                          ? "border-[#00cfc0] text-[#00cfc0] bg-[#00cfc0]/10 rounded-xl"
                          : "border-slate-800 text-slate-300 bg-slate-900/60 hover:rounded-xl hover:border-[#00cfc0]/30 hover:text-slate-100"
                        }`}
                      title={srv.name}
                    >
                      {srv.icon || srv.name[0]}
                      {/* Active indication line dot */}
                      {isActive && (
                        <span className="absolute -left-1.5 top-3.5 h-3 w-1 bg-[#00cfc0] rounded-r" />
                      )}
                    </button>
                  );
                })}

                {/* Create Guild Server button */}
                <button
                  onClick={() => setShowAddServer(true)}
                  className="h-10 w-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:border-emerald-400/50 hover:bg-emerald-500/5 cursor-pointer hover:rounded-xl transition-all"
                  title="Create a New Core Server"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Profile Settings Status Beacon */}
              <button
                onClick={() => {
                  if (confirm(`Reset and log out your multiplayer nick "${username}"?`)) {
                    localStorage.removeItem("chat_bubble_nick");
                    setIsRegistered(false);
                  }
                }}
                className="h-9 w-9 rounded-full border border-slate-850 flex items-center justify-center cursor-pointer transition-all overflow-hidden bg-slate-900"
                title={`Click to edit nickname identifier: "${username}"`}
              >
                <span 
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 tracking-tighter" 
                  style={{ backgroundColor: userColor }}
                >
                  {username.substring(0, 2).toUpperCase()}
                </span>
              </button>
            </div>

            {/* COLUMN 2: SUBCHANNELS LIST OR DIRECT MESSAGE PARTNER list */}
            <div className="w-28 md:w-44 bg-[#050813]/90 border-r border-[#00cfc0]/10 flex flex-col justify-between select-none shrink-0">
              <div className="p-3 overflow-y-auto flex-1 flex flex-col">
                
                {activeTab === "servers" ? (
                  /* channels */
                  <>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3.5">
                      <span>Secured Channels</span>
                      <button 
                        onClick={() => setShowAddChannel(true)}
                        className="text-slate-500 hover:text-[#00cfc0] cursor-pointer"
                        title="Add subchannel"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {currentServer ? (
                      <div className="space-y-1">
                        <div className="flex flex-col mb-4 bg-slate-900/50 p-2 rounded border border-slate-800">
                           <span className="block text-[11px] font-bold text-[#00cfc0] truncate tracking-tight uppercase">
                             {currentServer.name}
                           </span>
                           <div className="mt-2 flex items-center justify-between">
                             <button
                               onClick={() => handleGenerateInvite(currentServer.id)}
                               className="text-[9px] text-[#00cfc0] hover:text-white uppercase font-bold px-2 py-0.5 rounded border border-[#00cfc0]/40 hover:bg-[#00cfc0]/20 transition cursor-pointer"
                             >
                               Get Invite
                             </button>
                           </div>
                           {inviteGenStats[currentServer.id] && (
                             <div className="mt-2 text-[10px] text-emerald-400 font-mono tracking-widest bg-black p-1 text-center rounded border border-emerald-900 select-all cursor-text flex items-center justify-center relative">
                               Code: {inviteGenStats[currentServer.id]}
                             </div>
                           )}
                        </div>
                        
                        {(currentServer.channels || []).map((chan) => {
                          const isChanActive = selectedChannelId === chan.id;
                          return (
                            <button
                              key={chan.id}
                              onClick={() => setSelectedChannelId(chan.id)}
                              className={`w-full px-2 py-1.5 rounded flex items-center gap-1.5 text-left transition-all truncate text-[11px] cursor-pointer
                                ${isChanActive
                                  ? "bg-[#00cfc0]/10 text-[#00cfc0] font-bold border border-[#00cfc0]/20"
                                  : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                                }`}
                            >
                              <Hash size={12} className={isChanActive ? "text-[#00cfc0]" : "text-slate-500"} />
                              <span className="truncate">{chan.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 italic">No Server selected.</div>
                    )}
                  </>
                ) : (
                  /* direct messages */
                  <>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3.5">
                      <span>Online Direct Messages</span>
                      <button 
                        onClick={() => setShowAddFriend(true)}
                        className="text-slate-500 hover:text-[#00cfc0] cursor-pointer"
                        title="Add partner"
                      >
                        <UserPlus size={12} />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {friends.map((buddy) => {
                        const isBuddyActive = selectedFriendId === buddy.id;
                        return (
                          <button
                            key={buddy.id}
                            onClick={() => setSelectedFriendId(buddy.id)}
                            className={`w-full px-2 py-1.5 rounded flex items-center justify-between text-left transition-all text-[11px] truncate cursor-pointer
                              ${isBuddyActive
                                ? "bg-[#00cfc0]/10 text-[#00cfc0] font-bold border border-[#00cfc0]/20"
                                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span 
                                className="h-2 w-2 rounded-full shrink-0 relative"
                                style={{ backgroundColor: buddy.avatarColor || "#a855f7" }}
                              >
                                {buddy.status === "online" && (
                                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                                )}
                              </span>
                              <span className="truncate">{buddy.name}</span>
                            </div>

                            {buddy.isAgent && (
                              <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-1 rounded uppercase tracking-[0.1em] scale-90">
                                AI
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Logged Username Panel Anchor */}
              <div className="p-2 border-t border-[#00cfc0]/10 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-slate-300 font-bold max-w-[100px] truncate">{username}</span>
                </div>
                <span className="text-[8px] border border-emerald-500/20 text-emerald-400 px-1 rounded font-bold uppercase tracking-wider scale-90">
                  LIVE
                </span>
              </div>
            </div>

            {/* COLUMN 3: TEXT CHAT MESSAGES STREAM BOX & SEND MECHANISM */}
            <div className="flex-1 flex flex-col justify-between bg-[#04060d]/90 relative overflow-hidden">
              
              {/* Current Channel Info Header */}
              <div className="px-3.5 py-3 border-b border-[#00cfc0]/10 flex items-center justify-between">
                <div className="truncate">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    {activeTab === "servers" ? (
                      <>
                        <Hash size={13} className="text-[#00cfc0]/75" />
                        <span className="truncate">{currentServer?.channels.find(c => c.id === selectedChannelId)?.name || "lounge"}</span>
                      </>
                    ) : (
                      <>
                        <Users size={12} className="text-[#00cfc0]/75" />
                        <span className="truncate">{currentFriend ? currentFriend.name : "Select DM Connection"}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-[10px] text-slate-500 truncate mt-0.5 max-w-[280px]">
                    {activeTab === "servers" 
                      ? (currentServer?.channels.find(c => c.id === selectedChannelId)?.description || "Secure discussion gateway")
                      : (currentFriend?.role || "DMs Connection Protocol")
                    }
                  </div>
                </div>
                {/* Mobile Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="md:hidden ml-2 shrink-0 p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                  title="Close Chat"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable chat body */}
              <div 
                ref={scrollRef}
                className="flex-1 p-3.5 overflow-y-auto space-y-3 scrollbar-thin absolute left-0 right-0 top-[52px] bottom-[54px]"
              >
                {/* Render matching messages */}
                {(activeTab === "servers" ? activeChannelMessages : activeDmMessages).length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full text-center p-6 text-slate-600">
                    <AlertCircle size={20} className="mb-2 text-slate-700 animate-bounce" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">DECRYPTED DEPOSITS VACANT</span>
                    <span className="text-[9px] text-slate-600 max-w-xs mt-1">Start chatting! Pinging system AI personas or active peers works live instantly here.</span>
                  </div>
                ) : (
                  (activeTab === "servers" ? activeChannelMessages : activeDmMessages).map((msg) => {
                    const isSelf = msg.sender === username;
                    return (
                      <div 
                        key={msg.id} 
                        className="group flex flex-col space-y-0.5 text-left border-l-2 border-slate-900 hover:border-[#00cfc0]/40 pl-2 transition-all"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isSelf ? "text-slate-200" : "text-indigo-300"}`}>
                            {msg.sender}
                          </span>
                          
                          {msg.isAgent && (
                            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-bold px-1 rounded uppercase scale-90 tracking-wider">
                              AGENT BOT
                            </span>
                          )}
                          
                          <span className="text-[8px] text-slate-600 font-normal">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                          </span>
                        </div>
                        
                        <p className="text-slate-300 hover:text-slate-100 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap selection:bg-[#00cfc0]/20 max-w-full">
                          {msg.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input field and dispatch buttons */}
              <form 
                onSubmit={handleSendMessage}
                className="p-2 border-t border-[#00cfc0]/10 bg-slate-950 flex items-center gap-2"
              >
                <input
                  type="text"
                  className="flex-1 bg-[#060914] text-slate-100 placeholder-slate-600 px-3 py-1.5 rounded border border-slate-900 focus:outline-none focus:border-[#00cfc0]/50 text-xs font-mono"
                  placeholder={
                    activeTab === "servers" 
                      ? `Send to #${currentServer?.channels.find(c => c.id === selectedChannelId)?.name || "lounge"}...` 
                      : `Direct message ${currentFriend?.name || "recipient"}...`
                  }
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value.substring(0, 300))}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#00cfc0]/15 hover:bg-[#00cfc0]/25 text-[#00cfc0] border border-[#00cfc0]/35 hover:scale-105 active:scale-95 rounded font-bold cursor-pointer transition-all uppercase text-[10px]"
                  title="Dispatch Message packet"
                >
                  <Send size={12} />
                </button>
              </form>

            </div>

          </div>
        )}

        {/* MODALS INLINE FOR MANAGING ENTITIES CREATION */}
        {/* Create Server Modal Backdrop Overlay */}
        {showAddServer && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-slate-900 border border-[#00cfc0]/40 p-4 rounded-xl shadow-2xl flex flex-col gap-5">
              <div className="flex items-center justify-between text-slate-200">
                <span className="font-bold uppercase tracking-wider text-[10px]">Servers</span>
                <button onClick={() => setShowAddServer(false)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                  <X size={14} />
                </button>
              </div>

              {/* Create Form */}
              <form onSubmit={handleCreateServer} className="space-y-3">
                <span className="text-[10px] text-[#00cfc0] font-bold">CREATE NEW SERVER</span>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded text-xs focus:outline-none focus:border-[#00cfc0]/50 mt-1"
                  placeholder="Server name (e.g. Hacking Guild)"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value.substring(0, 24))}
                  required
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-[#00cfc0]/15 border border-[#00cfc0]/40 text-[#00cfc0] tracking-widest text-[9px] uppercase font-bold rounded hover:bg-[#00cfc0]/25 transition"
                >
                  CONSTRUCT SERVER
                </button>
              </form>
              
              <div className="border-t border-slate-800/80"></div>
              
              {/* Join Form */}
              <form onSubmit={handleJoinServer} className="space-y-3">
                <span className="text-[10px] text-emerald-400 font-bold">JOIN WITH INVITE CODE</span>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded text-xs focus:outline-none focus:border-emerald-500/50 mt-1 uppercase"
                  placeholder="Paste 8-char code here"
                  value={inviteJoinCode}
                  onChange={(e) => setInviteJoinCode(e.target.value.substring(0, 8))}
                  required
                />
                {joinError && <div className="text-rose-400 text-[10px]">{joinError}</div>}
                <button
                  type="submit"
                  className="w-full py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 tracking-widest text-[9px] uppercase font-bold rounded hover:bg-emerald-500/25 transition"
                >
                  JOIN SERVER
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Create Subchannel Modal */}
        {showAddChannel && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-slate-900 border border-[#00cfc0]/40 p-4 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-200">
                <span className="font-bold uppercase tracking-wider text-[10px]">Add Private Channel</span>
                <button onClick={() => setShowAddChannel(false)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <form onSubmit={handleCreateChannel} className="space-y-3">
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded text-xs focus:outline-none focus:border-[#00cfc0]/50"
                  placeholder="Channel name (e.g. tech-lounge)"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value.replace(/\s+/g, "-").toLowerCase().substring(0, 20))}
                  required
                />
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded text-xs focus:outline-none focus:border-[#00cfc0]/50"
                  placeholder="Topic/Topic description"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value.substring(0, 60))}
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-[#00cfc0]/15 border border-[#00cfc0]/40 text-[#00cfc0] tracking-widest text-[9px] uppercase font-bold rounded hover:bg-[#00cfc0]/25 transition"
                >
                  INITIALIZE CHANNEL
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Friend/Peer Connection Modal */}
        {showAddFriend && (
          <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-slate-900 border border-[#00cfc0]/40 p-4 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-200">
                <span className="font-bold uppercase tracking-wider text-[10px]">Add Peer Connection</span>
                <button onClick={() => setShowAddFriend(false)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <form onSubmit={handleAddFriend} className="space-y-3">
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded text-xs focus:outline-none focus:border-[#00cfc0]/50"
                  placeholder="Enter handle nickname..."
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value.substring(0, 20))}
                  required
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-[#00cfc0]/15 border border-[#00cfc0]/40 text-[#00cfc0] tracking-widest text-[9px] uppercase font-bold rounded hover:bg-[#00cfc0]/25 transition"
                >
                  SYNC FRIEND CONNECT
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
