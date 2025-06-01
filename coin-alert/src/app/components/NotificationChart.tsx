'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RecentNotification } from '../../../../shared/types/user';
import { getLastSevenDaysNotifications } from '../actions/getNotifications';


// Format a timestamp into "YYYY-MM-DD HH:00"
const formatToHourBucket = (timestamp: number): string => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00`;
};

export default function NotificationChart() {
  const [chartData, setChartData] = useState<{ hour: string; count: number }[]>([]);
  const [notifications, setNotifications] = useState<RecentNotification[]>([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const notifications = await getLastSevenDaysNotifications();
        setNotifications(notifications)

        // Aggregate by hour
        const counts: Record<string, number> = {};

        notifications.forEach((notif) => {
          const hourBucket = formatToHourBucket(notif.timestamp);
          counts[hourBucket] = (counts[hourBucket] || 0) + 1;
        });

        const sortedData = Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([hour, count]) => ({ hour, count }));

        setChartData(sortedData);
      } catch (err) {
        setError('Failed to load notifications');
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

return (
  <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>
        Hourly Notification Frequency
      </h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} angle={-45} height={70} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="count" stroke="#4f46e5" dot />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>
        Recent Notifications
      </h2>
      <div
        style={{
          overflowX: 'auto',
          maxHeight: '400px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          padding: '10px',
        }}
      >
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>UID</th>
              <th style={{ padding: '8px' }}>Mint</th>
              <th style={{ padding: '8px' }}>Timestamp</th>
              <th style={{ padding: '8px' }}>Percentage Breached</th>
              <th style={{ padding: '8px' }}>Minutes</th>
              <th style={{ padding: '8px' }}>Percent Change</th>
              <th style={{ padding: '8px' }}>Alert Type</th>
              <th style={{ padding: '8px' }}>Title</th>
              <th style={{ padding: '8px' }}>Body</th>
              <th style={{ padding: '8px' }}>Image</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notif, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{notif.uid ?? '-'}</td>
                <td style={{ padding: '8px' }}>{notif.mint ?? '-'}</td>
                <td style={{ padding: '8px' }}>{new Date(notif.timestamp).toLocaleString()}</td>
                <td style={{ padding: '8px' }}>{notif.percentageBreached}</td>
                <td style={{ padding: '8px' }}>{notif.minutes}</td>
                <td style={{ padding: '8px' }}>{notif.percentChange.toFixed(2)}</td>
                <td style={{ padding: '8px' }}>{notif.alertType}</td>
                <td style={{ padding: '8px' }}>{notif.notificationTitle ?? '-'}</td>
                <td style={{ padding: '8px' }}>{notif.notificationBody ?? '-'}</td>
                <td style={{ padding: '8px' }}>
                  {notif.image ? (
                    <img src={notif.image} alt="notification" style={{ maxWidth: '50px', maxHeight: '50px' }} />
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);


}
