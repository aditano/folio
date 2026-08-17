import { createFileRoute } from "@tanstack/react-router";
import { OcrStudio } from "@/components/folio/ocr-studio";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <OcrStudio />;
}
