/**
 * ChatLog – Scrollable transcript of the conversation.
 *
 * Displays committed transcript entries plus any in-flight pending
 * transcriptions from both the user and the assistant.
 */

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../types/gemini";

interface Props {
  transcript: TranscriptEntry[];
  pendingUserText: string;
  pendingAssistantText: string;
}

export function ChatLog({
  transcript,
  pendingUserText,
  pendingAssistantText,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, pendingUserText, pendingAssistantText]);

  const hasContent =
    transcript.length > 0 ||
    pendingUserText.trim() ||
    pendingAssistantText.trim();

  if (!hasContent) {
    return (
      <div className="chat-log chat-log--empty">
        <p className="chat-log__placeholder">
          Your conversation will appear here...
        </p>
      </div>
    );
  }

  return (
    <div className="chat-log">
      {transcript.map((entry) => (
        <div
          key={entry.id}
          className={`chat-bubble chat-bubble--${entry.role}`}
        >
          <span className="chat-bubble__role">
            {entry.role === "user" ? "You" : "Gemini"}
          </span>
          <p className="chat-bubble__text">{entry.text}</p>
        </div>
      ))}

      {/* Pending user transcription */}
      {pendingUserText.trim() && (
        <div className="chat-bubble chat-bubble--user chat-bubble--pending">
          <span className="chat-bubble__role">You</span>
          <p className="chat-bubble__text">
            {pendingUserText}
            <span className="chat-bubble__cursor" />
          </p>
        </div>
      )}

      {/* Pending assistant transcription */}
      {pendingAssistantText.trim() && (
        <div className="chat-bubble chat-bubble--assistant chat-bubble--pending">
          <span className="chat-bubble__role">Gemini</span>
          <p className="chat-bubble__text">
            {pendingAssistantText}
            <span className="chat-bubble__cursor" />
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
