import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { describe, expect, it } from "vitest";
import type { GlobalOpts } from "../../types.js";
import { cmdVerifyLocalSkill } from "./localVerify.js";

const mockOpts: GlobalOpts = {
  workdir: ".",
  dir: "skills",
  site: "https://clawhub.ai",
  registry: "https://clawhub.ai",
  registrySource: "default",
};

describe("cmdVerifyLocalSkill", () => {
  it("validates a well-structured SKILL.md", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "clawhub-verify-"));
    const skillDir = join(tmpDir, "test-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `# Test Skill
## Description
A test skill for validation.

## Usage
Use this skill for testing.

## Examples
Example 1: Basic usage
`,
    );

    const result = await cmdVerifyLocalSkill(mockOpts, skillDir, {});

    await rm(tmpDir, { recursive: true, force: true });

    expect(result.skillMdExists).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBeGreaterThan(0);
  });

  it("detects missing required sections", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "clawhub-verify-"));
    const skillDir = join(tmpDir, "invalid-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `# Invalid Skill
## Usage
Just usage.
`,
    );
    const result = await cmdVerifyLocalSkill(mockOpts, skillDir, {});
    await rm(tmpDir, { recursive: true, force: true });

    expect(result.skillMdExists).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
  });

  it("detects empty SKILL.md", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "clawhub-verify-"));
    const skillDir = join(tmpDir, "empty-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "");
    const result = await cmdVerifyLocalSkill(mockOpts, skillDir, {});
    await rm(tmpDir, { recursive: true, force: true });

    expect(result.skillMdExists).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.errors).toBe(1);
  });

  it("handles missing SKILL.md gracefully", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "clawhub-verify-"));
    const skillDir = join(tmpDir, "no-skill-md");
    await mkdir(skillDir, { recursive: true });
    const result = await cmdVerifyLocalSkill(mockOpts, skillDir, {});
    await rm(tmpDir, { recursive: true, force: true });

    expect(result.skillMdExists).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.errors).toBe(1);
  });
});
