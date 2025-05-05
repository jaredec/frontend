import { Card, CardContent } from "@/components/ui/card"

export default function ScorigamiLegend() {
  const legendItems = [
    { color: "#f3f4f6", label: "Never happened" },
    { color: "#dbeafe", label: "Very rare (1-10 times)" },
    { color: "#bfdbfe", label: "Rare (11-50 times)" },
    { color: "#93c5fd", label: "Uncommon (51-200 times)" },
    { color: "#60a5fa", label: "Somewhat common (201-500 times)" },
    { color: "#3b82f6", label: "Common (501-1000 times)" },
    { color: "#2563eb", label: "Very common (1001-2500 times)" },
    { color: "#1d4ed8", label: "Extremely common (2500+ times)" },
  ]

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
