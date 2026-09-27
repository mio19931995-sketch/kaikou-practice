import type { Feedback, ServiceStatus, Session } from "./types";
async function jsonResponse(response: Response) {
  const data = await response
    .json()
    .catch(() => ({ error: "服务暂时不可用，请稍后再试。" }));
  if (!response.ok) throw new Error(data.error || "请求没有完成，请重试。");
  return data;
}
export async function getStatus(): Promise<ServiceStatus> {
  try {
    return {
      ...(await jsonResponse(
        await fetch("/api/status", { signal: AbortSignal.timeout(5000) }),
      )),
      reachable: true,
    };
  } catch {
    return { ai: false, asr: false, reachable: false };
  }
}
export async function analyze(session: Session): Promise<Feedback> {
  try {
    return await jsonResponse(
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: session.transcript,
          mode: session.mode,
          topic: session.topic,
          duration: session.duration,
          framework: session.framework,
          material: session.material,
          ruleProfile: session.ruleProfile,
          thinkingModelId: session.thinkingModelId,
        }),
        signal: AbortSignal.timeout(100000),
      }),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      throw new Error(
        "等待 AI 结果超时。内容已保留，请稍后重试；无需重新录音。",
      );
    if (error instanceof TypeError)
      throw new Error(
        "未能连接点评服务。请检查网络或重新打开应用，再重试；无需重新录音。",
      );
    throw error;
  }
}
export async function transcribe(blob: Blob): Promise<string> {
  const body = new FormData();
  body.append(
    "audio",
    blob,
    `recording.${blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") ? "m4a" : "webm"}`,
  );
  const data = await jsonResponse(
    await fetch("/api/transcribe", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(310000),
    }),
  );
  return data.text;
}
