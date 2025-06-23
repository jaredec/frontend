import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Linkedin, X, Mail } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900/95 flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          MLB Scorigami
        </h1>
      </div>

      <div className="w-full max-w-4xl mx-auto space-y-8">
        <ScorigamiHeatmap />

        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/60 shadow-lg">
          <CardContent className="p-6 grid md:grid-cols-3 gap-x-8 gap-y-6">
            
            <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">What is MLB Scorigami?</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
                    <p>
                        MLB Scorigami tracks all final scores in Major League Baseball history. Many scores still haven't occurred. It's always exciting when a 'Scorigami' happens—a final score that's never been seen before.
                    </p>
                    <p>
                        This project not only captures the frequency of scores, but also celebrates those rare, brand new scores. It was inspired by the original <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">NFL Scorigami</a> by Jon Bois.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Data Source</h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md">
                  <p>
                    The information used here was obtained free of
                    charge from and is copyrighted by Retrosheet. Interested
                    parties may contact Retrosheet at 20 Sunset Rd.,
                    Newark, DE 19711.
                  </p>
                </div>
            </div>

          </CardContent>

          <CardFooter className="bg-gray-50 dark:bg-gray-900/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-lg">
              <div className="text-center sm:text-left">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Scorigami updates on X:</p>
                  <a href="https://x.com/MLB_Scorigami_" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">@MLB_Scorigami_</a>
              </div>
              <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Created by Jared Connolly</span>
                  <div className="flex items-center gap-4">
                      <a href="https://www.linkedin.com/in/jared-connolly/" target="_blank" rel="noopener noreferrer" aria-label="Jared Connolly's LinkedIn" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                          <Linkedin className="h-5 w-5" />
                      </a>
                      <a href="mailto:jaredconnolly5@gmail.com" aria-label="Email Jared Connolly" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                          <Mail className="h-5 w-5" />
                      </a>
                  </div>
              </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}