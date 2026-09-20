import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, RESPONSES, simulate, readBalances } from '../src/app/chaos/engine.ts';

test('the presented encounter has reproducible goal dates, cash and reserve scores', () => {
  const before = simulate(DEMO, 0), shock = simulate(DEMO, 850);
  assert.deepEqual([before.goalMonth, before.score, before.cashNow, before.reserveNow], [4, 84, 2560, 920]);
  assert.deepEqual([shock.goalMonth, shock.score, shock.cashNow, shock.reserveNow], [7, 38, 1710, 70]);
  assert.deepEqual(RESPONSES.map(r => simulate(DEMO, r.cost).goalMonth), [7, 5, 4]);
  assert.deepEqual(RESPONSES.map(r => simulate(DEMO, r.cost).score), [38, 64, 80]);
});
test('cash is conserved, including earmarked goals, and reserve recovers before goal funding', () => {
  for (const setup of [DEMO, {...DEMO, checking: 30.21, savings: 10.33}, {...DEMO, income: 1100.17}]) {
    for (const cost of [0, 180, 430, 850]) {
      const result = simulate(setup, cost);
      assert.equal(result.points.length, 13);
      for (const point of result.points) {
        assert.equal(Math.round(point.cash * 100), Math.round((setup.checking + setup.savings - cost) * 100) + point.month * (Math.round(setup.income * 100) - Math.round(setup.expenses * 100)));
        if (point.goal > 0 && setup.income >= setup.expenses) assert.ok(point.reserve >= setup.floor);
        assert.ok(point.goal >= 0 && point.goal <= setup.target);
      }
    }
  }
});
test('no surplus is unreachable and malformed or mislabeled live balances are rejected', () => {
  assert.equal(simulate({...DEMO, income: DEMO.expenses}, 850).goalMonth, null);
  assert.throws(() => simulate({...DEMO, floor: 0}, 850));
  assert.equal(readBalances({success:true, source:'demo', summary:{checkingBalance:1640,savingsBalance:920}}), null);
  assert.equal(readBalances({success:true, source:'nessie', summary:{checkingBalance:Infinity,savingsBalance:920}}), null);
  assert.deepEqual(readBalances({success:true,source:'nessie',summary:{checkingBalance:1640,savingsBalance:920}}), {checking:1640,savings:920});
});
