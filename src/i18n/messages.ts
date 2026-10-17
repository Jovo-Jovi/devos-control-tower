import en from "./messages/en.json";

export type Messages = typeof en;

export function getMessages(): Messages {
  return en;
}
