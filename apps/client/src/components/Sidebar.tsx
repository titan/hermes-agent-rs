import {
  MessageSquarePlus,
  Search,
  Puzzle,
  Zap,
  Settings,
  FolderOpen,
  Trash2,
  Filter,
  PenSquare,
  FolderPlus,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { BackendStatus } from "./BackendStatus";
import type { Session, Project, NavPage } from "../types";

interface SidebarProps {
  page: NavPage;
  onPageChange: (page: NavPage) => void;
  sessions: Session[];
  activeSessionId: string | null;
  projects: Project[];
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onAddProject: (name: string, path: string) => void;
  onRemoveProject: (id: string) => void;
}

const NAV_ITEMS: { id: NavPage; icon: typeof Puzzle; label: string }[] = [
  { id: "search", icon: Search, label: "Search" },
  { id: "plugins", icon: Puzzle, label: "Plugins" },
  { id: "automation", icon: Zap, label: "Automation" },
];

export function Sidebar({
  page,
  onPageChange,
  sessions,
  activeSessionId,
  projects,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onAddProject,
  onRemoveProject,
}: SidebarProps) {
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffH < 1) return "now";
    if (diffH < 24) return `${diffH}h`;
    return `${diffD}d`;
  };

  const handleAddProject = async () => {
    // Try Tauri dialog, fall back to prompt
    try {
      if ("__TAURI_INTERNALS__" in window) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false, title: "Select project folder" });
        if (selected) {
          const path = typeof selected === "string" ? selected : selected[0];
          if (path) {
            const name = path.split("/").pop() || path;
            onAddProject(name, path);
          }
        }
        return;
      }
    } catch { /* fall through */ }
    const path = prompt("Project path:");
    if (path) {
      const name = path.split("/").pop() || path;
      onAddProject(name, path);
    }
  };

  return (
    <aside className="relative w-full bg-[#23262a] flex h-full flex-col shrink-0 overflow-hidden">
      <div className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(90,113,150,0.18)_0%,rgba(28,36,49,0.05)_52%,transparent_76%)]" />
      {/* New Chat */}
      <div className="px-2 py-2.5">
        <button
          onClick={onNewChat}
          className={clsx(
            "relative z-10 flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-[13px] transition-colors",
            page === "chat" && !activeSessionId
              ? "bg-[#333c4d] text-[#e8eef8]"
              : "text-[#c3cddd] hover:bg-[#2b3444] hover:text-[#e8eef8]"
          )}
        >
          <MessageSquarePlus size={15} />
          <span>New chat</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={clsx(
              "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
              page === item.id
                ? "bg-[#333c4d] text-[#e8eef8]"
                : "text-[#c3cddd] hover:bg-[#2b3444] hover:text-[#e8eef8]"
            )}
          >
            <item.icon size={14} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Projects */}
      <div className="relative z-10 mt-4 px-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#8f9ab0] uppercase tracking-wider">Projects</span>
          <button
            onClick={handleAddProject}
            className="p-0.5 rounded hover:bg-[#2b3444] text-[#9ba8be] hover:text-[#d5deef]"
            title="Add project"
          >
            <FolderPlus size={12} />
          </button>
        </div>
        {projects.length === 0 && (
          <p className="text-xs text-[#9ba8be] px-3 py-1">No projects</p>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            className="group flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[12px] text-[#c3cddd] hover:bg-[#2b3444] hover:text-[#e8eef8] transition-colors"
          >
            <FolderOpen size={14} className="shrink-0" />
            <span className="truncate flex-1" title={p.path}>{p.name}</span>
            <button
              onClick={() => onRemoveProject(p.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#333c4d] text-[#9ba8be] hover:text-error transition-all"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Chat History */}
      <div className="relative z-10 mt-4 px-2.5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#8f9ab0] uppercase tracking-wider">Chats</span>
          <div className="flex items-center gap-1">
            <button className="p-0.5 rounded hover:bg-[#2b3444] text-[#9ba8be]">
              <Filter size={12} />
            </button>
            <button className="p-0.5 rounded hover:bg-[#2b3444] text-[#9ba8be]">
              <PenSquare size={12} />
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={clsx(
                "group flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors",
                activeSessionId === session.id && page === "chat"
                  ? "bg-[#333c4d] text-[#e8eef8]"
                  : "text-[#c3cddd] hover:bg-[#2b3444]"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <span className="truncate flex-1">{session.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#97a3ba]">{formatTime(session.updated_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#333c4d] text-[#9ba8be] hover:text-error transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Status + Settings */}
      <div className="relative z-10 mt-auto p-2.5 space-y-1.5">
        <BackendStatus />
        <button
          onClick={() => onPageChange("settings")}
          className={clsx(
            "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors justify-start",
            page === "settings"
              ? "bg-[#333c4d] text-[#e8eef8]"
              : "text-[#c3cddd] hover:bg-[#2b3444] hover:text-[#e8eef8]"
          )}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
