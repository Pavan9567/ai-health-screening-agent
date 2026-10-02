import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWebSocket, } from "./useWebSocket";
import { useAudioRecorder, } from "./useAudioRecorder";
import { useAudioPlayer, } from "./useAudioPlayer";
import type { CallStatus, HealthScreeningReport, TranscriptMessage, } from "../types/call";
import type { ServerMessage, } from "../types/websocket";


const WS_URL =
  import.meta.env.VITE_WS_URL ??
  "ws://localhost:4000/ws/call";


export function useVoiceCall() {
  /*
  |--------------------------------------------------------------------------
  | Call status
  |--------------------------------------------------------------------------
  */

  const [
    status,
    setStatus,
  ] = useState<CallStatus>(
    "idle",
  );


  /*
  |--------------------------------------------------------------------------
  | Conversation messages
  |--------------------------------------------------------------------------
  */

  const [
    messages,
    setMessages,
  ] = useState<TranscriptMessage[]>([]);

  const [
    liveTranscript,
    setLiveTranscript,
  ] = useState("");

  const pendingAiResponseRef =
    useRef<string | null>(
      null,
    );

  const fallbackSpeechActiveRef = useRef(false);

  const [
    callId,
    setCallId,
  ] = useState<string | null>(
    null,
  );

  const callIdRef =
    useRef<string | null>(
      null,
    );

  const [
    screeningReport,
    setScreeningReport,
  ] = useState<HealthScreeningReport | null>(
    null,
  );

  const screeningReportRef =
    useRef<HealthScreeningReport | null>(
      null,
    );

  const [
    isThinking,
    setIsThinking,
  ] = useState(false);

  const statusRef =
    useRef<CallStatus>(
      "idle",
    );

  useEffect(() => {
    statusRef.current =
      status;
  }, [
    status,
  ]);

  useEffect(() => {
    callIdRef.current =
      callId;
  }, [
    callId,
  ]);


  /*
  |--------------------------------------------------------------------------
  | WebSocket
  |--------------------------------------------------------------------------
  */

  const {
    connect,
    send,
    sendAudio,
    disconnect,
  } = useWebSocket();


  /*
  |--------------------------------------------------------------------------
  | AI Audio Player
  |--------------------------------------------------------------------------
  */

  const {
    isPlaying,
    startAudio,
    addAudioChunk,
    finishAudio,
    stopAudio,
  } = useAudioPlayer({
    /*
    |--------------------------------------------------------------------------
    | AI playback started
    |--------------------------------------------------------------------------
    */

    onPlaybackStart: () => {
      const response =
        pendingAiResponseRef.current;


      if (!response) {
        console.warn(
          "⚠️ AI playback started without a pending AI response.",
        );

        setIsThinking(false);

        return;
      }


      console.log(
        "🤖 AI message displayed as playback started:",
        response,
      );


      /*
      * AI is no longer thinking.
      *
      * It is now actually speaking.
      */

      setIsThinking(false);


      /*
      * Add AI response to visible conversation.
      */

      setMessages(
        (
          currentMessages,
        ) => [
          ...currentMessages,
          {
            id:
              crypto.randomUUID(),

            speaker:
              "assistant",

            text:
              response,

            timestamp:
              new Date()
                .toISOString(),
          },
        ],
      );


      /*
      * Response has now been consumed.
      */

      pendingAiResponseRef.current =
        null;
    },


    /*
    |--------------------------------------------------------------------------
    | AI playback finished
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | This fires only after the browser has actually
    | finished playing the complete AI response.
    |
    | Only now do we enable the microphone again.
    |
    */

    onPlaybackEnd: () => {
      console.log(
        "AI finished speaking.",
      );

      if (statusRef.current === "ended" || statusRef.current === "idle") {
        return;
      }

      setIsThinking(false);

      /* SCREENING COMPLETE */
      if (screeningReportRef.current) {
        console.log(
          "Final screening audio finished. Ending completed call.",
        );

        stopRecording();

        setStatus(
          "processing",
        );

        send({
          type:
            "END_CALL",

          callId:
            callIdRef.current ??
            undefined,
        });

        return;
      }

      /* Normal conversation turn */
      console.log(
        "Starting microphone for next user response.",
      );

      setStatus(
        "active",
      );

      void startRecording();
    },


    /*
    |--------------------------------------------------------------------------
    | AI playback error
    |--------------------------------------------------------------------------
    |
    | If browser playback fails, don't leave the
    | user permanently stuck in "Thinking..."
    |
    */

    onPlaybackError: () => {
      console.error(
        "AI playback failed.",
      );

      setIsThinking(false);

      if (statusRef.current === "ended" || statusRef.current === "idle") {
        return;
      }

      if (screeningReportRef.current) {
        console.log(
          "Final screening audio failed. Ending completed call.",
        );

        stopRecording();

        setStatus(
          "processing",
        );

        send({
          type: "END_CALL",
          callId:
            callIdRef.current ??
            undefined,
        });

        return;
      }

      console.log(
        "Returning to listening after playback failure.",
      );

      setStatus(
        "active",
      );

      void startRecording();
    },
  });

  const {
    status: audioStatus,
    error: audioError,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onAudioChunk:
      sendAudio,
  });

  /*
  |--------------------------------------------------------------------------
  | Browser Speech Fallback
  |--------------------------------------------------------------------------
  |
  | Gemini TTS can temporarily become unavailable because of
  | API quota/rate limits. In that case, use the browser's
  | built-in speech synthesis so the user still hears the
  | final AI response.
  |
  */

  const speakWithBrowserFallback =
  useCallback(
    (text: string) => {
      if (
        !text.trim() ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        console.warn(
          "Browser speech synthesis is unavailable.",
        );

        return;
      }

      console.log(
        "Using browser speech fallback.",
      );

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          text,
        );

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      fallbackSpeechActiveRef.current =
        true;

      utterance.onstart = () => {
        console.log(
          "Browser fallback speech started.",
        );

        setIsThinking(false);

        setMessages(
          (
            currentMessages,
          ) => [
            ...currentMessages,
            {
              id:
                crypto.randomUUID(),
              speaker:
                "assistant",
              text,
              timestamp:
                new Date()
                  .toISOString(),
            },
          ],
        );

        pendingAiResponseRef.current =
          null;
      };

      utterance.onend = () => {
        console.log(
          "Browser fallback speech finished.",
        );

        fallbackSpeechActiveRef.current =
          false;

        if (
          screeningReportRef.current
        ) {
          console.log(
            "📋 Final screening fallback speech finished. Ending completed call.",
          );

          stopRecording();

          setStatus(
            "processing",
          );

          send({
            type: "END_CALL",
            callId:
              callIdRef.current ??
              undefined,
          });

          return;
        }

        setStatus(
          "active",
        );

        void startRecording();
      };

      utterance.onerror = (
        error,
      ) => {
        console.error(
          "Browser fallback speech failed:",
          error,
        );

        fallbackSpeechActiveRef.current =
          false;

        pendingAiResponseRef.current =
          null;

        setIsThinking(false);

        if (
          screeningReportRef.current
        ) {
          stopRecording();

          setStatus(
            "processing",
          );

          send({
            type: "END_CALL",
            callId:
              callIdRef.current ??
              undefined,
          });

          return;
        }

        setStatus(
          "active",
        );

        void startRecording();
      };

      window.speechSynthesis.speak(
        utterance,
      );
    },
    [
      send,
      startRecording,
      stopRecording,
    ],
  );


  /*
  |--------------------------------------------------------------------------
  | Handle Server Messages
  |--------------------------------------------------------------------------
  */

  const handleMessage =
    useCallback(
      (
        message: ServerMessage,
      ) => {
        console.log(
          "Server WebSocket message:",
          message,
        );


        switch (
          message.type
        ) {
          /*
          |--------------------------------------------------------------------------
          | WEBSOCKET CONNECTED
          |--------------------------------------------------------------------------
          */

          case "CONNECTED": {
            console.log(
              "WebSocket connected:",
              message.message,
            );

            break;
          }


          /*
          |--------------------------------------------------------------------------
          | CALL STARTED
          |--------------------------------------------------------------------------
          |
          | IMPORTANT:
          |
          | Do NOT start the microphone here.
          |
          | The initial AI greeting must play first.
          |
          */

          case "CALL_STARTED": {
            setCallId(
              message.callId ??
                null,
            );


            setStatus(
              "active",
            );


            setIsThinking(
              false,
            );


            console.log(
              "Call started. Waiting for AI greeting.",
            );


            break;
          }


          /*
          |--------------------------------------------------------------------------
          | TRANSCRIPT
          |--------------------------------------------------------------------------
          */

          case "TRANSCRIPT": {
            const transcript =
              message.transcript
                ?.trim();


            if (!transcript) {
              break;
            }


            console.log(
              "Transcript received:",
              transcript,
              "Final:",
              message.isFinal,
            );


            /*
            |--------------------------------------------------------------------------
            | INTERIM TRANSCRIPT
            |--------------------------------------------------------------------------
            |
            | User is currently speaking.
            |
            */

            if (
              !message.isFinal
            ) {
              /*
              * Ignore interim transcripts while
              * the AI is speaking.
              *
              * This protects the UI from accidentally
              * displaying the AI's own voice as user text.
              */

              if (
                isPlaying
              ) {
                break;
              }


              setLiveTranscript(
                transcript,
              );


              break;
            }


            /*
            |--------------------------------------------------------------------------
            | FINAL TRANSCRIPT
            |--------------------------------------------------------------------------
            |
            | User has finished speaking.
            |
            */

            console.log(
              "🎙️ Final transcript:",
              transcript,
            );


            /*
            * Permanently add the user message.
            */

            setMessages(
              (
                currentMessages,
              ) => [
                ...currentMessages,
                {
                  id:
                    crypto.randomUUID(),

                  speaker:
                    "user",

                  text:
                    transcript,

                  timestamp:
                    new Date()
                      .toISOString(),
                },
              ],
            );


            /*
            * Clear the temporary live transcript.
            */

            setLiveTranscript(
              "",
            );


            /*
            |--------------------------------------------------------------------------
            | STOP MICROPHONE
            |--------------------------------------------------------------------------
            |
            | This is critical.
            |
            | Once Deepgram gives us a FINAL transcript,
            | the user has finished speaking.
            |
            | Stop sending microphone chunks while Gemini
            | is processing.
            |
            */

            console.log(
              "🎙️ User finished speaking. Stopping microphone.",
            );


            stopRecording();


            /*
            |--------------------------------------------------------------------------
            | SHOW THINKING STATE
            |--------------------------------------------------------------------------
            */

            setIsThinking(
              true,
            );


            setStatus(
              "processing",
            );


            break;
          }


          /*
          |--------------------------------------------------------------------------
          | AI RESPONSE
          |--------------------------------------------------------------------------
          */

          case "AI_RESPONSE": {
            const response =
              message.response
                ?.trim();


            if (!response) {
              break;
            }


            console.log(
              "🤖 AI response received:",
              response,
            );


            /*
            * Do not display the AI message yet.
            *
            * It will be displayed by onPlaybackStart
            * when the actual audio begins playing.
            */

            pendingAiResponseRef.current =
              response;


            break;
          }

          /*
          |--------------------------------------------------------------------------
          | SCREENING COMPLETE
          |--------------------------------------------------------------------------
          */

          case "SCREENING_COMPLETE": {
            if (!message.report) {
              console.warn(
                "SCREENING_COMPLETE received without a report.",
              );

              break;
            }

            console.log(
              "Final health screening report received:",
              message.report,
            );

            setScreeningReport(
              message.report,
            );

            screeningReportRef.current = message.report;

            break;
          }

          /*
          |--------------------------------------------------------------------------
          | AUDIO START
          |--------------------------------------------------------------------------
          */

          case "AUDIO_START": {
            console.log(
              "🔊 AI audio stream started.",
            );


            /*
            * Ensure microphone is not recording
            * while AI is speaking.
            */

            stopRecording();


            /*
            * Tell audio player a new response
            * is beginning.
            */

            startAudio();


            break;
          }


          /*
          |--------------------------------------------------------------------------
          | AUDIO END
          |--------------------------------------------------------------------------
          */

          case "AUDIO_END": {
            console.log(
              "🔊 AI audio stream ended.",
            );


            /*
            * finishAudio() creates the browser
            * audio element and starts playback.
            *
            * Microphone will NOT restart here.
            *
            * It restarts from onPlaybackEnd only
            * after actual playback completes.
            */

            void finishAudio();


            break;
          }


          /*
          |--------------------------------------------------------------------------
          | CALL ENDED
          |--------------------------------------------------------------------------
          */

          case "CALL_ENDED": {
            console.log(
              "📞 Call ended.",
            );


            stopRecording();


            stopAudio();


            pendingAiResponseRef.current =
              null;


            setIsThinking(
              false,
            );


            setLiveTranscript(
              "",
            );


            setStatus(
              "ended",
            );


            disconnect();


            break;
          }


          /*
          |--------------------------------------------------------------------------
          | SERVER ERROR
          |--------------------------------------------------------------------------
          */

          case "ERROR": {
            console.error(
              "WebSocket error:",
              message.message,
            );

            /*
            |--------------------------------------------------------------------------
            | Gemini TTS fallback
            |--------------------------------------------------------------------------
            |
            | The AI text response was already generated successfully,
            | but Gemini TTS may fail because of a rate limit/quota.
            |
            | In that case, use browser speech synthesis instead of
            | treating the entire call as failed.
            |
            */

            const pendingResponse =
              pendingAiResponseRef.current;

            const isTtsFailure =
              message.message ===
              "AI voice generation failed. The text response is still available.";

            if (
              isTtsFailure &&
              pendingResponse
            ) {
              console.warn(
                "Gemini TTS unavailable. Falling back to browser speech.",
              );

              stopAudio();

              setIsThinking(
                false,
              );

              speakWithBrowserFallback(
                pendingResponse,
              );

              break;
            }

            /*
            |--------------------------------------------------------------------------
            | Normal server error
            |--------------------------------------------------------------------------
            */

            stopRecording();

            stopAudio();

            pendingAiResponseRef.current =
              null;

            setIsThinking(
              false,
            );

            setLiveTranscript(
              "",
            );

            disconnect();

            setStatus(
              "idle",
            );

            break;
          }


          /*
          |--------------------------------------------------------------------------
          | PONG
          |--------------------------------------------------------------------------
          */

          case "PONG": {
            console.log(
              "WebSocket pong received.",
            );

            break;
          }


          /*
          |--------------------------------------------------------------------------
          | UNKNOWN
          |--------------------------------------------------------------------------
          */

          default: {
            console.warn(
              "Unknown server message:",
              message,
            );
          }
        }
      },
      [
        disconnect,
        finishAudio,
        isPlaying,
        speakWithBrowserFallback,
        startAudio,
        stopAudio,
        stopRecording,
      ],
    );


  /*
  |--------------------------------------------------------------------------
  | Handle Binary AI Audio
  |--------------------------------------------------------------------------
  */

  const handleAudio =
    useCallback(
      (
        audio: Blob,
      ) => {
        console.log(
          `🔊 AI audio chunk received: ${audio.size} bytes`,
        );


        addAudioChunk(
          audio,
        );
      },
      [
        addAudioChunk,
      ],
    );


  /*
  |--------------------------------------------------------------------------
  | START CALL
  |--------------------------------------------------------------------------
  */

  const startCall =
    useCallback(
      () => {
        /*
        |--------------------------------------------------------------------------
        | Reset previous conversation
        |--------------------------------------------------------------------------
        */

        setMessages(
          [],
        );


        setLiveTranscript(
          "",
        );


        setCallId(
          null,
        );

        setScreeningReport(
          null,
        );

        screeningReportRef.current = null;

        stopRecording();

        stopAudio();

        pendingAiResponseRef.current = null;

        setIsThinking(
          false,
        );

        setStatus(
          "connecting",
        );

        /*
        |--------------------------------------------------------------------------
        | Connect WebSocket
        |--------------------------------------------------------------------------
        */

        connect(
          WS_URL,
          {
            /*
            |--------------------------------------------------------------------------
            | WebSocket OPEN
            |--------------------------------------------------------------------------
            */

            onOpen: () => {
              console.log(
                "WebSocket connection opened.",
              );


              send({
                type:
                  "START_CALL",
              });
            },


            /*
            |--------------------------------------------------------------------------
            | JSON messages
            |--------------------------------------------------------------------------
            */

            onMessage:
              handleMessage,


            /*
            |--------------------------------------------------------------------------
            | Binary audio
            |--------------------------------------------------------------------------
            */

            onAudio:
              handleAudio,


            /*
            |--------------------------------------------------------------------------
            | WebSocket CLOSE
            |--------------------------------------------------------------------------
            */

            onClose: () => {
              console.log(
                "WebSocket connection closed.",
              );


              stopRecording();


              stopAudio();
            },


            /*
            |--------------------------------------------------------------------------
            | WebSocket ERROR
            |--------------------------------------------------------------------------
            */

            onError: (
              error,
            ) => {
              console.error(
                "WebSocket connection error:",
                error,
              );


              stopRecording();


              stopAudio();


              pendingAiResponseRef.current =
                null;


              setIsThinking(
                false,
              );


              setLiveTranscript(
                "",
              );


              setStatus(
                "idle",
              );
            },
          },
        );
      },
      [
        connect,
        handleAudio,
        handleMessage,
        send,
        stopAudio,
        stopRecording,
      ],
    );


  /*
  |--------------------------------------------------------------------------
  | END CALL
  |--------------------------------------------------------------------------
  */

  const endCall =
    useCallback(
      () => {
        console.log(
          "Ending call...",
        );


        stopRecording();


        stopAudio();

        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }

        fallbackSpeechActiveRef.current = false;

        pendingAiResponseRef.current = null;

        setIsThinking(
          false,
        );

        setLiveTranscript(
          "",
        );

        send({
          type:
            "END_CALL",

          callId:
            callId ??
            undefined,
        });
      },
      [
        callId,
        send,
        stopAudio,
        stopRecording,
      ],
    );


  /*
  |--------------------------------------------------------------------------
  | Return public state
  |--------------------------------------------------------------------------
  */

  return {
    status,

    messages,

    liveTranscript,

    isThinking,

    callId,

    screeningReport,

    audioStatus,

    audioError,

    isAiSpeaking: isPlaying,

    startCall,

    endCall,
  };
}