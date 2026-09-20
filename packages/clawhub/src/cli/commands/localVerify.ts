import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { GlobalOpts } from "../types.js";
import { styleText } from "../ui.js";

type LocalSkillCheck = {
  file: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
};

type LocalSkillValidationResult = {
  path: string;
  skillMdExists: boolean;
  checks: LocalSkillCheck[];
  errors: number;
  warnings: number;
  passed: boolean;
};

const REQUIRED_SECTIONS = [
  { name: "Name", pattern: /^#\s+(.+)$/m, description: "Skill naam (eerste H1)" },
  {
    name: "Description",
    pattern: /^##\s+Description$/im,
    description: "Beschrijving van de skill",
  },
  { name: "Usage", pattern: /^##\s+Usage$/im, description: "Gebruiksinstructies" },
  { name: "Examples", pattern: /^##\s+Examples$/im, description: "Voorbeelden van gebruik" },
];

const OPTIONAL_SECTIONS = [
  {
    name: "Installation",
    pattern: /^##\s+Installation$/im,
    description: "Installatie-instructies",
  },
  {
    name: "Configuration",
    pattern: /^##\s+Configuration$/im,
    description: "Configuratiemogelijkheden",
  },
  {
    name: "Troubleshooting",
    pattern: /^##\s+Troubleshooting$/im,
    description: "Problemen oplossen",
  },
  { name: "Contributing", pattern: /^##\s+Contributing$/im, description: "Bijdrage-instructies" },
];

function checkSkillName(content: string): LocalSkillCheck {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) {
    return {
      file: "SKILL.md",
      passed: false,
      message: "Geen skill naam gevonden (eerste regel moet '# Naam' zijn)",
      severity: "error",
    };
  }
  const name = match[1].trim();
  if (name.length < 3) {
    return {
      file: "SKILL.md",
      passed: false,
      message: `Skill naam te kort (${name.length} chars, min 3): "${name}"`,
      severity: "error",
    };
  }
  if (name.length > 50) {
    return {
      file: "SKILL.md",
      passed: false,
      message: `Skill naam te lang (${name.length} chars, max 50): "${name}"`,
      severity: "warning",
    };
  }
  return {
    file: "SKILL.md",
    passed: true,
    message: `Skill naam: "${name}"`,
    severity: "info",
  };
}

function checkRequiredSections(content: string): LocalSkillCheck[] {
  const checks: LocalSkillCheck[] = [];
  for (const section of REQUIRED_SECTIONS) {
    if (section.pattern.test(content)) {
      checks.push({
        file: "SKILL.md",
        passed: true,
        message: `Verplichte sectie aanwezig: ${section.name}`,
        severity: "info",
      });
    } else {
      checks.push({
        file: "SKILL.md",
        passed: false,
        message: `Verplichte sectie ontbreekt: ${section.name} (${section.description})`,
        severity: "error",
      });
    }
  }
  return checks;
}

function checkOptionalSections(content: string): LocalSkillCheck[] {
  const checks: LocalSkillCheck[] = [];
  for (const section of OPTIONAL_SECTIONS) {
    if (section.pattern.test(content)) {
      checks.push({
        file: "SKILL.md",
        passed: true,
        message: `Optionele sectie aanwezig: ${section.name}`,
        severity: "info",
      });
    } else {
      checks.push({
        file: "SKILL.md",
        passed: true,
        message: `Optionele sectie ontbreekt: ${section.name} (${section.description})`,
        severity: "warning",
      });
    }
  }
  return checks;
}

function checkMarkdownHeadingHierarchy(content: string): LocalSkillCheck {
  const lines = content.split("\n");
  let lastLevel = 0;
  let hasError = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    const text = headingMatch[2].trim();

    if (level > lastLevel + 1 && lastLevel > 0) {
      hasError = true;
      return {
        file: "SKILL.md",
        passed: false,
        message: `Heading niveau springt te veel: van H${lastLevel} naar H${level} ("${text}")`,
        severity: "warning",
      };
    }
    lastLevel = level;
  }

  return {
    file: "SKILL.md",
    passed: true,
    message: hasError ? "Heading hiërarchie heeft kleine problemen" : "Heading hiërarchie correct",
    severity: hasError ? "warning" : "info",
  };
}

async function checkFileCount(directory: string): Promise<LocalSkillCheck | null> {
  try {
    const files = await readdir(directory);
    const hasSkillMd = files.includes("SKILL.md");
    const otherFiles = files.filter((f) => f !== "SKILL.md" && !f.startsWith("."));

    if (!hasSkillMd) {
      return {
        file: directory,
        passed: false,
        message: "SKILL.md niet gevonden in skill-directory",
        severity: "error",
      };
    }

    if (otherFiles.length === 0) {
      return {
        file: directory,
        passed: true,
        message:
          "SKILL.md alleen aanwezig — overweeg bijbehorende bestanden (templates, scripts, etc.)",
        severity: "warning",
      };
    }

    return {
      file: directory,
      passed: true,
      message: `${otherFiles.length} bijbehorende bestanden naast SKILL.md`,
      severity: "info",
    };
  } catch {
    return null;
  }
}

/**
 * Valideer een lokale skill-directory op structuur en inhoud.
 */
export async function cmdVerifyLocalSkill(
  _opts: GlobalOpts,
  skillPath: string,
  options: { json?: boolean; strict?: boolean } = {},
): Promise<LocalSkillValidationResult> {
  const resolvedPath = resolve(skillPath);
  const skillMdPath = join(resolvedPath, "SKILL.md");

  let skillMdExists = false;
  try {
    await stat(skillMdPath);
    skillMdExists = true;
  } catch {
    skillMdExists = false;
  }

  const checks: LocalSkillCheck[] = [];

  if (!skillMdExists) {
    checks.push({
      file: "SKILL.md",
      passed: false,
      message: `SKILL.md niet gevonden op ${skillMdPath}`,
      severity: "error",
    });
    return {
      path: resolvedPath,
      skillMdExists: false,
      checks,
      errors: 1,
      warnings: 0,
      passed: false,
    };
  }

  let content: string;
  try {
    content = await readFile(skillMdPath, { encoding: "utf-8" });
  } catch (error) {
    checks.push({
      file: "SKILL.md",
      passed: false,
      message: `Cannot read SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
      severity: "error",
    });
    return {
      path: resolvedPath,
      skillMdExists: true,
      checks,
      errors: 1,
      warnings: 0,
      passed: false,
    };
  }

  if (content.length === 0) {
    checks.push({
      file: "SKILL.md",
      passed: false,
      message: "SKILL.md is leeg",
      severity: "error",
    });
    return {
      path: resolvedPath,
      skillMdExists: true,
      checks,
      errors: 1,
      warnings: 0,
      passed: false,
    };
  }

  checks.push(checkSkillName(content));
  checks.push(...checkRequiredSections(content));
  checks.push(...checkOptionalSections(content));
  checks.push(checkMarkdownHeadingHierarchy(content));

  const fileCheck = await checkFileCount(resolvedPath);
  if (fileCheck) checks.push(fileCheck);

  const errors = checks.filter((c) => c.severity === "error").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;
  const passed = errors === 0 && (!options.strict || warnings === 0);

  return {
    path: resolvedPath,
    skillMdExists: true,
    checks,
    errors,
    warnings,
    passed,
  };
}

/**
 * Print een lokale validatie-resultaat in human-readable formaat.
 */
export function printLocalValidationResult(result: LocalSkillValidationResult): void {
  console.log("");
  console.log(
    `${styleText("┌─", "brand")} ${styleText("Local Skill Validation", "brand")} ${styleText("─".repeat(40), "muted")}`,
  );
  console.log(`${styleText("│", "brand")} ${styleText(result.path, "strong")}`);
  console.log(styleText("│", "brand"));

  if (!result.skillMdExists) {
    console.log(`${styleText("│", "brand")} ${styleText("✗ SKILL.md not found", "error")}`);
    console.log(`${styleText("└", "brand")}${styleText("─".repeat(56), "muted")}`);
    return;
  }

  for (const check of result.checks) {
    const icon = check.passed ? "✓" : check.severity === "error" ? "✗" : "!";
    const color = check.passed ? "strong" : check.severity === "error" ? "error" : "warning";
    const prefix = check.severity === "info" ? "  " : "";
    console.log(`${styleText("│", "brand")} ${prefix}${styleText(icon, color)} ${check.message}`);
  }

  console.log(styleText("│", "brand"));
  console.log(
    `${styleText("│", "brand")} ${styleText(
      `Errors: ${result.errors}`,
      result.errors > 0 ? "error" : "strong",
    )}${styleText("  ", "muted")}${styleText(
      `Warnings: ${result.warnings}`,
      result.warnings > 0 ? "warning" : "strong",
    )}`,
  );
  console.log(
    `${styleText("│", "brand")} ${styleText(
      `Status: ${result.passed ? "PASSED" : "FAILED"}`,
      result.passed ? "strong" : "error",
    )}`,
  );
  console.log(`${styleText("└", "brand")}${styleText("─".repeat(56), "muted")}`);
  console.log("");
}
