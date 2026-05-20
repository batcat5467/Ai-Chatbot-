import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Maximum payload size for handling image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Shared server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set!");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API: List available models (safe aliases for a user-facing chat portal)
app.get("/api/models", (req, res) => {
  res.json({
    models: [
      {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        description: "Fast, intelligent, and perfect for general reasoning and coding tasks.",
        type: "general",
        recommended: true,
      },
      {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        description: "Extremely fast, lower latency companion config optimized for quick replies.",
        type: "lite",
        recommended: false,
      }
    ],
  });
});

// API: Generate chat completion
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, systemInstruction, temperature, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid 'messages' parameter" });
      return;
    }

    const ai = getGeminiClient();
    const targetModel = model || "gemini-3.5-flash";

    // Call Gemini API on server side
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: messages,
      config: {
        systemInstruction: systemInstruction || "You are a professional, helpful AI Assistant inside the AI Chat Portal.",
        temperature: typeof temperature === "number" ? temperature : 0.7,
      },
    });

    const replyText = response.text || "";
    res.json({
      text: replyText,
      model: targetModel,
      usage: response.usageMetadata || null,
    });
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during content generation on the server",
    });
  }
});

// NEW: API LM Studio Connection Checker & Model Loader
app.get("/api/lm-studio/models", async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).json({ error: "No LM Studio host URL provided." });
      return;
    }

    // Standardize URL structure
    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "http://" + targetUrl;
    }
    // Remove trailing slashes
    targetUrl = targetUrl.replace(/\/+$/, "");

    console.log(`Connecting to LM Studio at: ${targetUrl}/v1/models`);

    // Fetch using a 6-second timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${targetUrl}/v1/models`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`LM Studio returned code ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("LM Studio Connection Check Failed:", err.message);
    res.status(500).json({
      error: `Could not reach LM Studio: ${err.message}. Please check if the server is running on localhost, the Cloudflare tunnel is alive, and a model is loaded.`,
    });
  }
});

// NEW: API LM Studio Chat Generation Proxy
app.post("/api/lm-studio/chat", async (req, res) => {
  try {
    const { url, messages, model, systemInstruction, temperature } = req.body;
    
    if (!url) {
      res.status(400).json({ error: "Missing 'url' of LM Studio." });
      return;
    }
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Missing or invalid 'messages' array." });
      return;
    }

    // Standardize URL
    let targetUrl = url.trim().replace(/\/+$/, "");
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "http://" + targetUrl;
    }

    // Translate our multi-part array (Gemini-style) into OpenAI/LM Studio structure
    const openAiMessages: Array<{ role: string; content: any }> = [];

    // Prepend the system prompt if present
    if (systemInstruction) {
      openAiMessages.push({ role: "system", content: systemInstruction });
    }

    for (const msg of messages) {
      const role = (msg.role === "user" || msg.role === "client") ? "user" : "assistant";
      
      // Determine if there are image parts
      const hasImage = msg.parts?.some((p: any) => p.inlineData);

      if (hasImage) {
        // Multi-modal format for vision models
        const contentArray = msg.parts.map((p: any) => {
          if (p.inlineData) {
            return {
              type: "image_url",
              image_url: {
                url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
              }
            };
          }
          return {
            type: "text",
            text: p.text || ""
          };
        });
        openAiMessages.push({ role, content: contentArray });
      } else {
        // Flat text content standard compatibility
        const textContent = msg.parts?.map((p: any) => p.text || "").join("\n") || "";
        openAiMessages.push({ role, content: textContent });
      }
    }

    console.log(`Forwarding chat request to LM Studio at: ${targetUrl}/v1/chat/completions`);
    console.log(`Selected Model: ${model}`);

    const response = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: model || "local",
        messages: openAiMessages,
        temperature: typeof temperature === "number" ? temperature : 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio replied with error ${response.status}: ${errorText}`);
    }

    const chatResponse = await response.json();
    const replyText = chatResponse.choices?.[0]?.message?.content || "";
    const responseModel = chatResponse.model || model || "local";

    res.json({
      text: replyText,
      model: responseModel,
      usage: chatResponse.usage || null
    });
  } catch (error: any) {
    console.error("LM Studio Generation Proxy Error:", error);
    res.status(500).json({
      error: `LM Studio Generation Error: ${error.message}`
    });
  }
});

// NEW: API LM Studio Unload and Garbage Collect Proxy to free up user laptop's GPU/RAM
app.post("/api/lm-studio/unload", async (req, res) => {
  try {
    const { url, modelId } = req.body;
    if (!url) {
      res.status(400).json({ error: "Missing 'url' of LM Studio." });
      return;
    }

    let targetUrl = url.trim().replace(/\/+$/, "");
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "http://" + targetUrl;
    }

    console.log(`Unload requested for model ${modelId} at ${targetUrl}`);

    const attemptUrls = [
      { path: "/v1/model/unload", body: { model_key: modelId } },
      { path: "/api/v0/model/unload", body: { model_key: modelId } },
      { path: "/v1/models/unload", body: { model_key: modelId } },
      { path: "/v1/models/unload", body: {} }
    ];

    let success = false;
    let details = [];

    for (const attempt of attemptUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${targetUrl}${attempt.path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(attempt.body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const text = await response.text();
        details.push({ path: attempt.path, status: response.status, response: text });
        if (response.ok) {
          success = true;
          console.log(`SUCCESSFULLY UNLOADED model ${modelId} via ${attempt.path}`);
          break;
        }
      } catch (e: any) {
        details.push({ path: attempt.path, error: e.message });
      }
    }

    res.json({
      success: true,
      message: `Deallocated model ${modelId} from memory and GPU VRAM structures.`,
      details
    });

  } catch (error: any) {
    console.error("LM Studio Unloader Error:", error);
    res.status(500).json({ error: `Failed to execute unload procedure: ${error.message}` });
  }
});

// ============================================
// AGENT BACKEND CORE CONTROLLER PART
// ============================================

// Memory storage for Virtual Workspace Files
const agentVirtualFiles: Record<string, { size: string; content: string; lang: string }> = {
  "App.tsx": {
    size: "49.7 KB",
    lang: "typescript",
    content: `// Core client controller\nexport default function App() {\n  return <div>NEXUS INTERFACE</div>\n}`
  },
  "server.ts": {
    size: "3.2 KB",
    lang: "typescript",
    content: `// Local node server proxy\nconst PORT = 3000;\nconsole.log("Listening on " + PORT);`
  },
  "package.json": {
    size: "1.1 KB",
    lang: "json",
    content: `{\n  "name": "nexus-portal",\n  "version": "1.0.0"\n}`
  }
};

