import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const cargoBin = path.join(homedir(), ".cargo", "bin");
const sep = path.delimiter;

if (existsSync(cargoBin)) {
  process.env.PATH = `${cargoBin}${sep}${process.env.PATH ?? ""}`;
}

const child = spawn("npx", ["tauri", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: path.join(fileURLToPath(new URL(".", import.meta.url)), ".."),
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
