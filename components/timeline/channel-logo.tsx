export function ChannelLogo({
  label,
  logoPath
}: {
  label: string;
  logoPath: string;
}) {
  return (
    <span className="channel-logo-frame">
      <img className="channel-logo-image" src={logoPath} alt={`${label} logo`} />
    </span>
  );
}
