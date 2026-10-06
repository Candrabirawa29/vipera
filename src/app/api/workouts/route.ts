import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { WORKOUT_PRESETS } from "@/lib/presets/workout-presets";

export async function GET() {
  try {
    const user = await getCurrentUser();

    let customWorkouts: any[] = [];
    try {
      customWorkouts = await prisma.intervalWorkout.findMany({
        where: { userId: user.userId },
        include: {
          steps: { orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      console.warn("DB workouts query fallback:", err);
    }

    // Merge presets and custom workouts
    // Check if presets are already in customWorkouts to avoid duplicate listing
    const customTitles = new Set(customWorkouts.map((w) => w.title));
    const unseededPresets = WORKOUT_PRESETS.filter((p) => !customTitles.has(p.title));

    const allWorkouts = [
      ...customWorkouts,
      ...unseededPresets.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        isPreset: true,
        steps: p.steps,
      })),
    ];

    return NextResponse.json({ workouts: allWorkouts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const { title, description, steps } = body;

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Workout title and at least one step are required" },
        { status: 400 }
      );
    }

    const created = await prisma.intervalWorkout.create({
      data: {
        userId: user.userId,
        title,
        description,
        isPreset: false,
        steps: {
          create: steps.map((s: any, idx: number) => ({
            order: s.order || idx + 1,
            stepType: s.stepType || "RUN",
            targetType: s.targetType || "DISTANCE",
            targetValue: parseFloat(s.targetValue) || 400,
            targetUnit: s.targetUnit || "METERS",
            repeatCount: parseInt(s.repeatCount, 10) || 1,
            groupIndex: s.groupIndex !== undefined ? s.groupIndex : null,
            label: s.label || null,
            targetPaceMin: s.targetPaceMin ? parseFloat(s.targetPaceMin) : null,
            targetPaceMax: s.targetPaceMax ? parseFloat(s.targetPaceMax) : null,
            notes: s.notes || null,
          })),
        },
      },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ workout: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
