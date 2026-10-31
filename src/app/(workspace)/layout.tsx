import { Workspace } from "@/components/workspace";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Workspace>{children}</Workspace>;
}
