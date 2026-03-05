import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  weekDay: string;
  exercises: Array<{
    id: string;
    name: string;
    order: number;
    workoutDayId: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string;
    completedAt?: string;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan || workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId },
      include: {
        exercises: { orderBy: { order: "asc" } },
        sessions: { orderBy: { startedAt: "desc" } },
      },
    });

    if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        order: e.order,
        workoutDayId: e.workoutDayId,
        sets: e.sets,
        reps: e.reps,
        restTimeInSeconds: e.restTimeInSeconds,
      })),
      sessions: workoutDay.sessions.map((s) => ({
        id: s.id,
        workoutDayId: s.workoutDayId,
        startedAt: s.startedAt
          ? dayjs.utc(s.startedAt).format("YYYY-MM-DD")
          : undefined,
        completedAt: s.completedAt
          ? dayjs.utc(s.completedAt).format("YYYY-MM-DD")
          : undefined,
      })),
    };
  }
}