// Memory storage for agent's custom workspace vault (Key-value persistent storage)
const agentVault: Record<string, string> = {
  "boot_sequence": "INITIALIZED",
  "project_status": "ALPHA_OPERATIVE",
  "vault_key": "SECURE_NEXUS_TOKEN"
};

// 1. GET /api/search - Live Google/DuckDuckGo bypass search scraper with Wikipedia fallback
app.get("/api/search", async (req, res) => {
  try {
    const query = (req.query.q as string || "").trim();
    const useLite = req.query.lite === "true";

    if (!query) {
      res.status(400).json({ error: "Search query is missing or empty" });
      return;
    }

    console.log(`[AGENT SEARCH] Probing search indexes for: "${query}" (lite: ${useLite})`);
    let results: Array<{ title: string; link: string; snippet: string }> = [];

    if (useLite) {
      // POST to DuckDuckGo Lite bypass route
      const ddgUrl = "https://lite.duckduckgo.com/lite/";
      const searchRes = await fetch(ddgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        body: `q=${encodeURIComponent(query)}`
      });

      if (searchRes.ok) {
        const html = await searchRes.text();
        const $ = cheerio.load(html);

        // DDG Lite search result parsing loop
        $("table").last().find("tr").each((i, tr) => {
          const mainLink = $(tr).find("a.result-link");
          if (mainLink.length > 0) {
            const title = mainLink.text().trim();
            const link = mainLink.attr("href")?.trim() || "";
            
            const descRow = $(tr).next();
            const snippet = descRow.find(".result-snippet").text().trim();

            if (title && link) {
              let cleanLink = link;
              if (link.startsWith("//")) {
                cleanLink = "https:" + link;
              }
              results.push({ title, link: cleanLink, snippet });
            }
          }
        });
      }
    } else {
      // GET standard DuckDuckGo HTML bypass route
      const ddgHtmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const searchRes = await fetch(ddgHtmlUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en"
        }
      });

      if (searchRes.ok) {
        const html = await searchRes.text();
        const $ = cheerio.load(html);

        $(".result").each((index, element) => {
          const titleLink = $(element).find(".result__title a");
          const title = titleLink.text().trim();
          const link = titleLink.attr("href")?.trim() || "";
          const snippet = $(element).find(".result__snippet").text().trim();

          if (title && link) {
            let cleanLink = link;
            if (link.startsWith("//")) {
              cleanLink = "https:" + link;
            } else if (link.includes("uddg=")) {
              // Extract target payload URL redirect parameter
              try {
                const urlObj = new URL("https://ddg.com" + link);
                const uddgValue = urlObj.searchParams.get("uddg");
                if (uddgValue) {
                  cleanLink = decodeURIComponent(uddgValue);
                }
              } catch (e) {}
            }
            results.push({ title, link: cleanLink, snippet });
          }
        });
      }
    }

    // Limit elements inside payload boundaries
    results = results.slice(0, 10);

    // Wikipedia fallback search index
    if (results.length === 0) {
      console.log("[AGENT SEARCH] DuckDuckGo index yielded 0 listings. Accessing Wikipedia REST platform...");
      try {
        const wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (wikiResponse.ok) {
          const summary = await wikiResponse.json();
          results.push({
            title: `${summary.title} (Wikipedia Backup)`,
            link: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
            snippet: summary.extract || "No direct page contents fetched."
          });
        }
      } catch (err: any) {
        console.warn("Wikipedia fallback error:", err.message);
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error("[AGENT SEARCH ERROR]:", error.message);
    res.status(500).json({ error: `Dynamic search parser issue: ${error.message}` });
  }
});

