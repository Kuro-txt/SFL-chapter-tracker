// Clean Arcade Dashboard Styling (Zero Google Dependencies)

export const STYLES = {
  // Global Layout
  body: "bg-[#0b0f19] text-slate-100 min-h-screen p-4 sm:p-8 flex flex-col items-center font-mono selection:bg-amber-400 selection:text-slate-950",
  container: "max-w-7xl w-full space-y-6",

  // Header Elements
  headerBox: "text-center space-y-2 py-4",
  headerTitle: "text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-wider flex items-center justify-center gap-3 drop-shadow-[2px_2px_0_#000]",
  headerSubtitle: "text-slate-400 text-xs sm:text-sm font-bold tracking-wide",

  // Panels (Clean Retro Offset Shadow Box)
  panel: "bg-[#131b2e] border-2 border-slate-700 p-4 space-y-4 shadow-[4px_4px_0px_0px_#000000]",
  gridPanel: "bg-[#131b2e] border-2 border-slate-700 p-4 flex flex-col shadow-[4px_4px_0px_0px_#000000]",

  // Buttons (Classic 3D Push Buttons)
  btnAmber: "bg-amber-500 hover:bg-amber-400 active:translate-y-1 active:shadow-none text-slate-950 font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all border-2 border-amber-300 shadow-[3px_3px_0px_0px_#000] cursor-pointer",
  btnEmerald: "bg-emerald-500 hover:bg-emerald-400 active:translate-y-1 active:shadow-none text-slate-950 font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all border-2 border-emerald-300 shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-1",
  btnIndigo: "bg-indigo-600 hover:bg-indigo-500 active:translate-y-1 active:shadow-none text-white font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all border-2 border-indigo-400 shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-1",

  // Inputs
  input: "bg-[#090d16] border-2 border-slate-700 px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 w-full sm:w-48 uppercase font-bold font-mono",
  vipBadge: "flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border-2 border-amber-500/30 px-3 py-1.5 cursor-pointer hover:bg-amber-500/20 font-mono",

  // Status Badges
  badgeDone: "bg-emerald-950 text-emerald-300 border border-emerald-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono",
  badgeActive: "bg-amber-950 text-amber-300 border border-amber-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono",
  badgeRecipe: "bg-slate-950 text-amber-300 border border-amber-500/40 px-1 text-[9px] font-mono"
};
