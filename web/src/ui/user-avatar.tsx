import { avatarOrb } from "@/ui/avatar-orb";
import styles from "@/ui/user-avatar.module.css";

interface UserAvatarProps {
  // What identifies the person and does not change with their name: the email.
  seed: string;
  size?: "sm" | "xl";
}

// Families read: avatar. The family draws a person as a coloured disc with their initials, the same
// disc for anyone of the same letters. The mark here is the person's own: two neighbouring data
// slots flowing at an angle taken from the seed, on a lit and shaded disc. It carries no letters and
// stays out of the accessibility tree, since the name always stands beside it.
export function UserAvatar({ seed, size = "sm" }: UserAvatarProps) {
  const { slots, angle } = avatarOrb(seed);

  return (
    <span
      className={styles.orb}
      data-size={size}
      style={{
        ["--c1" as string]: `var(--equori-slot-${String(slots[0])})`,
        ["--c2" as string]: `var(--equori-slot-${String(slots[1])})`,
        ["--angle" as string]: `${String(angle)}deg`,
      }}
      aria-hidden="true"
    />
  );
}
