import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

interface Props {
  source: string | string[] | null | undefined;
  /** If `array`, render each item as a separate block in order. */
}

const COMPONENTS = {
  // Keep paragraphs as plain wrappers — fit-text controls font sizes outside.
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: 0 }}>{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ margin: 0, paddingLeft: "1.2em" }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ margin: 0, paddingLeft: "1.4em" }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ margin: 0 }}>{children}</li>
  ),
};

export function MdBlock({ source }: Props) {
  if (source == null) return null;
  const items = Array.isArray(source) ? source : [source];
  return (
    <>
      {items.map((s, i) => (
        <ReactMarkdown
          key={i}
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={COMPONENTS}
        >
          {s}
        </ReactMarkdown>
      ))}
    </>
  );
}
