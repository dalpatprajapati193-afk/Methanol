"use server"

import { signIn } from "@/auth";

export async function signInAction() {
    return await signIn("microsoft-entra-id", { redirectTo: "/instance-explorer" });
}

export async function devBypassAction() {
    return await signIn("credentials", { username: "dev", password: "dev", redirectTo: "/instance-explorer" });
}