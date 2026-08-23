import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AudioRecorderState,
} from "../types/audio";

interface UseAudioRecorderOptions {
  onAudioChunk?: (chunk: Blob) => void;
}

export function useAudioRecorder({
  onAudioChunk,
}: UseAudioRecorderOptions = {}) {
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const [state, setState] =
    useState<AudioRecorderState>({
      status: "idle",
      error: null,
    });

  const startRecording = useCallback(async () => {
    try {
      setState({
        status: "requesting",
        error: null,
      });

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      streamRef.current = stream;

      const recorder = new MediaRecorder(
        stream,
      );

      mediaRecorderRef.current = recorder;

      recorder.onstart = () => {
        setState({
          status: "recording",
          error: null,
        });
      };

      recorder.ondataavailable = (event) => {
        if (
          event.data.size > 0
        ) {
          onAudioChunk?.(
            event.data,
          );
        }
      };

      recorder.onerror = () => {
        setState({
          status: "error",
          error:
            "An error occurred while recording audio.",
        });
      };

      recorder.onstop = () => {
        setState({
          status: "stopped",
          error: null,
        });
      };

      recorder.start(250);
    } catch (error) {
      console.error(
        "Microphone access error:",
        error,
      );

      setState({
        status: "error",
        error:
          "Microphone permission was denied or unavailable.",
      });
    }
  }, [onAudioChunk]);

  const stopRecording = useCallback(() => {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    }

    streamRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !== "inactive"
      ) {
        recorder.stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}