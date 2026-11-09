import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AIInsight from "../models/AIInsight.js";
import {
  chatCompletion,
  SYSTEM_PROMPTS,
  parseJSONResponse,
} from "../utils/aiService.js";
import {
  todayKey,
  lastNDays,
  currentWeekDates,
  calcStreak,
} from "../utils/dateHelpers.js";

// Helper to build context for weekly report
const buildWeeklyContext = async (userId) => {
  const habits = await Habit.find({ userId, isArchived: false });
  const weekDates = currentWeekDates();
  const startDate = weekDates[0];
  const endDate = weekDates[weekDates.length - 1];

  const logs = await HabitLog.find({
    userId,
    completedDate: { $gte: startDate, $lte: endDate },
  });

  const habitSummary = habits.map((habit) => {
    const habitLogs = logs.filter(
      (l) => l.habitId.toString() === habit._id.toString()
    );
    return {
      name: habit.name,
      category: habit.category,
      frequency: habit.frequency,
      targetDays: habit.targetDays,
      completedDays: habitLogs.length,
    };
  });

  return { weekDates, habitSummary };
};

// @desc    Generate AI weekly report
// @route   POST /api/ai/weekly
export const weeklyReport = async (req, res) => {
  try {
    const { habitSummary } = await buildWeeklyContext(req.user._id);

    if (!habitSummary || habitSummary.length === 0) {
      return res.json({
        content:
          "You have no active habits tracked this week yet. Create some habits to receive your personalized AI weekly report!",
      });
    }

    const userMessage = `Here is my habit performance for this week:
${habitSummary
  .map(
    (h) =>
      `- ${h.name} (${h.category}): Completed ${h.completedDays} / ${h.targetDays} target days`
  )
  .join("\n")}`;

    const content = await chatCompletion({
      systemPrompt: SYSTEM_PROMPTS.weekly,
      userMessage,
      temperature: 0.7,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "weekly",
      content,
      meta: { habitCount: habitSummary.length },
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Generate habit suggestions
// @route   POST /api/ai/suggest
export const suggestHabits = async (req, res) => {
  try {
    const { goals, productiveTime, struggles } = req.body;

    const userMessage = `User Goals: ${goals || "Improve health and focus"}
Productive Time: ${productiveTime || "Mornings"}
Past Struggles: ${struggles || "Consistency on weekends"}`;

    const rawResponse = await chatCompletion({
      systemPrompt: SYSTEM_PROMPTS.suggestion,
      userMessage,
      temperature: 0.6,
    });

    let suggestions = parseJSONResponse(rawResponse);

    // Fallback defaults if model output parsing fails
    if (!suggestions || !Array.isArray(suggestions)) {
      suggestions = [
        {
          name: "Morning Hydration",
          description: "Drink 500ml of water right after waking up.",
          frequency: "daily",
          category: "health",
          icon: "💧",
          reason: "Simple win to start your day with energy.",
        },
        {
          name: "20-Minute Focus Read",
          description: "Read non-fiction before looking at screens.",
          frequency: "daily",
          category: "learning",
          icon: "📖",
          reason: "Leverages your peak morning productivity.",
        },
        {
          name: "Evening Wind Down",
          description: "Disconnect from devices 30 minutes before sleep.",
          frequency: "daily",
          category: "mindfulness",
          icon: "🌙",
          reason: "Directly combats late-night inconsistency.",
        },
      ];
    }

    await AIInsight.create({
      userId: req.user._id,
      type: "suggestion",
      content: JSON.stringify(suggestions),
      meta: { goals, productiveTime, struggles },
    });

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Generate streak recovery plan
// @route   POST /api/ai/recovery
export const recoveryPlan = async (req, res) => {
  try {
    const { habitId } = req.body;

    const habit = await Habit.findOne({
      _id: habitId,
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

    const userMessage = `Habit: ${habit.name}
Category: ${habit.category}
Current Streak: ${current} days
Longest Streak: ${longest} days
The user just missed completing this habit recently and broke their streak.`;

    const content = await chatCompletion({
      systemPrompt: SYSTEM_PROMPTS.recovery,
      userMessage,
      temperature: 0.7,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "recovery",
      content,
      meta: { habitId: habit._id, habitName: habit.name },
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Chat with AI about habit data
// @route   POST /api/ai/chat
export const chatAnalysis = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const habits = await Habit.find({ userId: req.user._id, isArchived: false });
    const last30 = lastNDays(30);
    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: { $gte: last30[0] },
    });

    // Build day of week breakdown for habits
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const contextPayload = habits.map((h) => {
      const hLogs = logs.filter(
        (l) => l.habitId.toString() === h._id.toString()
      );
      const dayCounts = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
      };

      hLogs.forEach((l) => {
        const dayIndex = new Date(l.completedDate).getDay();
        dayCounts[daysOfWeek[dayIndex]] += 1;
      });

      return {
        name: h.name,
        category: h.category,
        totalCompletionsLast30Days: hLogs.length,
        dayOfWeekBreakdown: dayCounts,
      };
    });

    const userMessage = `Habit History Context (Last 30 days):
${JSON.stringify(contextPayload, null, 2)}

User Question: ${message}`;

    const content = await chatCompletion({
      systemPrompt: SYSTEM_PROMPTS.chat,
      userMessage,
      temperature: 0.5,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "chat",
      content,
      meta: { question: message },
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get morning motivation message
// @route   GET /api/ai/morning
export const morningMotivation = async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user._id, isArchived: false });

    if (!habits || habits.length === 0) {
      return res.json({
        content: "Good morning! Set up your first habit today to start building momentum.",
      });
    }

    const today = todayKey();
    const todayLogs = await HabitLog.find({
      userId: req.user._id,
      completedDate: today,
    });

    const habitSummaries = await Promise.all(
      habits.map(async (h) => {
        const allLogs = await HabitLog.find({
          userId: req.user._id,
          habitId: h._id,
        }).sort({ completedDate: -1 });

        const dates = allLogs.map((l) => l.completedDate);
        const { current } = calcStreak(dates);

        return {
          name: h.name,
          currentStreak: current,
        };
      })
    );

    const userMessage = `User Habit Overview:
Total Habits: ${habits.length}
Completed Today So Far: ${todayLogs.length}
Habits with Streaks:
${habitSummaries.map((h) => `- ${h.name}: ${h.currentStreak} day streak`).join("\n")}`;

    const content = await chatCompletion({
      systemPrompt: SYSTEM_PROMPTS.morning,
      userMessage,
      temperature: 0.8,
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};