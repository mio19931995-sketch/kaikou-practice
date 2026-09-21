export {};
export type ServiceConfig = { baseUrl: string; model: string; hasKey: boolean };
export type ServiceInput = {
  baseUrl: string;
  model: string;
  apiKey: string;
  clearKey?: boolean;
};
type Result<T> =
  { success: true; value: T } | { success: false; message: string };
declare global {
  interface Window {
    desktopApp?: {
      platform: string;
      getServiceSettings(): Promise<Result<ServiceConfig>>;
      saveServiceSettings(input: ServiceInput): Promise<Result<ServiceConfig>>;
      testServiceSettings(
        input: ServiceInput,
      ): Promise<Result<{ ok: boolean; message: string }>>;
      restart(): Promise<void>;
    };
  }
}
