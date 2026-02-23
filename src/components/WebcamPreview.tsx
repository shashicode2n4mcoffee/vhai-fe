/**
 * WebcamPreview — Standalone webcam component with getUserMedia.
 *
 * Use this when you DON'T already have a <video> element (e.g. test page).
 * In the interview page, you can skip this and pass the existing
 * VoiceChat video ref to useProctoring() instead.
 *
 * Exposes videoRef via forwardRef so the parent can pass it to useProctoring.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { logErrorToServer } from "../lib/logError";

export interface WebcamPreviewHandle {
  videoElement: HTMLVideoElement | null;
}

interface Props {
  width?: number;
  height?: number;
  mirrored?: boolean;
  className?: string;
}

export const WebcamPreview = forwardRef<WebcamPreviewHandle, Props>(
  function WebcamPreview({ width = 640, height = 360, mirrored = true, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [permError, setPermError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      get videoElement() {
        return videoRef.current;
      },
    }));

    useEffect(() => {
      let cancelled = false;

      async function initCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30 } },
            audio: false, // Audio is handled by the interview pipeline
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : "Camera access denied";
            setPermError(msg);
            console.warn("[WebcamPreview] getUserMedia failed:", msg);
            logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "webcam" });
          }
        }
      }

      void initCamera();

      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    }, [width, height]);

    if (permError) {
      return (
        <div className={`proctor-preview proctor-preview--error ${className ?? ""}`}>
          <div className="proctor-preview__error">
            <CamOffIcon />
            <p>Camera unavailable</p>
            <small>{permError}</small>
          </div>
        </div>
      );
    }

    return (
      <video
        ref={videoRef}
        className={`proctor-preview ${mirrored ? "proctor-preview--mirrored" : ""} ${className ?? ""}`}
        autoPlay
        playsInline
        muted
        width={width}
        height={height}
      />
    );
  },
);

function CamOffIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      <path d="M15 11a3 3 0 0 0-5.22-2" />
    </svg>
  );
}
