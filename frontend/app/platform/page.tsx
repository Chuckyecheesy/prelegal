import fs from "fs";
import path from "path";
import PlatformShell from "@/components/PlatformShell";

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
  return <PlatformShell template={TEMPLATE} />;
}
