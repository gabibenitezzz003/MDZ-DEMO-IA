"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoModeToggle() {
  const path = usePathname();
  const engineering = path.startsWith("/ingenieria");

  return (
    <div className="flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
      <Link
        href="/"
        className={`rounded-full px-3 py-1.5 ${
          engineering
            ? "text-slate-600 hover:text-mza-blue"
            : "bg-mza-blue text-white"
        }`}
      >
        Productor
      </Link>
      <Link
        href="/ingenieria"
        className={`rounded-full px-3 py-1.5 ${
          engineering
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Ingeniería
      </Link>
    </div>
  );
}
