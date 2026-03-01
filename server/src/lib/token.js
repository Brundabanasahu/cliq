import fs from "node:fs/promises";   // FIXED (missing import)
import chalk from "chalk";           // FIXED (missing import)
import { TOKEN_FILE, CONFIG_DIR } from "../cli/commands/auth/login.js"; // FIXED (CONFIG_DIR missing)

export async function getStoredToken() {
    try {
        const data = await fs.readFile(TOKEN_FILE, "utf-8"); // FIXED (readfile → readFile)
        const token = JSON.parse(data);
        return token;
    } catch (error) {
        return null;
    }
}

export async function storeToken(token) {
    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });

        const tokenData = {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_type: token.token_type || "Bearer",
            scope: token.scope,
            expires_at: token.expires_in
                ? new Date(Date.now() + token.expires_in * 1000).toISOString() // FIXED (Data → Date)
                : null,
            created_at: new Date().toISOString(),
        };

        await fs.writeFile(
            TOKEN_FILE,
            JSON.stringify(tokenData, null, 2),
            "utf-8"
        );

        return true;
    } catch (error) {
        console.error(chalk.red("Failed to store token:"), error.message);
        return false;
    }
}

export async function clearStoredToken() {
    try {
        await fs.unlink(TOKEN_FILE);
        return true;
    } catch (error) {
        return false;
    }
}

export async function isTokenExpired() {
    const token = await getStoredToken();

    if (!token || !token.expires_at) {  // FIXED (condition wrong)
        return true;
    }

    const expiresAt = new Date(token.expires_at);
    const now = new Date();

    return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;
}

export async function requireAuth() {
    const token = await getStoredToken();

    if (!token) {
        console.log(
            chalk.red("Not authenticated. please run 'your-cli login' first.")
        );
        process.exit(1);
    }

    if (await isTokenExpired()) {
        console.log(
            chalk.yellow("Your session has expired. please login again")
        );
        console.log(chalk.gray("  Run: your-cli login\n")); // FIXED (missing quote)
        process.exit(1);
    }

    return token;
}