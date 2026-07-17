import React, { useEffect, useRef, useState } from "react";
import { Zap, Code2, BookOpen, Check, Copy, Maximize2, X, Download, ExternalLink } from "lucide-react";
import { useDispatch } from "react-redux";
import { setSelectedArtifact, setArtifactOpen } from "../redux/conversationSlice";

// app logo svg markup
const Mark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className="shrink-0">
    <rect width="36" height="36" rx="9" fill="#7c7ec8" />
    <path d="M10 18c0-4.42 3.58-8 8-8 2.58 0 4.88 1.22 6.36 3.12L21.6 14.6A5.5 5.5 0 0 0 18 13a5 5 0 0 0 0 10 5.5 5.5 0 0 0 3.6-1.6l2.76 1.52A7.97 7.97 0 0 1 18 26c-4.42 0-8-3.58-8-8Z" fill="white" />
  </svg>
);

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";

// Prism logic check syntax highlighting
const safeHighlight = (code, language) => {
  if (!code) return "";
  const lang = (language || "").toLowerCase();
  let grammar;
  if (lang === "js" || lang === "javascript" || lang === "jsx") {
    grammar = Prism.languages.javascript;
  } else if (lang === "css") {
    grammar = Prism.languages.css;
  } else if (lang === "html" || lang === "xml" || lang === "markup") {
    grammar = Prism.languages.markup;
  }

  if (grammar) {
    try {
      return Prism.highlight(code, grammar, lang);
    } catch (err) {
      console.error("Prism highlighting error:", err);
    }
  }

  // default tag escaping if lang is not matching
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// custom editable code display editor
const CodeBlock = ({ code, language }) => {
  const [codeText, setCodeText] = useState(code);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);
  const preRef = useRef(null);

  // stream text change hone par sync hook
  useEffect(() => {
    setCodeText(code);
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const handleScroll = (e) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // content length according editor height auto adjust
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [codeText]);

  const getHighlightedHtml = () => {
    return safeHighlight(codeText, language);
  };

  return (
    <div className="relative p-4 bg-transparent min-h-[40px]">
      {/* syntax highlighted text layer (background) */}
      <pre 
        ref={preRef}
        className="absolute top-4 left-4 right-4 bottom-4 pointer-events-none whitespace-pre-wrap break-all overflow-hidden p-0 m-0 bg-transparent text-base-100 font-mono text-[13px] leading-relaxed select-none"
        dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
      />
      {/* transparent text editor layer (overlay) */}
      <textarea
        ref={textareaRef}
        value={codeText}
        onChange={(e) => {
          setCodeText(e.target.value);
          setCopied(false);
        }}
        onScroll={handleScroll}
        className="w-full bg-transparent text-transparent caret-white relative z-10 p-0 m-0 border-none outline-none resize-none overflow-hidden block whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed font-medium"
        style={{ height: "auto" }}
        spellCheck="false"
      />
    </div>
  );
};

// stream buffer me se generated files list filter function
const getFilesFromStream = (rawText) => {
  if (!rawText) return [];
  const regex = /"name"\s*:\s*"([^"]+)"/g;
  const files = [];
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    const name = match[1];
    if (!files.some(f => f.name === name)) {
      files.push({ name, status: "generating" });
    }
  }
  if (files.length > 0) {
    for (let i = 0; i < files.length - 1; i++) {
      files[i].status = "complete";
    }
    try {
      let cleanText = rawText.trim();
      if (cleanText.startsWith("code_generation")) {
        cleanText = cleanText.substring("code_generation".length).trim();
      }
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
      }
      JSON.parse(cleanText);
      files.forEach(f => f.status = "complete");
    } catch (e) {
      // stream chal raha hai
    }
  }
  return files;
};

