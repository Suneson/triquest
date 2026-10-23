-- 0021: stake up to half your balance on one challenge (was 20%). The rules
-- function is the generated one from 0019 (tools/challenges-sql.mjs), restated
-- so the live database picks it up; tests run every migration, so a stale copy here fails parity.
create or replace function public.challenge_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"maxParticipants":5,"minWindowDays":1,"maxWindowDays":28,"maxStartAheadDays":14,"graceDays":2,"feeBp":500,"payouts":{"winner":[100],"top2":[65,35],"top3":[50,30,20]},"maxStake":150,"maxStakeShareBp":5000,"weeklyStakeCap":300,"minAccountDays":14,"minVerified":6,"pairWeek":1,"pairMonth":3,"maxOpenCreated":2,"roomCardsPerDay":3,"roomOpenMax":6,"dayCap":{"run":25000,"bike":150000,"swim":5000},"climbDayCap":{"run":1500,"bike":2500},"weekFloor":{"run":20000,"bike":100000,"swim":4000},"climbWeekFloor":{"run":1500,"bike":1500},"weekGrowthBp":13000,"longestMaxMin":{"run":180,"bike":360,"swim":120},"fastest":{"run":{"5k":5000,"10k":10000,"half":21097},"bike":{"20k":20000,"40k":40000},"swim":{"1k":1000}},"kinds":{"distance":["run","bike","swim"],"xp":["any","run","bike","swim"],"sessions":["any","run","bike","swim"],"fastest":["run","bike","swim"],"longest":["run","bike","swim"],"climb":["bike","run"],"segment":["run","bike"]},"lowerWins":["fastest","segment"]}'::jsonb;
$$;
