import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="border-none shadow-sm w-fit">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-3xl font-bold">
            MLB Scorigami Heatmap
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ScorigamiHeatmap />
        </CardContent>
      </Card>
    </main>
  );
}
