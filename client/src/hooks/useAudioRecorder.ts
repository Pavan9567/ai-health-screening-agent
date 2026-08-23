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

  const startRecording =
    useCallback(async () => {
      /*
       * Prevent starting multiple recorders.
       */
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !==
          "inactive"
      ) {
        return;
      }

      try {
        setState({
          status: "requesting",
          error: null,
        });

        /*
         * Check browser support.
         */
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Microphone access is not supported by this browser.",
          );
        }

        if (
          typeof MediaRecorder ===
          "undefined"
        ) {
          throw new Error(
            "MediaRecorder is not supported by this browser.",
          );
        }

        /*
         * Request microphone.
         */
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            },
          );

        streamRef.current = stream;

        /*
         * Select a browser-supported audio format.
         */
        const preferredMimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
        ];

        const mimeType =
          preferredMimeTypes.find(
            (type) =>
              MediaRecorder.isTypeSupported(
                type,
              ),
          );

        console.log(
          "🎙️ Selected audio MIME type:",
          mimeType ?? "browser default",
        );

        const recorder =
          mimeType
            ? new MediaRecorder(
                stream,
                {
                  mimeType,
                },
              )
            : new MediaRecorder(
                stream,
              );

        mediaRecorderRef.current =
          recorder;

        /*
         * Recording started.
         *
         * Update the UI immediately.
         */
        recorder.onstart = () => {
          console.log(
            "🎙️ MediaRecorder started.",
          );

          setState({
            status: "recording",
            error: null,
          });
        };

        /*
         * Audio chunks.
         */
        recorder.ondataavailable = (
          event,
        ) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            onAudioChunk?.(
              event.data,
            );
          }
        };

        /*
         * Recorder error.
         */
        recorder.onerror = (
          event,
        ) => {
          console.error(
            "🎙️ MediaRecorder error:",
            event,
          );

          setState({
            status: "error",
            error:
              "An error occurred while recording audio.",
          });
        };

        /*
         * Recording stopped.
         */
        recorder.onstop = () => {
          console.log(
            "🎙️ MediaRecorder stopped.",
          );

          setState({
            status: "stopped",
            error: null,
          });
        };

        /*
         * Start recording.
         *
         * 250ms timeslice means that
         * audio chunks are emitted roughly
         * every 250 milliseconds.
         */
        recorder.start(250);

        /*
         * Safety fallback.
         *
         * Some browsers can delay the onstart
         * event. If the recorder is already
         * recording, reflect that in React.
         */
        if (
          recorder.state ===
          "recording"
        ) {
          setState({
            status: "recording",
            error: null,
          });
        }
      } catch (error) {
        console.error(
          "🎙️ Microphone access error:",
          error,
        );

        /*
         * Clean up any partially-created stream.
         */
        streamRef.current
          ?.getTracks()
          .forEach(
            (track) =>
              track.stop(),
          );

        streamRef.current = null;
        mediaRecorderRef.current =
          null;

        const errorMessage =
          error instanceof DOMException
            ? getMicrophoneErrorMessage(
                error,
              )
            : error instanceof Error
              ? error.message
              : "Unable to access the microphone.";

        setState({
          status: "error",
          error: errorMessage,
        });
      }
    }, [onAudioChunk]);

  const stopRecording =
    useCallback(() => {
      console.log(
        "🎙️ Stopping microphone...",
      );

      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !==
          "inactive"
      ) {
        recorder.stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) => {
            track.stop();
          },
        );

      streamRef.current = null;
      mediaRecorderRef.current =
        null;

      setState({
        status: "stopped",
        error: null,
      });
    }, []);

  useEffect(() => {
    return () => {
      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !==
          "inactive"
      ) {
        recorder.stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}

/*
 * Convert browser microphone errors
 * into messages that are useful to the user.
 */
function getMicrophoneErrorMessage(
  error: DOMException,
): string {
  switch (error.name) {
    case "NotAllowedError":
      return "Microphone permission was denied. Please allow microphone access in your browser settings.";

    case "NotFoundError":
      return "No microphone was found. Please connect a microphone and try again.";

    case "NotReadableError":
      return "The microphone is already being used by another application.";

    case "SecurityError":
      return "Microphone access is blocked because this page is not running in a secure context.";

    case "AbortError":
      return "Microphone access was interrupted. Please try again.";

    default:
      return "Unable to access the microphone. Please check your browser permissions.";
  }
}