"use client";

import React from "react";
import {
  Board24Filled,
  FolderOpen24Filled,
  Building24Filled,
  Organization24Filled,
  Bot24Filled,
  Power24Filled,
  BookOpen24Filled,
  Book24Filled,
  DocumentText24Filled,
  Code24Filled,
  Image24Filled,
  Braces24Filled,
  Settings24Filled,
  Search24Filled,
  PuzzlePiece24Filled,
  ShieldCheckmark24Filled,
  Flash24Filled,
  Dismiss24Filled,
  ArrowUp24Filled,
  Warning24Filled,
  Eye24Filled,
  EyeOff24Filled,
  MailInbox24Filled,
  Key24Filled,
  CheckmarkCircle24Filled,
  Checkmark24Filled,
  Circle24Filled,
  Add24Filled,
  Save24Filled,
  Delete24Filled,
  Edit24Filled,
  ChevronUpDown24Filled,
  ChevronDown24Filled,
  ChevronRight24Filled,
  ChevronLeft24Filled,
  PanelLeft24Filled,

  Brain24Filled,
  Cloud24Filled,
  LockClosed24Filled,
  CloudArrowUp24Filled,
  CloudArrowDown24Filled,
  Clock24Filled,
  DismissCircle24Filled,
  Chat24Filled,
  Grid24Filled,
  Navigation24Filled,
  Branch24Filled,
  Sparkle24Filled,
  ArrowSync24Filled,
  Play24Filled,
  ArrowMinimize24Filled,
  ArrowMaximize24Filled,
  ArrowCounterclockwise24Filled,
  Desktop24Filled,
  Earth24Filled,
  WeatherSunny24Filled,
  WeatherMoon24Filled,
  Person24Filled,
  People24Filled,
  Mail24Filled,
  Briefcase24Filled,
  Camera24Filled,
  Link24Filled,
  Wrench24Filled,
  Folder24Filled,
  DeveloperBoard24Filled,
  Color24Filled,
  Beaker24Filled,
  BuildingBank24Filled,
  Open24Filled,
  Copy24Filled,
  Database24Filled,
  ErrorCircle24Filled,
  ArrowClockwise24Filled
} from "@fluentui/react-icons";

interface MaterialIconProps {
  name: string;
  className?: string;
  /** Animation: 'spin' | 'pulse' | 'bounce-hover' | 'sparkle' | 'none' */
  animate?: "spin" | "pulse" | "bounce-hover" | "sparkle" | "none";
  style?: React.CSSProperties;
}

