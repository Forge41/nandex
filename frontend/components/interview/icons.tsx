import * as React from "react";

/** The design draws its own 16px icon set at 1.3-1.5px stroke. Lucide's
 * equivalents sit on a 24px grid with heavier optical weight, so these are
 * ported path-for-path to keep the control bar and rail on-model. Lucide is
 * still fine for incidental icons that aren't in the design. */

type IconProps = React.ComponentProps<"svg">;

function Icon({ strokeWidth = 1.4, children, ...props }: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="2" width="4" height="7" rx="2" />
      <path d="M4 7.5a4 4 0 0 0 8 0" />
      <path d="M8 11.5V14" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="4" width="9" height="8" rx="1.5" />
      <path d="M10.5 8.2 14.5 5.6v4.8L10.5 7.8" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5" />
    </Icon>
  );
}

export function CaptionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="3" width="13" height="10" rx="2" />
      <path d="M6.5 6.6a2 2 0 1 0 0 2.8" />
      <path d="M11.5 6.6a2 2 0 1 0 0 2.8" />
    </Icon>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="M10 2.75v10.5" />
    </Icon>
  );
}

export function ThemeIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.3} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.5} {...props}>
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Icon>
  );
}

export function VolumeOnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 2.5 5 5.5H2.5v5H5l3.5 3z" />
      <path d="M11 5.8a3 3 0 0 1 0 4.4" />
      <path d="M12.9 3.8a5.6 5.6 0 0 1 0 8.4" />
    </Icon>
  );
}

export function VolumeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 2.5 5 5.5H2.5v5H5l3.5 3z" />
      <path d="M11 6.2l3.5 3.6" />
      <path d="M14.5 6.2 11 9.8" />
    </Icon>
  );
}

export function SkipIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.5} {...props}>
      <path d="M4 4l4.5 4L4 12" />
      <path d="M11.5 4v8" />
    </Icon>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.5} {...props}>
      <path d="M6.5 4l4 4-4 4" />
      <path d="M3 4l4 4-4 4" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.8} {...props}>
      <path d="M13 4.5 6.2 11.5 3 8.3" />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.5z" />
      <path d="M9.5 1.5v4h4" />
    </Icon>
  );
}
