import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";

dotenv.config();

const URL = "http://localhost:3005";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export async function loginAction(opts) {
    const options = z.object({
        serverUrl: z.string().optional(),
        clientId: z.string().optional()
    }).parse(opts || {}); // FIXED

    const serverUrl = options.serverUrl || URL;
    const clientId = options.clientId || CLIENT_ID;

    intro(chalk.bold("🔏Auth CLIQ login"));

    const existingToken = await getstored();
    const expired = await isTokenExpired();

    if (existingToken && !expired) {
        const shouldReAuth = await confirm({
            message: "You are already loggedIn. Do you want to login Again",
            initialValue: false
        });

        if (isCancel(shouldReAuth) || !shouldReAuth) {
            cancel("Login Cancelled");
            process.exit(0);
        }
    }

    const authClient = createAuthClient({
        baseURL: serverUrl,
        plugins: [deviceAuthorizationClient()]
    });

    const spinner = yoctoSpinner({ text: "Requesting device authorization..." });
    spinner.start();

    try {
        const { data, error } = await authClient.device.code({
            client_id: clientId,
            scope: "openid profile email"
        });

        spinner.stop();

        if (error || !data) {
            logger.error(`Failed to request device authorization: ${error}`);
            process.exit(1);
        }

        const {
            device_code,
            user_code,
            verification_url,
            verification_url_complete,
            interval = 5,
            expires_in,
        } = data;

        console.log(
            `Please visit ${chalk.underline.blue(
                verification_url || verification_url_complete
            )}`
        );

        console.log(`Enter the code: ${chalk.bold.green(user_code)}`);

        const shouldOpen = await confirm({
            message: "Open Browser automatically",
            initialValue: true
        });

        if (!isCancel(shouldOpen) && shouldOpen) {
            const urlToOpen = verification_url || verification_url_complete;
            await open(urlToOpen);
        }

        console.log(
            chalk.gray(
                `Waiting for authorization (Expires in ${Math.floor(
                    expires_in / 60
                )} minutes)...`
            )
        );

        const token = await pollForToken(
            authClient,
            device_code,
            clientId,
            interval
        );

        if (token) {
            const saved = await storeToken(token);
            if (!saved) {
                console.log(
                    chalk.yellow("\n Warning:could not save authentication token.")
                );
                console.log(
                    chalk.yellow(" you may need to login again on next use.")
                );
            }
        }

        outro(chalk.green("Login successfull!! "));
        console.log(chalk.gray(`\n Token saved to: ${TOKEN_FILE}`));
        console.log(
            chalk.gray("you can now use AI command without logging in again\n")
        );

    } catch (error) {
        spinner.stop();
        console.error(chalk.red("\nLogin Failed:"), error.message);
        process.exit(1);
    }
}

async function pollForToken(authClient, deviceCode, clientId, initialInterval) {
    let pollingInterval = initialInterval;
    const spinner = yoctoSpinner({ text: "", color: "cyan" });
    let dots = 0;

    return new Promise((resolve, reject) => {   // FIXED
        const poll = async () => {
            dots = (dots + 1) % 4;

            spinner.text = chalk.gray(
                `polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`
            );

            if (!spinner.isSpinning) spinner.start();

            try {
                const { data, error } = await authClient.device.token({
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    device_code: deviceCode,
                    client_id: clientId,
                    fetchOptions: {
                        headers: {
                            "user-agent": "My CLI",
                        },
                    },
                });

                if (data?.access_token) {
                    console.log(   // FIXED
                        chalk.bold.yellow(`Your access token: ${data.access_token}`)
                    );
                    spinner.stop();
                    resolve(data);
                    return;
                } else if (error) {
                    switch (error.error) {
                        case "authorization_pending":
                            break;
                        case "slow_down":
                            pollingInterval += 5;
                            break;
                        case "access_denied":
                            console.error("Access was denied by the user");
                            return;
                        case "expired_token":
                            console.error("The device code has expired. Please try again.");
                            return;
                        default:
                            spinner.stop();
                            logger.error(`Error: ${error.error_description}`);
                            process.exit(1); // FIXED
                    }
                }
            } catch (err) {   // FIXED
                spinner.stop();
                logger.error(`Network error: ${err.message}`);  // FIXED
                process.exit(1); // FIXED
            }

            setTimeout(poll, pollingInterval * 1000);
        };

        setTimeout(poll, pollingInterval * 1000);  // FIXED
    });
}

export async function logoutAction(){
    intro(chalk.bold("Logout"));
    const token =await getStoredToken();

    if(!token){
        console.log(chalk.yellow("You're not logged in."));
        process.exit(0);
    }
    const shouldLogout=await confirm({
        message:"Are you sure you want to logout?",
        initialValue:false,
    });
    if(isCancel(shouldLogout)|| !shouldLogout){
        cancel("Logout cancelled");
        process.exit(0);
    }
    const cleaed =await clearStoredToken();

    if(cleared){
        outro(chalk.green("Successfully logged out!"));
    }else{
        console.log(chalk.yellow("could not clear token file."));
    }
}

export async function whoamiActivity(opts){
    const token=await requiredAuth();
    if(!token?.access_token){
        console.log("No access token found.please login");
        process.exit(1);
    }
    const user=await prisma.user.findFirst({
        where:{
            sessions:{
                some:{
                    token:token.access_token,
                },
            },
        },
        select:{
            id:true,
            name:true,
            email:true,
            image:true,
        },
    });

    chalk.bold.greenBright(`\n user:${user.name}
            Email:${user.email}
            ID:${user.id}`)
}
export const login = new Command("login")
    .description("Login to the BetterAuth")
    .option("--server-url <url>", "The better auth server URL", URL)
    .option("--client-url <url>", "The OAuth client Id", CLIENT_ID)
    .action(loginAction);


export const logout = new Command("logout")
  .description("Logout and clear stored credentials")
  .action(logoutAction);

export const whoami = new Command("whoami")
  .description("Show current authenticated user")
  .option("--server-url <url>", "The Better Auth server URL", DEMO_URL)
  .action(whoamiAction);    