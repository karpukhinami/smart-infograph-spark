import { createFileRoute } from "@tanstack/react-router";
import { SimpleHome } from "./index";

export const Route = createFileRoute("/view_all")({
  head: () => ({ meta: [{ title: "AI Infographic Generator" }] }),
  component: SimpleHome,
});
