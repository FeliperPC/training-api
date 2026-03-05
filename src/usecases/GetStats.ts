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
  from: string;
  to: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    { workoutDayCompleted: boolean; workoutDayStarted: boolean }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjs.utc(dto.from).startOf("day");
    const toDate = dayjs.utc(dto.to).endOf("day");

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: { workoutDays: true },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId: dto.userId, isActive: true },
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
    });

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (const session of sessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      if (!consistencyByDay[dayKey]) {
        consistencyByDay[dayKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      consistencyByDay[dayKey].workoutDayStarted = true;

      if (session.completedAt !== null) {
        consistencyByDay[dayKey].workoutDayCompleted = true;
      }
    }

    const completedWorkoutsCount = sessions.filter(
      (s) => s.completedAt !== null,
    ).length;

    const totalSessions = sessions.length;
    const conclusionRate =
      totalSessions > 0 ? completedWorkoutsCount / totalSessions : 0;

    let totalTimeInSeconds = 0;
    for (const session of sessions) {
      if (session.completedAt) {
        const start = dayjs.utc(session.startedAt);
        const end = dayjs.utc(session.completedAt);
        totalTimeInSeconds += end.diff(start, "second");
      }
    }

    const workoutStreak = this.calculateStreak(
      dayjs.utc(dto.to),
      workoutPlan.workoutDays,
      sessions,
    );

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private calculateStreak(
    fromDate: dayjs.Dayjs,
    workoutDays: Array<{ weekDay: WeekDay; isRest: boolean }>,
    sessions: Array<{ startedAt: Date; completedAt: Date | null }>,
  ): number {
    const weekDayMap = new Map<string, boolean>();
    for (const wd of workoutDays) {
      weekDayMap.set(wd.weekDay, wd.isRest);
    }

    const completedDates = new Set(
      sessions
        .filter((s) => s.completedAt !== null)
        .map((s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD")),
    );

    const lookbackDays = 90;
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
