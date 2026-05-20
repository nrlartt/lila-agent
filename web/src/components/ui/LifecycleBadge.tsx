import type { Token } from "../../api";

const labels: Record<Token["lifecycle"], string> = {
  curve: "Bonding",
  graduating: "Graduating",
  graduated: "Graduated",
};

export function LifecycleBadge({ lifecycle }: { lifecycle: Token["lifecycle"] }) {
  return (
    <span className={`badge badge--${lifecycle}`}>
      <span className="badge__dot" aria-hidden />
      {labels[lifecycle]}
    </span>
  );
}