const fluentMap: Record<string, React.ComponentType<any>> = {
  // Navigation / Views
  "dashboard": Board24Filled,
  "folder_open": FolderOpen24Filled,
  "corporate_fare": Building24Filled,
  "domain": Building24Filled,
  "account_tree": Organization24Filled,
  "hub": Organization24Filled,
  "smart_toy": Bot24Filled,
  "power": Power24Filled,
  "power_settings_new": Power24Filled,
  "auto_stories": BookOpen24Filled,
  "book": Book24Filled,
  "description": DocumentText24Filled,
  "draft": DocumentText24Filled,
  "code": Code24Filled,
  "image": Image24Filled,
  "data_object": Braces24Filled,
  "settings_applications": Settings24Filled,
  "find_in_page": Search24Filled,
  "extension": PuzzlePiece24Filled,
  "settings": Settings24Filled,
  "verified_user": ShieldCheckmark24Filled,
  "bolt": Flash24Filled,
  "close": Dismiss24Filled,
  "arrow_upward": ArrowUp24Filled,
  "warning": Warning24Filled,
  "visibility": Eye24Filled,
  "visibility_off": EyeOff24Filled,
  "inbox": MailInbox24Filled,
  "key": Key24Filled,
  "search": Search24Filled,
  "check_circle": CheckmarkCircle24Filled,
  "check": Checkmark24Filled,
  "circle": Circle24Filled,
  "plus": Add24Filled,
  "add": Add24Filled,
  "save": Save24Filled,
  "delete": Delete24Filled,
  "edit": Edit24Filled,
  "unfold_more": ChevronUpDown24Filled,
  "keyboard_arrow_down": ChevronDown24Filled,
  "chevron_right": ChevronRight24Filled,
  "chevron_left": ChevronLeft24Filled,
  "expand_more": ChevronDown24Filled,
  "splitscreen": PanelLeft24Filled,
  "terminal": Code24Filled,
  "psychology": Brain24Filled,
  "cloud": Cloud24Filled,
  "lock": LockClosed24Filled,
  "upload": CloudArrowUp24Filled,
  "download": CloudArrowDown24Filled,
  "schedule": Clock24Filled,
  "cancel": DismissCircle24Filled,
  "chat": Chat24Filled,
  "widgets": Grid24Filled,
  "menu": Navigation24Filled,
  "alt_route": Branch24Filled,
  "auto_awesome": Sparkle24Filled,
  "progress_activity": ArrowSync24Filled,
  "play_arrow": Play24Filled,
  "close_fullscreen": ArrowMinimize24Filled,
  "open_in_full": ArrowMaximize24Filled,
  "replay": ArrowCounterclockwise24Filled,
  "computer": Desktop24Filled,
  "public": Earth24Filled,
  "light_mode": WeatherSunny24Filled,
  "dark_mode": WeatherMoon24Filled,
  "person": Person24Filled,
  "group": People24Filled,
  "alternate_email": Mail24Filled,
  "work": Briefcase24Filled,
  "play_circle": Play24Filled,
  "photo_camera": Camera24Filled,
  "groups": People24Filled,
  "link": Link24Filled,
  "build": Wrench24Filled,
  "folder": Folder24Filled,
  "users": People24Filled,
  "trash": Delete24Filled,
  "trash2": Delete24Filled,
  "cpu": DeveloperBoard24Filled,
  "memory": DeveloperBoard24Filled,
  "palette": Color24Filled,
  "science": Beaker24Filled,
  "landmark": BuildingBank24Filled,
  "account_balance": BuildingBank24Filled,
  "key_round": Key24Filled,
  "open_in_new": Open24Filled,
  "external_link": Open24Filled,
  "content_copy": Copy24Filled,
  "database": Database24Filled,
  "error": ErrorCircle24Filled,
  "refresh": ArrowClockwise24Filled,
  "update": ArrowSync24Filled,
  "cloud_upload": CloudArrowUp24Filled,
};

/**
 * Normalizes CSS class names to ensure width matches height on SVG elements.
 * For example, if "w-4" is present, it appends "h-4" if not already specified.
 */
function normalizeClassName(className: string): string {
  let res = className;
  // Match tailwind w-X class (supporting numbers and float decimals like 3.5)
  const wMatch = className.match(/\bw-(\d+|3\.5)\b/);
  const hMatch = className.match(/\bh-(\d+|3\.5)\b/);
  if (wMatch && !hMatch) {
    res += ` h-${wMatch[1]}`;
  }
  return res;
}

/**
 * Renders a Microsoft Fluent UI System Icon.
 * Fully backwards-compatible with the MaterialIcon component interface.
 */
export function MaterialIcon({ name, className = "", animate, style }: MaterialIconProps) {
  const IconComponent = fluentMap[name.toLowerCase()] || Grid24Filled;

  const animClass =
    animate === "spin"
      ? "animate-spin"
      : animate === "pulse"
      ? "animate-pulse"
      : animate === "bounce-hover"
      ? "icon-bounce-hover"
      : animate === "sparkle"
      ? "icon-sparkle"
      : "";

  const finalClassName = normalizeClassName(`${className} ${animClass}`).trim();

  return (
    <IconComponent
      className={finalClassName}
      style={style}
    />
  );
}
