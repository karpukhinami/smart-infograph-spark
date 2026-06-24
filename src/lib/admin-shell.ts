/** Admin UI shell (header with debug controls) is shown only on /view_all. */
export function isAdminShellPath(pathname: string): boolean {
  return pathname === "/view_all" || pathname.startsWith("/view_all/");
}
