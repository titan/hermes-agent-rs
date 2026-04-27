/**
 * useStreamChat — React hook for streaming chat with WebSocket or Tauri events.
 *
 * Follows the Vercel AI SDK useChat pattern:
 * - Manages messages state
 * - Handles streaming token-by-token
 * - Batches state updates to avoid layout thrash
 * - Works in both Tauri (native events) and browser (WebSocket) modes
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { } from "../types";

interface UseStreamChatOptions {
  /** hermes-http API base URL for browser WebSocket mode */
  apiBase?: string;
}

interface StreamState {
  status: "idle" | "streaming" | "error";
  streamingContent: string;
  error?: string;
}

export function useStreamChat(options: UseStreamChatOptions = {}) {
  // Browser dev mode expects `hermes serve` on :3000 by default.
  const { apiBase = "http://127.0.0.1:3000" } = options;

  const [streamState, setStreamState] = useState<StreamState>({
    status: "idle",
    streamingContent: "",
  });

  // Use a ref to accumulate tokens without triggering re-renders on every token
  const contentRef = useRef("");
  const displayedRef = useRef("");
  const flushRafRef = useRef<number | null>(null);
  const isFlushingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Smoothly reveal streamed text frame-by-frame.
  // This feels closer to "typing" than fixed 50ms timer batches.
  const startFlushing = useCallback(() => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;

    const flushFrame = () => {
      if (!isFlushingRef.current) return;

      const target = contentRef.current;
      const current = displayedRef.current;

      if (target !== current) {
        if (!target.startsWith(current)) {
          // Non-append mutation (reset/rewrite): sync immediately.
          displayedRef.current = target;
        } else {
          const remaining = target.length - current.length;
          const chunk = Math.max(1, Math.min(24, Math.ceil(remaining / 8)));
          displayedRef.current = current + target.slice(current.length, current.length + chunk);
        }

        setStreamState((prev) => {
          if (prev.streamingContent === displayedRef.current) return prev;
          return { ...prev, streamingContent: displayedRef.current };
        });
      }

      flushRafRef.current = requestAnimationFrame(flushFrame);
    };

    flushRafRef.current = requestAnimationFrame(flushFrame);
  }, []);

  const stopFlushing = useCallback(() => {
    isFlushingRef.current = false;
    if (flushRafRef.current !== null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    // Final sync flush
    displayedRef.current = contentRef.current;
    setStreamState((prev) => ({
      ...prev,
      streamingContent: displayedRef.current,
    }));
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isFlushingRef.current = false;
      if (flushRafRef.current !== null) cancelAnimationFrame(flushRafRef.current);
      wsRef.current?.close();
    };
  }, []);

  /**
   * Send a message and stream the response via WebSocket.
   * Returns the final complete reply text.
   */
  const sendStreaming = useCallback(
    (sessionId: string, content: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        // Reset state
        contentRef.current = "";
        displayedRef.current = "";
        setStreamState({ status: "streaming", streamingContent: "" });
        startFlushing();

        const wsBase = apiBase.replace("http://", "ws://").replace("https://", "wss://");
        const url = `${wsBase}/v1/ws-stream/${sessionId}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;
        let fullReply = "";

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);

            switch (data.type) {
              case "connected":
                ws.send(JSON.stringify({ text: content, user_id: "app" }));
                break;

              case "text":
                contentRef.current += data.content;
                fullReply += data.content;
                break;

              case "thinking":
                contentRef.current += `\n> 💭 ${data.content}`;
                break;

              case "tool_start":
                contentRef.current += `\n\n🔧 **${data.tool || "tool"}**: ${data.content}\n`;
                break;

              case "tool_complete":
                contentRef.current += `\n✅ ${data.tool || "tool"} 完成\n`;
                break;

              case "status":
                contentRef.current += `\n_${data.content}_\n`;
                break;

              case "activity":
                contentRef.current += `\n⏳ ${data.content}\n`;
                break;

              case "done":
                stopFlushing();
                if (data.content) fullReply = data.content;
                setStreamState({
                  status: "idle",
                  streamingContent: "",
                });
                ws.close();
                resolve(fullReply);
                break;

              case "error":
                stopFlushing();
                setStreamState({
                  status: "error",
                  streamingContent: "",
                  error: data.content,
                });
                ws.close();
                reject(new Error(data.content));
                break;
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          stopFlushing();
          setStreamState({ status: "error", streamingContent: "", error: "WebSocket connection failed" });
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          stopFlushing();
          if (streamState.status === "streaming") {
            setStreamState({ status: "idle", streamingContent: "" });
            resolve(fullReply);
          }
        };
      });
    },
    [apiBase, startFlushing, stopFlushing, streamState.status]
  );

  /**
   * Handle a Tauri stream-delta event (for native mode).
   */
  const handleTauriDelta = useCallback(
    (deltaType: string, content: string) => {
      if (streamState.status !== "streaming" && deltaType !== "done") {
        contentRef.current = "";
        displayedRef.current = "";
        setStreamState({ status: "streaming", streamingContent: "" });
        startFlushing();
      }

      switch (deltaType) {
        case "text":
          contentRef.current += content;
          break;
        case "thinking":
          contentRef.current += `\n> 💭 ${content}`;
          break;
        case "tool_start":
          contentRef.current += `\n\n🔧 ${content}\n`;
          break;
        case "tool_complete":
          contentRef.current += `\n✅ ${content}\n`;
          break;
        case "status":
          contentRef.current += `\n_${content}_\n`;
          break;
        case "activity":
          contentRef.current += `\n⏳ ${content}\n`;
          break;
        case "done":
          stopFlushing();
          // Keep the final streamed content visible until caller commits
          // the assistant message, then clear via resetStream().
          setStreamState((prev) => ({ ...prev, status: "idle" }));
          break;
      }
    },
    [startFlushing, stopFlushing, streamState.status]
  );

  /**
   * Clear stream UI state after final assistant message is committed.
   */
  const resetStream = useCallback(() => {
    contentRef.current = "";
    displayedRef.current = "";
    setStreamState({ status: "idle", streamingContent: "" });
  }, []);

  return {
    /** Current streaming status */
    isStreaming: streamState.status === "streaming",
    /** Accumulated streaming content (updates every 50ms during streaming) */
    streamingContent: streamState.streamingContent,
    /** Error message if streaming failed */
    error: streamState.error,
    /** Send a message via WebSocket streaming (browser mode) */
    sendStreaming,
    /** Handle a Tauri stream-delta event (native mode) */
    handleTauriDelta,
    /** Clear streamed text after message commit */
    resetStream,
  };
}
