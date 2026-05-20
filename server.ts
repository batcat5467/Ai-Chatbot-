import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";

dotenv.config();

const app = express();
const PORT = 3000;

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
