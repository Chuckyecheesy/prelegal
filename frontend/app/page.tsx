import fs from "fs";
import path from "path";
import NdaCreator from "@/components/NdaCreator";

function loadTemplate(): string {
  const templatePath = path.join(
    process.cwd(),
    "..",
    "templates",
    "Mutual-NDA.md"
  );
  try {
    return fs.readFileSync(templatePath, "utf-8");
  } catch {
    throw new Error(
      `Could not read Mutual NDA template at ${templatePath}. ` +
        "Ensure the templates/ directory exists at the project root."
    );
  }
}

export default function Home() {
  const template = loadTemplate();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Mutual NDA Creator
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Fill in the details below to generate a Mutual Non-Disclosure
            Agreement.
          </p>
        </div>
        <NdaCreator template={template} />
      </div>
    </main>
  );
}
