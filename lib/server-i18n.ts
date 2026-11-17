import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, translator, type Lang } from "./i18n.ts";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "hi";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
