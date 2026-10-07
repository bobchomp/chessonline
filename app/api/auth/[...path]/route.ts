import { getAuth } from "@/lib/auth/server";

type Handler = ReturnType<ReturnType<typeof getAuth>["handler"]>;
let handler: Handler | undefined;

export function GET(...args: Parameters<Handler["GET"]>) {
  handler ??= getAuth().handler();
  return handler.GET(...args);
}

export function POST(...args: Parameters<Handler["POST"]>) {
  handler ??= getAuth().handler();
  return handler.POST(...args);
}
