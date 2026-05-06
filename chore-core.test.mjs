import test from "node:test";
import assert from "node:assert/strict";
import { assignChores, buildMessage, buildMessagesForRange, getJstParts, getTodaysChores } from "./chore-core.mjs";

test("tuesday includes recycling and sink cleaning", () => {
  const parts = getJstParts(new Date("2026-05-12T00:00:00+09:00"));
  const chores = getTodaysChores(parts).map((chore) => chore.label);
  assert.deepEqual(chores.sort(), ["キッチン（シンク）掃除", "ゴミ捨て（びん・かん・ペットボトル系）", "夜ご飯料理", "皿洗い", "洗濯（回す・干す）"].sort());
});

test("saturday includes alternating weekend room reset", () => {
  const parts = getJstParts(new Date("2026-05-09T00:00:00+09:00"));
  const chores = getTodaysChores(parts).map((chore) => chore.label);
  assert.match(chores.join(","), /部屋の全体的な片付け/);
  assert.match(chores.join(","), /ゴミ捨て（燃えるゴミ）/);
  assert.match(chores.join(","), /ゴミ捨て（乾電池）/);
});

test("weighted assignment stays balanced for two members", () => {
  const parts = getJstParts(new Date("2026-05-05T00:00:00+09:00"));
  const assignments = assignChores(parts);
  const totals = assignments.map((item) => item.totalPoints);
  assert.ok(Math.abs(totals[0] - totals[1]) <= 4);
});

test("weekly cumulative assignment stays close over seven days", () => {
  const messages = buildMessagesForRange(new Date("2026-05-05T00:00:00+09:00"), 7);
  const totals = new Map([
    ["こうすけ", 0],
    ["えり", 0],
  ]);

  for (const message of messages) {
    for (const assignment of message.assignments) {
      totals.set(assignment.member, totals.get(assignment.member) + assignment.totalPoints);
    }
  }

  assert.ok(Math.abs(totals.get("こうすけ") - totals.get("えり")) <= 3);
});

test("dinner assignment does not repeat on consecutive days when avoidable", () => {
  const messages = buildMessagesForRange(new Date("2026-05-05T00:00:00+09:00"), 7);
  const dinnerAssignees = messages.map((message) => {
    const owner = message.assignments.find((assignment) =>
      assignment.chores.some((chore) => chore.id === "cook-dinner")
    );
    return owner?.member;
  });

  for (let index = 1; index < dinnerAssignees.length; index += 1) {
    assert.notEqual(dinnerAssignees[index], dinnerAssignees[index - 1]);
  }
});

test("message contains points and rules", () => {
  const { text } = buildMessage(new Date("2026-05-05T00:00:00+09:00"));
  assert.match(text, /こうすけ/);
  assert.match(text, /えり/);
  assert.match(text, /2026\/05\/05（火）/);
  assert.match(text, /今週:/);
  assert.match(text, /皿洗い/);
  assert.match(text, /おはようにゃ/);
  assert.match(text, /\/\\_\/\\\\/);
  assert.match(text, /""   ""/);
});
