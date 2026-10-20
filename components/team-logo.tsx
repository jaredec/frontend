/* eslint-disable @next/next/no-img-element */
import { getTeamCapUrl } from "@/lib/mlb-data";

/**
 * Team cap (or the site mark for "ALL") that follows the site theme in CSS:
 * both variants are in the DOM and `.dark` picks one, so a theme switch needs
 * no re-render. Lazy-loading keeps the hidden variant from downloading.
 */
export default function TeamLogo({ code, className = "" }: { code: string; className?: string }) {
  const light = getTeamCapUrl(code, false);
  const dark = getTeamCapUrl(code, true);
  if (!light || !dark) {
    return <img src="/logo3.svg" alt="" className={`${className} dark:invert dark:opacity-90`} />;
  }
  return (
    <>
      <img src={light} alt="" loading="lazy" className={`${className} dark:hidden`} />
      <img src={dark} alt="" loading="lazy" className={`${className} hidden dark:block`} />
    </>
  );
}
