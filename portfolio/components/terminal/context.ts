"use client";

import { createContext, useContext, type Dispatch } from "react";

import type { DrawerTarget, TerminalAction } from "@/lib/terminal/reducer";
import type { MessageDraft, ThemeName } from "@/lib/terminal/types";
import type { Source } from "@/lib/types";

export type TerminalApi = {
  sources: Source[];
  byId: Record<string, Source>;
  dispatch: Dispatch<TerminalAction>;
  submit: (text: string, silent?: boolean) => void;
  focus: () => void;
  openSource: (id: string, entryId?: number) => void;
  openPane: (id: string) => void;
  copyLink: (id: string) => Promise<boolean>;
  copyText: (text: string) => Promise<boolean>;
  fitTypeMode: () => void;
  fitFile: (file: File) => void;
  sendMessage: (draft: MessageDraft) => void;
  openVoice: () => void;
  openShare: () => void;
  openResume: () => void;
  openDrawer: (target: DrawerTarget) => void;
};

export type TerminalView = {
  theme: ThemeName;
  isMobile: boolean;
  contrib: number[] | null;
  landing: boolean;
};

export const ApiContext = createContext<TerminalApi | null>(null);
export const ViewContext = createContext<TerminalView>({
  theme: "default",
  isMobile: false,
  contrib: null,
  landing: true,
});

export function useTerminal() {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useTerminal outside <Terminal>");
  return api;
}

export const useTerminalView = () => useContext(ViewContext);
