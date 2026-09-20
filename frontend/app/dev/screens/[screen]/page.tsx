import { ScreenHarness } from "@/components/dev/screen-harness";

/** The catalogue holds JSX and component references, so it is client-side and cannot
 * be read here -- an RSC boundary turns its exports into references, not values. This
 * passes the id along and the harness resolves it. */
export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { screen } = await params;
  const { state } = await searchParams;

  // Keyed so a different state remounts: the offline seams are installed once per
  // mount, and switching state changes what they answer.
  return (
    <ScreenHarness
      key={`${screen}:${state ?? ""}`}
      screenId={screen}
      stateId={state ?? null}
    />
  );
}
