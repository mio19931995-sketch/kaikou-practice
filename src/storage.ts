import type { Session } from "./types";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("kaikou-practice", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("sessions", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = undefined;
        reject(
          new Error("无法打开本机存储。请检查浏览器是否允许保存网站数据。"),
        );
      };
    });
  return dbPromise;
}
export async function saveSession(session: Session): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("保存失败，可能是浏览器存储空间不足。请先下载录音。"));
    tx.onabort = () => reject(new Error("保存被中断，请重试或下载录音。"));
  });
}
export async function getSessions(): Promise<Session[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("sessions")
      .objectStore("sessions")
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as Session[]).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    request.onerror = () => reject(new Error("读取历史记录失败。"));
  });
}
export async function deleteSession(id: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    tx.objectStore("sessions").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("删除失败，请重试。"));
  });
}
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function completedDays(sessions: Session[]) {
  return new Set(sessions.filter((s) => s.lessonDay).map((s) => s.lessonDay!));
}
export function streak(sessions: Session[]) {
  const dates = new Set(sessions.map((s) => dateKey(new Date(s.createdAt))));
  const cursor = new Date();
  let count = 0;
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(dateKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
