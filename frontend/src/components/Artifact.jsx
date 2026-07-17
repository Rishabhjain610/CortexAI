import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { X, Eye, Code, Download, Copy, Check, FileText } from "lucide-react";
import { setArtifactOpen, updateArtifactFileContent } from "../redux/conversationSlice";
import Editor from "@monaco-editor/react";

// file name check karke monaco editor ke liye language set karne ke liye
const getMonacoLanguage = (fileName) => {
  if (!fileName) return "javascript";
  const name = fileName.toLowerCase();
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  return "plaintext";
};

// html, css, aur js ko combine karke single page html source code ready karne ka logic
const compileSrcDocDirect = (filesList) => {
  if (!filesList || filesList.length === 0) return "";
  const htmlFile = filesList.find(f => f.name.endsWith(".html")) || filesList[0];
  let htmlContent = htmlFile ? htmlFile.content : "";
  
  if (!htmlFile || !htmlFile.name.endsWith(".html")) {
    return `<html><body><pre>${htmlContent}</pre></body></html>`;
  }
  
  const cssFile = filesList.find(f => f.name.endsWith(".css"));
  const cssContent = cssFile ? cssFile.content : "";
  const jsFile = filesList.find(f => f.name.endsWith(".js"));
  const jsContent = jsFile ? jsFile.content : "";
  
  const styleTag = cssContent ? `<style>${cssContent}</style>` : "";
  if (htmlContent.includes("</head>")) {
    htmlContent = htmlContent.replace("</head>", `${styleTag}</head>`);
  } else {
    htmlContent = htmlContent + styleTag;
  }
  
  const scriptTag = jsContent ? `<script>${jsContent}</script>` : "";
  if (htmlContent.includes("</body>")) {
    htmlContent = htmlContent.replace("</body>", `${scriptTag}</body>`);
  } else {
    htmlContent = htmlContent + scriptTag;
  }
  
  return htmlContent;
};

