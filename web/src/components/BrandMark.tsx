import * as PhosphorIcons from '@phosphor-icons/react';
import type { Icon as PhosphorIconType } from '@phosphor-icons/react';
import './BrandMark.scss';

type BrandMarkProps = {
  /** Image URL — takes precedence over icon when present. */
  image?: string;
  /** Either an emoji (e.g. "☕") or a Phosphor icon name (e.g. "CoffeeIcon"). */
  icon?: string;
  /** Background colour for the emoji/icon tile. */
  iconBg?: string;
  className?: string;
};

const PHOSPHOR_ICONS = PhosphorIcons as unknown as Record<string, PhosphorIconType>;

export const BrandMark = ({ image, icon, iconBg, className }: BrandMarkProps) => {
  if (image) {
    return (
      <div className={className}>
        <img className='brand-mark-image' src={image} alt='' draggable={false} />
      </div>
    );
  }

  // Look the icon up in the Phosphor namespace: known names resolve to a
  // component, while emojis (and anything else) fall through to plain text.
  const Icon = icon ? PHOSPHOR_ICONS[icon] : undefined;

  return (
    <div className={className} style={iconBg ? { background: iconBg } : undefined}>
      {Icon ? <Icon size='1em' color='#fff' /> : icon}
    </div>
  );
};