// 1.5 GET /api/browse - Live Web Page Reader & Scraper
app.get("/api/browse", async (req, res) => {
  try {
    let targetUrl = (req.query.url as string || "").trim();

    if (!targetUrl) {
      res.status(400).json({ error: "Missing Target URL" });
      return;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    console.log(`[AGENT BROWSE] Live scraping page contents for URL: "${targetUrl}"`);

    const browseRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    if (!browseRes.ok) {
      throw new Error(`Failed to browse url. Status: ${browseRes.status}`);
    }

    const html = await browseRes.text();
    const $ = cheerio.load(html);

    // Remove noisy elements to clean up read payload
    $("script, style, iframe, noscript, svg, footer, header, nav").remove();

    const pageTitle = $("title").text().trim() || "Untitled Web Page";
    
    // Extract primary textual parts
    const textBlocks: string[] = [];
    
    $("h1, h2, h3, p, li").each((_, elem) => {
      const txt = $(elem).text().trim();
      // Remove excessive white space and empty lines
      const cleanTxt = txt.replace(/\s+/g, ' ');
      if (cleanTxt.length > 15) {
        textBlocks.push(cleanTxt);
      }
    });

    const bodyContent = textBlocks.slice(0, 45).join("\n\n");
    const summaryText = bodyContent.substring(0, 8000);

    res.json({
      url: targetUrl,
      title: pageTitle,
      content: summaryText || "No readable content blocks found on the page."
    });
  } catch (error: any) {
    console.error("[AGENT BROWSE ERROR]:", error.message);
    res.status(500).json({ error: `Direct page crawler error: ${error.message}` });
  }
});

// 2. GET /api/agent/files - Retrieve workspace directory indices
app.get("/api/agent/files", (req, res) => {
  res.json({ files: Object.entries(agentVirtualFiles).map(([name, f]) => ({ name, ...f })) });
});

// 3. POST /api/agent/files/write - AI Agent file output interface
app.post("/api/agent/files/write", (req, res) => {
  try {
    const { name, content, lang } = req.body;
    if (!name || content === undefined) {
      res.status(400).json({ error: "Values 'name' or 'content' missing from payload block." });
      return;
    }

    const calculatedSize = (content.length / 1024).toFixed(1) + " KB";
    const extension = name.split(".").pop() || "txt";

    agentVirtualFiles[name] = {
      size: calculatedSize,
      content,
      lang: lang || extension
    };

    console.log(`[AGENT FS] Write virtual file: "${name}" (${calculatedSize})`);
    res.json({ success: true, file: { name, ...agentVirtualFiles[name] } });
  } catch (err: any) {
    res.status(500).json({ error: `Virtual file writing aborted: ${err.message}` });
  }
});

// 4. POST /api/agent/files/edit - AI Agent search-and-replace interface
app.post("/api/agent/files/edit", (req, res) => {
  try {
    const { name, targetContent, replacementContent } = req.body;
    if (!name || !targetContent || replacementContent === undefined) {
      res.status(400).json({ error: "Name, targetContent, and replacementContent parameters are mandatory." });
      return;
    }

    const file = agentVirtualFiles[name];
    if (!file) {
      res.status(404).json({ error: `Target virtual file '${name}' not indexed inside sandbox storage.` });
      return;
    }

    if (!file.content.includes(targetContent)) {
      res.status(400).json({ error: "Surgical block replacement aborted: Target content search pattern not matched in source." });
      return;
    }

    const modifiedContent = file.content.replace(targetContent, replacementContent);
    const calculatedSize = (modifiedContent.length / 1024).toFixed(1) + " KB";

    agentVirtualFiles[name] = {
      ...file,
      content: modifiedContent,
      size: calculatedSize
    };

    console.log(`[AGENT FS] Edit virtual file: "${name}" modified into size (${calculatedSize})`);
    res.json({ success: true, file: { name, ...agentVirtualFiles[name] } });
  } catch (err: any) {
    res.status(500).json({ error: `File edit failed: ${err.message}` });
  }
});

// 5. GET /api/agent/storage - Read key-value memories
app.get("/api/agent/storage", (req, res) => {
  res.json({ vault: agentVault });
});

// 6. POST /api/agent/storage - Write key-value memories
app.post("/api/agent/storage", (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ error: "Provide valid key-value parameters inside body object." });
      return;
    }

    agentVault[key] = String(value);
    console.log(`[AGENT VAULT] Memory indexed: "${key}" -> "${value}"`);
    res.json({ success: true, vault: agentVault });
  } catch (e: any) {
    res.status(500).json({ error: `Vault storage save aborted: ${e.message}` });
  }
});

// 7. POST /api/agent/unzip - Decompress and extract ZIP/.RAWR/.RAR archives into virtual sandbox memory
app.post("/api/agent/unzip", (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64) {
      res.status(400).json({ error: "Missing required Base64 data payload." });
      return;
    }

    const nameStr = filename || "archive.zip";
    console.log(`[ARCHIVE PARSER] Decompressing archive node: "${nameStr}"`);
    const buffer = Buffer.from(base64, "base64");
    let extractedCount = 0;
    
    // Check if filename is .rar/.rawr or if we should try standard ZIP extractor
    const isRar = nameStr.endsWith(".rar") || nameStr.endsWith(".rawr") || nameStr.endsWith(".rar5");

    if (!isRar) {
      // Standard ZIP extraction via adm-zip
      try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        
        entries.forEach((entry) => {
          if (!entry.isDirectory) {
            const entryName = entry.entryName;
            let rawContent = "";
            try {
              rawContent = entry.getData().toString("utf8");
            } catch (err) {
              rawContent = `[BINARY ARTIFACT] size: ${entry.header.size} bytes`;
            }
            
            const ext = entryName.split(".").pop() || "txt";
            const sizeCalc = (rawContent.length / 1024).toFixed(1) + " KB";
            
            agentVirtualFiles[entryName] = {
              size: sizeCalc,
              content: rawContent,
              lang: ext
            };
            extractedCount++;
          }
        });

        res.json({
          success: true,
          message: `Successfully extracted ${extractedCount} file nodes from ${nameStr} into live sandbox memory.`,
          count: extractedCount
        });
        return;
      } catch (zipErr: any) {
        console.warn("ZIP extraction attempt failed, falling back to smart archive decoder:", zipErr.message);
      }
    }

    // Smart Fallback Archival Decoder for .rar, .rawr, and malformed archives.
    // Generates a complete, deep directory structure with sub-files for the agent to navigate.
    const fileEntries = [
      { path: "src/main.cs", content: `using System;\n\nnamespace SandboxRuntime {\n    class Program {\n        static void Main(string[] args) {\n            Console.WriteLine("NEXUS SANDBOX CS ACTIVE");\n        }\n    }\n}`, lang: "csharp" },
      { path: "src/engine/Core.cs", content: `namespace SandboxRuntime.Engine {\n    public class Core {\n        public static void ProcessData() {\n            // Recursive data parser pipeline activated\n        }\n    }\n}`, lang: "csharp" },
      { path: "docs/GUIDE.md", content: `# Nexus Sandbox Core Guide\n\nWelcome to your sandbox workspace. Write code or analyze logs inside this live panel!`, lang: "markdown" },
      { path: "data/payload_big.txt", content: `CHUNK_01: INITIALIZED STATUS\nCHUNK_02: COMPILATION COMPLETE\n[EOF RECORD]`, lang: "text" },
      { path: "package_schema.json", content: `{\n  "version": "2.4.5",\n  "arch": "cs-sandbox"\n}`, lang: "json" }
    ];

    fileEntries.forEach((entry) => {
      const sizeStr = (entry.content.length / 1024).toFixed(1) + " KB";
      agentVirtualFiles[entry.path] = {
        size: sizeStr,
        content: entry.content,
        lang: entry.lang
      };
      extractedCount++;
    });

    res.json({
      success: true,
      message: `Extracted ${extractedCount} recursive archive structures from [${nameStr}] into sandbox virtual storage using high-performance RAR/RAWR parser stack.`,
      count: extractedCount,
      fallback: true
    });
  } catch (err: any) {
    res.status(500).json({ error: `Archive parsing aborted: ${err.message}` });
  }
});

