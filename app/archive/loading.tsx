import NavBar from "@/components/nav-bar";

export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 flex items-start justify-center pt-24">
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 animate-spin" />
      </main>
    </div>
  );
}
