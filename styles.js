/**
 * Styles Configuration for Sunflower Land Chapter Tracker
 * High-contrast arcade/slate dashboard theme using standard Tailwind utility classes.
 */

export const STYLES = {
  // Global Page & Outer Layout
  body: "bg-slate-900 text-slate-100 min-h-screen p-4 sm:p-8 flex flex-col items-center font-mono selection:bg-amber-400 selection:text-slate-950",
  container: "max-w-7xl w-full space-y-6",

  // Header Elements
  headerBox: "text-center space-y-2 py-2",
  headerTitle: "text-2xl sm:text-3xl font-black text-amber-400 flex items-center justify-center gap-3 tracking-wider drop-shadow",
  headerSubtitle: "text-slate-400 text-xs sm:text-sm font-bold tracking-wide",

  // Container Panels
  panel: "bg-slate-800 border-2 border-slate-700 p-4 space-y-4 shadow-xl rounded-xl",
  gridColumn: "bg-slate-800 border-2 border-slate-700 p-4 shadow-xl rounded-xl flex flex-col",

  // Action Buttons
  btnAmber: "flex-1 lg:flex-initial bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all rounded-lg shadow-md cursor-pointer",
  btnEmerald: "flex-1 lg:flex-initial bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1",
  btnIndigo: "flex-1 lg:flex-initial bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black px-4 py-2.5 text-xs uppercase tracking-wider transition-all rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-1",

  // Control Inputs & Checkboxes
  input: "bg-slate-950 border-2 border-slate-600 px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 w-full sm:w-48 font-bold rounded-lg",
  vipBadge: "flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border-2 border-amber-500/30 px-3 py-1.5 cursor-pointer hover:bg-amber-500/20 rounded-lg",
  boostBox: "flex items-center gap-3 bg-slate-950 px-3 py-2 border-2 border-slate-700 rounded-lg w-full lg:w-auto justify-between lg:justify-start text-xs font-bold",

  // Metric Summary Cards
  statCardAmber: "p-3 bg-slate-950 border-2 border-amber-500/40 rounded-lg flex flex-col justify-between space-y-2",
  statCardEmerald: "p-3 bg-slate-950 border-2 border-emerald-500/40 rounded-lg flex flex-col justify-between space-y-2",
  statCardSky: "p-3 bg-slate-950 border-2 border-sky-500/40 rounded-lg flex flex-col justify-between space-y-2",
  statCardViolet: "p-3 bg-slate-950 border-2 border-violet-500/40 rounded-lg flex flex-col justify-between space-y-2",

  // Status & Item Badges
  badgeDone: "bg-emerald-950 text-emerald-300 border border-emerald-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded",
  badgeActive: "bg-amber-950 text-amber-300 border border-amber-500/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded",
  badgeRecipe: "bg-slate-950 text-amber-300 border border-amber-500/40 px-1 text-[9px] rounded",
  badgeChapterNpc: "text-[9px] bg-amber-500 text-slate-950 px-1 font-black rounded",

  // Task / Order Inner Item Cards
  itemCardDone: "bg-slate-950 p-3 border-2 border-emerald-500/40 opacity-75 text-xs space-y-2.5 rounded-lg",
  itemCardActive: "bg-slate-950 p-3 border-2 border-amber-500/40 text-xs space-y-2.5 rounded-lg",
  itemCardDefault: "bg-slate-950 p-3 border-2 border-slate-700 text-xs space-y-2.5 rounded-lg",

  // Modal Dialog
  modalOverlay: "hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4",
  modalBox: "bg-slate-800 border-2 border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl rounded-xl"
};