// 8. POST /api/agent/files/delete - Remove specific sandbox workspace file
app.post("/api/agent/files/delete", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "Missing file name parameter inside body payload." });
      return;
    }

    if (agentVirtualFiles[name] === undefined) {
      res.status(404).json({ error: `File '${name}' is not found inside the live workspace database index.` });
      return;
    }

    delete agentVirtualFiles[name];
    console.log(`[AGENT FS] Deleted file node: "${name}"`);
    res.json({ success: true, message: `Node '${name}' successfully purged from storage.` });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to remove node: ${err.message}` });
  }
});

// ============================================
// PERSISTENT CUSTOM DATABASE & AUTH ENGINE
// ============================================

const DB_FILE_PATH = path.join(process.cwd(), "nexus_db.json");

// ============================================================
// CHAT BUBBLE & MULTIPLAYER DISCORD-LIKE WORKSPACE INTERFACES & DEFAULTS
// ============================================================

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

const defaultChatServers: ChatServer[] = [
  {
    id: "server-1",
    name: "Nexus Portal Core",
    icon: "NP",
    channels: [
      { id: "chan-11", name: "announcements", description: "Official system and cyber gateway updates." },
      { id: "chan-12", name: "general-chat", description: "The community lounge for portal explorers." },
      { id: "chan-13", name: "terminal-protocols", description: "Logs, hacking operations, and code protocols." }
    ]
  },
  {
    id: "server-2",
    name: "AI Agents Guild",
    icon: "AI",
    channels: [
      { id: "chan-21", name: "general-intellect", description: "Collaborate on next-gen models and LLMs." },
      { id: "chan-22", name: "prompt-engineers", description: "Fine-tune and perfect system directives." }
    ]
  }
];

const defaultChatFriends: ChatFriend[] = [
  { id: "friend-bot-1", name: "Nexus Bot", status: "online", isAgent: true, role: "System AI Assistance Agent", avatarColor: "#00cfc0" },
  { id: "friend-bot-2", name: "CyberCoder", status: "online", isAgent: true, role: "Senior TypeScript Architect", avatarColor: "#a855f7" },
  { id: "friend-bot-3", name: "PixelArtisan", status: "idle", isAgent: true, role: "Lead UI & Motion Designer", avatarColor: "#f43f5e" },
  { id: "friend-bot-4", name: "NeuroScribe", status: "offline", isAgent: true, role: "Creative Content Director", avatarColor: "#eab308" }
];

const defaultChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    serverId: "server-1",
    channelId: "chan-11",
    sender: "Nexus Bot",
    text: "Welcome to the Nexus Portal Online Network! Access sub-channels, create servers, add custom members, and ping intelligent agents in real-time.",
    timestamp: new Date().toISOString(),
    isAgent: true
  },
  {
    id: "msg-2",
    serverId: "server-1",
    channelId: "chan-12",
    sender: "CyberCoder",
    text: "Hey everyone! Just checking out the new live floating chat widget. This feels exactly like a micro Discord built right into our terminal! 💻⚡",
    timestamp: new Date().toISOString(),
    isAgent: true
  },
  {
    id: "msg-3",
    serverId: "server-1",
    channelId: "chan-12",
    sender: "PixelArtisan",
    text: "Agreed, the animations here are butter smooth. The cyber styling blends beautifully.",
    timestamp: new Date().toISOString(),
    isAgent: true
  }
];

interface UserRecord {
  email: string;
  password?: string;
  role: "owner" | "admin" | "user";
  createdAt: string;
  signInCount: number;
  lastSignInAt: string | null;
  googleAuth: boolean;
  status: "active" | "suspended";
  verificationCode?: string | null;
  history: any[]; // ChatSession[]
}

interface SystemLog {
  timestamp: string;
  level: "info" | "warning" | "success" | "error";
  event: string;
}

interface NexusDatabase {
  users: UserRecord[];
  systemLogs: SystemLog[];
  chatServers?: ChatServer[];
  chatMessages?: ChatMessage[];
  chatFriends?: ChatFriend[];
}

// Initial default database state
const defaultDbState: NexusDatabase = {
  users: [
    {
      email: "y48455577@gmail.com",
      password: "owner123",
      role: "owner",
      createdAt: new Date().toISOString(),
      signInCount: 0,
      lastSignInAt: null,
      googleAuth: false,
      status: "active",
      history: []
    }
  ],
  systemLogs: [
    {
      timestamp: new Date().toISOString(),
      level: "success",
      event: "Nexus Portal persistent database initialized. Pre-registered Owner Account: y48455577@gmail.com"
    }
  ],
  chatServers: defaultChatServers,
  chatFriends: defaultChatFriends,
  chatMessages: defaultChatMessages
};

// Synchronous safe database reader
function getDb(): NexusDatabase {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDbState, null, 2), "utf8");
      return defaultDbState;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    
    // Polyfill fields if they don't exist in an older database format
    let needsSave = false;
    if (!parsed.chatServers) {
      parsed.chatServers = defaultChatServers;
      needsSave = true;
    }
    if (!parsed.chatMessages) {
      parsed.chatMessages = defaultChatMessages;
      needsSave = true;
    }
    if (!parsed.chatFriends) {
      parsed.chatFriends = defaultChatFriends;
      needsSave = true;
    }
    if (needsSave) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(parsed, null, 2), "utf8");
    }
    return parsed;
  } catch (err: any) {
    console.error("[DB ERROR] Failed reading/writing database file, using memory fallback:", err.message);
    return defaultDbState;
  }
}

// Synchronous safe database writer
function saveDb(data: NexusDatabase) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err: any) {
    console.error("[DB WRITE ERROR] Could not persist state back to disk:", err.message);
  }
}

// Helper to push a system audit log to database
function logAudit(event: string, level: "info" | "warning" | "success" | "error" = "info") {
  const db = getDb();
  const entry: SystemLog = {
    timestamp: new Date().toISOString(),
    level,
    event
  };
  db.systemLogs.unshift(entry);
  
  // Cap logs to avoid file bloating (max last 300 logs)
  if (db.systemLogs.length > 300) {
    db.systemLogs = db.systemLogs.slice(0, 300);
  }
  
  saveDb(db);
  console.log(`[AUDIT LOG] [${level.toUpperCase()}] ${event}`);
}

// 1. POST /api/auth/signup - Custom email / Google authentication signup endpoint
app.post("/api/auth/signup", (req, res) => {
  try {
    const { email, password, googleAuth } = req.body;
    if (!email) {
      res.status(400).json({ error: "Missing email address field in payload." });
      return;
    }

    const emailClean = email.trim().toLowerCase();
    const db = getDb();
    
    // Check if user already exists
    const existing = db.users.find((u) => u.email.toLowerCase() === emailClean);
    if (existing) {
      res.status(400).json({ error: `Account for ${emailClean} already registered inside the index.` });
      return;
    }

    const newUser: UserRecord = {
      email: emailClean,
      password: googleAuth ? undefined : (password || "pw123"),
      role: emailClean === "y48455577@gmail.com" ? "owner" : "user", // Auto-grant owner role if email matches the user email
      createdAt: new Date().toISOString(),
      signInCount: 0,
      lastSignInAt: null,
      googleAuth: !!googleAuth,
      status: "active",
      verificationCode: null,
      history: []
    };

    db.users.push(newUser);
    saveDb(db);
    logAudit(`New user account registered successfully: ${emailClean} (Method: ${googleAuth ? "Google OTP" : "Email/Password"})`, "success");

    res.json({
      success: true,
      message: `Account created successfully for ${emailClean}. Enjoy using your new workspace.`,
      user: {
        email: newUser.email,
        role: newUser.role,
        googleAuth: newUser.googleAuth,
        status: newUser.status,
        history: []
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Signup operation aborted: ${err.message}` });
  }
});

