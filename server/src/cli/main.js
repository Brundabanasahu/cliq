#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";

import { Command } from "commander";
import {login} from "./commands/auth/login.js";

dotenv.config();

async function main(){
    console.log(
        chalk.cyan(
            figlet.textSync("CLIQ",{
                font:"Standard",
                horizontalLayout:"default"
            })
        )
    )
    console.log(chalk.yellow("A CLI based AI tool\n"))

    const program =new Command("cliq");

    program.version("0.0.1")
    .description("CLIQ - A CLI based AI Tool")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami)
    .addCommand(wakeup)

    program.action(()=>{
    program.help();
    });

    program.parse()
}

main().catch((err)=>{
    console.log(chalk.red("Error in CLIQ: "),err)
    process.exit(1)
})