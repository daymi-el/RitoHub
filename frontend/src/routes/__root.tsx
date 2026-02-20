import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "@/providers/theme-provider";
import { AccountsProvider } from "@/providers/accounts-provider";

export const Route = createRootRoute({
    component: () => (
        <div className="antialiased overflow-y-auto">
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem={true}
                disableTransitionOnChange={true}
            >
                <AccountsProvider>
                    <Outlet />
                </AccountsProvider>
            </ThemeProvider>
        </div>
    ),
});