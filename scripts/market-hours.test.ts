/**
 * The sentence under the price, at every hour of the week.
 *
 * This exists because of one bug that was visible on the site for a long
 * time and that nothing could have caught: at 06:55 in New York the page
 * said "מסחר מוקדם · נפתחת בעוד 3 שעות" to a reader who was watching
 * pre-market trade. Both halves were true of different things and the
 * sentence was false. A status line is read more often than almost
 * anything else on the site, and it is exactly the kind of string that
 * nobody re-reads once it has shipped.
 *
 *   npm run test:hours
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeStatus, marketStatus } from "../src/lib/market-hours";

/** New York wall clock, the shape `marketStatus` takes for testing. */
const at = (day: number, hour: number, minute = 0) => ({
  day,
  minutes: hour * 60 + minute,
});

const MON = 1;
const FRI = 5;
const SAT = 6;
const SUN = 0;

test("pre-market is a session in progress, never one that opens later", () => {
  const status = marketStatus(at(MON, 6, 55));
  assert.equal(status.state, "pre");

  const text = describeStatus(status);
  // The exact failure that was reported: the early session described as
  // something that has not started.
  assert.ok(
    !text.includes("נפתחת בעוד"),
    `pre-market must not be described as opening later, got: ${text}`,
  );
  assert.ok(text.includes("הפתיחה הרגילה"), text);
});

test("an open exchange counts down to the bell, not to an opening", () => {
  const status = marketStatus(at(MON, 11, 0));
  assert.equal(status.state, "open");
  assert.equal(status.opensInMinutes, null);
  assert.equal(status.sessionEndsInMinutes, 5 * 60);
  assert.ok(describeStatus(status).includes("ננעלת בעוד"));
});

test("late trading counts down to its own end", () => {
  const status = marketStatus(at(MON, 17, 0));
  assert.equal(status.state, "after");
  assert.equal(status.sessionEndsInMinutes, 3 * 60);

  const text = describeStatus(status);
  assert.ok(text.includes("מסתיים בעוד"), text);
  assert.ok(!text.includes("נפתחת בעוד"), text);
});

test("only a closed exchange is described as opening", () => {
  for (const when of [at(SAT, 12), at(SUN, 12), at(MON, 2), at(MON, 21)]) {
    const status = marketStatus(when);
    assert.equal(status.state, "closed");
    assert.equal(status.sessionEndsInMinutes, null);
    assert.ok(describeStatus(status).includes("נפתחת בעוד"));
  }
});

test("the weekend opens on Monday, not on Saturday", () => {
  const friday = marketStatus(at(FRI, 17));
  const saturday = marketStatus(at(SAT, 12));
  // Friday evening is still a trading session; Saturday is not, and its
  // countdown has to cross two days rather than one.
  assert.equal(friday.state, "after");
  assert.ok(
    saturday.opensInMinutes !== null && saturday.opensInMinutes > 24 * 60,
    `Saturday should be more than a day from the open, got ${saturday.opensInMinutes}`,
  );
});

test("no sentence ever claims two things about the same session", () => {
  // Every half hour of the week, in every state, the line must not both
  // open and close the same thing.
  for (let day = 0; day < 7; day++) {
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
      const text = describeStatus(marketStatus({ day, minutes }));
      const opens = text.includes("נפתחת בעוד");
      const ends = text.includes("ננעלת בעוד") || text.includes("מסתיים בעוד");
      assert.ok(!(opens && ends), `contradictory line on day ${day}: ${text}`);
    }
  }
});
