import { go } from "./components";
function SectionTabs({
  active,
  label,
  items,
}: {
  active: string;
  label: string;
  items: { path: string; label: string }[];
}) {
  return (
    <nav className="section-tabs" aria-label={label}>
      {items.map((item) => (
        <a
          href={`#${item.path}`}
          key={item.path}
          onClick={(event) => {
            event.preventDefault();
            go(item.path);
          }}
          aria-current={active === item.path ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
export function MethodsTabs({ active }: { active: string }) {
  return (
    <SectionTabs
      active={active}
      label="方法学习分类"
      items={[
        { path: "/thinking", label: "思维框架" },
        { path: "/structures", label: "表达结构" },
        { path: "/plan", label: "21 天计划" },
      ]}
    />
  );
}
export function TrainingTabs({ active }: { active: string }) {
  return (
    <SectionTabs
      active={active}
      label="训练方式"
      items={[
        { path: "/practice/improv", label: "即兴表达" },
        { path: "/logic", label: "场景表达" },
        { path: "/library", label: "复述练习" },
      ]}
    />
  );
}
