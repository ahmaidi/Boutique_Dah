import type { AnchorHTMLAttributes } from "react";
import { appHref } from "@/lib/app-href";
// Document navigation lets the service worker serve cached route shells offline.
export default function AppLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  return <a {...props} href={props.href ? appHref(props.href) : undefined} />;
}
