import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  Paperclip,
  Globe,
  ChevronDown,
  Bot,
  MessageSquare,
  Code,
  FileText,
  Presentation,
  Image,
} from "lucide-react";

// models aur agents list jo support hote hain
const MODELS = [
  { id: "CortexAI", label: "CortexAI", sub: "Fast · accurate" },
  { id: "CortexAI Pro", label: "CortexAI Pro", sub: "Most capable" },
];

const AGENTS = [
  { id: "auto", label: "Smart Router", icon: <Bot size={13} strokeWidth={1.75} /> },
  { id: "chatAgent", label: "Chat", icon: <MessageSquare size={13} strokeWidth={1.75} /> },
  { id: "codingAgent", label: "Coding", icon: <Code size={13} strokeWidth={1.75} /> },
  { id: "searchAgent", label: "Search", icon: <Globe size={13} strokeWidth={1.75} /> },
  { id: "pdfAgent", label: "PDF", icon: <FileText size={13} strokeWidth={1.75} /> },
  { id: "pptAgent", label: "PPT", icon: <Presentation size={13} strokeWidth={1.75} /> },
  { id: "imageAgent", label: "Image", icon: <Image size={13} strokeWidth={1.75} /> },
];

const ChatInput = ({ onSendMessage, disabled }) => {
  // dynamic controls and variables for input form
  const [text, setText] = useState("");
  const [showModels, setShowModels] = useState(false);
  const [model, setModel] = useState("CortexAI");
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const [focused, setFocused] = useState(false);
  const [selectedFile,setSelectedFile]=useState(null);
  const fileref=useRef(null);
  const areaRef = useRef(null);
  const dropRef = useRef(null);

  // model selection menu ke bahar click check handles close
  useEffect(() => {
    const fn = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target))
        setShowModels(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // text ke according textarea height automatic set karne ke liye
  const resize = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);
  
  // final text submit payload send trigger
  const send = () => {
    if (disabled || (!text.trim() && !selectedFile)) return;

    const formData = new FormData();
    if (selectedFile) {
      formData.append("file", selectedFile);
    }
    formData.append("message", text.trim());
    formData.append("model", model);
    formData.append("agent", selectedAgent);
    
    onSendMessage(formData);
    setText("");
    if (areaRef.current) areaRef.current.style.height = "auto";
    setSelectedFile(null);
  };

  const canSend = !disabled && (text.trim().length > 0 || selectedFile !== null);

  // agents icons button selection helper
  const toolBtn = (key, active, label, icon, onClick) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors
        ${
          active
            ? "text-accent-500 bg-accent-100 border border-accent-200"
            : "text-base-500 bg-transparent border border-transparent hover:text-base-300 hover:bg-base-800"
        }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="shrink-0 flex justify-center px-4 pb-5 pt-1">
      <div className="w-full max-w-[880px] space-y-1.5">
        {/* input panel container border design */}
        <div
          className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-150
          bg-base-850 border
          ${focused ? "border-accent-500/40 shadow-[0_0_0_3px_rgba(110,118,200,0.08),0_8px_28px_rgba(0,0,0,0.4)]" : "border-white/[0.1] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"}`}
        >
          {/* File Attachment Chip */}
          {selectedFile && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base-800 border border-white/[0.1] text-[13px] text-base-200 shadow-sm">
                {selectedFile.type?.startsWith("image/") ? (
                  <div className="w-6 h-6 rounded-md overflow-hidden bg-base-900 border border-white/10 shrink-0">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <FileText size={15} className="text-red-400 shrink-0" />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="truncate max-w-[220px] font-medium text-xs text-base-100">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-base-500 font-sans">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type?.startsWith("image/") ? "Image" : "PDF Document"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileref.current) fileref.current.value = "";
                  }}
                  className="ml-1.5 p-0.5 rounded-full hover:bg-white/10 text-base-400 hover:text-base-100 transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          {/* main editor textarea element */}
          <div className="px-4 pt-4 pb-2">
            <textarea
              ref={areaRef}
              rows={1}
              value={text}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                resize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                disabled ? "Select a conversation first…" : "Message CortexAI…"
              }
              className="w-full bg-transparent border-0 outline-none resize-none font-sans text-[15px] text-base-100 caret-accent-500 leading-relaxed"
              style={{ minHeight: 40, maxHeight: 200 }}
            />
          </div>

          {/* sub menus, attachment hooks aur submit action elements */}
          <div className="flex items-center justify-between px-3 pb-3 gap-2">
            {/* left options (attachment, agent selectors) */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none max-w-[calc(100vw-120px)] sm:max-w-none">
              <input type="file" hidden accept='.pdf,image/*' ref={fileref} onChange={(e)=>setSelectedFile(e.target.files[0])} />
              <button
                type="button"
                disabled={disabled}
                title="Attach"
                onClick={()=>fileref.current.click()}
                className="p-1.5 rounded-lg text-base-500 hover:text-base-300 hover:bg-base-800 cursor-pointer transition-colors"
              >
                <Paperclip size={15} strokeWidth={1.75} />
              </button>

              {/* division line */}
              <div className="w-px h-3.5 bg-white/[0.08] mx-1" />

              {/* horizontal list of agent tools */}
              {AGENTS.map((agentItem) =>
                toolBtn(
                  agentItem.id,
                  selectedAgent === agentItem.id,
                  agentItem.label,
                  agentItem.icon,
                  () => setSelectedAgent(agentItem.id)
                )
              )}
            </div>

            {/* right options (model selection, send trigger) */}
            <div className="flex items-center gap-2">

              {/* drop picker select clicker */}
              <div className="relative" ref={dropRef}>
                <button
                  type="button"
                  onClick={() => setShowModels((v) => !v)}
                  disabled={disabled}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-base-500 hover:text-base-300 hover:bg-base-800 cursor-pointer transition-colors"
                >
                  {model}
                  <ChevronDown
                    size={11}
                    strokeWidth={2.5}
                    className={`transition-transform duration-200 ${showModels ? "rotate-180" : ""}`}
                  />
                </button>

                {/* drop picker list menus */}
                {showModels && (
                  <div className="absolute bottom-full right-0 mb-2 rounded-xl overflow-hidden z-50 min-w-[180px] bg-base-800 border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModel(m.id);
                          setShowModels(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.05]
                          ${model === m.id ? "bg-accent-100" : "bg-transparent"}`}
                      >
                        <p
                          className={`text-[13px] font-medium ${model === m.id ? "text-accent-500" : "text-base-100"}`}
                        >
                          {m.label}
                        </p>
                        <p className="text-[11px] text-base-500 mt-0.5">
                          {m.sub}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* final send key */}
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150
                  ${
                    canSend
                      ? "bg-accent-500 text-white shadow-[0_2px_10px_rgba(110,118,200,0.3)] cursor-pointer hover:bg-accent-400"
                      : "bg-base-800 text-base-700 cursor-default"
                  }`}
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* bottom note label */}
        <p className="text-center text-[11px] font-sans text-base-500">
          CortexAI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
