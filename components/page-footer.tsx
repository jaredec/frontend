import { Mail } from "lucide-react";

const XLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1200 1227" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
    <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" />
  </svg>
);

export default function PageFooter() {
  return (
    <footer className="border-t border-slate-200/60 dark:border-[#2c2c2c] mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              Created by{" "}
              <a
                href="https://www.linkedin.com/in/jared-connolly/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Jared Connolly
              </a>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-[#383838]">|</span>
            <a
              href="https://x.com/MLBgami"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <XLogoIcon className="w-3 h-3" />
              <span>@MLBgami</span>
            </a>
            <a
              href="mailto:scorigami.mlb@gmail.com"
              className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Mail className="w-3 h-3" />
              <span>Contact</span>
            </a>
          </div>
          <p className="text-center sm:text-right max-w-md">
            Modern game results via MLB Stats API. Federal League &amp; 1871–1900 records from{" "}
            <a
              href="https://www.retrosheet.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Retrosheet
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
