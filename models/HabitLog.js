import mongoose from "mongoose";

const habitLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
      index: true,
    },
    completedDate: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring one completion log per habit per day for a user
habitLogSchema.index(
  { userId: 1, habitId: 1, completedDate: 1 },
  { unique: true }
);

const HabitLog = mongoose.model("HabitLog", habitLogSchema);

export default HabitLog;