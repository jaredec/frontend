import { getYearlyScorigami } from "@/lib/scorigami-queries";
import SWRProvider from "@/components/swr-provider";
import ScorigamiPage from "@/components/scorigami-page";

export const revalidate = 3600;

export default async function Home() {
  const data = await getYearlyScorigami("ALL", "traditional");

  return (
    <SWRProvider
      fallback={{
        "/api/scorigami?team=ALL&type=traditional&mode=yearly": data,
      }}
    >
      <ScorigamiPage />
    </SWRProvider>
  );
}
