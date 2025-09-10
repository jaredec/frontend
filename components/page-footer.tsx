import { Mail } from "lucide-react";

const XLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1200 1227" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
    <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" />
  </svg>
);

export default function PageFooter() {
  return (
    <footer className="w-full mt-8 pb-8">
      <div className="container mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
        <div className="border-t border-slate-200 dark:border-gray-700 pt-8 flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-4">
            <p>Created by <a href="https://www.linkedin.com/in/jared-connolly/" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline text-blue-600 dark:text-blue-400">Jared Connolly</a></p>
            <div className="h-4 w-px bg-slate-300 dark:bg-gray-600 hidden sm:block"></div>
            <div className="flex items-center gap-4">
                <a href="https://x.com/MLB_Scorigami_" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <XLogoIcon className="w-3.5 h-3.5" />
                    <span>@MLB_Scorigami_</span>
                </a>
                <a href="mailto:scorigami.mlb@gmail.com" className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <Mail className="w-4 h-4" />
                    <span>Contact</span>
                </a>
            </div>
        </div>
      </div>
    </footer>
  );
}