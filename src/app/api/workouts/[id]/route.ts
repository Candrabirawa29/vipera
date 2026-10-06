import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { WORKOUT_PRESETS } from "@/lib/presets/workout-presets";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check presets first
    const preset = WORKOUT_PRESETS.find((p) => p.id === id);
    if (preset) {
      return NextResponse.json({
        workout: {
          id: preset.id,
          title: preset.title,
          description: preset.description,
          isPreset: true,
          steps: preset.steps,
        },
      });
    }

    const workout = await prisma.intervalWorkout.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    return NextResponse.json({ workout });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    await prisma.intervalWorkout.deleteMany({
      where: { id, userId: user.userId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
