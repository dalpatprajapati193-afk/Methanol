"use server"

import { signOut } from "@/auth";

export async function signOutAction() {
    return await signOut({ redirectTo: "/api/auth/signin" });
}