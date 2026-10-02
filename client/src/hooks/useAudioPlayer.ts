import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";


export interface AudioPlayerOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onPlaybackError?: () => void;
}


export function useAudioPlayer(
  options?: AudioPlayerOptions,
) {
  /*
  |--------------------------------------------------------------------------
  | Current HTML audio element
  |--------------------------------------------------------------------------
  */

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null,
    );


  /*
  |--------------------------------------------------------------------------
  | Playing state
  |--------------------------------------------------------------------------
  */

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);


  /*
  |--------------------------------------------------------------------------
  | Playback callbacks
  |--------------------------------------------------------------------------
  */

  const onPlaybackStartRef =
    useRef<
      (() => void) | undefined
    >(
      options?.onPlaybackStart,
    );


  const onPlaybackEndRef =
    useRef<
      (() => void) | undefined
    >(
      options?.onPlaybackEnd,
    );


  const onPlaybackErrorRef =
    useRef<
      (() => void) | undefined
    >(
      options?.onPlaybackError,
    );


  /*
  |--------------------------------------------------------------------------
  | Keep callback refs current
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    onPlaybackStartRef.current =
      options?.onPlaybackStart;

    onPlaybackEndRef.current =
      options?.onPlaybackEnd;

    onPlaybackErrorRef.current =
      options?.onPlaybackError;
  }, [
    options?.onPlaybackStart,
    options?.onPlaybackEnd,
    options?.onPlaybackError,
  ]);


  /*
  |--------------------------------------------------------------------------
  | Current object URL
  |--------------------------------------------------------------------------
  */

  const objectUrlRef =
    useRef<string | null>(
      null,
    );


  /*
  |--------------------------------------------------------------------------
  | Audio chunks for the current response
  |--------------------------------------------------------------------------
  */

  const chunksRef =
    useRef<Blob[]>([]);


  /*
  |--------------------------------------------------------------------------
  | Playback generation
  |--------------------------------------------------------------------------
  |
  | Every AI audio response gets a unique generation number.
  |
  | This prevents an old audio callback from modifying
  | the state of a newer audio response.
  |
  */

  const generationRef =
    useRef(0);


  /*
  |--------------------------------------------------------------------------
  | Cleanup current audio
  |--------------------------------------------------------------------------
  */

  const cleanupAudio =
    useCallback(() => {
      const audio =
        audioRef.current;


      if (audio) {
        audio.pause();

        audio.onplay =
          null;

        audio.onended =
          null;

        audio.onerror =
          null;

        audio.src = "";

        audioRef.current =
          null;
      }


      const objectUrl =
        objectUrlRef.current;


      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );

        objectUrlRef.current =
          null;
      }
    }, []);


  /*
  |--------------------------------------------------------------------------
  | AUDIO_START
  |--------------------------------------------------------------------------
  */

  const startAudio =
    useCallback(() => {
      console.log(
        "🔊 AI audio started.",
      );


      /*
      * Invalidate any previous
      * playback callbacks.
      */

      generationRef.current += 1;


      /*
      * Stop and clean up any
      * previous audio.
      */

      cleanupAudio();


      /*
      * Remove chunks from the
      * previous response.
      */

      chunksRef.current = [];


      setIsPlaying(false);
    }, [
      cleanupAudio,
    ]);


  /*
  |--------------------------------------------------------------------------
  | Receive audio chunk
  |--------------------------------------------------------------------------
  */

  const addAudioChunk =
    useCallback(
      (chunk: Blob) => {
        if (
          chunk.size === 0
        ) {
          return;
        }


        console.log(
          `🔊 Buffering AI audio chunk: ${chunk.size} bytes`,
        );


        chunksRef.current.push(
          chunk,
        );
      },
      [],
    );


  /*
  |--------------------------------------------------------------------------
  | AUDIO_END
  |--------------------------------------------------------------------------
  */

  const finishAudio =
    useCallback(
      async () => {
        console.log(
          "🔊 AI audio finished. Preparing playback...",
        );


        if (
          chunksRef.current.length ===
          0
        ) {
          console.warn(
            "⚠️ No AI audio chunks received.",
          );

          /*
           * If there was no audio, make sure
           * the caller is not left waiting forever.
           */

          onPlaybackErrorRef.current?.();

          return;
        }


        /*
        |--------------------------------------------------------------------------
        | Capture current playback generation
        |--------------------------------------------------------------------------
        */

        const generation =
          generationRef.current;


        /*
        |--------------------------------------------------------------------------
        | Combine audio chunks
        |--------------------------------------------------------------------------
        */

        const audioBlob =
          new Blob(
            chunksRef.current,
            {
              type:
                "audio/wav",
            },
          );


        /*
        * Clear the chunk array immediately.
        *
        * The Blob now owns the data needed
        * for this playback.
        */

        chunksRef.current = [];


        console.log(
          `🔊 Combined AI audio size: ${audioBlob.size} bytes`,
        );


        /*
        |--------------------------------------------------------------------------
        | Create object URL
        |--------------------------------------------------------------------------
        */

        const objectUrl =
          URL.createObjectURL(
            audioBlob,
          );


        objectUrlRef.current =
          objectUrl;


        /*
        |--------------------------------------------------------------------------
        | Create audio element
        |--------------------------------------------------------------------------
        */

        const audio =
          new Audio();


        audioRef.current =
          audio;


        audio.preload =
          "auto";


        audio.src =
          objectUrl;


        /*
        |--------------------------------------------------------------------------
        | Playback started
        |--------------------------------------------------------------------------
        */

        audio.onplay = () => {
          /*
           * Ignore callbacks from
           * an outdated response.
           */

          if (
            generation !==
            generationRef.current
          ) {
            return;
          }


          console.log(
            "🔊 AI voice playback started.",
          );


          setIsPlaying(true);


          /*
           * Tell useVoiceCall that the AI
           * is actually speaking now.
           */

          onPlaybackStartRef.current?.();
        };


        /*
        |--------------------------------------------------------------------------
        | Playback ended
        |--------------------------------------------------------------------------
        */

        audio.onended = () => {
          if (
            generation !==
            generationRef.current
          ) {
            return;
          }


          console.log(
            "🔊 AI voice playback finished.",
          );


          setIsPlaying(false);


          /*
           * IMPORTANT:
           *
           * The AI has actually finished
           * speaking at this point.
           *
           * useVoiceCall can now safely
           * restart the microphone.
           */

          onPlaybackEndRef.current?.();


          /*
           * Clean up only if this is
           * still the current audio.
           */

          if (
            audioRef.current ===
            audio
          ) {
            audio.onplay =
              null;

            audio.onended =
              null;

            audio.onerror =
              null;

            audio.src = "";

            audioRef.current =
              null;
          }


          if (
            objectUrlRef.current ===
            objectUrl
          ) {
            URL.revokeObjectURL(
              objectUrl,
            );

            objectUrlRef.current =
              null;
          }
        };


        /*
        |--------------------------------------------------------------------------
        | Playback error
        |--------------------------------------------------------------------------
        */

        audio.onerror = () => {
          if (
            generation !==
            generationRef.current
          ) {
            return;
          }


          console.error(
            "❌ AI audio playback failed.",
          );


          setIsPlaying(false);


          /*
           * Let useVoiceCall recover
           * and return to listening.
           */

          onPlaybackErrorRef.current?.();


          if (
            audioRef.current ===
            audio
          ) {
            audio.onplay =
              null;

            audio.onended =
              null;

            audio.onerror =
              null;

            audio.src = "";

            audioRef.current =
              null;
          }


          if (
            objectUrlRef.current ===
            objectUrl
          ) {
            URL.revokeObjectURL(
              objectUrl,
            );

            objectUrlRef.current =
              null;
          }
        };


        /*
        |--------------------------------------------------------------------------
        | Start playback
        |--------------------------------------------------------------------------
        */

        try {
          await audio.play();
        } catch (
          error
        ) {
          if (
            generation !==
            generationRef.current
          ) {
            return;
          }


          console.error(
            "❌ Unable to start AI audio playback:",
            error,
          );


          setIsPlaying(false);


          /*
           * Notify useVoiceCall that
           * playback could not start.
           */

          onPlaybackErrorRef.current?.();


          if (
            audioRef.current ===
            audio
          ) {
            audio.onplay =
              null;

            audio.onended =
              null;

            audio.onerror =
              null;

            audio.src = "";

            audioRef.current =
              null;
          }


          if (
            objectUrlRef.current ===
            objectUrl
          ) {
            URL.revokeObjectURL(
              objectUrl,
            );

            objectUrlRef.current =
              null;
          }
        }
      },
      [],
    );


  /*
  |--------------------------------------------------------------------------
  | Stop audio
  |--------------------------------------------------------------------------
  */

  const stopAudio =
    useCallback(() => {
      console.log(
        "🔇 Stopping AI audio.",
      );


      /*
      * Invalidate all callbacks
      * belonging to the current
      * playback.
      */

      generationRef.current += 1;


      cleanupAudio();


      chunksRef.current = [];


      setIsPlaying(false);
    }, [
      cleanupAudio,
    ]);


  /*
  |--------------------------------------------------------------------------
  | React cleanup
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      generationRef.current += 1;

      cleanupAudio();

      chunksRef.current = [];
    };
  }, [
    cleanupAudio,
  ]);


  /*
  |--------------------------------------------------------------------------
  | Public API
  |--------------------------------------------------------------------------
  */

  return {
    isPlaying,
    startAudio,
    addAudioChunk,
    finishAudio,
    stopAudio,
  };
}