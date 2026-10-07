import { AuthView } from "@neondatabase/auth/react/ui";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: PageProps<"/auth/[path]">) {
  const { path } = await params;
  return (
    <div className="flex justify-center px-4 py-12">
      <AuthView path={path} redirectTo="/dashboard" />
    </div>
  );
}
