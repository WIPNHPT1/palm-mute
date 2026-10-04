import { GitHubIcon } from "@/components/icons/GitHubIcon";

export const REPO_URL = "https://github.com/WIPNHPT1/palm-mute";

export function Footer() {
  return (
    <footer className="sig-rule flex justify-center py-[10px]">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Palm/Mute on GitHub"
        title="Palm/Mute on GitHub"
        className="flex h-[44px] w-[44px] items-center justify-center text-text-faint transition-colors hover:text-text-primary"
      >
        <GitHubIcon />
      </a>
    </footer>
  );
}
