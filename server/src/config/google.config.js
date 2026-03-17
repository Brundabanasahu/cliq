import dotenv from "dotenv"
dotenv.congig();

export const config={
    googleApikey:process.env.GOOGLE_AI_API_KEY || "",
    model:process.env.ORBITAL_MODEL || "gemini-2.5-flash"
}