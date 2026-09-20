"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Eyebrow } from "@/components/ui/typography";
import { SCREENS } from "@/lib/dev/screens";

export default function ScreensIndexPage() {
  return (
    <main className="min-h-dvh bg-surface px-6 py-12 text-content">
      <div className="mx-auto max-w-[76ch]">
        <Eyebrow>Development</Eyebrow>
        <h1 className="t-h2 mt-2">Screens</h1>
        <p className="t-body mt-2 leading-[1.7] text-content-subtle">
          Every screen, in every state worth looking at, from fixtures. Nothing here
          reaches the network — what a screen tries to call is listed on the page itself.
        </p>

        <Banner tone="warning" className="mt-5">
          <span>
            These prove a screen renders and nothing else. Verify a change against{" "}
            <Link href="/dev/session" className="underline">
              a seeded session
            </Link>{" "}
            before merging it.
          </span>
        </Banner>

        <div className="mt-7 flex flex-col gap-5">
          {SCREENS.map((screen) => (
            <div key={screen.id}>
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-medium">{screen.label}</h2>
                {!screen.shipped && <Badge tone="warning">not shipped</Badge>}
              </div>
              <p className="t-xs mt-0.5 text-content-muted">{screen.note}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {screen.states.map((state) => (
                  <Link
                    key={state.id}
                    href={`/dev/screens/${screen.id}?state=${state.id}`}
                    title={state.note}
                    className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5 text-xs transition-colors hover:border-line-interactive"
                  >
                    {state.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