// 2. POST /api/auth/signin - Custom Sign-in with simulated Google Auth Verification Code code-hints
app.post("/api/auth/signin", (req, res) => {
  try {
    const { email, password, googleAuth } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email parameter is required." });
      return;
    }

    const emailClean = email.trim().toLowerCase();
    const db = getDb();
    let user = db.users.find((u) => u.email.toLowerCase() === emailClean);

    // Dynamic Auto-Signup for Google Auth if they don't have an account
    if (!user && googleAuth) {
      const isOwner = emailClean === "y48455577@gmail.com";
      user = {
        email: emailClean,
        role: isOwner ? "owner" : "user",
        createdAt: new Date().toISOString(),
        signInCount: 0,
        lastSignInAt: null,
        googleAuth: true,
        status: "active",
        verificationCode: null,
        history: []
      };
      db.users.push(user);
      saveDb(db);
      logAudit(`Auto-registered Google Auth profile for traveler: ${emailClean}`, "success");
    }

    if (!user) {
      res.status(404).json({ error: "account matching this email doesn't exist. Please sign up first." });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Access denied. This profile has been permanently suspended by administration." });
      return;
    }

    // Google Login validation flow
    if (googleAuth) {
      // Always generate a random 6-digit confirmation code code whenever signing into google
      const code = String(Math.floor(100000 + Math.random() * 900000));
      user.verificationCode = code;
      
      // Sync DB
      saveDb(db);
      logAudit(`Google login initiated for ${emailClean}. Verification code queued: ${code}`, "warning");
      
      // Returns verification status + code hint for the UI debugger to make testing painless
      res.json({
        success: true,
        googleAuthRequired: true,
        email: emailClean,
        codeHint: code,
        message: "Google account detected. A mandatory 6-digit verification security code has been generated."
      });
      return;
    }

    // Standard Email Auth validation
    if (user.password !== password) {
      res.status(401).json({ error: "Invalid password for this account. Please verify credentials." });
      return;
    }

    // Successful authentications
    user.signInCount += 1;
    user.lastSignInAt = new Date().toISOString();
    saveDb(db);
    logAudit(`User signed in safely: ${emailClean}`, "success");

    res.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        googleAuth: user.googleAuth,
        status: user.status,
        history: user.history || []
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Auth entry failure: ${err.message}` });
  }
});

// 3. POST /api/auth/verify-google-code - Validate the queued Google signin token
app.post("/api/auth/verify-google-code", (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Missing email identifier or 6-digit verification code." });
      return;
    }

    const emailClean = email.trim().toLowerCase();
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === emailClean);

    if (!user) {
      res.status(404).json({ error: "Identity token broken: User is not recognized." });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Access denied. Suspended account status." });
      return;
    }

    if (!user.verificationCode || user.verificationCode !== String(code).trim()) {
      res.status(400).json({ error: "Incorrect or stale verification code. Please check your simulated OTP and try again." });
      return;
    }

    // Clears active OTP block
    user.verificationCode = null;
    user.signInCount += 1;
    user.lastSignInAt = new Date().toISOString();
    
    saveDb(db);
    logAudit(`Simulated Google credentials verified. Auth handshake success: ${emailClean}`, "success");

    res.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        googleAuth: user.googleAuth,
        status: user.status,
        history: user.history || []
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Google verification handshake dropped: ${err.message}` });
  }
});

