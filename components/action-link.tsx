import Link from "next/link";
import type { ReactNode } from "react";

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
};

const VARIANT_CLASS = {
  primary: "bs-btn-primary",
  ghost: "bs-btn-ghost",
} as const;

export default function ActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={`bs-btn ${VARIANT_CLASS[variant]} px-5 py-3 text-sm ${className}`}
    >
      {children}
    </Link>
  );
}
