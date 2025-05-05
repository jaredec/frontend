"use client";

import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamStore } from "@/lib/store";
import Papa from "papaparse";

const getColor = (frequency: number) => {
  if (frequency === 0) return "#f3f4f6";
  if (frequency <= 10) return "#dbeafe";
  if (frequency <= 50) return "#bfdbfe";
  if (frequency <= 200) return "#93c5fd";
  if (frequency <= 500) return "#60a5fa";
  if (frequency <= 1000) return "#3b82f6";
  if (frequency <= 2500) return "#2563eb";
  return "#1d4ed8";
};

const getFrequencyText = (frequency: number) => {
  if (frequency === 0) return "Never happened";
  if (frequency === 1) return "Happened once";
  return `Happened approximately ${frequency} times`;
};

export default function ScorigamiHeatmap() {
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const { selectedTeams } = useTeamStore();
  const maxScore = 30;
  const [baseScores, setBaseScores] = useState<{ [key: string]: number }>({});
  const [teamData, setTeamData] = useState<{ [teamId: string]: { [score: string]: number } }>({});

  useEffect(() => {
    Papa.parse("/data/mlb_scorigami_scores.csv", {
      download: true,
      header: true,
      complete: (result) => {
        const newBaseScores: { [key: string]: number } = {};
        const newTeamData: { [teamId: string]: { [score: string]: number } } = {};

        result.data.forEach((row: any) => {
          const homeScore = parseInt(row.home_score, 10);
          const awayScore = parseInt(row.away_score, 10);
          const homeTeam = row.home_team?.toLowerCase();
          const awayTeam = row.away_team?.toLowerCase();

          if (!isNaN(homeScore) && !isNaN(awayScore) && homeTeam && awayTeam) {
            const key = `${homeScore}-${awayScore}`;
            newBaseScores[key] = (newBaseScores[key] || 0) + 1;

            [homeTeam, awayTeam].forEach((teamId) => {
              if (!newTeamData[teamId]) newTeamData[teamId] = {};
              newTeamData[teamId][key] = (newTeamData[teamId][key] || 0) + 1;
            });
          }
        });

        setBaseScores(newBaseScores);
        setTeamData(newTeamData);
      },
    });
  }, []);

  const getFrequency = (score: string) => {
    if (selectedTeams.length === 0) {
      return baseScores[score] || 0;
    }
    let total = 0;
    selectedTeams.forEach((teamId) => {
      if (teamData[teamId] && teamData[teamId][score]) {
        total += teamData[teamId][score];
      }
    });
    return total;
  };

  return (
    <TooltipProvider>
      <div className="w-full overflow-auto" style={{ maxHeight: "700px" }}>
        <div className="relative">
          <div className="flex border-b border-gray-300 sticky top-0 bg-white z-10 pl-10">
            <div className="w-10 flex-shrink-0"></div>
            {Array.from({ length: maxScore + 1 }, (_, i) => (
              <div
                key={`x-${i}`}
                className="w-6 flex-shrink-0 text-xs text-center font-medium"
                style={{ height: "24px" }}
              >
                {i}
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="sticky left-0 bg-white z-10">
              {Array.from({ length: maxScore + 1 }, (_, i) => (
                <div
                  key={`y-${i}`}
                  className="h-6 w-10 flex-shrink-0 text-xs flex items-center justify-center font-medium border-r border-gray-300"
                >
                  {i}
                </div>
              ))}
            </div>

            <div>
              {Array.from({ length: maxScore + 1 }, (_, homeScore) => (
                <div key={`row-${homeScore}`} className="flex h-6">
                  {Array.from({ length: maxScore + 1 }, (_, awayScore) => {
                    const key = `${homeScore}-${awayScore}`;
                    const frequency = getFrequency(key);
                    const color = getColor(frequency);
                    const isActive = activeCell === key;

                    return (
                      <Tooltip key={`cell-${key}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-6 h-6 flex-shrink-0 cursor-pointer transition-colors duration-200 border ${
                              isActive ? "border-black" : "border-gray-100"
                            }`}
                            style={{ backgroundColor: color }}
                            onMouseEnter={() => setActiveCell(key)}
                            onMouseLeave={() => setActiveCell(null)}
                          ></div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm font-medium">Score: {key}</div>
                          <div className="text-xs text-gray-600">{getFrequencyText(frequency)}</div>
                          {selectedTeams.length > 0 && (
                            <div className="text-xs text-gray-600">
                              {selectedTeams.length} team{selectedTeams.length !== 1 ? "s" : ""} selected
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}