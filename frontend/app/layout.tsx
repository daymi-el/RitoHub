import "./globals.css";
import {ThemeProvider} from "@/providers/theme-provider";
import {AccountsProvider} from "@/providers/accounts-provider";

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning={true}>
        <body
            className={`antialiased overflow-y-auto`}
        >
        <ThemeProvider
            attribute={"class"}
            defaultTheme={"system"}
            enableSystem={true}
            disableTransitionOnChange={true}
        >
            <AccountsProvider>
                {children}
            </AccountsProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}
