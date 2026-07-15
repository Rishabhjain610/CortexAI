import React, { useState } from "react";
import { X, Eye, Code, Download, Copy, Check, FileText } from "lucide-react";

const Artifact = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("preview");
  const [copied, setCopied] = useState(false);

  const mockCode = `// Quantum Superposition Simulation
import { QuantumCircuit } from 'qiskit';

const circuit = new QuantumCircuit(2);
circuit.h(0); // Apply Hadamard gate
circuit.cx(0, 1); // CNOT gate

console.log("Circuit initialized!");
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mockCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 lg:relative h-screen bg-[#1c1c1e] flex flex-col text-zinc-300 select-none flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen
          ? "w-full sm:w-96 xl:w-[480px] translate-x-0 border-l border-zinc-800/80 opacity-100"
          : "w-0 translate-x-full opacity-0 pointer-events-none border-l-0"
      }`}
    >
      <div className="w-full sm:w-96 xl:w-[480px] flex flex-col h-full flex-shrink-0">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800/80 bg-zinc-900/40 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-900/30 border border-indigo-850 rounded text-indigo-400">
              <FileText size={15} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">quantum_sim.py</h3>
              <p className="text-[10px] text-zinc-500">Python script • Updated just now</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition duration-200 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/20 flex gap-2">
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === "preview"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40"
            }`}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === "code"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40"
            }`}
          >
            <Code size={13} />
            <span>Code</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 font-mono text-xs">
          {activeTab === "preview" ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-6 font-sans">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Glowing sphere representing a quantum state */}
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-xl animate-pulse"></div>
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-lg shadow-indigo-500/30 border border-indigo-400/20">
                  |Ψ⟩
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Quantum Superposition State</h4>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Bell State |Φ+⟩ initialized successfully. Probability distribution is evenly split: 50% |00⟩, 50% |11⟩.
                </p>
              </div>
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left space-y-2">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>State |00⟩</span>
                  <span>50.2% probability</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: "50%" }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 pt-1">
                  <span>State |11⟩</span>
                  <span>49.8% probability</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: "50%" }}></div>
                </div>
              </div>
            </div>
          ) : (
            <pre className="text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre p-2 bg-zinc-900/30 border border-zinc-800/40 rounded-xl select-text">
              {mockCode}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-end gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition cursor-pointer shadow-md shadow-indigo-600/10">
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Artifact;