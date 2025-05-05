"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTeamStore, teams, allTeams } from "@/lib/store"

export default function TeamFilters() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const { selectedTeams, selectTeam, deselectTeam, selectAll, deselectAll, selectDivision, selectLeague } =
    useTeamStore()

  const selectedCount = selectedTeams.length

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between w-[200px]">
              {selectedCount > 0 ? (
                <>
                  <span>
                    {selectedCount} team{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                  <Badge variant="secondary" className="ml-2 rounded-sm px-1">
                    {selectedCount}
                  </Badge>
                </>
              ) : (
                <span>Select teams</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center border-b px-3">
                <TabsList className="h-10">
                  <TabsTrigger value="all" className="text-xs">
                    All Teams
                  </TabsTrigger>
                  <TabsTrigger value="al" className="text-xs">
                    American League
                  </TabsTrigger>
                  <TabsTrigger value="nl" className="text-xs">
                    National League
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="all" className="p-0">
                <Command>
                  <CommandInput placeholder="Search teams..." />
                  <CommandList>
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup>
                      <div className="flex items-center px-2 py-1.5">
                        <Button variant="outline" size="sm" className="mr-2 h-8" onClick={() => selectAll()}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => deselectAll()}>
                          Clear All
                        </Button>
                      </div>
                    </CommandGroup>
                    <CommandSeparator />
                    {Object.entries(teams).map(([division, divisionTeams]) => (
                      <CommandGroup key={division} heading={division}>
                        <div className="px-2 py-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-xs"
                            onClick={() => selectDivision(divisionTeams.map((t) => t.id))}
                          >
                            Select Division
                          </Button>
                        </div>
                        {divisionTeams.map((team) => (
                          <CommandItem
                            key={team.id}
                            onSelect={() => {
                              if (selectedTeams.includes(team.id)) {
                                deselectTeam(team.id)
                              } else {
                                selectTeam(team.id)
                              }
                            }}
                          >
                            <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                            <span>{team.name}</span>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedTeams.includes(team.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </TabsContent>
              <TabsContent value="al" className="p-0">
                <Command>
                  <CommandInput placeholder="Search AL teams..." />
                  <CommandList>
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup>
                      <div className="flex items-center px-2 py-1.5">
                        <Button variant="outline" size="sm" className="mr-2 h-8" onClick={() => selectLeague("AL")}>
                          Select All AL
                        </Button>
                      </div>
                    </CommandGroup>
                    <CommandSeparator />
                    {["AL East", "AL Central", "AL West"].map((division) => (
                      <CommandGroup key={division} heading={division}>
                        <div className="px-2 py-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-xs"
                            onClick={() => selectDivision(teams[division].map((t) => t.id))}
                          >
                            Select Division
                          </Button>
                        </div>
                        {teams[division].map((team) => (
                          <CommandItem
                            key={team.id}
                            onSelect={() => {
                              if (selectedTeams.includes(team.id)) {
                                deselectTeam(team.id)
                              } else {
                                selectTeam(team.id)
                              }
                            }}
                          >
                            <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                            <span>{team.name}</span>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedTeams.includes(team.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </TabsContent>
              <TabsContent value="nl" className="p-0">
                <Command>
                  <CommandInput placeholder="Search NL teams..." />
                  <CommandList>
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup>
                      <div className="flex items-center px-2 py-1.5">
                        <Button variant="outline" size="sm" className="mr-2 h-8" onClick={() => selectLeague("NL")}>
                          Select All NL
                        </Button>
                      </div>
                    </CommandGroup>
                    <CommandSeparator />
                    {["NL East", "NL Central", "NL West"].map((division) => (
                      <CommandGroup key={division} heading={division}>
                        <div className="px-2 py-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-xs"
                            onClick={() => selectDivision(teams[division].map((t) => t.id))}
                          >
                            Select Division
                          </Button>
                        </div>
                        {teams[division].map((team) => (
                          <CommandItem
                            key={team.id}
                            onSelect={() => {
                              if (selectedTeams.includes(team.id)) {
                                deselectTeam(team.id)
                              } else {
                                selectTeam(team.id)
                              }
                            }}
                          >
                            <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                            <span>{team.name}</span>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedTeams.includes(team.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap gap-1">
          {selectedTeams.length > 0 ? (
            selectedTeams.map((teamId) => {
              const team = allTeams.find((t) => t.id === teamId)
              if (!team) return null
              return (
                <Badge
                  key={team.id}
                  variant="secondary"
                  className="rounded-sm"
                  style={{
                    backgroundColor: `${team.color}20`,
                    borderColor: team.color,
                    color: team.color,
                  }}
                >
                  {team.name}
                  <button
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => deselectTeam(team.id)}
                  >
                    <span className="sr-only">Remove {team.name}</span>×
                  </button>
                </Badge>
              )
            })
          ) : (
            <div className="text-sm text-muted-foreground">No teams selected. Showing data for all teams.</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => selectAll()}>
          All Teams
        </Button>
        <Button variant="outline" size="sm" onClick={() => selectLeague("AL")}>
          American League
        </Button>
        <Button variant="outline" size="sm" onClick={() => selectLeague("NL")}>
          National League
        </Button>
        {Object.keys(teams).map((division) => (
          <Button
            key={division}
            variant="outline"
            size="sm"
            onClick={() => selectDivision(teams[division].map((t) => t.id))}
          >
            {division}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#dbeafe]"></div>
          <span>Very rare</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#93c5fd]"></div>
          <span>Uncommon</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#60a5fa]"></div>
          <span>Common</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#2563eb]"></div>
          <span>Very common</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#1d4ed8]"></div>
          <span>Extremely common</span>
        </div>
      </div>
    </div>
  )
}
