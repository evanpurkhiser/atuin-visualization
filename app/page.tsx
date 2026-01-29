"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HistoryData {
  date: string;
  count: number;
}

interface CalendarDay {
  date: Date;
  count: number;
  intensity: number;
}

export default function Home() {
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    // Calculate the start date (one year ago)
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split("T")[0];

    // Fetch total
    fetch(`https://apis.evanpurkhiser.com/atuin-abacus/?start=${startDate}`, {
      headers: {
        Prefer: "timezone=America/New_York",
      },
    })
      .then((res) => res.json())
      .then((data: { total: number }) => {
        setTotal(data.total);
      })
      .catch((err) => {
        console.error("Failed to fetch total:", err);
      });

    // Fetch history
    fetch(
      `https://apis.evanpurkhiser.com/atuin-abacus/history?start=${startDate}`,
      {
        headers: {
          Prefer: "timezone=America/New_York",
        },
      }
    )
      .then((res) => res.json())
      .then((historyData: HistoryData[]) => {
        // Create a map of date strings to counts
        const dataMap = new Map(historyData.map((d) => [d.date, d.count]));

        const calendarDays: CalendarDay[] = [];
        const currentDate = new Date(oneYearAgo);

        // Start from the most recent Monday before one year ago
        const dayOfWeek = currentDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentDate.setDate(currentDate.getDate() - daysToMonday);

        while (currentDate <= today) {
          const dateStr = currentDate.toISOString().split("T")[0];
          const count = dataMap.get(dateStr) || 0;

          calendarDays.push({
            date: new Date(currentDate),
            count,
            intensity: 0, // Will be calculated below
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calculate intensity using logarithmic scale with percentile-based thresholds
        const nonZeroCounts = calendarDays
          .map((d) => d.count)
          .filter((c) => c > 0)
          .sort((a, b) => a - b);

        if (nonZeroCounts.length > 0) {
          // Convert to log scale to handle wide range of values
          const logCounts = nonZeroCounts.map((c) => Math.log10(c + 1));

          const getPercentile = (arr: number[], percentile: number) => {
            const index = Math.ceil((percentile / 100) * arr.length) - 1;
            return arr[Math.max(0, index)];
          };

          // Get percentile thresholds on log scale
          const p10 = getPercentile(logCounts, 10);
          const p25 = getPercentile(logCounts, 25);
          const p40 = getPercentile(logCounts, 40);
          const p55 = getPercentile(logCounts, 55);
          const p70 = getPercentile(logCounts, 70);
          const p80 = getPercentile(logCounts, 80);
          const p88 = getPercentile(logCounts, 88);
          const p94 = getPercentile(logCounts, 94);
          const p98 = getPercentile(logCounts, 98);

          console.log("Percentile thresholds:", {
            p10,
            p25,
            p40,
            p55,
            p70,
            p80,
            p88,
            p94,
            p98,
          });

          calendarDays.forEach((day) => {
            if (day.count === 0) {
              day.intensity = 0;
            } else {
              const logCount = Math.log10(day.count + 1);
              if (logCount <= p10) {
                day.intensity = 1;
              } else if (logCount <= p25) {
                day.intensity = 2;
              } else if (logCount <= p40) {
                day.intensity = 3;
              } else if (logCount <= p55) {
                day.intensity = 4;
              } else if (logCount <= p70) {
                day.intensity = 5;
              } else if (logCount <= p80) {
                day.intensity = 6;
              } else if (logCount <= p88) {
                day.intensity = 7;
              } else if (logCount <= p94) {
                day.intensity = 8;
              } else if (logCount <= p98) {
                day.intensity = 9;
              } else {
                day.intensity = 9;
              }
            }
          });
        }

        setData(calendarDays);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch data:", err);
        setLoading(false);
      });
  }, []);

  // Group days by month
  const groupByMonth = () => {
    const months: {
      name: string;
      weeks: CalendarDay[][];
    }[] = [];

    let currentMonth = -1;
    let currentWeeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];

    data.forEach((day, index) => {
      const month = day.date.getMonth();
      const year = day.date.getFullYear();
      // Convert Sunday (0) to 6, Monday (1) to 0, etc.
      const dayOfWeek = day.date.getDay() === 0 ? 6 : day.date.getDay() - 1;

      // If this is a new month
      if (month !== currentMonth) {
        // Save the previous month if it exists
        if (currentMonth !== -1 && currentWeeks.length > 0) {
          if (currentWeek.length > 0) {
            currentWeeks.push(currentWeek);
          }
          months.push({
            name: new Date(year, currentMonth).toLocaleString("en", {
              month: "short",
            }),
            weeks: currentWeeks,
          });
        }

        // Start a new month
        currentMonth = month;
        currentWeeks = [];
        currentWeek = [];

        // Add empty spacers for days before the month starts
        if (dayOfWeek > 0) {
          for (let i = 0; i < dayOfWeek; i++) {
            currentWeek.push({
              date: new Date(0),
              count: -1,
              intensity: -1,
            });
          }
        }
      }

      // Add the day to the current week
      currentWeek.push(day);

      // If we've completed a week (Sunday), start a new one
      if (dayOfWeek === 6) {
        currentWeeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Add the last week and month
    if (currentWeek.length > 0) {
      currentWeeks.push(currentWeek);
    }
    if (currentWeeks.length > 0) {
      months.push({
        name: new Date(
          data[data.length - 1].date.getFullYear(),
          currentMonth
        ).toLocaleString("en", { month: "short" }),
        weeks: currentWeeks,
      });
    }

    return months;
  };

  const months = groupByMonth();

  const getIntensityClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-zinc-900";
      case 1:
        return "bg-rose-950/40";
      case 2:
        return "bg-rose-900/60";
      case 3:
        return "bg-rose-900";
      case 4:
        return "bg-rose-800";
      case 5:
        return "bg-rose-700";
      case 6:
        return "bg-rose-600";
      case 7:
        return "bg-rose-500";
      case 8:
        return "bg-rose-400";
      case 9:
        return "bg-rose-300";
      default:
        return "bg-zinc-900";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-rose-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="flex flex-col gap-12">
        <div
          className="flex flex-col gap-2"
          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          <motion.h1
            className="text-2xl font-medium text-gray-300"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            Echoes in the Terminal
          </motion.h1>
          <motion.p
            className="text-sm text-gray-500 leading-snug max-w-2xl font-normal"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          >
            Every command tells a story. Through the quiet hum of terminals and
            the steady rhythm of keystrokes, each moment is preserved—the
            invisible threads that weave together days of work, exploration, and
            creation. This is the map of those journeys, rendered in color and
            time.
          </motion.p>
        </div>

        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {/* Day labels */}
          <motion.div
            className="flex flex-col gap-[3px] justify-start text-xs text-gray-400 pr-2 pt-5 lowercase"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="h-[10px]">M</div>
            <div className="h-[10px]">T</div>
            <div className="h-[10px]">W</div>
            <div className="h-[10px]">T</div>
            <div className="h-[10px]">F</div>
            <div className="h-[10px]">S</div>
            <div className="h-[10px]">S</div>
          </motion.div>

          {/* Months */}
          <div className="flex gap-3 flex-wrap">
            {months.map((month, monthIndex) => {
              // Calculate starting index for this month
              const startIndex = months
                .slice(0, monthIndex)
                .reduce((sum, m) => sum + m.weeks.flatMap((w) => w).length, 0);

              return (
                <div key={monthIndex} className="flex flex-col gap-1">
                  {/* Month label */}
                  <motion.div
                    className="text-xs text-gray-400 h-4 mb-1 lowercase"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.3,
                      delay: 0.5 + monthIndex * 0.05,
                    }}
                  >
                    {month.name}
                  </motion.div>

                  {/* Grid of days in this month */}
                  <div
                    className="grid gap-[3px]"
                    style={{
                      gridTemplateRows: "repeat(7, 10px)",
                      gridAutoFlow: "column",
                    }}
                  >
                    {month.weeks.flatMap((week, weekIndex) => {
                      const weekStartIndex =
                        startIndex +
                        month.weeks
                          .slice(0, weekIndex)
                          .reduce((sum, w) => sum + w.length, 0);

                      return week.map((day, dayIndex) => {
                        const absoluteIndex = weekStartIndex + dayIndex;

                        return (
                          <motion.div
                            key={`${day.date.getTime()}-${dayIndex}`}
                            className={`w-[10px] h-[10px] relative group ${
                              day.intensity === -1
                                ? "bg-transparent"
                                : getIntensityClass(day.intensity)
                            } ${
                              day.intensity >= 0
                                ? "hover:ring-1 hover:ring-rose-400 transition-all cursor-pointer"
                                : ""
                            }`}
                            initial={{ opacity: 0, scale: 1.25 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              duration: 0.15,
                              delay: 0.5 + absoluteIndex * 0.002,
                              ease: "easeOut",
                            }}
                          >
                            {day.intensity >= 0 && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                                <div className="font-semibold">
                                  {day.count.toLocaleString()} commands
                                </div>
                                <div className="text-gray-400">
                                  {day.date.toLocaleDateString("en", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            )}
                          </motion.div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Legend and Total */}
        <motion.div
          className="flex flex-wrap items-center justify-between gap-4 mt-4 text-xs text-gray-400"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <div className="flex items-center gap-2">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((intensity, i) => (
                <motion.div
                  key={i}
                  className={`w-[10px] h-[10px] ${getIntensityClass(
                    intensity
                  )}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: 1.2 + i * 0.03 }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
          {total !== null && (
            <motion.div
              className="text-gray-400 lowercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.6 }}
            >
              {total.toLocaleString()} commands over 365 days
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-xs text-gray-700 text-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.8 }}
        >
          <div>
            Data from{" "}
            <a
              href="https://atuin.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-500 transition-colors underline"
            >
              Atuin.sh
            </a>
            .
          </div>
          <div>Visualization by myself.</div>
        </motion.div>
      </div>
    </div>
  );
}
