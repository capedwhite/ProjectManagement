import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/signup"];
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  let isValidToken = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      isValidToken = true;
    } catch {
      isValidToken = false; // expired, tampered, or wrong secret
    }
  }

  if (isValidToken && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isValidToken && !isPublicPath) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token"); // clean up a bad/expired cookie
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};