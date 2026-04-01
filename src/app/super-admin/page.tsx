import Link from "next/link";

export default function SuperAdminPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Super Admin dashboard</h1>
      <p>Отсюда будем управлять пользователями и мероприятиями.</p>

      <ul>
        <li><Link href="/super-admin/users">Пользователи</Link></li>
        <li><Link href="/super-admin/events">Мероприятия</Link></li>
      </ul>
    </main>
  );
}