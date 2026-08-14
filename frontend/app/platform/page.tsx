import fs from "fs";
import path from "path";
import NdaCreator from "@/components/NdaCreator";

// Read once at module load — no per-request disk I/O.
// Template lives inside frontend/ so process.cwd() is always the right root.
const TEMPLATE: string = (() => {
  const templatePath = path.join(
    process.cwd(),
    "templates",
    "Mutual-NDA.md"
  );
  try {
    return fs.readFileSync(templatePath, "utf-8");
  } catch {
    throw new Error(
      `Could not read Mutual NDA template at ${templatePath}. ` +
        "Ensure frontend/templates/Mutual-NDA.md exists."
    );
  }
})();

export default function PlatformPage() {
  const template = TEMPLATE;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Mutual NDA Creator
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Chat with the assistant below to generate a Mutual Non-Disclosure
            Agreement.
          </p>
        </div>
        <NdaCreator template={template} />
      </div>
    </main>
  );
}
