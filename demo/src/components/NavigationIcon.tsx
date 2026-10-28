import { Bot, Boxes, BriefcaseBusiness, ClipboardList, FolderKanban, Search } from "lucide-react";

const outlineIcons = {
  library: Boxes,
  search: Search,
  toolbox: BriefcaseBusiness,
  agent: Bot,
  project: FolderKanban,
  taskcenter: ClipboardList,
};

export type NavigationIconName = keyof typeof outlineIcons;

// Filled counterparts keep the existing 24px icon grid. Even-odd cutouts remain
// transparent on the header and on highlighted Radix options alike.
const solidPaths: Record<NavigationIconName, string> = {
  library: "M12 2 17 4.75v5.5L12 13 7 10.25v-5.5Z M6 11 11 13.75v5.5L6 22 1 19.25v-5.5Z M18 11 23 13.75v5.5L18 22 13 19.25v-5.5Z",
  search: "M10.5 2a8.5 8.5 0 1 0 5.03 15.35l4.21 4.21a1.5 1.5 0 0 0 2.12-2.12l-4.21-4.21A8.5 8.5 0 0 0 10.5 2Zm0 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z",
  toolbox: "M9 2h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Zm0 2v2h6V4H9ZM4 11v1.5h6.5V15h3v-2.5H20V11H4Z",
  agent: "M11 1h2v4h4a4 4 0 0 1 4 4v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a4 4 0 0 1 4-4h4V1ZM0 10h2v7H0Zm22 0h2v7h-2ZM7 9v4h2V9H7Zm8 0v4h2V9h-2Zm-7 7v1.5h8V16H8Z",
  project: "M4 3h5l2 3h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 6v8h2V9H6Zm5 0v5h2V9h-2Zm5 0v7h2V9h-2Z",
  taskcenter: "M9 2h6a1 1 0 0 1 1 1v1h2a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h2V3a1 1 0 0 1 1-1Zm1 2v2h4V4h-4ZM7 10v2h2v-2H7Zm4 0v2h6v-2h-6Zm-4 5v2h2v-2H7Zm4 0v2h6v-2h-6Z",
};

export function NavigationIcon({ name, active = false }: { name: NavigationIconName; active?: boolean }) {
  if (!active) {
    const OutlineIcon = outlineIcons[name];
    return <OutlineIcon className="desktop-nav-icon" data-variant="outline" aria-hidden="true" focusable="false" />;
  }
  return <svg className="desktop-nav-icon" data-variant="solid" aria-hidden="true" focusable="false"
    xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d={solidPaths[name]} fillRule="evenodd" clipRule="evenodd" />
  </svg>;
}
