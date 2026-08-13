// Arcade Pixel Dashboard Theme Configuration

export const STYLES = {
  // Global Layout
  body: "bg-[#0B0F19] text-slate-100 min-h-screen p-4 sm:p-8 flex flex-col items-center selection:bg-amber-400 selection:text-slate-950",
  container: "max-w-7xl w-full space-y-6",

  // Header Elements
  headerBox: "text-center space-y-2 py-4",
  headerTitle: "text-xl sm:text-3xl font-extrabold text-amber-400 tracking-wider flex items-center justify-center gap-3 drop-shadow-[3px_3px_0_#000]",
  headerSubtitle: "text-slate-400 text-xs sm:text-sm font-mono font-medium tracking-wide",

  // Panel Containers (3D Arcade Box Style)
  panel: "bg-[#131B2E] border-2 border-slate-700 p-4 space-y-4 shadow-[4px_4px_0px_0px_#000000]",
  gridPanel: "bg-[#131B2E] border-2 border-slate-700 p-4 flex flex-col shadow-[4px_4px_0px_0px_#000000]",

  // Buttons (3D Retro Push Buttons)
  btnAmber: "bg-amber-500 hover:bg-amber-400 active:translate-y-1 active:shadow-none text-slate-950 font-black px-4 py-2 text-xs uppercase tracking-wider transition-all border-2 border-amber-300 shadow-[3px_3px_0px_0px_#000] cursor-pointer",
  btnEmerald: "bg-emerald-500 hover:bg-emerald-400 active:translate-y-1 active:shadow-none text-slate-950 font-black px-4 py-2 text-xs uppercase tracking-wider transition-all border-2 border-emerald-300 shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-1",
  btnIndigo: "bg-indigo-600 hover:bg-indigo-500 active:translate-y-1 active:shadow-none text-white font-black px-4 py-2 text-xs uppercase tracking-wider transition-all border-2 border-indigo-400 shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-1",

  // Inputs & Controls
  input: "bg-[#090D16] border-2 border-slate-700 px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-mono w-full sm:w-48 uppercase font-bold",
  vipBadge: "flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border-2 border-amber-500/30 px-3 py-1.5 cursor-pointer hover:bg-amber-500/20 font-mono",
  boostBox: "flex items-center gap-3 bg-[#090D16] px-3 py-2 border-2 border-slate-800 w-full lg:w-auto justify-between lg:justify-start font-mono text-xs font-bold",

  // Metric Stat Boxes
  statCardAmber: "p-3 bg-[#090D16] border-2 border-amber-500/40 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2",
  statCardEmerald: "p-3 bg-[#090D16] border-2 border-emerald-500/40 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2",
  statCardSky: "p-3 bg-[#090D16] border-2 border-sky-500/40 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2",
  statCardViolet: "p-3 bg-[#090D16] border-2 border-violet-500/40 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2",

  // Badges
  badgeDone: "bg-emerald-950 text-emerald-300 border border-emerald-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono",
  badgeActive: "bg-amber-950 text-amber-300 border border-amber-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono",
  badgeRecipe: "bg-slate-950 text-amber-300 border border-amber-500/40 px-1 text-[9px] font-mono"
};
