import { Terminal } from "@/components/terminal";
import { loadSources, orderSources } from "@/lib/content";

export default function Page() {
  const sources = orderSources(loadSources());
  return (
    <>
      <main className="sr-only">
        <h1>Nandisha D — Generative AI Engineer</h1>
        <p>{sources.find((s) => s.id === "resume-summary")?.text}</p>
      </main>
      <Terminal sources={sources} bookingUrl={process.env.NEXT_PUBLIC_BOOKING_URL} />
    </>
  );
}
