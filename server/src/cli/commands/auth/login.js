import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorization } from "better-auth/plugins";

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
const DEMO_URL = "http://localhost:3000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");


// ================== LOGIN ==================
export async function loginAction(opts) {
  const options = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional()
  }).parse(opts || {});

  const serverUrl = options.serverUrl || URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(chalk.bold("🔏 Auth CLIQ login"));

  const existingToken = await getStoredToken(); // FIXED
  const expired = await isTokenExpired();

  if (existingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "You are already logged in. Login again?",
      initialValue: false
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login Cancelled");
      process.exit(0);
    }
  }

  const authClient = createAuthClient({
    baseURL: serverUrl,
    plugins: [deviceAuthorization()]
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
      logger.error(`Failed: ${error}`);
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

    const url =
  verification_url ||
  verification_url_complete ||
  "http://localhost:3005/device";

console.log(`Visit: ${chalk.underline.blue(url)}`);

    console.log(`Code: ${chalk.bold.green(user_code)}`);

    const shouldOpen = await confirm({
      message: "Open browser?",
      initialValue: true
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      await open(url);
    }

    console.log(
      chalk.gray(`Waiting... (${Math.floor(expires_in / 60)} min)`)
    );

    const token = await pollForToken(
      authClient,
      device_code,
      clientId,
      interval
    );

    if (token) {
      await storeToken({
        ...token,
        created_at: Math.floor(Date.now() / 1000)
      });
    }

    outro(chalk.green("Login successful!"));

  } catch (err) {
    spinner.stop();
    console.error(chalk.red("Login Failed:"), err.message);
    process.exit(1);
  }
}


// ================== POLLING ==================
async function pollForToken(authClient, deviceCode, clientId, interval) {
  return new Promise((resolve) => {
    const poll = async () => {
      try {
        const { data } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
        });

        if (data?.access_token) {
          console.log(chalk.green("Authenticated ✅"));
          resolve(data);
          return;
        }
      } catch {}

      setTimeout(poll, interval * 1000);
    };

    poll();
  });
}


// ================== LOGOUT ==================
export async function logoutAction() {
  intro("Logout");

  const token = await getStoredToken();

  if (!token) {
    console.log("Not logged in");
    return;
  }

  const confirmLogout = await confirm({
    message: "Logout?",
    initialValue: false
  });

  if (isCancel(confirmLogout) || !confirmLogout) {
    cancel("Cancelled");
    return;
  }

  const cleared = await clearStoredToken(); // FIXED

  if (cleared) {
    outro("Logged out ✅");
  }
}


// ================== WHOAMI ==================
export async function whoamiActivity() {
  const token = await getStoredToken();

  if (!token?.access_token) {
    console.log("Please login first");
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token }
      }
    }
  });

  console.log(
    chalk.green(`User: ${user?.name}\nEmail: ${user?.email}`)
  );
}


// ================== TOKEN HELPERS ==================
async function getStoredToken() {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function storeToken(token) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2));
  return true;
}

async function clearStoredToken() {
  try {
    await fs.unlink(TOKEN_FILE);
    return true;
  } catch {
    return false;
  }
}

async function isTokenExpired() {
  const token = await getStoredToken();
  if (!token?.expires_in || !token?.created_at) return true;

  const now = Math.floor(Date.now() / 1000);
  return now > token.created_at + token.expires_in;
}


// ================== COMMANDS ==================
export const login = new Command("login")
  .description("Login")
  .option("--server-url <url>", "Server URL", URL)
  .action(loginAction);

export const logout = new Command("logout")
  .description("Logout")
  .action(logoutAction);

export const whoami = new Command("whoami")
  .description("Show current user")
  .action(whoamiActivity);

export const wakeup = new Command("wakeup")
  .description("Wake up CLI")
  .action(() => console.log("CLIQ is awake 🚀"));