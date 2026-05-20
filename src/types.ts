export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 payload
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  parts: MessagePart[];
  timestamp: string;
}

export interface AssistantPersona {
  id: string;
  name: string;
  icon: string; // lucide icon name
  bgColor: string;
  textColor: string;
  prompt: string;
  description: string;
  initialSuggestion?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  personaId: string;
  modelId: string;
  temperature: number;
  systemInstruction?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  type: string;
  recommended: boolean;
}
