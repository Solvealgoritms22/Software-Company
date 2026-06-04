import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';

// Initialize mermaid safely
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  });
} catch (e) {
  console.error("Failed to initialize mermaid", e);
}

let mermaidIdCounter = 0;

function Mermaid({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;
    
    const elementId = `mermaid-svg-${++mermaidIdCounter}`;
    
    async function renderChart() {
      try {
        setError(null);
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        const { svg: renderedSvg } = await mermaid.render(elementId, chart);
        setSvg(renderedSvg);
      } catch (err: any) {
        console.error("Mermaid parsing error:", err);
        setError("Error de sintaxis en diagrama de Mermaid.");
      }
    }
    
    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="p-3 my-2 border border-rose-500/30 rounded-lg bg-rose-500/5 text-rose-450 text-xs font-mono">
        {error}
        <pre className="mt-2 text-[10px] opacity-70 overflow-auto">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="flex justify-center my-4 p-4 rounded-lg bg-surface-muted/20 border border-line overflow-auto w-full"
      dangerouslySetInnerHTML={{ __html: svg || '<span class="text-text-muted text-xs animate-pulse">Renderizando diagrama...</span>' }} 
    />
  );
}

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export function MarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;

  // Auto-wrap raw mermaid strings that LLMs sometimes generate without code blocks
  let processedText = text;
  const trimmed = text.trim();
  
  if (trimmed.startsWith('mermaid ') || trimmed.startsWith('mermaid\n')) {
    processedText = "```mermaid\n" + trimmed.substring(7).trim() + "\n```";
  } else if (/^(graph\s|flowchart\s|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|erDiagram|journey|gitGraph)/.test(trimmed)) {
    processedText = "```mermaid\n" + trimmed + "\n```";
  }

  return (
    <div className="markdown-body space-y-4 text-sm leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }: ComponentProps) => <h1 className="text-xl font-bold text-text-strong border-b border-line pb-2 mt-6 mb-3">{children}</h1>,
          h2: ({ children }: ComponentProps) => <h2 className="text-lg font-bold text-text-strong mt-5 mb-2">{children}</h2>,
          h3: ({ children }: ComponentProps) => <h3 className="text-base font-semibold text-text-strong mt-4 mb-1">{children}</h3>,
          h4: ({ children }: ComponentProps) => <h4 className="text-sm font-semibold text-text-strong mt-3">{children}</h4>,
          p: ({ children }: ComponentProps) => <p className="text-text font-normal mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }: ComponentProps) => <ul className="list-disc list-inside space-y-1.5 pl-4 my-2 text-text">{children}</ul>,
          ol: ({ children }: ComponentProps) => <ol className="list-decimal list-inside space-y-1.5 pl-4 my-2 text-text">{children}</ol>,
          li: ({ children }: ComponentProps) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }: ComponentProps) => (
            <blockquote className="border-l-4 border-brand/50 pl-4 py-1 my-3 bg-surface-muted/30 text-text-muted italic rounded-r-md">
              {children}
            </blockquote>
          ),
          a: ({ href, children }: ComponentProps) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand hover:underline font-semibold"
            >
              {children}
            </a>
          ),
          table: ({ children }: ComponentProps) => (
            <div className="overflow-x-auto my-4 border border-line rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-line text-left text-xs text-text">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }: ComponentProps) => <thead className="bg-surface-muted/80 text-text-strong uppercase font-bold tracking-wider">{children}</thead>,
          tbody: ({ children }: ComponentProps) => <tbody className="divide-y divide-line bg-surface/20">{children}</tbody>,
          tr: ({ children }: ComponentProps) => <tr className="hover:bg-surface-muted/20 transition">{children}</tr>,
          th: ({ children }: ComponentProps) => <th className="px-4 py-3 font-semibold text-text-strong border-b border-line">{children}</th>,
          td: ({ children }: ComponentProps) => <td className="px-4 py-2.5 border-b border-line whitespace-pre-wrap">{children}</td>,
          code({ className, children, ...props }: ComponentProps) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match && match[1] === 'mermaid') {
              return <Mermaid chart={codeString} />;
            }

            return inline ? (
              <code className="px-1.5 py-0.5 rounded bg-surface-muted border border-line text-xs font-mono text-emerald-600 dark:text-emerald-450" {...props}>
                {children}
              </code>
            ) : (
              <pre className="overflow-auto rounded-lg bg-surface-muted/50 border border-line p-4 text-xs text-text-strong font-mono my-2 shadow-inner leading-relaxed">
                {match && <div className="text-[10px] uppercase text-text-muted mb-2 font-sans font-bold tracking-wider">{match[1]}</div>}
                <code {...props}>{children}</code>
              </pre>
            );
          }
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
