import { useEffect, useRef } from "react";
import { createHighlighter } from "shiki";

type CodeBlockProps = {
  code: string;
  language: "sql" | "csv";
};

const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const highlightCode = async () => {
      const highlighter = await createHighlighter({
        themes: ["github-light"],
        langs: [language],
      });

      if (codeRef.current) {
        const html = highlighter.codeToHtml(code, {
          lang: language,
          themes: { light: "github-light" },
        });
        const innerContent = html
          .replace(/<pre[^>]*>/, "")
          .replace(/<\/pre>$/, "");
        codeRef.current.innerHTML = innerContent;
      }
    };

    highlightCode();
  }, [code, language]);

  return (
    <pre
      ref={codeRef}
      className="p-4 overflow-auto text-sm border rounded-md border-slate-200 not-prose"
    />
  );
};

export default CodeBlock;
