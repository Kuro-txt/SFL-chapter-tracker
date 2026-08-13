// Retro Pixel Theme Style Classes for SFL Tracker

export const PIXEL_STYLES = {
  // Page Body & Pixel Background Pattern
  body: "bg-emerald-950 text-amber-100 min-h-screen p-4 sm:p-8 flex flex-col items-center font-mono selection:bg-amber-500 selection:text-slate-950",
  
  // Outer Container
  container: "max-w-7xl w-full space-y-6",

  // Header Title
  headerTitle: "text-2xl sm:text-4xl font-extrabold text-amber-400 flex items-center justify-center gap-3 tracking-wider drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]",
  headerSubtitle: "text-amber-200/80 text-xs sm:text-sm tracking-wide font-bold",

  // Card Containers with 8-bit Box Borders
  cardBox: "bg-slate-900 border-4 border-slate-700 p-4 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.8)] rounded-none",
  columnCard: "bg-slate-900 border-4 border-slate-700 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.8)] flex flex-col rounded-none",

  // Buttons
  btnAmber: "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black px-4 py-2 text-xs uppercase transition-transform active:translate-y-1 border-b-4 border-r-4 border-amber-700 cursor-pointer",
  btnEmerald: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black px-4 py-2 text-xs uppercase transition-transform active:translate-y-1 border-b-4 border-r-4 border-emerald-900 cursor-pointer flex items-center justify-center gap-1",
  btnIndigo: "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black px-4 py-2 text-xs uppercase transition-transform active:translate-y-1 border-b-4 border-r-4 border-indigo-900 cursor-pointer flex items-center justify-center gap-1",

  // Inputs & Checkboxes
  inputMono: "bg-slate-950 border-2 border-slate-600 px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-mono rounded-none uppercase",
  checkboxLabel: "flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-950/80 border-2 border-amber-500/50 px-3 py-1.5 rounded-none cursor-pointer hover:bg-amber-900/50",

  // Section Headers
  sectionHeader: "text-sm font-bold pb-2 border-b-4 border-slate-700 flex justify-between items-center tracking-wider uppercase",
  
  // Status Badges
  badgeDone: "bg-emerald-950 text-emerald-400 border-2 border-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase",
  badgeActive: "bg-amber-950 text-amber-400 border-2 border-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase",
  badgeRecipe: "bg-slate-950 text-amber-300 border border-amber-500/50 px-1 text-[9px] uppercase",
  
  // Summary Stats Stat Boxes
  statBox: "p-3 bg-slate-950 border-2 flex flex-col justify-between space-y-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] rounded-none"
};
