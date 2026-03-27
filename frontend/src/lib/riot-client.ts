import {invoke} from "@tauri-apps/api/core";
import type {Account} from "@/lib/types";

type LoginAccount = Pick<Account, "userName" | "password">;
type RiotLoginStage =
    | "launch_client"
    | "wait_for_window"
    | "wait_for_controls"
    | "fill_username"
    | "fill_password"
    | "submit";

export interface RiotLoginErrorPayload {
    stage: RiotLoginStage;
    code: string;
    message: string;
}

export async function loginToRiotAccount(
    account: LoginAccount,
): Promise<void> {
    await invoke("switch_riot_account", {
        username: account.userName,
        password: account.password,
    });
}

function isRiotLoginErrorPayload(
    value: unknown,
): value is RiotLoginErrorPayload {
    return (
        typeof value === "object" &&
        value !== null &&
        "stage" in value &&
        "code" in value &&
        "message" in value &&
        typeof value.stage === "string" &&
        typeof value.code === "string" &&
        typeof value.message === "string"
    );
}

function parseNestedLoginError(value: unknown): RiotLoginErrorPayload | null {
    if (isRiotLoginErrorPayload(value)) {
        return value;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "message" in value
    ) {
        const nestedMessage = (value as { message: unknown }).message;

        if (isRiotLoginErrorPayload(nestedMessage)) {
            return nestedMessage;
        }

        if (typeof nestedMessage === "string") {
            try {
                const parsed = JSON.parse(nestedMessage);
                if (isRiotLoginErrorPayload(parsed)) {
                    return parsed;
                }
            } catch {
                return null;
            }
        }
    }

    return null;
}

function getFriendlyLoginMessage(payload: RiotLoginErrorPayload): string {
    switch (payload.stage) {
        case "wait_for_window":
            return "Riot Client opened but the login window never appeared.";
        case "wait_for_controls":
            return `Riot Client opened but the username/password fields could not be reached.\n\n${payload.message}`;
        case "fill_username":
        case "fill_password":
            return `RitoHub reached the Riot login window but Windows blocked text entry.\n\n${payload.message}`;
        case "submit":
            return `RitoHub filled the login form but could not submit it.\n\n${payload.message}`;
        default:
            return payload.message;
    }
}

export function getRiotLoginErrorMessage(error: unknown): string {
    const structuredError = parseNestedLoginError(error);
    if (structuredError) {
        return getFriendlyLoginMessage(structuredError);
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return error.message;
    }

    return "RitoHub could not log into the Riot Client.";
}

export function alertRiotLoginError(error: unknown): void {
    const message = getRiotLoginErrorMessage(error);
    window.alert(`RitoHub could not log into the Riot Client.\n\n${message}`);
}
