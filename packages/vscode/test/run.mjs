import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

delete process.env.ELECTRON_RUN_AS_NODE;

await runTests({
  extensionDevelopmentPath: fileURLToPath(new URL("..", import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL("./suite.cjs", import.meta.url)),
  launchArgs: ["--disable-extensions", "--disable-gpu", "--skip-welcome", "--skip-release-notes"],
});
