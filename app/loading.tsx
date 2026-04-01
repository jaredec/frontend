import NavBar from "@/components/nav-bar";

export default function HomeLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-start justify-center pt-24">
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 animate-spin" />
      </main>
    </div>
  );
}
