import { checkSql } from "@/lib/ask/sql-guard";

const cases: [string, boolean][] = [
  ["select count(*) from gamelogs where not is_negro_league", true],
  ["with s as (select home_team_id t, greatest(home_score,visitor_score) w from gamelogs union all select visitor_team_id, greatest(home_score,visitor_score) from gamelogs) select t, w, count(*) from s group by 1,2 order by 3 desc limit 5;", true],
  ["select extract(year from date) y, round(avg(home_score+visitor_score)::numeric, 2) from gamelogs group by 1", true],
  ["select t.team, l.display_name from teams t join lineage l using (team_id)", true],
  ["delete from teams", false],
  ["select 1; drop table teams", false],
  ["with x as (delete from teams returning *) select * from x", false],
  ["select * from ask_log", false],
  ["select * from public.posted_updates", false],
  ["select * from pg_catalog.pg_roles", false],
  ["select * from pg_stat_activity", false],
  ["select * from extensions.pg_stat_statements", false],
  ["select set_config('default_transaction_read_only','off',false)", false],
  ["select pg_sleep(30)", false],
  ["select pg_read_file('/etc/passwd')", false],
  ["select dblink_exec('x','drop table teams')", false],
  ["select * into pwn from teams", false],
  ["select * from teams for update", false],
  ["select 1) as q; delete from teams; select * from (select 1", false],
  ["select * from gamelogs -- \n) as q; drop table teams; --", false],
  ["select public.check_true_scorigami(1,2)", false],
  ["select * from (with ask_log as (select 1) select * from ask_log) z, ask_log", false],
  ["with ask_log as (select * from ask_log) select * from ask_log", false],
  ["with a as (select 1 x), b as (select * from a) select * from b", true],
  ["with recursive r(n) as (select 1 union all select n + 1 from r where n < 5) select * from r", true],
  ["with t as (select * from teams) select * from t union all (with u as (select * from lineage) select team_id, null, null, null, null, null from u)", true],
  ["(with ask_log as (select 1) select * from ask_log) union all select 1 from ask_log", false],
  ["copy teams to stdout", false],
  ["select lo_import('/etc/passwd')", false],
  ["select $1", false],
];

(async () => {
  let bad = 0;
  for (const [sql, expectOk] of cases) {
    const r = await checkSql(sql);
    const ok = "sql" in r;
    if (ok !== expectOk) bad++;
    console.log(
      ok === expectOk ? "pass" : "FAIL",
      ok ? "allowed " : "rejected",
      "|",
      sql.replace(/\n/g, " ").slice(0, 70),
      ok ? "" : `-> ${(r as { error: string }).error}`,
    );
  }
  console.log(bad ? `${bad} FAILED` : "all passed");
})();
