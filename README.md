# 开口练习

一个用于即兴表达、逻辑表达和复述训练的 Windows 桌面应用。选择场景和表达框架，录音或输入文字，再根据 AI 点评进行下一轮练习。

## 下载使用

**[下载 Windows 安装包 v0.7.0](https://github.com/mio19931995-sketch/kaikou-practice/releases/download/v0.7.0/Kaikou-Setup-0.7.0.exe)** · [版本说明](https://github.com/mio19931995-sketch/kaikou-practice/releases)

适用于 Windows x64。安装后从桌面快捷方式启动，无需安装 Node.js。当前安装包未进行代码签名。

1. 打开「设置与说明 → AI 服务配置」。
2. 选择 Agnes AI、DeepSeek、TypeSafe / Jev 或兼容服务，填写自己的 API Key，确认服务地址和模型名。
3. 点击「测试连接」，再点击「保存并生效」。模型权限、额度和费用以服务商账户为准。
4. 选择题目，输入文字或录音。转写文字准备好后可直接生成 AI 点评，不必先修改；发现识别错误时可以修正。

未配置模型时只有明确标注的基础反馈。**安装包支持录音，但不包含本地转写所需的 Python 和语音模型。** 需要转写时请准备下方环境，或配置云端转写；也可直接输入文字练习。

## 功能

- 即兴表达、逻辑表达、复述表达三种训练方式。
- 按汇报、面试、说服、复盘等场景推荐表达结构。
- 15 种表达结构及示例，帮助理解每一步应该说什么。
- 录音、计时、音量显示、回放、下载和转写文字修改。
- Agnes 多维点评：切题与重点、结构与逻辑、事实具体程度、听众与沟通目的、文字清晰简洁、结论与下一步。结合场景给出原话依据、分析、改进建议和优先练习任务。
- Jev 场景规则判断，展示检查结果与置信度。
- 21 天训练计划、历史练习、保存点评与导出文字。

点评基于转写文字，不评价发音、语调或情绪。开放式表达没有唯一标准答案，参考框架中的事实需要自己补充。AI 判断可能有误，请结合实际沟通目的使用。

## 本地语音转文字（可选）

准备可通过 `python` 命令运行的 Python 环境，然后执行：

```powershell
python -m pip install faster-whisper
python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
```

第二条命令首次需要联网下载模型。使用相同 Windows 用户完成下载后重启应用。应用在 CPU 上离线加载已缓存的 small 模型，录音时不会自动下载模型。启动检查未通过时会提示本机转写不可用。

也可在 `%APPDATA%/KaikouPractice/services.env` 配置 `ASR_BASE_URL`、`ASR_API_KEY` 和 `ASR_MODEL`，保存后重启应用，使用兼容的云端转写。点评服务和语音转写服务分别配置。

## 源码运行

需要 Node.js 22.12+ 和 npm。

```powershell
git clone https://github.com/mio19931995-sketch/kaikou-practice.git
cd kaikou-practice
npm ci
npm run build
npm start
```

浏览器访问 http://127.0.0.1:4173 。网页版本需将 `.env.example` 复制为 `.env`，填写自己的服务参数并重启服务。不要上传 `.env` 或密钥。

```powershell
npm run dev           # 网页开发
npm run desktop       # 桌面启动，先执行 npm run build
npm run desktop:pack  # 生成 Windows 安装包
npm test              # 服务与规则测试
npm run test:e2e      # 浏览器流程测试，需要 Microsoft Edge
npm run desktop:test # 桌面流程测试
```

当前服务仅监听本机。手机使用需要可访问的 HTTPS 环境；公开多人服务需要鉴权、额度管理等配套功能。

## 数据与密钥

练习文字、点评和音频保存在本机，不自动跨设备同步。桌面版与浏览器版使用独立存储。删除应用数据前请先导出重要记录。

桌面版 AI 密钥经 Windows 加密后存于 `%APPDATA%/KaikouPractice/ai-service.json`，不会回传到界面。生成 AI 点评会将本次文字、题目和相关参考材料发送给所配置的模型服务；云端转写会发送本次录音。本地转写不上传录音，浏览器语音识别可能依赖浏览器厂商在线服务。

仓库和安装包不含作者的 API 密钥、个人练习记录或操作录屏。

## 项目结构

- `src/`：训练页面、表达结构、录音、历史和设置。
- `server/`：AI 点评、场景规则、转写接口与数据校验。
- `desktop/`：Windows 窗口、配置存储、本地转写与打包。
- `tests/`：服务和交互测试。
- [Agnes 点评规则](docs/agnes-coach.md) · [Jev 场景规则](docs/jev-rules.md)
