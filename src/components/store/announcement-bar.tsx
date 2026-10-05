import Link from 'next/link';

export interface StoreAnnouncement {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

function AnnouncementItem({ announcement, duplicate = false }: { announcement: StoreAnnouncement; duplicate?: boolean }) {
  const content = <span className="flex min-w-[240px] shrink-0 items-center justify-center gap-2 px-5 sm:min-w-[300px] sm:px-8">
    <strong className="font-bold">{announcement.title}</strong>
    {announcement.subtitle && <span className="font-medium text-white/90">{announcement.subtitle}</span>}
    {announcement.ctaLabel && <span className="border-b border-white font-bold">{announcement.ctaLabel}</span>}
    <span aria-hidden className="ml-4 text-base leading-none text-white/90">•</span>
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

  return <aside aria-label="Store announcements" className="announcement-bar overflow-hidden py-2.5 text-white">
    <div className="announcement-track flex w-max items-center whitespace-nowrap text-[11px] uppercase tracking-[0.035em] sm:text-xs">
      <div className="flex items-center">
        {repeated.map((announcement, index) => <AnnouncementItem key={`a-${announcement.id}-${index}`} announcement={announcement} />)}
      </div>
      <div className="flex items-center" aria-hidden>
        {repeated.map((announcement, index) => <AnnouncementItem key={`b-${announcement.id}-${index}`} announcement={announcement} duplicate />)}
      </div>
    </div>
  </aside>;
}
