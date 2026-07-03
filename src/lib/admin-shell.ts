/** Debug/admin routes that show the top nav + CostMeter. Public home `/` is excluded. */
const ADMIN_SHELL_PREFIXES = [
  "/view_all",
  "/workspace",
  "/styles",
  "/design-profiles",
  "/prompts",
] as const;

export function isAdminShellPath(pathname: string): boolean {
  return ADMIN_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
