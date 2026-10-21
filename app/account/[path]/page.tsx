import { AccountView } from "@neondatabase/auth/react/ui";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";
import { UsernameSettings } from "@/components/username-settings";
import { Page, PageHeader } from "@/components/ui/page";

export const dynamicParams = false;

export function generateStaticParams() {
  return [accountViewPaths.SETTINGS, accountViewPaths.SECURITY].map((path) => ({ path }));
}

export default async function AccountPage({ params }: PageProps<"/account/[path]">) {
  const { path } = await params;
  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Your username, avatar, email and password." />
      {path === accountViewPaths.SETTINGS && <UsernameSettings />}
      <AccountView path={path} />
    </Page>
  );
}
