import { useState, useEffect } from "react";
import { Mail, Lock, Key, Check, AlertCircle, RefreshCw, LogIn, UserPlus } from "lucide-react";

interface UserProfile {
  email: string;
  role: "owner" | "admin" | "user";
  googleAuth: boolean;
  status: string;
  history: any[];
}

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verification step details
  const [otpPage, setOtpPage] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [codeHint, setCodeHint] = useState<string | null>(null);

  const resetForm = () => {
    setError(null);
    setOtpPage(false);
    setOtpCode("");
    setCodeHint(null);
  };



  // 1. Submit custom credentials signin / signup trigger
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please provide a valid email identifier.");
      return;
    }
    if (!isGoogleAuth && !password) {
      setError("Password input parameter is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const endpoint = tab === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const payload = {
        email: email.trim(),
        password: isGoogleAuth ? undefined : password,
        googleAuth: isGoogleAuth
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication procedure rejected.");
      }

      if (data.googleAuthRequired) {
        // Step into OTP Verification route
        setOtpPage(true);
        setCodeHint(data.codeHint || null);
        setError(null);
      } else {
        // Successful login
        onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Perform validation verification code check
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError("Please enter the 6-digit confirmation code.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/auth/verify-google-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: otpCode.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Incorrect confirmation code.");
      }

      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="nexus-auth-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div 
        id="nexus-auth-container" 
        className="w-full max-w-md overflow-hidden rounded-xl bg-[#090f1d] border border-[#00cfc0]/30 shadow-[0_0_25px_rgba(0,207,192,0.15)] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing cyber header */}
        <div className="relative border-b border-[#00cfc0]/20 bg-[#050811] p-5 text-center">
          <div className="absolute right-4 top-4">
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 p-1 cursor-pointer"
              title="Close Panel"
            >
              ✕
            </button>
          </div>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#00cfc0]/10 text-[#00cfc0] shadow-[0_0_10px_rgba(0,207,192,0.2)]">
            <Key size={20} />
          </div>
          <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-slate-100">
            {otpPage ? "Verification Required" : tab === "signin" ? "Handshake Sign-In" : "Access Registration"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {otpPage ? "Simulating dual-factor security" : "Secure cybernetic workspace terminal authentication"}
          </p>
        </div>

        {/* Diagnostic notifications block */}
        {error && (
          <div className="flex items-start gap-2 border-b border-rose-500/10 bg-rose-950/20 px-5 py-3 text-xs text-rose-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Verification code hint box (For testing usability) */}
        {otpPage && codeHint && (
          <div className="border-b border-cyan-500/10 bg-cyan-950/20 px-5 py-3 text-center text-xs">
            <div className="text-cyan-400 font-semibold mb-1">
              [DEBUG MODULE] Simulated OTP Dispatched:
            </div>
            <code className="bg-[#050811] px-3 py-1 rounded text-sm font-bold tracking-widest text-[#00cfc0] select-all">
              {codeHint}
            </code>
            <p className="text-[10px] text-slate-400 mt-1">
              (Use this secure code to finalize Google Sign-In verification)
            </p>
          </div>
        )}

        <div className="p-6">
          {!otpPage ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {/* Form Toggles */}
              <div className="flex border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => { setTab("signin"); resetForm(); }}
                  className={`flex-1 pb-1 text-center font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer
                    ${tab === "signin" ? "text-[#00cfc0] border-b-2 border-[#00cfc0]" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("signup"); resetForm(); }}
                  className={`flex-1 pb-1 text-center font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer
                    ${tab === "signup" ? "text-[#00cfc0] border-b-2 border-[#00cfc0]" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Create Account
                </button>
              </div>

              {/* Login Method choices (Standard Email/Password vs Google) */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] uppercase font-bold text-slate-400">
                <button
                  type="button"
                  onClick={() => { setIsGoogleAuth(false); resetForm(); }}
                  className={`py-2 px-3 rounded border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5
                    ${!isGoogleAuth ? "border-[#00cfc0]/30 bg-[#00cfc0]/10 text-[#00cfc0]" : "border-slate-800 hover:border-slate-700 bg-[#050811] hover:text-slate-200"}`}
                >
                  <span>Email Sign-In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsGoogleAuth(true); resetForm(); }}
                  className={`py-2 px-3 rounded border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5
                    ${isGoogleAuth ? "border-[#00cfc0]/30 bg-[#00cfc0]/10 text-[#00cfc0]" : "border-slate-800 hover:border-slate-700 bg-[#050811] hover:text-slate-200"}`}
                >
                  <span>✨ Google OTP</span>
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-bold">
                  Email Address
                </label>
                <div id="input-container-email" className="relative">
                  <span className="absolute left-3 top-3 text-slate-500">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded border border-slate-800 bg-[#050811] py-2 pl-9 pr-4 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-[#00cfc0]/50 focus:outline-none"
                  />
                </div>
              </div>

              {!isGoogleAuth && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-bold">
                    Profile Password
                  </label>
                  <div id="input-container-pw" className="relative">
                    <span className="absolute left-3 top-3 text-slate-500">
                      <Lock size={14} />
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded border border-slate-800 bg-[#050811] py-2 pl-9 pr-4 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-[#00cfc0]/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Action trigger button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-[#00cfc0] to-[#01a399] py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : tab === "signin" ? (
                  <>
                    <LogIn size={13} />
                    <span>Authorize Sandbox</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} />
                    <span>Register Credentials</span>
                  </>
                )}
              </button>

              <div id="notice-notes" className="text-[10px] text-slate-500 text-center leading-relaxed mt-4">
                {isGoogleAuth 
                  ? "Google Login will generate and prompt for a simulated authentication code on every entry, keeping security strict." 
                  : "Standard login uses standard persistent server database records and enables account status locks."}
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div id="otp-guidance" className="text-center">
                <p className="text-xs text-slate-300">
                  Dual-Factor Code sent to <span className="text-[#00cfc0] font-bold">{email}</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Enter the six-digit security code generated for your Google credentials payload.
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-bold text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="CODE"
                  className="w-full rounded border border-slate-800 bg-[#050811] py-3 text-center font-mono text-base font-extrabold tracking-widest text-[#00cfc0] focus:border-[#00cfc0]/50 focus:outline-none"
                />
              </div>

              {/* Validate action button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-[#00cfc0] to-[#01a399] py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <>
                    <Check size={13} />
                    <span>Verify and Login</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full text-center text-[10px] uppercase font-bold text-slate-400 hover:text-slate-200 py-1 transition-colors block cursor-pointer"
              >
                ← Back to credentials entry
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
