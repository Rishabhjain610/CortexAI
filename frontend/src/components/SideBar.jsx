import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Plus, MessageSquare, Trash2, Settings, LogOut } from "lucide-react";
import getConversations from "../features/getCoverations";
import deleteConversation from "../features/deleteConversation";
import {
  setConversations, addConversation, removeConversation, setSelectedConversationId,
} from "../redux/conversationSlice";


/* CortexAI logo mark component */
const Mark = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className="shrink-0">
    <rect width="36" height="36" rx="9" fill="#7c7ec8" />

    <path d="M10 18c0-4.42 3.58-8 8-8 2.58 0 4.88 1.22 6.36 3.12L21.6 14.6A5.5 5.5 0 0 0 18 13a5 5 0 0 0 0 10 5.5 5.5 0 0 0 3.6-1.6l2.76 1.52A7.97 7.97 0 0 1 18 26c-4.42 0-8-3.58-8-8Z" fill="white" />
  </svg>
);

const SideBar = ({ user, onLogout, isOpen, onOpenUpgrade }) => {
  // Redux state se pure conversations ki list aur selected chat ID fetch kar rahe hain.
  const chats      = useSelector(s => s.conversation.conversations);
  const selectedId = useSelector(s => s.conversation.selectedConversationId);
  const dispatch   = useDispatch();
  const isInitialLoad = useRef(true);

  // App load hone par saare active chats download karke Redux state me daalne wala hook.
  // Agar database me pehle se chat saved hain aur selected ID empty hai, toh sabse pehli chat ko select kar lega.
  useEffect(() => {
    getConversations().then(d => {
      dispatch(setConversations(d));
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        if (d && d.length > 0 && !selectedId) {
          dispatch(setSelectedConversationId(d[0]._id || d[0].id));
        }
      }
    });
  }, [dispatch, selectedId]);

  // Naya chat room reset karne wala helper button command.
  const create = () => {
    dispatch(setSelectedConversationId(null));
  };

  // Kisi purani chat ko delete karne aur UI ko refresh karne ka helper function.
  const remove = async (id, e) => {
    e.stopPropagation();
    const ok = await deleteConversation(id);
    if (ok) {
      dispatch(removeConversation(id));
      // Agar delete ki gayi chat abhi open thi, toh bachhi hui list me se pehli chat open kar do.
      if (id === selectedId) {
        const remaining = chats.filter(c => (c._id || c.id) !== id);
        if (remaining.length > 0) {
          dispatch(setSelectedConversationId(remaining[0]._id || remaining[0].id));
        }
      }
    }
  };

  return (
    <aside className={`
      fixed lg:relative inset-y-0 left-0 z-40 h-screen flex-shrink-0
      flex flex-col overflow-hidden select-none
      bg-[#141210] border-r border-white/[0.07]
      transition-all duration-300 ease-in-out
      ${isOpen ? "w-[248px] opacity-100" : "w-0 opacity-0 pointer-events-none"}
    `}>
      <div className="w-[248px] flex flex-col h-full">

        {/* Logo and branding zone */}
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <Mark size={22} />
          <span className="font-sans font-semibold text-[15px] text-base-100 tracking-tight">
            CortexAI
          </span>
        </div>

        {/* New chat creator trigger button */}
        <div className="px-3 pb-3">
          <button
            onClick={create}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium
              text-base-400 bg-base-850 border border-white/[0.07] cursor-pointer
              hover:text-base-100 hover:border-white/[0.13] transition-colors duration-150"
          >
            <Plus size={14} strokeWidth={2.5} />
            New conversation
          </button>
        </div>

        {/* Recent Chat listing column */}
        <div className="flex-1 overflow-y-auto px-2 min-h-0">
          {chats.length > 0 && (
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-base-500">
              Recent
            </p>
          )}
          {chats.map(chat => {
            const id     = chat._id || chat.id;
            const active = id === selectedId;
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => dispatch(setSelectedConversationId(id))}
                onKeyDown={e => e.key === "Enter" && dispatch(setSelectedConversationId(id))}
                className={`group flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg mb-0.5 cursor-pointer
                  border transition-colors duration-100
                  ${active
                    ? "bg-accent-100 border-accent-200 text-base-100"
                    : "border-transparent text-base-400 hover:bg-white/[0.04] hover:text-base-200"
                  }`}
              >
                <MessageSquare size={13} strokeWidth={active ? 2 : 1.75} className={`shrink-0 ${active ? "text-accent-500" : "text-base-700"}`} />
                <span className={`flex-1 min-w-0 truncate text-[13px] ${active ? "font-medium" : "font-normal"}`}>
                  {chat.title}
                </span>
                <button
                  onClick={e => remove(id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-base-700 hover:text-red-400 cursor-pointer transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* User profile, settings and logout drawer footer */}
        <div className="border-t border-white/[0.07] px-2 pt-2 pb-3 space-y-0.5">
          <button
            onClick={onOpenUpgrade}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-base-450
              hover:bg-white/[0.04] hover:text-base-200 transition-colors duration-100 cursor-pointer"
          >
            <Settings size={13} />
            <span>Settings / Subscription</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-base-450
              hover:bg-white/[0.04] hover:text-red-400/90 transition-colors duration-100 cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>

          {/* User profile details badge card */}
          {user && (
            <div 
              onClick={onOpenUpgrade}
              className="flex items-center gap-2.5 px-2.5 py-2 mt-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-150 cursor-pointer"
              title="Click to manage subscription"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-semibold text-indigo-400">
                {user.email ? user.email[0].toUpperCase() : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-medium text-base-200 truncate">
                  {user.name || "User"}
                </p>
                <p className="text-[9.5px] text-base-500 truncate mt-0.5">
                  {user.credits ?? 100} credits
                </p>
              </div>
              <span className="text-[8.5px] font-semibold tracking-wider uppercase px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 text-indigo-400">
                {user.plan || "Free"}
              </span>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};

export default SideBar;
