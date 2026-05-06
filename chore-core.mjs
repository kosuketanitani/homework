import { choreConfig } from "./chore-config.mjs";

const MS_PER_DAY = 86400000;

export function getJstParts(date = new Date(), timezone = choreConfig.timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday],
  };
}

export function getDateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getDaySerial(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

export function getWeekendAnchor(parts) {
  return Math.floor(getDaySerial(parts) / 7);
}

export function getStartOfWeekDate(date = new Date(), timezone = choreConfig.timezone) {
  const parts = getJstParts(date, timezone);
  const diffToMonday = (parts.weekday + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - diffToMonday);
  return start;
}

export function isChoreScheduledForDate(chore, parts) {
  const { schedule } = chore;

  if (schedule.type === "daily") {
    return true;
  }

  if (schedule.type === "weekly") {
    return parts.weekday === schedule.weekday;
  }

  if (schedule.type === "biweekly") {
    if (parts.weekday !== schedule.weekday) {
      return false;
    }
    return (getWeekendAnchor(parts) + schedule.offset) % 2 === 0;
  }

  if (schedule.type === "everyNDays") {
    return (getDaySerial(parts) + schedule.offset) % schedule.interval === 0;
  }

  if (schedule.type === "weeklyAlternatingWeekend") {
    if (parts.weekday !== 0 && parts.weekday !== 6) {
      return false;
    }

    const parity = getWeekendAnchor(parts) % 2;
    return parity === 0 ? parts.weekday === schedule.startWith : parts.weekday !== schedule.startWith;
  }

  return false;
}

export function getTodaysChores(parts, config = choreConfig) {
  return config.chores.filter((chore) => isChoreScheduledForDate(chore, parts));
}

function createPlannerState(config) {
  return {
    scores: new Map(config.members.map((member, index) => [
      member,
      {
        weeklyPoints: 0,
        weeklyAssignedCount: 0,
        tieBreaker: index,
      },
    ])),
    lastDinnerAssignee: null,
  };
}

function compareMembers(a, b) {
  if (a.weeklyPoints !== b.weeklyPoints) {
    return a.weeklyPoints - b.weeklyPoints;
  }
  if (a.weeklyAssignedCount !== b.weeklyAssignedCount) {
    return a.weeklyAssignedCount - b.weeklyAssignedCount;
  }
  return a.tieBreaker - b.tieBreaker;
}

function compareChores(a, b) {
  if (a.points !== b.points) {
    return b.points - a.points;
  }
  if (a.id === "cook-dinner" && b.id !== "cook-dinner") {
    return -1;
  }
  if (a.id !== "cook-dinner" && b.id === "cook-dinner") {
    return 1;
  }
  return a.label.localeCompare(b.label, "ja");
}

export function assignChores(parts, config = choreConfig, scores = createPlannerState(config)) {
  const plannerState = scores instanceof Map
    ? { scores, lastDinnerAssignee: null }
    : scores;
  const chores = [...getTodaysChores(parts, config)].sort(compareChores);
  const assignments = new Map(config.members.map((member) => [member, []]));

  for (const chore of chores) {
    if (chore.shared) {
      for (const member of config.members) {
        assignments.get(member).push(chore);
        const state = plannerState.scores.get(member);
        state.weeklyPoints += chore.points;
        state.weeklyAssignedCount += 1;
      }
      continue;
    }

    const rankedMembers = [...plannerState.scores.entries()]
      .sort((left, right) => compareMembers(left[1], right[1]))
      .map(([member]) => member);

    const member = chore.id === "cook-dinner"
      ? rankedMembers.find((candidate) => candidate !== plannerState.lastDinnerAssignee) ?? rankedMembers[0]
      : rankedMembers[0];

    assignments.get(member).push(chore);
    const state = plannerState.scores.get(member);
    state.weeklyPoints += chore.points;
    state.weeklyAssignedCount += 1;

    if (chore.id === "cook-dinner") {
      plannerState.lastDinnerAssignee = member;
    }
  }

  return config.members.map((member) => ({
    member,
    chores: assignments.get(member),
    totalPoints: assignments.get(member).reduce((sum, chore) => sum + chore.points, 0),
    weeklyPoints: plannerState.scores.get(member).weeklyPoints,
  }));
}

export function buildMessage(date = new Date(), config = choreConfig) {
  const weekStart = getStartOfWeekDate(date, config.timezone);
  return buildMessagesForRange(weekStart, Math.floor((date - weekStart) / MS_PER_DAY) + 1, config).at(-1);
}

function formatMessage(parts, assignments, config) {
  const weekdayJa = ["日", "月", "火", "水", "木", "金", "土"][parts.weekday];
  const sharedAssignments = [];
  const personalAssignments = assignments.map((assignment) => ({
    ...assignment,
    chores: assignment.chores.filter((chore) => {
      if (chore.shared) {
        if (!sharedAssignments.some((item) => item.id === chore.id)) {
          sharedAssignments.push(chore);
        }
        return false;
      }
      return true;
    }),
  }));
  const lines = [
    `【${parts.year}/${String(parts.month).padStart(2, "0")}/${String(parts.day).padStart(2, "0")}（${weekdayJa}） ${config.title}】`,
    "",
    "おはようにゃ。",
    "",
  ];

  personalAssignments.forEach((assignment, index) => {
    if (assignment.chores.length === 0) {
      lines.push(`・${assignment.member} 今日:0pt`);
      lines.push("  きょうはおやすみにゃ");
      if (index < personalAssignments.length - 1) {
        lines.push("");
      }
      return;
    }

    lines.push(`・${assignment.member} 今日:${assignment.totalPoints}pt`);
    for (const chore of assignment.chores) {
      lines.push(`  ・${chore.label}`);
    }
    if (index < personalAssignments.length - 1) {
      lines.push("");
    }
  });

  if (sharedAssignments.length > 0) {
    lines.push("");
    lines.push("二人で");
    for (const chore of sharedAssignments) {
      lines.push(`・${chore.label}`);
    }
  }

  lines.push("");
  lines.push(config.footer);

  return lines.join("\n");
}

export function buildMessagesForRange(startDate = new Date(), days = 7, config = choreConfig) {
  const plannerState = createPlannerState(config);

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + offset);
    const parts = getJstParts(date, config.timezone);
    const assignments = assignChores(parts, config, plannerState);

    return {
      date,
      text: formatMessage(parts, assignments, config),
      assignments,
      parts,
    };
  });
}