// building loading status component
const FileBuilderStatus = ({ rawText, artifact }) => {
  const dispatch = useDispatch();
  const files = getFilesFromStream(rawText);
  
  const handleOpenArtifact = () => {
    if (artifact && artifact.files && artifact.files.length > 0) {
      dispatch(setSelectedArtifact(artifact));
      dispatch(setArtifactOpen(true));
    }
  };

  if (files.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
        <span className="text-xs font-sans text-base-400">Initializing project workspace...</span>
      </div>
    );
  }

  const isAllComplete = files.every(f => f.status === "complete");

  return (
    <div 
      onClick={handleOpenArtifact}
      className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-3 max-w-sm cursor-pointer hover:border-white/[0.15] transition-all hover:bg-white/[0.03]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold font-sans text-base-200">
          {isAllComplete ? "Workspace Assets Ready" : "Building Workspace Assets..."}
        </span>
        {!isAllComplete && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-2">
              <Code2 size={13} className="text-base-400" />
              <span className="text-base-350">{file.name}</span>
            </div>
            {file.status === "complete" ? (
              <div className="flex items-center gap-1 text-emerald-400">
                <Check size={12} strokeWidth={3} />
                <span className="text-[10px] font-medium">Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-accent-400">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
                <span className="text-[10px] font-medium">Building...</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAllComplete && (
        <div className="pt-1.5 border-t border-white/[0.05] text-[10px] font-sans text-emerald-500 flex items-center gap-1">
          <Check size={11} strokeWidth={3} />
          <span>Opened in Artifact preview drawer. Click to review.</span>
        </div>
      )}
    </div>
  );
};

// multiple files selector switcher tab
const TabbedFileViewer = ({ files, artifact }) => {
  const [activeTab, setActiveTab] = useState(0);
  const dispatch = useDispatch();

  if (!files || files.length === 0) return null;
  
  const currentFile = files[activeTab] || files[0];

  const handleOpenSidebar = () => {
    const payload = artifact || {
      id: Date.now(),
      title: currentFile.name,
      files: files
    };
    dispatch(setSelectedArtifact(payload));
    dispatch(setArtifactOpen(true));
  };

  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden my-4 bg-base-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-2 select-none overflow-x-auto">
        <div className="flex gap-1">
          {files.map((file, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-3 py-2 text-xs font-medium font-sans border-b-2 transition-all duration-200 cursor-pointer ${
                activeTab === idx
                  ? "border-accent-500 text-accent-400 bg-white/[0.02]"
                  : "border-transparent text-base-400 hover:text-base-200"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
        
        <button
          onClick={handleOpenSidebar}
          className="flex items-center gap-1.5 text-[11px] font-sans text-base-400 hover:text-base-200 px-3 py-2 transition-colors cursor-pointer"
          title="Open in Sidebar"
        >
          <Maximize2 size={11} />
          <span>Open in Sidebar</span>
        </button>
      </div>
      <div className="bg-transparent">
        <CodeBlock 
          key={currentFile.name}
          code={currentFile.content} 
          language={currentFile.name.split('.').pop()} 
        />
      </div>
    </div>
  );
};

// raw string JSON converter helper
function tryParseJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.files)) {
      return parsed;
    }
  } catch (e) {
    // json parsing parse failed case
  }
  return null;
}

// deepseek thinking tag separation parser
function parseThinking(content) {
  const thinkRegex = /<(?:mm:)?think>([\s\S]*?)(<\/(?:mm:)?think>|$)/i;
  const match = content.match(thinkRegex);
  
  if (match) {
    const thinking = match[1];
    const response = content.replace(thinkRegex, "").trim();
    const isThinking = !match[2]; // status check tag missing check
    return { thinking, response, isThinking };
  }
  
  return { thinking: "", response: content, isThinking: false };
}

