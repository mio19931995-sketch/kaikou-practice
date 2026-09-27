import { useRef, useState } from "react";
import { thinkingModels } from "./thinkingData";

export function ThinkingIllustration({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(100);
  const [failed, setFailed] = useState(false);
  const model = thinkingModels.find((m) => m.id === id);
  if (!model) return null;
  const source = `/thinking-illustrations/${id}-${id === "batna" ? "v2" : "v1"}.png`;
  return (
    <section id="lesson-picture" className="knowledge-picture">
      <span className="lesson-kicker">一图看懂 / 方法全貌</span>
      <h2>{model.name} · 知识图</h2>
      <p>先看图中的关系和步骤，再结合下面的案例理解。点击图片可以放大阅读。</p>
      {failed ? (
        <p role="alert">
          知识图暂时未能加载，请重新打开本页。下面的文字与交互图解仍可阅读。
        </p>
      ) : (
        <button
          className="knowledge-preview"
          aria-label={`放大${model.name}知识图`}
          onClick={() => {
            setZoom(100);
            dialog.current?.showModal();
          }}
        >
          <img
            src={source}
            alt={`${model.name}知识图：${model.summary} 图中包含步骤、应用案例与使用提醒。`}
            onError={() => setFailed(true)}
          />
          <span>点击放大 · 查看流程与案例 ↗</span>
        </button>
      )}
      <p className="knowledge-caption">
        配图为学习示意，案例与条件详见本课文字；图中编号仅用于图集索引。
      </p>
      <dialog
        ref={dialog}
        className="knowledge-dialog"
        aria-labelledby={`picture-title-${id}`}
        onClose={() => setZoom(100)}
      >
        <div className="knowledge-toolbar">
          <strong id={`picture-title-${id}`}>{model.name} · 知识图</strong>
          <button
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="关闭知识图"
          >
            关闭 ×
          </button>
        </div>
        <div className="knowledge-controls">
          <label>
            缩放{" "}
            <input
              aria-label="知识图缩放"
              type="range"
              min="100"
              max="200"
              step="25"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />{" "}
            {zoom}%
          </label>
          <button onClick={() => setZoom(100)}>适合宽度</button>
          <a href={source} download={`${model.name}-知识图.png`}>
            下载原图 ↓
          </a>
        </div>
        <div className="knowledge-canvas">
          <img
            src={source}
            style={{ width: `${zoom}%` }}
            alt={`${model.name}完整知识图`}
          />
        </div>
      </dialog>
    </section>
  );
}
