"use client";

import React from "react";
import * as Solar from "@solar-icons/react";

interface MaterialIconProps {
  name: string;
  className?: string;
  /** Animation: 'spin' | 'pulse' | 'bounce-hover' | 'sparkle' | 'none' */
  animate?: "spin" | "pulse" | "bounce-hover" | "sparkle" | "none";
  style?: React.CSSProperties;
}

const solarMap: Record<string, React.ComponentType<any>> = {
  // Navigation / Views
  "dashboard": Solar.Widget2,
  "folder_open": Solar.FolderOpen,
  "corporate_fare": Solar.Structure,
  "domain": Solar.Structure,
  "account_tree": Solar.BranchingPathsDown,
  "hub": Solar.BranchingPathsDown,
  "smart_toy": Solar.UserRounded,
  "power": Solar.Power,
  "power_settings_new": Solar.Power,
  "auto_stories": Solar.Book,
  "book": Solar.Book,
  "description": Solar.DocumentText,
  "draft": Solar.DocumentText,
  "code": Solar.CodeFile,
  "image": Solar.Gallery,
  "data_object": Solar.FileCheck,
  "settings_applications": Solar.Settings,
  "find_in_page": Solar.Magnifer,
  "extension": Solar.AddSquare,
  "settings": Solar.Settings,
  "verified_user": Solar.ShieldCheck,
  "bolt": Solar.Bolt,
  "close": Solar.CloseCircle,
  "arrow_upward": Solar.AltArrowUp,
  "warning": Solar.Danger,
  "visibility": Solar.Eye,
  "visibility_off": Solar.EyeClosed,
  "inbox": Solar.Inbox,
  "key": Solar.Key,
  "search": Solar.Magnifer,
  "check_circle": Solar.CheckCircle,
  "check": Solar.CheckCircle,
  "circle": Solar.RecordCircle,
  "plus": Solar.AddCircle,
  "add": Solar.AddCircle,
  "save": Solar.Diskette,
  "delete": Solar.TrashBinMinimalistic,
  "edit": Solar.Pen2,
  "unfold_more": Solar.AltArrowDown,
  "keyboard_arrow_down": Solar.AltArrowDown,
  "chevron_right": Solar.AltArrowRight,
  "chevron_left": Solar.AltArrowLeft,
  "expand_more": Solar.AltArrowDown,
  "splitscreen": Solar.Widget5,
  "terminal": Solar.ServerPath,
  "psychology": Solar.Cpu,
  "cloud": Solar.Cloud,
  "lock": Solar.ShieldKeyholeMinimalistic,
  "upload": Solar.CloudUpload,
  "download": Solar.FileDownload,
  "schedule": Solar.ClockCircle,
  "cancel": Solar.CloseCircle,
  "chat": Solar.ChatRoundDots,
  "widgets": Solar.Widget2,
  "menu": Solar.HamburgerMenu,
  "alt_route": Solar.BranchingPathsDown,
  "auto_awesome": Solar.Stars2,
  "progress_activity": Solar.RefreshCircle,
  "play_arrow": Solar.Play,
  "close_fullscreen": Solar.QuitFullScreenCircle,
  "open_in_full": Solar.FullScreenCircle,
  "replay": Solar.RestartCircle,
  
  // Custom mappings to prevent fallback to Widget2
  "computer": Solar.Monitor,
  "public": Solar.Earth,
  "light_mode": Solar.Sun,
  "dark_mode": Solar.Moon,
  "person": Solar.User,
  "group": Solar.UsersGroupRounded,
  "alternate_email": Solar.Letter,
  "work": Solar.CaseRoundMinimalistic,
  "play_circle": Solar.PlayCircle,
  "photo_camera": Solar.Camera,
  "groups": Solar.UsersGroupRounded,
  "link": Solar.Link,
  "build": Solar.Sledgehammer,
  "folder": Solar.Folder,
  "users": Solar.UsersGroupRounded,
  "trash": Solar.TrashBinMinimalistic,
  "trash2": Solar.TrashBinMinimalistic,
  "cpu": Solar.Cpu,
  "memory": Solar.Cpu,
  "palette": Solar.PaletteRound,
  "science": Solar.TestTube,
  "landmark": Solar.Banknote,
  "account_balance": Solar.Banknote,
  "key_round": Solar.Key,
  "open_in_new": Solar.Export,
  "external_link": Solar.Export,
  "cloud_upload": Solar.CloudUpload
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
 * Renders a Solar Icon (Line Duotone family enforced globally via SolarProvider).
 * Fully backwards-compatible with the MaterialIcon component interface.
 */
export function MaterialIcon({ name, className = "", animate, style }: MaterialIconProps) {
  const IconComponent = solarMap[name.toLowerCase()] || Solar.Widget2;

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
