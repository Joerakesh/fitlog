import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const setSchema = new mongoose.Schema({
  setNumber: { type: Number, required: true },
  reps: { type: Number, required: true, min: 0 },
  weightKg: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: true },
  completedAt: { type: Date, default: Date.now }
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  muscleGroup: String,
  sets: [setSchema]
}, { _id: false });

const workoutSchema = new mongoose.Schema({
  planName: { type: String, required: true },
  startedAt: { type: Date, required: true },
  finishedAt: Date,
  status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
  exercises: [exerciseSchema],
  notes: String
}, { timestamps: true });

const sleepSchema = new mongoose.Schema({
  startedAt: { type: Date, required: true },
  wokeAt: Date,
  durationMinutes: Number,
  quality: { type: Number, min: 1, max: 5 },
  notes: String
}, { timestamps: true });

const planExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  muscleGroup: String,
  targetSets: { type: Number, default: 3, min: 1 },
  targetReps: { type: String, default: "8-12" },
  restSeconds: { type: Number, default: 90, min: 0 }
}, { _id: false });

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  exercises: [planExerciseSchema]
}, { timestamps: true });

const Workout = mongoose.model("Workout", workoutSchema);
const Sleep = mongoose.model("Sleep", sleepSchema);
const Plan = mongoose.model("Plan", planSchema);

const defaultPlans = [
  { name: "PULL", description: "Back, rear delts and biceps", exercises: [
    ["Lat Pulldown","Lats"],["Lat Machine Row","Mid back"],["Reverse Pec Deck","Rear delts"],
    ["Dumbbell Curl","Biceps"],["Hammer Curl","Biceps and forearms"],["Hyperextension","Lower back"],["Plank","Core"]
  ].map(([name,muscleGroup]) => ({ name, muscleGroup, targetSets: name === "Plank" ? 3 : 3, targetReps: name === "Plank" ? "30-60 sec" : "8-12", restSeconds: 90 })) },
  { name: "LEGS", description: "Quads, hamstrings and calves", exercises: [
    ["Smith Machine Squat","Quads and glutes"],["Bulgarian Split Squat","Quads and glutes"],["Seated Leg Curl","Hamstrings"],
    ["Leg Extension","Quads"],["Standing Calf Raise","Calves"],["Leg Raises","Core"]
  ].map(([name,muscleGroup]) => ({ name, muscleGroup, targetSets: 3, targetReps: name === "Leg Raises" ? "8-15" : "8-12", restSeconds: 90 })) },
  { name: "PUSH", description: "Chest, shoulders and triceps", exercises: [
    ["Incline Dumbbell Press","Upper chest"],["Overhead Press (OHP)","Shoulders"],["Lateral Raise","Side delts"],
    ["Pec Fly","Chest"],["Triceps Pushdown","Triceps"],["Overhead Triceps Extension","Triceps"],["Dead Bug or Side Plank","Core"]
  ].map(([name,muscleGroup]) => ({ name, muscleGroup, targetSets: 3, targetReps: name.includes("Dead Bug") ? "3 sets" : "8-12", restSeconds: 90 })) }
];

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
}));

app.get("/api/plans", async (_req, res, next) => {
  try { res.json(await Plan.find().sort({ name: 1 })); } catch (e) { next(e); }
});

app.post("/api/plans", async (req, res, next) => {
  try {
    const { name, description = "", exercises = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Plan name is required" });
    const plan = await Plan.findOneAndUpdate(
      { name: name.trim().toUpperCase() },
      { name: name.trim().toUpperCase(), description, exercises },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(plan);
  } catch (e) { next(e); }
});

app.patch("/api/plans/:name", async (req, res, next) => {
  try {
    const plan = await Plan.findOneAndUpdate(
      { name: req.params.name.toUpperCase() }, { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) { next(e); }
});

app.post("/api/workouts", async (req, res, next) => {
  try {
    const { planName, exercises = [] } = req.body;
    if (!planName) return res.status(400).json({ error: "planName is required" });
    const workout = await Workout.create({ planName, startedAt: new Date(), exercises });
    res.status(201).json(workout);
  } catch (e) { next(e); }
});

app.patch("/api/workouts/:id", async (req, res, next) => {
  try {
    const workout = await Workout.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!workout) return res.status(404).json({ error: "Workout not found" });
    res.json(workout);
  } catch (e) { next(e); }
});

app.get("/api/workouts", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await Workout.find().sort({ startedAt: -1 }).limit(limit));
  } catch (e) { next(e); }
});

app.get("/api/analytics/summary", async (_req, res, next) => {
  try {
    const workouts = await Workout.find({ status: "completed" }).lean();
    const completedSets = workouts.flatMap(w => w.exercises.flatMap(e => e.sets || [])).filter(s => s.completed);
    const totalReps = completedSets.reduce((n, s) => n + (s.reps || 0), 0);
    const totalVolumeKg = completedSets.reduce((n, s) => n + (s.reps || 0) * (s.weightKg || 0), 0);
    const prs = {};
    for (const w of workouts) for (const ex of w.exercises) {
      const best = Math.max(0, ...(ex.sets || []).filter(s => s.completed).map(s => s.weightKg || 0));
      prs[ex.name] = Math.max(prs[ex.name] || 0, best);
    }
    res.json({ workouts: workouts.length, totalSets: completedSets.length, totalReps, totalVolumeKg, bestWeightByExercise: prs });
  } catch (e) { next(e); }
});

app.post("/api/sleep/start", async (_req, res, next) => {
  try {
    const open = await Sleep.findOne({ wokeAt: null }).sort({ startedAt: -1 });
    if (open) return res.status(409).json({ error: "A sleep session is already running", sleep: open });
    res.status(201).json(await Sleep.create({ startedAt: new Date() }));
  } catch (e) { next(e); }
});

app.post("/api/sleep/wake", async (req, res, next) => {
  try {
    const sleep = await Sleep.findOne({ wokeAt: null }).sort({ startedAt: -1 });
    if (!sleep) return res.status(404).json({ error: "No active sleep session found" });
    sleep.wokeAt = new Date();
    sleep.durationMinutes = Math.max(0, Math.round((sleep.wokeAt - sleep.startedAt) / 60000));
    if (req.body.quality) sleep.quality = req.body.quality;
    if (req.body.notes) sleep.notes = req.body.notes;
    await sleep.save();
    res.json(sleep);
  } catch (e) { next(e); }
});

app.get("/api/sleep", async (_req, res, next) => {
  try { res.json(await Sleep.find().sort({ startedAt: -1 }).limit(100)); } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error", detail: process.env.NODE_ENV === "development" ? err.message : undefined });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and add your Atlas connection string.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");
  for (const plan of defaultPlans) {
    await Plan.updateOne({ name: plan.name }, { $setOnInsert: plan }, { upsert: true });
  }
  app.listen(PORT, () => console.log(`FitLog running at http://localhost:${PORT}`));
}

start().catch(err => { console.error("Startup failed:", err); process.exit(1); });
