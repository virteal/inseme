/* ==========================================================================
   ICON COMPONENT
   Semantic icon wrapper using Phosphor Icons.
   Maps semantic names to concrete icons for easy theme switching.
   ========================================================================== */

import {
  PaperPlaneTilt,
  ThumbsUp,
  ThumbsDown,
  Sparkle,
  User,
  Robot,
  X,
  CaretDown,
  CaretUp,
  Lightning,
  CheckCircle,
  WarningCircle,
  Info,
  Plus,
  Minus,
} from "@phosphor-icons/react";

const iconMap = {
  // Actions
  send: PaperPlaneTilt,
  "thumbs-up": ThumbsUp,
  "thumbs-down": ThumbsDown,
  close: X,
  plus: Plus,
  minus: Minus,

  // Status
  sparkle: Sparkle,
  lightning: Lightning,
  success: CheckCircle,
  warning: WarningCircle,
  info: Info,

  // Entities
  user: User,
  bot: Robot,

  // Navigation
  "caret-down": CaretDown,
  "caret-up": CaretUp,
};

/**
 * Semantic Icon Component
 *
 * @param {string} name - Semantic icon name (e.g., 'send', 'user', 'success')
 * @param {number} size - Icon size in pixels (default: 24)
 * @param {string} weight - Icon weight: 'thin' | 'light' | 'regular' | 'bold' | 'fill' (default: 'regular')
 * @param {string} className - Additional CSS classes
 * @param {object} props - Additional props passed to the icon
 */
export const Icon = ({ name, size = 24, weight = "regular", className = "", ...props }) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap. Available icons:`, Object.keys(iconMap));
    return null;
  }

  return <IconComponent size={size} weight={weight} className={className} {...props} />;
};

export default Icon;
