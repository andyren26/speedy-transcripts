// Shared by the support form (browser) and POST /api/support (server).

export const SUPPORT_CATEGORIES = [
  { value: "account", label: "帳號與登入" },
  { value: "credits", label: "點數與付款" },
  { value: "transcription", label: "上傳與轉錄" },
  { value: "other", label: "其他問題" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export function categoryLabel(value: string) {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const SUBJECT_MAX = 200;
export const MESSAGE_MAX = 5000;
