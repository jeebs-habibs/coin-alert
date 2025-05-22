'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const notifications = await getLastSevenDaysNotifications();

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
    <div>
      <h2>Hourly Notification Frequency</h2>
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
  );
}
