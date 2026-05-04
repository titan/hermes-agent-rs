import type { ExecutionTimelineEvent } from "../types";

interface ExecutionTimelineProps {
  events: ExecutionTimelineEvent[];
}

interface TimelineGroup {
  key: string;
  tool: string;
  kind: "tool" | "status";
  status: "running" | "done";
  events: ExecutionTimelineEvent[];
}

function buildGroups(events: ExecutionTimelineEvent[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const activeToolGroup = new Map<string, number>();

  for (const ev of events) {
    if (ev.type === "status") {
      groups.push({
        key: `status-${groups.length}`,
        tool: "status",
        kind: "status",
        status: "done",
        events: [ev],
      });
      continue;
    }

    const tool = ev.tool?.trim() || "tool";
    let groupIndex = activeToolGroup.get(tool);
    const needsNewGroup = ev.type === "tool_start" || groupIndex === undefined;

    if (needsNewGroup) {
      groups.push({
        key: `${tool}-${groups.length}`,
        tool,
        kind: "tool",
        status: ev.type === "tool_complete" ? "done" : "running",
        events: [],
      });
      groupIndex = groups.length - 1;
      activeToolGroup.set(tool, groupIndex);
    }

    const safeGroupIndex = groupIndex ?? groups.length - 1;
    const group = groups[safeGroupIndex];
    group.events.push(ev);
    if (ev.type === "tool_complete") {
      group.status = "done";
      activeToolGroup.delete(tool);
    }
  }

  return groups;
}

function statusDot(status: "running" | "done"): string {
  return status === "done" ? "bg-emerald-400" : "bg-amber-400 animate-pulse";
}

export function ExecutionTimeline({ events }: ExecutionTimelineProps) {
  if (!events.length) return null;
  const groups = buildGroups(events);

  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] text-gray-400 mb-1">执行时间线</div>
      <div className="space-y-2">
        {groups.map((group) => (
          <details key={group.key} className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-xs text-gray-200">
              {group.kind === "tool" ? (
                <>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(group.status)}`} />
                  <span className="font-mono">{group.tool}</span>
                  <span className="text-gray-500">{group.status}</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>状态更新</span>
                </>
              )}
            </summary>
            <div className="mt-2 space-y-1.5">
              {group.events.map((ev, idx) => (
                <div key={`${group.key}-${idx}`} className="text-xs text-gray-300">
                  <div className="text-gray-500">
                    {ev.type}
                    {ev.chunk_index && ev.chunk_total
                      ? ` (${ev.chunk_index}/${ev.chunk_total})`
                      : ""}
                  </div>
                  {ev.arguments && (
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-black/30 px-2 py-1 text-[11px] text-gray-400">
                      {ev.arguments}
                    </pre>
                  )}
                  {ev.content && (
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 px-2 py-1 text-[11px] text-gray-300">
                      {ev.content}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
