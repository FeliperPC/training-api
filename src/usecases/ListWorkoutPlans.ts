import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  active?: boolean;
}

interface SessionOutput {
  id: string;
  workoutDayId: string;
  startedAt: string;
  completedAt?: string;
}

interface ExerciseOutput {
  id: string;
  name: string;
  order: number;
  workoutDayId: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
}

interface WorkoutDayOutput {
  id: string;
  name: string;
  weekDay: string;
  isRest: boolean;
  estimatedDurationInSeconds: number;
  coverImageUrl?: string;
  exercises: ExerciseOutput[];
  sessions: SessionOutput[];
}

interface OutputDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workoutDays: WorkoutDayOutput[];
}

export class ListWorkoutPlans {
  async execute(dto: InputDto): Promise<OutputDto[]> {
    const where: { userId: string; isActive?: boolean } = {
      userId: dto.userId,
    };

    if (dto.active !== undefined) {
      where.isActive = dto.active;
    }

    const plans = await prisma.workoutPlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        workoutDays: {
          include: {
            exercises: { orderBy: { order: "asc" } },
            sessions: { orderBy: { startedAt: "desc" } },
          },
        },
      },
    });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      workoutDays: plan.workoutDays.map((day) => ({
        id: day.id,
        name: day.name,
        weekDay: day.weekDay,
        isRest: day.isRest,
        estimatedDurationInSeconds: day.estimatedDurationInSeconds,
        coverImageUrl: day.coverImageUrl ?? undefined,
        exercises: day.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          order: e.order,
          workoutDayId: e.workoutDayId,
          sets: e.sets,
          reps: e.reps,
          restTimeInSeconds: e.restTimeInSeconds,
        })),
        sessions: day.sessions.map((s) => ({
          id: s.id,
          workoutDayId: s.workoutDayId,
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt?.toISOString() ?? undefined,
        })),
      })),
    }));
  }
}
