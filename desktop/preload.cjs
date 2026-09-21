const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desktopApp",
  Object.freeze({
    platform: "windows",
    getServiceSettings: () => ipcRenderer.invoke("kaikou:service-read"),
    saveServiceSettings: (input) =>
      ipcRenderer.invoke("kaikou:service-save", input),
    testServiceSettings: (input) =>
      ipcRenderer.invoke("kaikou:service-test", input),
    restart: () => ipcRenderer.invoke("kaikou:restart"),
  }),
);
