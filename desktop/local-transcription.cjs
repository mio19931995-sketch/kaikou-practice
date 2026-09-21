const { spawn } = require("node:child_process");
function createLocalTranscription({
  script,
  executable = "python",
  timeout = 300000,
}) {
  let ready = false;
  let active;
  function run(args, audio) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, [script, ...args], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8", HF_HUB_OFFLINE: "1" },
      });
      active = child;
      let output = "";
      child.stdout.setEncoding('utf8');
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("本机转写超时，请缩短录音后重试。"));
      }, timeout);
      const done = () => {
        clearTimeout(timer);
        if (active === child) active = undefined;
      };
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
        if (output.length > 100000) child.kill();
      });
      child.stderr.resume();
      child.stdin.on("error", () => {});
      child.on("error", () => {
        done();
        reject(new Error("本机语音识别环境不可用。"));
      });
      child.on("close", (code) => {
        done();
        try {
          const data = JSON.parse(output);
          if (code !== 0 || data.error) throw new Error();
          resolve(data);
        } catch {
          reject(new Error("本机转写未完成，请重试或手动填写文字。"));
        }
      });
      child.stdin.end(audio);
    });
  }
  return {
    async check() {
      try {
        ready = Boolean((await run(["--check"])).ready);
      } catch {
        ready = false;
      }
      return ready;
    },
    available: () => ready,
    async transcribe(buffer) {
      if (!ready) throw new Error("本机语音识别尚未就绪，请稍后重试。");
      if (active) throw new Error("已有录音正在识别，请等待完成。");
      return (await run([], buffer)).text;
    },
    close() {
      active?.kill();
    },
  };
}
module.exports = { createLocalTranscription };