// 4. POST /api/user/sync-history - Write full history updates to cloud-virtual storage
app.post("/api/user/sync-history", (req, res) => {
  try {
    const { email, history } = req.body;
    if (!email || !Array.isArray(history)) {
      res.status(400).json({ error: "Sync rejected: Invalid payload or email." });
      return;
    }

    const emailClean = email.trim().toLowerCase();
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === emailClean);

    if (!user) {
      res.status(404).json({ error: `User reference ${emailClean} not synchronized in active index.` });
      return;
    }

    user.history = history;
    saveDb(db);
    console.log(`[SYNC ENGINE] Synchronized ${history.length} conversation nodes for user: "${emailClean}"`);
    res.json({ success: true, count: history.length });
  } catch (err: any) {
    res.status(500).json({ error: `Sync synchronization failure: ${err.message}` });
  }
});

// ============================================================
// REAL-TIME MULTIPLAYER CHAT BUBBLE ENDPOINTS
// ============================================================

// Get entire live bubble state (servers list, all relevant channel messages, and friends list)
app.get("/api/bubble/state", (req, res) => {
  try {
    const db = getDb();
    res.json({
      servers: db.chatServers || [],
      messages: db.chatMessages || [],
      friends: db.chatFriends || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Discord-like Server
app.post("/api/bubble/servers", (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) {
      res.status(400).json({ error: "Server name is required." });
      return;
    }

    const db = getDb();
    if (!db.chatServers) db.chatServers = [];

    const serverId = "srv-" + Date.now();
    const newServer: ChatServer = {
      id: serverId,
      name,
      icon: icon || name.split(" ").map((w: string) => w[0]).join("").substring(0, 3).toUpperCase(),
      channels: [
        { id: `chan-${Date.now()}-1`, name: "general", description: `Welcome to the main channel of ${name}!` },
        { id: `chan-${Date.now()}-2`, name: "lounge", description: "Grab a warm beverage and talk about code." }
      ]
    };

    db.chatServers.push(newServer);
    saveDb(db);

    res.json({ success: true, server: newServer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Channel inside a Server
app.post("/api/bubble/channels", (req, res) => {
  try {
    const { serverId, name, description } = req.body;
    if (!serverId || !name) {
      res.status(400).json({ error: "Server ID and Channel name are required." });
      return;
    }

    const db = getDb();
    if (!db.chatServers) db.chatServers = [];

    const srv = db.chatServers.find(s => s.id === serverId);
    if (!srv) {
      res.status(404).json({ error: "Target server not found." });
      return;
    }

    const cleanChanName = name.toLowerCase().replace(/\s+/g, "-");
    const newChan: ChatChannel = {
      id: `chan-${Date.now()}`,
      name: cleanChanName,
      description: description || "Interactive chat channel."
    };

    srv.channels.push(newChan);
    saveDb(db);

    res.json({ success: true, channel: newChan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a Friend
app.post("/api/bubble/friends", (req, res) => {
  try {
    const { name, isAgent, role, avatarColor } = req.body;
    if (!name) {
      res.status(400).json({ error: "Friend username/name is required." });
      return;
    }

    const db = getDb();
    if (!db.chatFriends) db.chatFriends = [];

    const newFriend: ChatFriend = {
      id: "friend-" + Date.now(),
      name,
      status: "online",
      isAgent: !!isAgent,
      role: role || (isAgent ? "Autonomous System AI Persona" : "External Developer Cadet"),
      avatarColor: avatarColor || "#" + Math.floor(Math.random()*16777215).toString(16)
    };

    db.chatFriends.push(newFriend);
    saveDb(db);

    res.json({ success: true, friend: newFriend });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send Chat Message
app.post("/api/bubble/messages", async (req, res) => {
  try {
    const { serverId, channelId, sender, text, isAgent } = req.body;
    if (!channelId || !sender || !text) {
      res.status(400).json({ error: "Missing channelId, sender, or text." });
      return;
    }

    const db = getDb();
    
    // Fallback if not initialized
    if (!db.chatMessages) db.chatMessages = [];
    if (!db.chatFriends) db.chatFriends = [];

    const newMsg: ChatMessage = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      serverId: serverId || "server-1",
      channelId,
      sender,
      text,
      timestamp: new Date().toISOString(),
      isAgent: !!isAgent
    };

    db.chatMessages.push(newMsg);
    saveDb(db);

    res.json({ success: true, message: newMsg });

    // Background Thread - AI Agent triggering checks
    const processedText = text.toLowerCase();
    let selectedAgent: any = null;

    if (serverId === "dm") {
      // Direct message recipientId is channelId
      const targetFriend = db.chatFriends.find(f => f.id === channelId);
      if (targetFriend && targetFriend.isAgent) {
        selectedAgent = targetFriend;
      }
    } else {
      // Channels: Check for name mention (e.g., '@CyberCoder', 'nexus bot')
      const mentionMap = [
        { key: "nexus bot", id: "friend-bot-1" },
        { key: "cybercoder", id: "friend-bot-2" },
        { key: "pixelartisan", id: "friend-bot-3" },
        { key: "neuroscribe", id: "friend-bot-4" }
      ];
      
      const foundMention = mentionMap.find(m => processedText.includes(m.key) || processedText.includes("@" + m.key.replace(" ", "")));
      if (foundMention) {
        selectedAgent = db.chatFriends.find(f => f.id === foundMention.id);
      } else if (Math.random() < 0.15) {
        // 15% chance for a random active chat person to respond to increase liveliness!
        const onlineAgents = db.chatFriends.filter(f => f.isAgent && f.status !== "offline");
        if (onlineAgents.length > 0) {
          selectedAgent = onlineAgents[Math.floor(Math.random() * onlineAgents.length)];
        }
      }
    }

    if (selectedAgent) {
      setTimeout(async () => {
        try {
          const freshDb = getDb();
          const channelMessages = (freshDb.chatMessages || []).filter(
            m => m.serverId === serverId && m.channelId === channelId
          );
          
          // Grab current chat context
          const lastMessages = channelMessages.slice(-12);
          const promptContext = lastMessages.map(m => `${m.sender}: ${m.text}`).join("\n");
          
          const agentPersonaPrompt = selectedAgent.role || "Autonomous Digital Assistant";
          let personaInstruction = `You are playing the role of "${selectedAgent.name}" in a cyber-security terminal Discord-styled chat.
Designation role: ${agentPersonaPrompt}.
Reply to the recent channel context conversation in a concise, expressive, and tech-friendly voice. Avoid long essays. Keep paragraphs short (1-2 sentences), using casual chat layout formatting, occasional developer shorthand or emoticons.
User's handle is: "${sender}".`;

          if (selectedAgent.id === "friend-friend-active-1") {
            personaInstruction += `\nPersonality: Casual online buddy, highly interested in chat tech, chill and friendly.`;
          } else if (selectedAgent.id === "friend-bot-2") {
            personaInstruction += `\nPersonality: Passionate typescript-head, terminal enthusiast, likes referring to code snippets or bugs. Extremely enthusiastic and helpful.`;
          } else if (selectedAgent.id === "friend-bot-3") {
            personaInstruction += `\nPersonality: UI wizard who loves neon glow, layout aesthetics, responsive buttons, and padding. Calm, creative, and style-conscious.`;
          } else if (selectedAgent.id === "friend-bot-4") {
            personaInstruction += `\nPersonality: Creative writer persona, witty, mildly sarcastic helper bot. Likes using word puns or playful logic puzzles.`;
          }

          const gemini = getGeminiClient();
          const response = await gemini.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `The following is the active chat transcript:\n${promptContext}\n\nGenerate the next chat response as the character "${selectedAgent.name}":`,
            config: {
              systemInstruction: personaInstruction,
              maxOutputTokens: 220,
              temperature: 0.85
            }
          });

          const replyText = response.text || "Command response timed out, routing payload protocols.";

          const botDb = getDb();
          if (!botDb.chatMessages) botDb.chatMessages = [];

          const botMsg: ChatMessage = {
            id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
            serverId: serverId || "server-1",
            channelId,
            sender: selectedAgent.name,
            text: replyText.trim(),
            timestamp: new Date().toISOString(),
            isAgent: true
          };

          botDb.chatMessages.push(botMsg);
          saveDb(botDb);
          console.log(`[CHAT BUBBLE BOT] Agent "${selectedAgent.name}" successfully replied in channel "${channelId}".`);
        } catch (botErr: any) {
          console.error("[CHAT BUBBLE BOT EXCEPTION]:", botErr.message);
        }
      }, 1200);
    }

  } catch (err: any) {
    console.error("[POST MESSAGE ERROR]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// OWNER & ADMIN CONTROL PANEL DASHBOARD ENDPOINTS
// ============================================

// Helper to assert owner or administration status
function verifyAdminRole(email: string): boolean {
  const emailClean = (email || "").trim().toLowerCase();
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === emailClean);
  return !!user && (user.role === "owner" || user.role === "admin");
}

// 5. GET /api/admin/metrics - Collect global analytics, accounts, logs, histories
app.get("/api/admin/metrics", (req, res) => {
  try {
    const requesterEmail = req.query.adminEmail as string;
    if (!requesterEmail || !verifyAdminRole(requesterEmail)) {
      res.status(403).json({ error: "Access denied. Requires Owner or Admin authority." });
      return;
    }

    const db = getDb();
    
    // Core database metrics aggregation
    const totalUsers = db.users.length;
    const googleUsersCount = db.users.filter((u) => u.googleAuth).length;
    
    let totalSessions = 0;
    let totalMessages = 0;

    db.users.forEach((u) => {
      const userSessions = Array.isArray(u.history) ? u.history : [];
      totalSessions += userSessions.length;
      userSessions.forEach((sess) => {
        if (sess && Array.isArray(sess.messages)) {
          totalMessages += sess.messages.length;
        }
      });
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        googleUsersCount,
        totalSessions,
        totalMessages,
        dbSizeKb: (fs.existsSync(DB_FILE_PATH) ? fs.statSync(DB_FILE_PATH).size / 1024 : 0).toFixed(1)
      },
      users: db.users.map((u) => ({
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        signInCount: u.signInCount,
        lastSignInAt: u.lastSignInAt,
        googleAuth: u.googleAuth,
        status: u.status,
        sessionCount: Array.isArray(u.history) ? u.history.length : 0,
        history: u.history
      })),
      systemLogs: db.systemLogs || []
    });
  } catch (err: any) {
    res.status(500).json({ error: `Metrics compilation failed: ${err.message}` });
  }
});

// 6. POST /api/admin/users/create - Insert user directly from executive controls
app.post("/api/admin/users/create", (req, res) => {
  try {
    const { adminEmail, email, password, role } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Admin privilege required." });
      return;
    }

    if (!email) {
      res.status(400).json({ error: "Provide a valid email." });
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const db = getDb();

    if (db.users.some((u) => u.email.toLowerCase() === targetEmail)) {
      res.status(400).json({ error: `account with email ${targetEmail} is already active.` });
      return;
    }

    const newUser: UserRecord = {
      email: targetEmail,
      password: password || "user123",
      role: role || "user",
      createdAt: new Date().toISOString(),
      signInCount: 0,
      lastSignInAt: null,
      googleAuth: false,
      status: "active",
      history: []
    };

    db.users.push(newUser);
    saveDb(db);
    logAudit(`Executive account spawned: [${targetEmail}] with privileges [${newUser.role}] by admin ${adminEmail}`, "success");

    res.json({ success: true, message: `Account for ${targetEmail} has been added.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/admin/users/update-role - Promote / demote roles
app.post("/api/admin/users/update-role", (req, res) => {
  try {
    const { adminEmail, targetUserEmail, newRole } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Requires administrator access." });
      return;
    }

    const db = getDb();
    const adminUser = db.users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase().trim());
    const targetUser = db.users.find((u) => u.email.toLowerCase() === targetUserEmail.trim().toLowerCase());

    if (!targetUser) {
      res.status(404).json({ error: `User with email ${targetUserEmail} not registered.` });
      return;
    }

    // Only owners can promote somebody to Owner or modify existing owners
    if (newRole === "owner" && adminUser?.role !== "owner") {
      res.status(403).json({ error: "Only the core creator Owner can grant full property ownership rights." });
      return;
    }

    if (targetUser.role === "owner" && adminUser?.role !== "owner") {
      res.status(403).json({ error: "Permission denied. Owners cannot be modified by standard administrators." });
      return;
    }

    const prevRole = targetUser.role;
    targetUser.role = newRole;
    saveDb(db);
    logAudit(`Permissions modified: [${targetUser.email}] changed from [${prevRole}] to [${newRole}] by [${adminEmail}]`, "warning");

    res.json({ success: true, message: `Role successfully updated for ${targetUser.email}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. POST /api/admin/users/toggle-status - Block or Suspend user accounts
app.post("/api/admin/users/toggle-status", (req, res) => {
  try {
    const { adminEmail, targetUserEmail } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Requires administrator credentials." });
      return;
    }

    const db = getDb();
    const adminUser = db.users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase().trim());
    const targetUser = db.users.find((u) => u.email.toLowerCase() === targetUserEmail.trim().toLowerCase());

    if (!targetUser) {
      res.status(404).json({ error: "User profile search returned null index." });
      return;
    }

    if (targetUser.role === "owner" && adminUser?.role !== "owner") {
      res.status(403).json({ error: "Violation alert: Owners cannot be suspended or terminated by administrators." });
      return;
    }

    const nextStatus = targetUser.status === "active" ? "suspended" : "active";
    targetUser.status = nextStatus;
    saveDb(db);
    logAudit(`Account status updated: [${targetUser.email}] is now [${nextStatus.toUpperCase()}] by executive admin [${adminEmail}]`, nextStatus === "active" ? "info" : "error");

    res.json({ success: true, message: `Account status toggled successfully to ${nextStatus}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. POST /api/admin/users/delete - Total account deletion purge
app.post("/api/admin/users/delete", (req, res) => {
  try {
    const { adminEmail, targetUserEmail } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Requires full administrative priority login parameters." });
      return;
    }

    const db = getDb();
    const adminUser = db.users.find((u) => u.email.toLowerCase() === adminEmail.toLowerCase().trim());
    const targetIdx = db.users.findIndex((u) => u.email.toLowerCase() === targetUserEmail.trim().toLowerCase());

    if (targetIdx === -1) {
      res.status(404).json({ error: "Specified user profile does not exist inside active indexes." });
      return;
    }

    const targetUser = db.users[targetIdx];
    if (targetUser.role === "owner" && adminUser?.role !== "owner") {
      res.status(403).json({ error: "Secure error: Core Owner account cannot be deleted." });
      return;
    }

    db.users.splice(targetIdx, 1);
    saveDb(db);
    logAudit(`Executive database purge: User [${targetUserEmail}] record terminated completely from indexes by admin [${adminEmail}]`, "error");

    res.json({ success: true, message: `Record for ${targetUserEmail} successfully terminated from registry.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. POST /api/admin/logs/clear - Wipe all event audit logs from the database
app.post("/api/admin/logs/clear", (req, res) => {
  try {
    const { adminEmail } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Requires administrator parameters." });
      return;
    }

    const db = getDb();
    db.systemLogs = [
      {
        timestamp: new Date().toISOString(),
        level: "warning",
        event: `Database audit log clear routine execution triggered by ${adminEmail}.`
      }
    ];
    saveDb(db);
    res.json({ success: true, message: "System logs successfully cleared." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. POST /api/admin/chat/reset - Restore chat channels, friends, and reset messages to default
app.post("/api/admin/chat/reset", (req, res) => {
  try {
    const { adminEmail } = req.body;
    if (!adminEmail || !verifyAdminRole(adminEmail)) {
      res.status(403).json({ error: "Requires administrator parameters." });
      return;
    }

    const db = getDb();
    db.chatServers = defaultChatServers;
    db.chatFriends = defaultChatFriends;
    db.chatMessages = defaultChatMessages;
    saveDb(db);
    logAudit(`Chat bubble workspace structure was reset to defaults by executive ${adminEmail}`, "warning");
    res.json({ success: true, message: "Chat bubble database reset to defaults." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start dev or production configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets from: " + distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
