import { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AutomationView } from "./components/AutomationView";
import { SettingsView } from "./components/SettingsView";
import { SearchView } from "./components/SearchView";
import { PluginsView } from "./components/PluginsView";
import { TitleBar } from "./components/TitleBar";
import { useStreamChat } from "./hooks/useStreamChat";
import * as api from "./api";
import type { Session, Project, NavPage, ChatMessage } from "./types";

export default function App() {
  const SIDEBAR_WIDTH_KEY = "hermes.ui.sidebar.width.v1";
  const SIDEBAR_MIN_WIDTH = 200;
  const SIDEBAR_MAX_WIDTH = 360;
  const [page, setPage] = useState<NavPage>("chat");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 232;
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, n)) : 232;
  });
  const resizingSidebarRef = useRef(false);

  const { isStreaming, streamingContent, sendStreaming, handleTauriDelta, resetStream } = useStreamChat();

  // Listen for Tauri stream-delta events (native mode)
  const handleTauriDeltaRef = useRef(handleTauriDelta);
  handleTauriDeltaRef.current = handleTauriDelta;

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u = await listen<{ session_id?: string; delta_type: string; content: string; tool_name?: string }>(
          "stream-delta",
          (event) => {
            // Ignore deltas from other sessions.
            if (activeSessionId && event.payload.session_id && event.payload.session_id !== activeSessionId) {
              return;
            }
            handleTauriDeltaRef.current(event.payload.delta_type, event.payload.content);
          }
        );
        unlisten = u;
      } catch {
        // Not in Tauri — browser mode uses WebSocket via useStreamChat
      }
    })();

    return () => { unlisten?.(); };
  }, [activeSessionId]);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setSidebarOpen(!e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    api.getSessions().then(setSessions);
    api.getProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingSidebarRef.current) return;
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!resizingSidebarRef.current) return;
      resizingSidebarRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const handleNewChat = useCallback(async () => {
    const session = await api.createSession("New chat");
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setPage("chat");
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setPage("chat");
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
    },
    [activeSessionId]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) return;

      // Add user message to UI immediately
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [...s.messages, userMsg],
                updated_at: new Date().toISOString(),
                title: s.messages.length === 0
                  ? content.slice(0, 30) + (content.length > 30 ? "..." : "")
                  : s.title,
              }
            : s
        )
      );

      // Detect environment — check if Tauri IPC is actually available
      const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

      if (isTauri) {
        // Tauri mode: call invoke, streaming comes via Tauri events
        try {
          await api.sendMessage(activeSessionId, content);
        } catch { /* handled by event listener */ }
        // Refresh final messages from Tauri backend
        try {
          const messages = await api.getSessionMessages(activeSessionId);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, messages, updated_at: new Date().toISOString() }
                : s
            )
          );
          resetStream();
        } catch { /* ignore */ }
      } else {
        // Browser mode: use WebSocket streaming directly
        try {
          const reply = await sendStreaming(activeSessionId, content);
          // Add assistant message to session
          const assistantMsg: ChatMessage = {
            id: `reply-${Date.now()}`,
            role: "assistant",
            content: reply,
            timestamp: new Date().toISOString(),
            model: "remote",
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, messages: [...s.messages, assistantMsg], updated_at: new Date().toISOString() }
                : s
            )
          );
          resetStream();
        } catch (e) {
          // Show error as assistant message
          const errMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ 连接失败: ${e}`,
            timestamp: new Date().toISOString(),
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, messages: [...s.messages, errMsg], updated_at: new Date().toISOString() }
                : s
            )
          );
          resetStream();
        }
      }
    },
    [activeSessionId, resetStream, sendStreaming]
  );

  const handleAddProject = useCallback(async (name: string, path: string) => {
    const project = await api.addProject(name, path);
    setProjects((prev) => [...prev, project]);
  }, []);

  const handleRemoveProject = useCallback(async (id: string) => {
    await api.removeProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary rounded-2xl overflow-hidden border border-[#273042]">
      <TitleBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative bg-[#23262a]">
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setSidebarOpen(false)} />
        )}
        <div
          className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-200 absolute md:relative z-20 h-full`}
          style={{ width: sidebarWidth }}
        >
          <Sidebar
            page={page}
            onPageChange={setPage}
            sessions={sessions}
            activeSessionId={activeSessionId}
            projects={projects}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onAddProject={handleAddProject}
            onRemoveProject={handleRemoveProject}
          />
          <div
            className="hidden md:block absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-white/10 active:bg-white/20"
            onMouseDown={() => {
              resizingSidebarRef.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden rounded-[25px] bg-bg-primary">
          {page === "chat" && (
            <ChatView
              session={activeSession}
              onSendMessage={handleSendMessage}
              onNewChat={handleNewChat}
              streamingText={streamingContent}
              isStreaming={isStreaming}
            />
          )}
          {page === "search" && <SearchView sessions={sessions} onSelectSession={handleSelectSession} />}
          {page === "plugins" && <PluginsView />}
          {page === "automation" && <AutomationView />}
          {page === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