// thought process box accordion wrapper
const ThoughtBox = ({ content, active }) => {
  const [collapsed, setCollapsed] = useState(!active);

  useEffect(() => {
    if (active) {
      setCollapsed(false); // thinking chal rahi ho toh screen open rakho
    } else {
      setCollapsed(true); // thinking complete hone par collapse status set
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

// Markdown tables, lists, code alerts, dynamic render component
const Prose = ({ content }) => (
  <div className="font-sans text-[15px] leading-relaxed text-base-200 font-normal space-y-3">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold text-base-100" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        img: () => null,
        a: ({ node, ...props }) => (
          <a 
            className="text-accent-500 hover:text-accent-400 font-medium underline transition-colors cursor-pointer" 
            target="_blank" 
            rel="noopener noreferrer" 
            {...props} 
          />
        ),
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
        pre: ({ node, children, ...props }) => {
          const codeElement = React.Children.toArray(children)[0];
          const rawCode = codeElement?.props?.children || "";
          const className = codeElement?.props?.className || "";
          const match = /language-(\w+)/.exec(className);
          const lang = match ? match[1] : "";
          
          return (
            <CodeBlock 
              code={String(rawCode).replace(/\n$/, "")} 
              language={lang} 
            />
          );
        },
        ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-1 my-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-1 my-2" {...props} />,
        li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-base-100 mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-base-100 mt-3 mb-1.5" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-md font-semibold text-base-100 mt-2 mb-1" {...props} />,
        blockquote: ({ node, children, ...props }) => {
          let alertType = null;
          let cleanedChildren = children;

          try {
            const childrenArray = React.Children.toArray(children);
            const firstChild = childrenArray[0];
            
            if (firstChild && firstChild.props && firstChild.props.children) {
              const paragraphChildren = React.Children.toArray(firstChild.props.children);
              const firstTextNode = paragraphChildren[0];
              
              if (typeof firstTextNode === "string") {
                const match = firstTextNode.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)/i);
                if (match) {
                  alertType = match[1].toUpperCase();
                  const remainingText = match[2];
                  
                  cleanedChildren = [
                    React.cloneElement(firstChild, {
                      ...firstChild.props,
                      children: [remainingText, ...paragraphChildren.slice(1)]
                    }),
                    ...childrenArray.slice(1)
                  ];
                }
              }
            }
          } catch (e) {
            console.warn("Could not parse alert block:", e.message);
          }

          if (alertType) {
            const styles = {
              NOTE: "bg-blue-900/10 border-blue-900/50 text-blue-200",
              TIP: "bg-emerald-900/10 border-emerald-900/50 text-emerald-200",
              IMPORTANT: "bg-indigo-900/10 border-indigo-900/50 text-indigo-200",
              WARNING: "bg-amber-900/10 border-amber-900/50 text-amber-200",
              CAUTION: "bg-rose-900/10 border-rose-900/50 text-rose-200"
            };

            return (
              <div className={`p-4 border rounded-xl my-4 text-[14px] ${styles[alertType]}`}>
                <div className="font-semibold text-xs mb-1 tracking-wider uppercase">{alertType}</div>
                <div className="leading-relaxed">{cleanedChildren}</div>
              </div>
            );
          }

          return (
            <blockquote className="border-l-2 border-white/[0.15] pl-4 text-base-400 italic font-sans my-3">
              {children}
            </blockquote>
          );
        },
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-4 border border-white/[0.08] rounded-xl">
            <table className="w-full text-left text-xs border-collapse" {...props} />
          </div>
        ),
        thead: ({ node, ...props }) => <thead className="bg-white/[0.02] border-b border-white/[0.08] text-base-300 font-semibold" {...props} />,
        tbody: ({ node, ...props }) => <tbody className="divide-y divide-white/[0.05]" {...props} />,
        tr: ({ node, ...props }) => <tr className="hover:bg-white/[0.01] transition-colors" {...props} />,
        th: ({ node, ...props }) => <th className="px-4 py-2.5 font-medium" {...props} />,
        td: ({ node, ...props }) => <td className="px-4 py-2.5 text-base-350" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// main messaging area container
const MessageArea = ({ messages, loading, selectedConversationId }) => {
  const containerRef = useRef(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  // scroll sync to bottom hook
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // greeting state if messages list is empty
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-base-900">
        <div className="max-w-md space-y-6">
          <div className="flex justify-center">
            <Mark size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif text-white italic font-normal tracking-tight">
              What can I help with?
            </h1>
            <p className="text-[14px] text-base-400 font-sans">
              Send a message to begin.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-medium text-base-400">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-base-850 hover:bg-base-800 border border-white/[0.07] rounded-xl cursor-pointer hover:text-base-200 transition-colors">
              <Zap size={12} />
              <span>Write</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-base-850 hover:bg-base-800 border border-white/[0.07] rounded-xl cursor-pointer hover:text-base-200 transition-colors">
              <BookOpen size={12} />
              <span>Learn</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-base-850 hover:bg-base-800 border border-white/[0.07] rounded-xl cursor-pointer hover:text-base-200 transition-colors">
              <Code2 size={12} />
              <span>Code</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-8 select-text"
    >
      <div className="max-w-[800px] mx-auto space-y-8">
        {messages.map((msg, i) => {
          // user prompt layout (right card)
          if (msg.role === "user") {
            return (
              <div key={msg._id || i} className="flex justify-end">
                <div className="max-w-[70%] bg-base-800 border border-white/[0.09] rounded-[18px] rounded-br-[4px] px-4 py-2.5 text-[14.5px] text-base-100 font-sans leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          // assistant layout (left card)
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
                {msg.images && msg.images.length > 0 && (
                  <div className="pb-3 w-full">
                    {msg.images.length === 1 ? (
                      // Single Image: Renders as a beautiful, premium visual card with full controls (ideal for AI Generated Images)
                      <div className="relative group max-w-[480px] w-full rounded-2xl overflow-hidden border border-white/[0.07] bg-base-850 hover:border-white/[0.18] transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                        <div className="relative w-full overflow-hidden bg-base-900 aspect-[4/3] flex items-center justify-center">
                          <img 
                            src={msg.images[0]} 
                            alt="AI Generated Output" 
                            className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.015]"
                            onClick={() => setActiveLightboxImage(msg.images[0])}
                          />
                          {/* Image Actions Overlay on Hover */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                            <button 
                              onClick={() => setActiveLightboxImage(msg.images[0])}
                              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all duration-200 shadow-lg border border-white/10 hover:scale-105 cursor-pointer"
                              title="Zoom Image"
                            >
                              <Maximize2 size={18} />
                            </button>
                            <button 
                              onClick={() => window.open(msg.images[0], "_blank")}
                              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all duration-200 shadow-lg border border-white/10 hover:scale-105 cursor-pointer"
                              title="Open Original"
                            >
                              <ExternalLink size={18} />
                            </button>
                          </div>
                        </div>
                        {/* Bottom Info Bar */}
                        <div className="px-4 py-3 bg-base-800/60 border-t border-white/[0.05] flex items-center justify-between text-xs text-base-400">
                          <span className="font-sans font-medium text-base-500">AI Generated Image</span>
                          <a 
                            href={msg.images[0]} 
                            download={`cortex-ai-${Date.now()}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-base-300 hover:text-white transition-colors cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      // Multiple Images (Search Results): Renders as a clean grid
                      <div className="grid grid-cols-2 gap-3 max-w-[480px] w-full">
                        {msg.images.map((imgUrl, imgIdx) => (
                          <div 
                            key={imgIdx} 
                            className="relative group rounded-xl overflow-hidden border border-white/[0.07] bg-base-850 hover:border-white/[0.18] transition-all duration-300 shadow-md aspect-square"
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Search result ${imgIdx + 1}`} 
                              className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-103"
                              onClick={() => setActiveLightboxImage(imgUrl)}
                            />
                            {/* Hover Overlay */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1.5">
                              <button 
                                onClick={() => setActiveLightboxImage(imgUrl)}
                                className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors border border-white/10 cursor-pointer"
                              >
                                <Maximize2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  if (!response) return null;
                  
                  const cleanResponse = response.trim();
                  const isCodeGeneration = cleanResponse.startsWith("code_generation") || 
                                           cleanResponse.startsWith("{\"files\"") || 
                                           cleanResponse.startsWith("```json\n{\"files\"") || 
                                           cleanResponse.startsWith("```json\ncode_generation") ||
                                           (msg.artifacts && msg.artifacts.length > 0 && msg.artifacts[0].files && msg.artifacts[0].files.length > 0);

                  if (isCodeGeneration) {
                    let filesList = [];
                    if (msg.artifacts && msg.artifacts.length > 0 && msg.artifacts[0].files) {
                      filesList = msg.artifacts[0].files;
                    } else {
                      const filesData = tryParseJSON(response);
                      if (filesData && filesData.files) {
                        filesList = filesData.files;
                      }
                    }
                    
                    const inlineArtifact = {
                      id: msg._id || Date.now(),
                      title: "Generated Assets",
                      files: filesList
                    };

                    return <FileBuilderStatus rawText={response} artifact={inlineArtifact} />;
                  }

                  return (
                    <Prose content={response} />
                  );
                })()}
              </div>
            </div>
          );
        })}
    </div>

    {/* Fullscreen Image Lightbox Modal */}
    {activeLightboxImage && (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
        onClick={() => setActiveLightboxImage(null)}
      >
        <button 
          className="absolute top-4 right-4 text-white hover:text-zinc-300 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={() => setActiveLightboxImage(null)}
        >
          <X size={20} />
        </button>
        <img 
          src={activeLightboxImage} 
          alt="Fullscreen preview" 
          className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default border border-white/5"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
  </div>
);
};

export default MessageArea;
