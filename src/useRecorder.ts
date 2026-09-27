import { useEffect, useRef, useState } from "react";

type SpeechEvent = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export const speechSupported = () =>
  Boolean(
    !window.desktopApp &&
    ((window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition),
  );

async function toWav(blob: Blob, context: AudioContext): Promise<Blob> {
  const audio = await context.decodeAudioData(await blob.arrayBuffer());
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(audio.duration * 16000),
    16000,
  );
  const source = offline.createBufferSource();
  source.buffer = audio;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const string = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  string(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useRecorder(maxSeconds = 60) {
  const [phase, setPhase] = useState<
    "idle" | "requesting" | "ready" | "recording" | "processing" | "done"
  >("idle");
  const [blob, setBlob] = useState<Blob>();
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const stream = useRef<MediaStream | undefined>(undefined);
  const context = useRef<AudioContext | undefined>(undefined);
  const analyser = useRef<AnalyserNode | undefined>(undefined);
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const recognition = useRef<Recognition | undefined>(undefined);
  const started = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const speechFinished = useRef<Promise<void> | undefined>(undefined);
  const finishSpeech = useRef<(() => void) | undefined>(undefined);
  const closeContext = () => {
    if (context.current && context.current.state !== "closed")
      void context.current.close().catch(() => {});
  };
  const release = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timer.current);
    try {
      recognition.current?.stop();
    } catch {
      /* Already stopped. */
    }
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
      closeContext();
    };
  }, []);
  async function prepare() {
    setError("");
    setSpeechError("");
    setPhase("requesting");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "此浏览器暂不支持录音。请使用 HTTPS 或本机 localhost 打开，或改用文字练习。",
      );
      setPhase("idle");
      return false;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return false;
      }
      stream.current = media;
      context.current = new AudioContext();
      await context.current.resume();
      analyser.current = context.current.createAnalyser();
      analyser.current.fftSize = 256;
      context.current.createMediaStreamSource(media).connect(analyser.current);
      setBlob(undefined);
      setTranscript("");
      setSeconds(0);
      setPhase("ready");
      return true;
    } catch (e) {
      release();
      closeContext();
      setPhase("idle");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "麦克风权限未开启。请在浏览器的网站设置中允许麦克风，然后重试；也可以用文字练习。"
          : "无法打开麦克风，请检查设备是否可用，或改用文字练习。",
      );
      return false;
    }
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  function start(browserSpeech: boolean) {
    if (!stream.current || !context.current) return;
    const limit = [30, 60, 90, 180].includes(maxSeconds) ? maxSeconds : 60;
    const preferred = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    try {
      const instance = new MediaRecorder(
        stream.current,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorder.current = instance;
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onerror = () => {
        release();
        if (mounted.current) {
          setError("录音中断，请检查麦克风后重试。");
          setPhase("idle");
        }
      };
      instance.onstop = async () => {
        release();
        if (!mounted.current) return;
        setPhase("processing");
        setSeconds(
          Math.min(
            limit,
            Math.max(1, Math.round((Date.now() - started.current) / 1000)),
          ),
        );
        const raw = new Blob(chunks, { type: instance.mimeType });
        try {
          const wav = await toWav(raw, context.current!);
          if (mounted.current) setBlob(wav);
        } catch {
          if (mounted.current) {
            setBlob(raw);
            setSpeechError(
              "录音已保留为原始格式；若云端转写不支持，可手动填写内容。",
            );
          }
        } finally {
          if (speechFinished.current)
            await Promise.race([
              speechFinished.current,
              new Promise((resolve) => setTimeout(resolve, 1200)),
            ]);
          closeContext();
          if (mounted.current) setPhase("done");
        }
      };
      instance.start(250);
      started.current = Date.now();
      setPhase("recording");
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(Math.min(limit, elapsed));
        if (elapsed >= limit) stop();
      }, 250);
      const Speech =
        (window as SpeechWindow).SpeechRecognition ||
        (window as SpeechWindow).webkitSpeechRecognition;
      if (browserSpeech && Speech) {
        speechFinished.current = new Promise((resolve) => {
          finishSpeech.current = resolve;
        });
        const speech = new Speech();
        recognition.current = speech;
        speech.lang = "zh-CN";
        speech.continuous = true;
        speech.interimResults = true;
        speech.onresult = (event) => {
          let text = "";
          for (let i = 0; i < event.results.length; i++)
            text += event.results[i][0].transcript;
          if (mounted.current) setTranscript(text);
        };
        speech.onend = () => finishSpeech.current?.();
        speech.onerror = (event) => {
          finishSpeech.current?.();
          if (mounted.current && event.error !== "aborted")
            setSpeechError(
              "浏览器转写暂未成功，录音仍在继续。结束后可手动填写，或使用已配置的云端转写。",
            );
        };
        try {
          speech.start();
        } catch {
          finishSpeech.current?.();
          setSpeechError("浏览器转写没有启动，录音不受影响。");
        }
      }
    } catch {
      release();
      setError("此浏览器无法启动录音，请换一个浏览器或用文字练习。");
      setPhase("idle");
    }
  }
  useEffect(() => {
    if (phase !== "recording") return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [phase]);
  function reset() {
    release();
    closeContext();
    speechFinished.current = undefined;
    finishSpeech.current = undefined;
    setPhase("idle");
    setBlob(undefined);
    setTranscript("");
    setSeconds(0);
    setError("");
    setSpeechError("");
  }
  return {
    phase,
    blob,
    seconds,
    transcript,
    error,
    speechError,
    analyser,
    prepare,
    start,
    stop,
    reset,
  };
}
