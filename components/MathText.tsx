"use client";
import katex from "katex";
import { useMemo } from "react";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Renders plain text with:
 *  - $inline$ and $$display$$ KaTeX math
 *  - ```code blocks```
 *  - line breaks
 *  - "[blank]" or 3+ underscores → a printable blank
 */
export function renderRich(text: string): string {
  if (!text) return "";
  const out: string[] = [];
  const re = /```([\s\S]*?)```|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const plain = (s: string) =>
    esc(s)
      .replace(/\[blank\]|_{3,}/gi, '<span style="display:inline-block;min-width:22mm;border-bottom:0.25mm solid #000">&nbsp;</span>')
      .replace(/\n/g, "<br/>");
  while ((m = re.exec(text))) {
    out.push(plain(text.slice(last, m.index)));
    if (m[1] !== undefined) out.push(`<pre class="code">${esc(m[1].replace(/^\w*\n/, ""))}</pre>`);
    else if (m[2] !== undefined) out.push(katex.renderToString(m[2], { displayMode: true, throwOnError: false }));
    else if (m[3] !== undefined) out.push(katex.renderToString(m[3], { displayMode: false, throwOnError: false }));
    last = re.lastIndex;
  }
  out.push(plain(text.slice(last)));
  return out.join("");
}

export default function MathText({ text, className, as = "span" }: { text: string; className?: string; as?: "span" | "div" }) {
  const html = useMemo(() => renderRich(text), [text]);
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function UrduText({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <div className="urdu" dir="rtl" lang="ur">
      {text}
    </div>
  );
}
