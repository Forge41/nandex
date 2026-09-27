import type { Metadata } from "next";

import { PortfolioPage } from "@/components/portfolio-page";

export const metadata: Metadata = {
  title: "Contact — Nandisha",
  description: "Leave Nandisha a message.",
};

export default function ContactPage() {
  return <PortfolioPage initialCommand="/message" />;
}
