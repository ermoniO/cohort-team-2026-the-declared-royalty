import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import {
  buildDeterministicFaceSvgDataUrl,
  getInitials,
  isSystemUser,
} from './userDisplay';

export interface UserAvatarProps {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  isSystem?: boolean;
  sizeClassName?: string;
  className?: string;
  title?: string;
  highlightRing?: boolean;
  forceInitialsFallback?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  name,
  role,
  avatarUrl,
  isSystem,
  sizeClassName = 'size-8',
  className = '',
  title,
  highlightRing = false,
  forceInitialsFallback = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const displayName = (name ?? '').trim() || 'Team Member';
  const initials = getInitials(displayName);
  const systemActor = isSystemUser({ userId, name: displayName, isSystem });
  const accessibleTitle = title || (role ? `${displayName} · ${role}` : displayName);

  const resolvedSrc = systemActor
    ? ''
    : avatarUrl && avatarUrl.trim().length > 0
      ? avatarUrl.trim()
      : buildDeterministicFaceSvgDataUrl(userId || displayName, displayName);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedSrc]);

  const ringClass = highlightRing
    ? 'ring-2 ring-[#16834a] ring-offset-1 ring-offset-white'
    : '';

  if (systemActor) {
    return (
      <span
        data-testid="system-actor-avatar"
        data-initials="AI"
        title={accessibleTitle}
        aria-label={displayName}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#14532d] text-[#e8f7ed] ${ringClass} ${sizeClassName} ${className}`}
      >
        <Bot className="w-[58%] h-[58%]" aria-hidden="true" />
      </span>
    );
  }

  const showImage = !forceInitialsFallback && !imgFailed && Boolean(resolvedSrc);

  return (
    <span
      data-initials={initials}
      title={accessibleTitle}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f7ed] text-[#16834a] font-semibold select-none ${ringClass} ${sizeClassName} ${className}`}
    >
      {showImage ? (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={displayName}
          onError={() => setImgFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span className="text-[11px] leading-none font-bold">{initials}</span>
      )}
    </span>
  );
};

export default UserAvatar;