const Artifact = ({ isOpen, onClose }) => {
  // Redux se active artifact details uthane ke liye
  const selectedArtifact = useSelector((state) => state.conversation.selectedArtifact);
  const dispatch = useDispatch();

  // normal states define kiye hain (tab, file index, copy state, aur iframe source doc)
  const [activeTab, setActiveTab] = useState("preview");
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewSrcDoc, setPreviewSrcDoc] = useState("");

  const lastLoadedArtifactIdRef = useRef(null);

  const { title, files } = selectedArtifact || {};
  const currentFile = files?.[activeFileIdx] || files?.[0] || { name: "No File", content: "" };
  const hasHtml = files?.some(f => f.name.endsWith(".html"));

  const compileSrcDoc = () => compileSrcDocDirect(files);

  // jab user doosra artifact load karega tab state reset karne ka useEffect
  // ref check lagaya hai taaki typing ke time bar bar page refresh ya reset na ho
  useEffect(() => {
    if (selectedArtifact) {
      if (selectedArtifact.id !== lastLoadedArtifactIdRef.current) {
        lastLoadedArtifactIdRef.current = selectedArtifact.id;
        
        if (selectedArtifact.files?.length > 0) {
          setActiveFileIdx(0);
          const hasHtml = selectedArtifact.files.some(f => f.name.endsWith(".html"));
          const initialTab = hasHtml ? "preview" : "code";
          setActiveTab(initialTab);
          
          if (initialTab === "preview") {
            setPreviewSrcDoc(compileSrcDocDirect(selectedArtifact.files));
          }
        }
      }
    } else {
      lastLoadedArtifactIdRef.current = null;
    }
  }, [selectedArtifact]);

  // tab switch logic - jab tab preview ho tabhi code compile karenge
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "preview") {
      setPreviewSrcDoc(compileSrcDoc());
    }
  };

  // current active file ka content clipboard me copy karne ke liye
  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // saari files ko download karne ka function
  const handleDownload = () => {
    if (!files || files.length === 0) return;
    files.forEach((file) => {
      const element = document.createElement("a");
      const blob = new Blob([file.content], { type: "text/plain" });
      element.href = URL.createObjectURL(blob);
      element.download = file.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });
  };

  // fallback agar koi active artifact selected nahi hai layout me
  if (!selectedArtifact) {
    return (
      <div
        className={`fixed inset-y-0 right-0 z-40 lg:relative h-screen bg-[#1c1c1e] flex flex-col text-zinc-300 select-none flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen
            ? "w-full sm:w-96 xl:w-[480px] translate-x-0 border-l border-zinc-800/80 opacity-100"
            : "w-0 translate-x-full opacity-0 pointer-events-none border-l-0"
        }`}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-500 font-sans">
          <FileText size={48} strokeWidth={1.5} className="mb-3 text-zinc-700 animate-pulse" />
          <p className="text-xs">No active artifact selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 lg:relative h-screen bg-[#1c1c1e] flex flex-col text-zinc-300 select-none flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen
          ? "w-full sm:w-96 xl:w-[480px] translate-x-0 border-l border-zinc-800/80 opacity-100"
          : "w-0 translate-x-full opacity-0 pointer-events-none border-l-0"
      }`}
    >
      <div className="w-full sm:w-96 xl:w-[480px] flex flex-col h-full flex-shrink-0">
        {/* Top header aur meta information header */}
        <div className="h-14 border-b border-zinc-800/80 bg-zinc-900/40 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-900/30 border border-indigo-850 rounded text-indigo-400">
              <FileText size={15} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white truncate max-w-[200px]">{title || currentFile.name}</h3>
              <p className="text-[10px] text-zinc-500">Artifact • Updated just now</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition duration-200 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Preview aur Code tabs select karne ke buttons */}
        <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/20 flex items-center justify-between">
          <div className="flex gap-2">
            {hasHtml && (
              <button
                onClick={() => handleTabChange("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40"
                }`}
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
            )}
            <button
              onClick={() => handleTabChange("code")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "code" || !hasHtml
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40"
              }`}
            >
              <Code size={13} />
              <span>Code</span>
            </button>
          </div>
        </div>

        {/* Files list ke tabs dikhane ke liye */}
        {activeTab === "code" && files && files.length > 0 && (
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/40 overflow-x-auto shrink-0 select-none">
            {files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveFileIdx(idx);
                  setCopied(false);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 border-r border-zinc-800 text-xs font-mono transition cursor-pointer relative
                  ${
                    activeFileIdx === idx
                      ? "bg-zinc-950 text-white font-medium border-t border-t-indigo-500"
                      : "text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                  }`}
              >
                <FileText size={12} className={activeFileIdx === idx ? "text-indigo-400" : "text-zinc-500"} />
                <span>{file.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Beech ka block - ya toh Iframe preview dikhega ya Monaco editor */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex flex-col min-h-0">
          {activeTab === "preview" && hasHtml ? (
            <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-zinc-800 shadow-lg">
              <iframe
                title="Artifact Preview"
                srcDoc={previewSrcDoc}
                className="w-full h-full border-none"
                sandbox="allow-scripts"
              />
            </div>
          ) : (
            <div className="flex-1 w-full h-full rounded-lg overflow-hidden border border-zinc-800/80">
              <Editor
                height="100%"
                language={getMonacoLanguage(currentFile.name)}
                theme="vs-dark"
                value={currentFile.content}
                onChange={(val) => {
                  dispatch(updateArtifactFileContent({ fileIdx: activeFileIdx, content: val || "" }));
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 10, bottom: 10 },
                  fontFamily: "Fira Code, Monaco, Courier New, monospace",
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  scrollbar: {
                    vertical: "visible",
                    horizontal: "visible",
                  },
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom ke actions (Copy aur Download buttons) */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition cursor-pointer shadow-md shadow-indigo-600/10"
          >
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Artifact;