import type { Locale } from "./locale";
import { en } from "./messages/en";
import { am } from "./messages/am";
import { om } from "./messages/om";

export type Messages = typeof en;

export type Dictionary = Messages;

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  am,
  om,
};
