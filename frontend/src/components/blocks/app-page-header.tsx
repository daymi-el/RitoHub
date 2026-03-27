import type {ReactNode} from "react";

interface AppPageHeaderProps {
    title: ReactNode;
    leading?: ReactNode;
    trailing?: ReactNode;
    accentColor?: string;
}

function HeaderSlot({children}: { children?: ReactNode }) {
    if (!children) {
        return <div className="h-10 w-10" aria-hidden="true"/>;
    }

    return <>{children}</>;
}

export function AppPageHeader({
                                  title,
                                  leading,
                                  trailing,
                                  accentColor,
                              }: AppPageHeaderProps) {
    return (
        <header
            className="sticky top-0 z-50 relative bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
                <div className="justify-self-start">
                    <HeaderSlot>{leading}</HeaderSlot>
                </div>
                <h1 className="truncate text-center text-lg font-bold tracking-tight">{title}</h1>
                <div className="justify-self-end">
                    <HeaderSlot>{trailing}</HeaderSlot>
                </div>
            </div>
            <div
                className="absolute bottom-0 left-0 right-0 h-px transition-[background] duration-300"
                style={{
                    background: accentColor
                        ? `linear-gradient(to right, transparent, ${accentColor}, transparent)`
                        : "linear-gradient(to right, transparent, var(--border), transparent)",
                }}
            />
        </header>
    );
}
