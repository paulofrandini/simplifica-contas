import { spawn } from "node:child_process";

const received = process.argv.slice(2);
const forwarded = [];

for (let index = 0; index < received.length; index += 1) {
  const argument = received[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    forwarded.push("--hostname");
    if (received[index + 1]) forwarded.push(received[++index]);
    continue;
  }
  forwarded.push(argument);
}

const executable = process.platform === "win32" ? "next.cmd" : "next";
const child = spawn(executable, ["dev", ...forwarded], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
