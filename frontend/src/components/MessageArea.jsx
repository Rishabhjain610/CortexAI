import React, { useEffect, useRef, useState } from "react";
import { Zap, Code2, BookOpen } from "lucide-react";

/* ── Logo ── */
const Mark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className="shrink-0">
    <rect width="36" height="36" rx="9" fill="#7c7ec8" />
    <path d="M10 18c0-4.42 3.58-8 8-8 2.58 0 4.88 1.22 6.36 3.12L21.6 14.6A5.5 5.5 0 0 0 18 13a5 5 0 0 0 0 10 5.5 5.5 0 0 0 3.6-1.6l2.76 1.52A7.97 7.97 0 0 1 18 26c-4.42 0-8-3.58-8-8Z" fill="white" />
  </svg>
);

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Regex to extract content inside <think>...</think> tags (handles active streaming)
function parseThinking(content) {
  const thinkRegex = /<think>([\s\S]*?)(<\/think>|$)/i;
  const match = content.match(thinkRegex);
  
  if (match) {
    const thinking = match[1];
    const response = content.replace(thinkRegex, "").trim();
    const isThinking = !match[2]; // True if </think> is missing (still streaming)
    return { thinking, response, isThinking };
  }
  
  return { thinking: "", response: content, isThinking: false };
}

const ThoughtBox = ({ content, active }) => {
  const [collapsed, setCollapsed] = useState(!active);

  useEffect(() => {
    if (active) {
      setCollapsed(false); // Expand automatic during active thinking
    } else {
      setCollapsed(true); // Collapse automatic when finished
    }
  }, [active]);
  
  return (
    <div className="border-l-2 border-base-700 pl-4 py-1 my-2 text-[13px] text-base-500 font-sans">
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 font-medium text-base-500 hover:text-base-300 transition-colors focus:outline-none cursor-pointer"
      >
        <svg 
          className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span>{active ? "Thinking..." : "Thought process"}</span>
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-ping" />
        )}
      </button>
      
      {!collapsed && (
        <div className="mt-2 text-base-500 whitespace-pre-wrap leading-relaxed select-none">
          {content}
        </div>
      )}
    </div>
  );
};

/* Renders markdown text with tables, lists, blockquotes, code blocks, etc. */
const Prose = ({ content }) => (
  <div className="font-sans text-[15px] leading-relaxed text-base-200 font-normal space-y-3">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold text-base-100" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        code: ({ node, className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="font-mono text-[0.85em] bg-white/[0.07] px-1.5 py-0.5 rounded text-accent-300" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="font-mono text-inherit bg-transparent p-0 block" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ node, ...props }) => (
          <pre className="font-mono text-[0.9em] bg-white/[0.04] p-4 rounded-xl border border-white/[0.08] overflow-x-auto my-3" {...props} />
        ),
        ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-1 my-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-1 my-2" {...props} />,
        li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-base-100 mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-base-100 mt-3 mb-1.5" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-md font-semibold text-base-100 mt-2 mb-1" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-accent-500 pl-4 italic text-base-400 my-3" {...props} />
        ),
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full divide-y divide-white/[0.08] border border-white/[0.08]" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-base-300 bg-white/[0.03]" {...props} />,
        td: ({ node, ...props }) => <td className="px-3 py-2 text-sm text-base-200 border-t border-white/[0.08]" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);


/* ── Loading dots ── */
const Dots = () => (
  <div className="flex gap-1.5 items-center">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-base-700 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

/* ── Starter chips ── */
const STARTERS = [
  { icon: <Zap size={12} strokeWidth={2} />, label: "Write" },
  { icon: <BookOpen size={12} strokeWidth={2} />, label: "Learn" },
  { icon: <Code2 size={12} strokeWidth={2} />, label: "Code" },
];

/* ── Welcome / Empty screen ── (matches Claude.ai layout from screenshot) */
const Welcome = ({ hasConvo }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 min-h-0">
    <div className="w-full max-w-[560px] text-center space-y-6">
      {/* Heading */}
      <h1 className="font-serif italic font-normal text-[32px] leading-tight text-base-100 tracking-tight">
        What can I help with?
      </h1>

      {/* Sub-text */}
      <p className="text-[14px] text-base-500 font-sans">
        {hasConvo
          ? "Send a message to begin."
          : "Start a new conversation from the sidebar."}
      </p>

      {/* Chips — only when a convo is open */}
      {hasConvo && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {STARTERS.map(({ icon, label }, i) => (
            <button
              key={i}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium
                text-base-400 bg-base-850 border border-white/[0.08]
                hover:text-base-100 hover:border-white/[0.15] cursor-pointer transition-colors"
            >
              <span className="text-accent-500">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────── */
const MessageArea = ({ messages, loading, selectedConversationId }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  if (!selectedConversationId) return <Welcome hasConvo={false} />;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-0">
      <Dots />
    </div>
  );

  if (messages.length === 0) return <Welcome hasConvo={true} />;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-[880px] mx-auto px-5 pt-7 pb-4 space-y-6">

        {messages.map((msg, i) => {
          const isAI = msg.role === "assistant" || msg.role === "bot";

          if (!isAI) {
            /* User bubble — right aligned */
            return (
              <div key={msg._id || i} className="flex justify-end">
                <div className="max-w-[70%] bg-base-800 border border-white/[0.09] rounded-[18px] rounded-br-[4px] px-4 py-2.5 text-[14.5px] text-base-100 font-sans leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          /* AI message — left with logo */
          const { thinking, response, isThinking } = parseThinking(msg.content);

          return (
            <div key={msg._id || i} className="flex gap-3 items-start">
              <div className="mt-0.5 shrink-0">
                <Mark size={24} />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-base-700">
                  CortexAI
                </p>
                {thinking && (
                  <ThoughtBox content={thinking} active={isThinking} />
                )}
                {response && (
                  <Prose content={response} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MessageArea;
