'use server'

import { RecentNotification } from "../../../../shared/types/user";
import { getRedisClient } from "../lib/redis";

export async function getLastSevenDaysNotifications(): Promise<RecentNotification[]> {
    const redisClient = await getRedisClient();
    try {
        // Get connected Redis client
    
        const notifications: RecentNotification[] = [];
        const currentDate = new Date();

        // Loop through the last 7 days (including today)
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);
            const dateKey = `notifications:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            // Fetch all notifications for the day
            const dailyNotifications = await redisClient.zRange(dateKey, 0, -1);
            const parsedNotifications = dailyNotifications.map((item) => JSON.parse(item) as RecentNotification);
            notifications.push(...parsedNotifications);
        }

        // Sort notifications by timestamp (newest first)
        notifications.sort((a, b) => b.timestamp - a.timestamp);

        return notifications;
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    } finally {
        // Close Redis connection if client was created
        if (redisClient) {
            await redisClient.quit();
        }
    }
}