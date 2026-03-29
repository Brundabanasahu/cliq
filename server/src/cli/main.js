#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Resolve correct path to server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";

import { login, logout, whoami } from "./commands/auth/login.js";
import { wakeUp } from "./commands/auth/ai/wakeUp.js";

async function main() {
  console.log(
    chalk.cyan(
      figlet.textSync("CLIQ", {
        font: "Standard",
        horizontalLayout: "default",
      })
    )
  );

  console.log(chalk.yellow("A CLI based AI tool\n"));

  const program = new Command("cliq");

  program
    .version("0.0.1")
    .description("CLIQ - A CLI based AI Tool")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami)
    .addCommand(wakeUp);

  program.action(() => {
    program.help();
  });

  program.parse();
}

main().catch((err) => {
  console.log(chalk.red("Error in CLIQ: "), err);
  process.exit(1);
});