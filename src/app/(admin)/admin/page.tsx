import { redirect } from 'next/navigation';

/** /admin lands on the dashboard. */
export default function AdminIndex() {
  redirect('/admin/dashboard');
}
