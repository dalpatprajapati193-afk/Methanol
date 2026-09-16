import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { nextUrl } = request;

  const isAuthPage = nextUrl.pathname.startsWith("/api/auth");
  const isPublicPage = 
    nextUrl.pathname.startsWith("/reformer-configurator") ||
    nextUrl.pathname.startsWith("/api/reformer") ||
    nextUrl.pathname.startsWith("/api/synthesis") ||
    nextUrl.pathname.startsWith("/pfd") ||
    nextUrl.pathname.endsWith(".png") ||
    nextUrl.pathname.endsWith(".svg") ||
    nextUrl.pathname.endsWith(".jpg") ||
    nextUrl.pathname.endsWith(".ico");

  if (isPublicPage) {
    return null;
  }

  if (isAuthPage) {
    if (session) {
      return Response.redirect(new URL("/instance-explorer", nextUrl));
    }
    return null;
  }

  if (!session) {
    return Response.redirect(new URL("/api/auth/signin", nextUrl));
  }
};

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
