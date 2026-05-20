import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-1.5 font-mono text-xs text-slate-400 select-none">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">{lang || "source-code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
          title="Copy Code"
        >
          {copied ? <Check size={12} className="text-emerald-400 animate-scale-in" /> : <Copy size={12} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs md:text-sm leading-relaxed text-slate-200">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}
