export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  model?: string;
  execution_backend?: "local" | "sandbox";
  tool_calls?: ToolCall[];
  execution_timeline?: ExecutionTimelineEvent[];
}

export interface ToolCall {
  name: string;
  status: "running" | "done" | "error";
  output?: string;
}

export interface ExecutionTimelineEvent {
  type: "tool_start" | "tool_stdout" | "tool_complete" | "status";
  tool?: string;
  content?: string;
  arguments?: string;
  chunk_index?: number;
  chunk_total?: number;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  project?: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface AutomationTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
}

export interface AppConfig {
  api_base: string;
  default_model: string;
  theme: string;
  mode: "local" | "remote";
}

export interface PluginSettings {
  mcp_filesystem: boolean;
  mcp_terminal: boolean;
  mcp_browser: boolean;
  mcp_database: boolean;
  tool_code_exec: boolean;
}

export type NavPage = "chat" | "search" | "plugins" | "automation" | "settings";
