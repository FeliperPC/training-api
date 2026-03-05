import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

const DAY_INDEX_TO_WEEKDAY: Record<number, WeekDay> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

interface InputDto {
  userId: string;
  date: string;
}

interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    { workoutDayCompleted: boolean; workoutDayStarted: boolean }
  >;
}

export class GetHome {
  async execute(dto: InputDto): Promise<OutputDto> {
    const inputDate = dayjs.utc(dto.date);

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            _count: { select: { exercises: true } },
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWeekDay = DAY_INDEX_TO_WEEKDAY[inputDate.day()];
    const todayWorkoutDay = workoutPlan.workoutDays.find(
      (d) => d.weekDay === todayWeekDay,
    );

    if (!todayWorkoutDay) {
      throw new NotFoundError("No workout day found for the given date");
    }

    const weekStart = inputDate.day(0).startOf("day");
    const weekEnd = inputDate.day(6).endOf("day");

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId: dto.userId, isActive: true },
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day");
      const dayKey = day.format("YYYY-MM-DD");

      const daySessions = sessions.filter(
        (s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD") === dayKey,
      );

      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (s) => s.completedAt !== null,
      );

      consistencyByDay[dayKey] = { workoutDayCompleted, workoutDayStarted };
    }

    const workoutStreak = await this.calculateStreak(
      dto.userId,
      inputDate,
      workoutPlan.workoutDays,
    );

    return {
      activeWorkoutPlanId: workoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: workoutPlan.id,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
        exercisesCount: todayWorkoutDay._count.exercises,
      },
      workoutStreak,
      consistencyByDay,
    };
  }

  private async calculateStreak(
    userId: string,
    fromDate: dayjs.Dayjs,
    workoutDays: Array<{ weekDay: WeekDay; isRest: boolean }>,
  ): Promise<number> {
    const weekDayMap = new Map<string, boolean>();
    for (const wd of workoutDays) {
      weekDayMap.set(wd.weekDay, wd.isRest);
    }

    const lookbackDays = 90;
    const lookbackStart = fromDate.subtract(lookbackDays, "day").startOf("day");

    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId, isActive: true },
        },
        completedAt: { not: null },
        startedAt: {
          gte: lookbackStart.toDate(),
          lte: fromDate.endOf("day").toDate(),
        },
      },
    });

    const completedDates = new Set(
      completedSessions.map((s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD")),
    );

    let streak = 0;
    let current = fromDate;

    for (let i = 0; i <= lookbackDays; i++) {
      const weekDay = DAY_INDEX_TO_WEEKDAY[current.day()];
      const isInPlan = weekDayMap.has(weekDay);

      if (!isInPlan) {
        current = current.subtract(1, "day");
        continue;
      }

      const isRest = weekDayMap.get(weekDay)!;

      if (isRest) {
        streak++;
      } else {
        const dateKey = current.format("YYYY-MM-DD");
        if (completedDates.has(dateKey)) {
          streak++;
        } else {
          break;
        }
      }

      current = current.subtract(1, "day");
    }

    return streak;
  }
}
