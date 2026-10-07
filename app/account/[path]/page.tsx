import { AccountView } from "@neondatabase/auth/react/ui";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";
import { UsernameSettings } from "@/components/username-settings";

export const dynamicParams = false;

export function generateStaticParams() {
  return [accountViewPaths.SETTINGS, accountViewPaths.SECURITY].map((path) => ({ path }));
}

export default async function AccountPage({ params }: PageProps<"/account/[path]">) {
  const { path } = await params;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {path === accountViewPaths.SETTINGS && <UsernameSettings />}
      <AccountView path={path} />
    </div>
  );
}
