import React from "react";
import { Menu, PanelRight, ChevronDown } from "lucide-react";

// Top navigation bar component: isme Sidebar aur Right Artifact side drawer ko toggle karne ke buttons hain.
const Navbar = ({ isSidebarOpen, onToggleSidebar, isArtifactOpen, onToggleArtifact }) => (
  <header className="h-11 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.07]">

    {/* Left section: Sidebar toggle aur Branding label */}
    <div className="flex items-center gap-1">
      {!isSidebarOpen && (
        <button
          onClick={onToggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-base-500 hover:text-base-200 hover:bg-base-850 cursor-pointer transition-colors"
          title="Show sidebar"
        >
          <Menu size={16} strokeWidth={1.75} />
        </button>
      )}
      <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-medium text-base-300 hover:text-base-100 hover:bg-base-850 cursor-pointer transition-colors">
        CortexAI
        <ChevronDown size={12} strokeWidth={2.5} className="text-base-500" />
      </button>
    </div>

    {/* Right section: Artifact sidebar toggle button */}
    <button
      onClick={onToggleArtifact}
      className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors
        ${isArtifactOpen
          ? "text-accent-500 bg-accent-100"
          : "text-base-500 hover:text-base-200 hover:bg-base-850"
        }`}
      title={isArtifactOpen ? "Close panel" : "Open panel"}
    >
      <PanelRight size={16} strokeWidth={1.75} />
    </button>

  </header>
);

export default Navbar;