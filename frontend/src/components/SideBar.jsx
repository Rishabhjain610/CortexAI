import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Plus, MessageSquare, Trash2, Settings, LogOut } from "lucide-react";
import createConversation from "../features/createConversation";
import getConversations from "../features/getCoverations";
import deleteConversation from "../features/deleteConversation";
import {
  setConversations, addConversation, removeConversation, setSelectedConversationId,
} from "../redux/conversationSlice";


/* CortexAI logo mark */
const Mark = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className="shrink-0">
    <rect width="36" height="36" rx="9" fill="#7c7ec8" />

    <path d="M10 18c0-4.42 3.58-8 8-8 2.58 0 4.88 1.22 6.36 3.12L21.6 14.6A5.5 5.5 0 0 0 18 13a5 5 0 0 0 0 10 5.5 5.5 0 0 0 3.6-1.6l2.76 1.52A7.97 7.97 0 0 1 18 26c-4.42 0-8-3.58-8-8Z" fill="white" />
  </svg>
);

const SideBar = ({ user, onLogout, isOpen }) => {
  const chats      = useSelector(s => s.conversation.conversations);
  const selectedId = useSelector(s => s.conversation.selectedConversationId);
  const dispatch   = useDispatch();

  useEffect(() => {
    getConversations().then(d => dispatch(setConversations(d)));
  }, [dispatch]);

  const create = async () => {
    const c = await createConversation();
    if (c) dispatch(addConversation(c));
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    const ok = await deleteConversation(id);
    if (ok) dispatch(removeConversation(id));
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

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <Mark size={22} />
          <span className="font-sans font-semibold text-[15px] text-base-100 tracking-tight">
            CortexAI
          </span>
        </div>

        {/* New chat */}
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

        {/* Chat list */}
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

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-2 pt-2 pb-3 space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-base-400 hover:text-base-200 hover:bg-white/[0.04] cursor-pointer transition-colors">
            <Settings size={13} strokeWidth={1.75} />
            Settings
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-base-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer transition-colors">
            <LogOut size={13} strokeWidth={1.75} />
            Sign out
          </button>

          {/* User row */}
          <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-base-850 border border-white/[0.07]">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || "CX")}&backgroundColor=6e76c8&textColor=ffffff`}
              alt=""
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-base-200 truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-base-400 truncate">{user?.email || ""}</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-accent-100 text-accent-500 border border-accent-200 shrink-0">
              {user?.plan || "free"}
            </span>
          </div>
        </div>

      </div>
    </aside>
  );
};

export default SideBar;
