import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold">
            MLB Scorigami Heatmap
          </CardTitle>
          <CardDescription>
            Visualization of final scores in MLB history. Each box represents a
            score combination, with color intensity indicating how many times
            that score has occurred.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* one heat-map, built-in dropdown */}
          <ScorigamiHeatmap />
        </CardContent>
      </Card>
    </main>
  );
}
