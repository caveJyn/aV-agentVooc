import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../lib/api';
import './userStats.css';

interface UserStats {
  totalUsers: number;
  onlineUsers: number;
}

// Custom hook for animated counter
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const prevEndRef = useRef(0);

  useEffect(() => {
    const start = prevEndRef.current;
    const startTime = Date.now();
    
    if (start === end) return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * easeOutQuart);
      
      setCount(current);
      
      if (progress >= 1) {
        clearInterval(timer);
        setCount(end);
        prevEndRef.current = end;
      }
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
};

const UserStats: React.FC = () => {
  const [stats, setStats] = useState<UserStats>({ totalUsers: 0, onlineUsers: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animated counters
  const animatedTotalUsers = useCountUp(stats.totalUsers, 2000);
  const animatedOnlineUsers = useCountUp(stats.onlineUsers, 1500);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getUserStats();
        setStats(response);
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError('Failed to load user statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return <div className="user-stats-error">Error: {error}</div>;
  }

  return (
    <div className="user-stats-container">
      <div className="user-stat-item">
        <div className="user-stat-number">
          {isLoading && stats.totalUsers === 0 ? 
            '...' : 
            animatedTotalUsers.toLocaleString()
          }
        </div>
        <div className="user-stat-label">Total Users</div>
      </div>
      
      <div className="user-stat-item">
        <div className="user-stat-number">
          {isLoading && stats.onlineUsers === 0 ? 
            '...' : 
            animatedOnlineUsers.toLocaleString()
          }
        </div>
        <div className="user-stat-label">Users Online</div>
      </div>
    </div>
  );
};

export default UserStats;