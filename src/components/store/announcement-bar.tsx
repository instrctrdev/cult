import Link from 'next/link';

export interface StoreAnnouncement {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

function AnnouncementItem({ announcement, duplicate = false }: { announcement: StoreAnnouncement; duplicate?: boolean }) {
  const content = <span className="flex shrink-0 items-center gap-2 px-7">
    <strong className="font-semibold">{announcement.title}</strong>
    {announcement.subtitle && <span className="text-white/75">{announcement.subtitle}</span>}
    {announcement.ctaLabel && <span className="border-b border-white/70 font-semibold">{announcement.ctaLabel}</span>}
    <span aria-hidden className="ml-5 text-white/45">✦</span>
  </span>;
  return announcement.ctaHref && !duplicate
    ? <Link href={announcement.ctaHref} className="shrink-0 hover:text-white">{content}</Link>
    : content;
}

export function AnnouncementBar({ announcements }: { announcements: StoreAnnouncement[] }) {
  if (!announcements.length) return null;
  const repeated = announcements.length === 1
    ? Array.from({ length: 4 }, () => announcements[0])
    : announcements;

  return <aside aria-label="Store announcements" className="overflow-hidden bg-ink py-2 text-white">
    <div className="announcement-track flex w-max items-center whitespace-nowrap text-[11px] uppercase tracking-[0.13em]">
      <div className="flex items-center">
        {repeated.map((announcement, index) => <AnnouncementItem key={`a-${announcement.id}-${index}`} announcement={announcement} />)}
      </div>
      <div className="flex items-center" aria-hidden>
        {repeated.map((announcement, index) => <AnnouncementItem key={`b-${announcement.id}-${index}`} announcement={announcement} duplicate />)}
      </div>
    </div>
  </aside>;
}
