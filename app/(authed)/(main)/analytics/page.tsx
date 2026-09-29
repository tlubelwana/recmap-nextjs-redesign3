import { redirect } from "next/navigation";

/**
 * Charts moved into the Map's view switcher, alongside Map / Matrix / List,
 * so they plot whatever the map's filters currently select rather than
 * always the whole catalog. The chart code now lives in
 * components/CatalogCharts.tsx.
 *
 * This route stays as a redirect rather than being deleted: /analytics was
 * linked from the nav and may be bookmarked or referenced in the help
 * page, and a 404 is a worse answer than the charts themselves.
 */
export default function AnalyticsPage() {
  redirect("/map?view=charts");
}
