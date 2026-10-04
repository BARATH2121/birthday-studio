import type { Metadata } from "next";
import CreateFlow from "@/components/create/create-flow";

export const metadata: Metadata = {
  title: "Create a Birthday — Birthday Studio",
  description:
    "Add their details, photos and style to build a personalized birthday surprise.",
};

export default function CreatePage() {
  return (
    <main className="flex flex-col">
      <CreateFlow />
    </main>
  );
}
