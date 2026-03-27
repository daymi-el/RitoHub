import { createRootRoute, Outlet } from "@tanstack/react-router";
import { GameRail } from "@/components/blocks/game-rail";
import { ThemeProvider } from "@/providers/theme-provider";
import { AccountsProvider } from "@/providers/accounts-provider";
import { GameSelectionProvider } from "@/providers/game-selection-provider";

export const Route = createRootRoute({
  component: () => (
    <div className="antialiased">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem={true}
        disableTransitionOnChange={true}
      >
        <AccountsProvider>
          <GameSelectionProvider>
            <div className="flex h-screen">
              <GameRail />
              <div className="flex-1 min-w-0 overflow-y-auto">
                <Outlet />
              </div>
            </div>
          </GameSelectionProvider>
        </AccountsProvider>
      </ThemeProvider>
    </div>
  ),
});
