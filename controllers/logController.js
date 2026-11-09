import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import {
  todayKey,
  last90Days,
  calcStreak,
  lastNDays,
} from "../utils/dateHelpers.js";

// @desc    Mark a habit complete for a date
// @route   POST /api/logs
export const markComplete = async (req, res) => {
  try {
    const { habitId, date, notes } = req.body;
    const completedDate = date || todayKey();

    // Verify habit belongs to user
    const habit = await Habit.findOne({
      _id: habitId,
      userId: req.user._id,
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const log = await HabitLog.findOneAndUpdate(
      {
        userId: req.user._id,
        habitId,
        completedDate,
      },
      {
        $setOnInsert: {
          userId: req.user._id,
          habitId,
          completedDate,
          notes: notes || "",
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Unmark/remove habit completion
// @route   DELETE /api/logs
export const unmarkComplete = async (req, res) => {
  try {
    const { habitId, date } = req.body;
    const completedDate = date || todayKey();

    const log = await HabitLog.findOneAndDelete({
      userId: req.user._id,
      habitId,
      completedDate,
    });

    if (!log) {
      return res.status(404).json({ message: "Log not found" });
    }

    res.json({ message: "Log removed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get today's logs for current user
// @route   GET /api/logs/today
export const getToday = async (req, res) => {
  try {
    const today = todayKey();
    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: today,
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get logs within date range
// @route   GET /api/logs/range
export const getRange = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and end dates are required" });
    }

    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: { $gte: start, $lte: end },
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get 90-day completion heatmap
// @route   GET /api/logs/heatmap
export const getHeatMap = async (req, res) => {
  try {
    const dates = last90Days();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: { $gte: startDate, $lte: endDate },
    });

    const counts = {};
    dates.forEach((d) => {
      counts[d] = 0;
    });

    logs.forEach((log) => {
      if (counts[log.completedDate] !== undefined) {
        counts[log.completedDate] += 1;
      }
    });

    const heatmap = dates.map((date) => ({
      date,
      count: counts[date] || 0,
    }));

    res.json(heatmap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get stats for all active habits
// @route   GET /api/logs/stats
export const getAllStats = async (req, res) => {
  try {
    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });

    const last30 = lastNDays(30);
    const startDate = last30[0];

    const stats = await Promise.all(
      habits.map(async (habit) => {
        const allLogs = await HabitLog.find({
          userId: req.user._id,
          habitId: habit._id,
        }).sort({ completedDate: -1 });

        const dates = allLogs.map((l) => l.completedDate);
        const { current, longest } = calcStreak(dates);

        const completionsLast30 = allLogs.filter(
          (l) => l.completedDate >= startDate
        ).length;

        return {
          habitId: habit._id,
          name: habit.name,
          category: habit.category,
          color: habit.color,
          icon: habit.icon,
          currentStreak: current,
          longestStreak: longest,
          completionsLast30,
        };
      })
    );

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get detailed stats for a single habit
// @route   GET /api/logs/stats/:habitId
export const getHabitStats = async (req, res) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.habitId,
      userId: req.user._id,
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId: habit._id,
    }).sort({ completedDate: -1 });

    const dates = logs.map((l) => l.completedDate);
    const { current, longest } = calcStreak(dates);

    const daysSinceCreation = Math.max(
      1,
      Math.floor(
        (Date.now() - new Date(habit.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const completionRate = Math.min(
      100,
      Math.round((logs.length / daysSinceCreation) * 100)
    );

    res.json({
      habit,
      totalCompletions: logs.length,
      currentStreak: current,
      longestStreak: longest,
      completionRate,
      logs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};