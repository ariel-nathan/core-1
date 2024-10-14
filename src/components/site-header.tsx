import Link from "next/link";
import { UserIcon } from "lucide-react";

import ThemeToggle from "./theme-toggle";
import { Button } from "./ui/button";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-between py-2">
        <Link href="/" className="text-xl underline-offset-2 hover:underline">
          Xaac
        </Link>
        <div className="flex items-center gap-2">
          <Button size="icon">
            <UserIcon />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
