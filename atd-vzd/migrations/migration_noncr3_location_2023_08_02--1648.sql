-- 1. Add generated column for non-CR3 crash locations
ALTER TABLE atd_apd_blueform
ADD COLUMN generated_location_id varchar 
GENERATED ALWAYS AS (update_noncr3_location(case_id)) STORED;

-- 2. Drop views that use location_id
DROP VIEW IF EXISTS locations_with_crash_injury_counts;
DROP VIEW IF EXISTS view_location_crashes_global;
DROP VIEW IF EXISTS view_location_injry_count_cost_summary;

-- 3. Drop materialized views that use location_id and branch from all_atd_apd_blueform
DROP MATERIALIZED VIEW IF EXISTS all_crashes_off_mainlane;
DROP MATERIALIZED VIEW IF EXISTS all_non_cr3_crashes_off_mainlane;
DROP MATERIALIZED VIEW IF EXISTS all_atd_apd_blueform;

-- 4. Drop materialized views that use location_id and branch from five_year_atd_apd_blueform
DROP MATERIALIZED VIEW IF EXISTS five_year_highway_polygons_with_crash_data;
DROP MATERIALIZED VIEW IF EXISTS five_year_all_crashes_outside_any_polygons;

DROP MATERIALIZED VIEW IF EXISTS five_year_all_crashes_outside_surface_polygons;
DROP MATERIALIZED VIEW IF EXISTS five_year_non_cr3_crashes_outside_surface_polygons;

DROP MATERIALIZED VIEW IF EXISTS five_year_surface_polygons_with_crash_data;
DROP MATERIALIZED VIEW IF EXISTS five_year_all_crashes_off_mainlane_outside_surface_polygons;

DROP MATERIALIZED VIEW IF EXISTS five_year_all_crashes_off_mainlane;
DROP MATERIALIZED VIEW IF EXISTS five_year_non_cr3_crashes_off_mainlane;

DROP MATERIALIZED VIEW IF EXISTS five_year_atd_apd_blueform;

-- 5. Then, drop current atd_apd_blueform location_id column
ALTER TABLE atd_apd_blueform DROP COLUMN location_id;

-- 6. Rename generated_location_id to location_id to replace the previous column
ALTER TABLE atd_apd_blueform 
RENAME COLUMN generated_location_id TO location_id;

-- 7. Add DB views that use location_id (need to be tracked in Hasura console)
CREATE OR REPLACE VIEW locations_with_crash_injury_counts AS
 WITH crashes AS (
         WITH cris_crashes AS (
                 SELECT crashes_1.location_id,
                    count(crashes_1.crash_id) AS crash_count,
                    COALESCE(sum(crashes_1.est_comp_cost_crash_based), 0::numeric) AS total_est_comp_cost,
                    COALESCE(sum(crashes_1.death_cnt), 0::bigint) AS fatality_count,
                    COALESCE(sum(crashes_1.sus_serious_injry_cnt), 0::bigint) AS suspected_serious_injury_count
                   FROM atd_txdot_crashes crashes_1
                  WHERE true AND crashes_1.location_id IS NOT NULL AND crashes_1.crash_date > (now() - '5 years'::interval)
                  GROUP BY crashes_1.location_id
                ), apd_crashes AS (
                 SELECT crashes_1.location_id,
                    count(crashes_1.case_id) AS crash_count,
                    COALESCE(sum(crashes_1.est_comp_cost), 0::numeric) AS total_est_comp_cost,
                    0 AS fatality_count,
                    0 AS suspected_serious_injury_count
                   FROM atd_apd_blueform crashes_1
                  WHERE true AND crashes_1.location_id IS NOT NULL AND crashes_1.date > (now() - '5 years'::interval)
                  GROUP BY crashes_1.location_id
                )
         SELECT cris_crashes.location_id,
            cris_crashes.crash_count + apd_crashes.crash_count AS crash_count,
            cris_crashes.total_est_comp_cost + (10000 * apd_crashes.crash_count)::numeric AS total_est_comp_cost,
            cris_crashes.fatality_count + apd_crashes.fatality_count AS fatalities_count,
            cris_crashes.suspected_serious_injury_count + apd_crashes.suspected_serious_injury_count AS serious_injury_count
           FROM cris_crashes
             FULL JOIN apd_crashes ON cris_crashes.location_id::text = apd_crashes.location_id::text
        )
 SELECT locations.description,
    locations.location_id,
    COALESCE(crashes.crash_count, 0::bigint) AS crash_count,
    COALESCE(crashes.total_est_comp_cost, 0::numeric) AS total_est_comp_cost,
    COALESCE(crashes.fatalities_count, 0::bigint) AS fatalities_count,
    COALESCE(crashes.serious_injury_count, 0::bigint) AS serious_injury_count
   FROM atd_txdot_locations locations
     LEFT JOIN crashes ON locations.location_id::text = crashes.location_id::text
  WHERE true AND locations.council_district > 0 AND locations.location_group = 1;

CREATE OR REPLACE VIEW view_location_crashes_global AS
  SELECT atc.crash_id,
    'CR3'::text AS type,
    atc.location_id,
    atc.case_id,
    atc.crash_date,
    atc.crash_time,
    atc.day_of_week,
    atc.crash_sev_id,
    atc.longitude_primary,
    atc.latitude_primary,
    atc.address_confirmed_primary,
    atc.address_confirmed_secondary,
    atc.non_injry_cnt,
    atc.nonincap_injry_cnt,
    atc.poss_injry_cnt,
    atc.sus_serious_injry_cnt,
    atc.tot_injry_cnt,
    atc.death_cnt,
    atc.unkn_injry_cnt,
    atc.est_comp_cost_crash_based AS est_comp_cost,
    string_agg(atcl.collsn_desc::text, ','::text) AS collsn_desc,
    string_agg(attdl.trvl_dir_desc::text, ','::text) AS travel_direction,
    string_agg(atml.movement_desc::text, ','::text) AS movement_desc,
    string_agg(atvbsl.veh_body_styl_desc::text, ','::text) AS veh_body_styl_desc,
    string_agg(atvudl.veh_unit_desc_desc, ','::text) AS veh_unit_desc_desc
   FROM atd_txdot_crashes atc
     LEFT JOIN atd_txdot__collsn_lkp atcl ON atc.fhe_collsn_id = atcl.collsn_id
     LEFT JOIN atd_txdot_units atu ON atc.crash_id = atu.crash_id
     LEFT JOIN atd_txdot__trvl_dir_lkp attdl ON atu.travel_direction = attdl.trvl_dir_id
     LEFT JOIN atd_txdot__movt_lkp atml ON atu.movement_id = atml.movement_id
     LEFT JOIN atd_txdot__veh_body_styl_lkp atvbsl ON atu.veh_body_styl_id = atvbsl.veh_body_styl_id
     LEFT JOIN atd_txdot__veh_unit_desc_lkp atvudl ON atu.unit_desc_id = atvudl.veh_unit_desc_id
  WHERE atc.crash_date >= (now() - '5 years'::interval)::date
  GROUP BY atc.crash_id, atc.location_id, atc.case_id, atc.crash_date, atc.crash_time, atc.day_of_week, atc.crash_sev_id, atc.longitude_primary, atc.latitude_primary, atc.address_confirmed_primary, atc.address_confirmed_secondary, atc.non_injry_cnt, atc.nonincap_injry_cnt, atc.poss_injry_cnt, atc.sus_serious_injry_cnt, atc.tot_injry_cnt, atc.death_cnt, atc.unkn_injry_cnt, atc.est_comp_cost
UNION ALL
 SELECT aab.form_id AS crash_id,
    'NON-CR3'::text AS type,
    aab.location_id,
    aab.case_id::text AS case_id,
    aab.date AS crash_date,
    concat(aab.hour, ':00:00')::time without time zone AS crash_time,
    ( SELECT
                CASE date_part('dow'::text, aab.date)
                    WHEN 0 THEN 'SUN'::text
                    WHEN 1 THEN 'MON'::text
                    WHEN 2 THEN 'TUE'::text
                    WHEN 3 THEN 'WED'::text
                    WHEN 4 THEN 'THU'::text
                    WHEN 5 THEN 'FRI'::text
                    WHEN 6 THEN 'SAT'::text
                    ELSE 'Unknown'::text
                END AS "case") AS day_of_week,
    0 AS crash_sev_id,
    aab.longitude AS longitude_primary,
    aab.latitude AS latitude_primary,
    aab.address AS address_confirmed_primary,
    ''::text AS address_confirmed_secondary,
    0 AS non_injry_cnt,
    0 AS nonincap_injry_cnt,
    0 AS poss_injry_cnt,
    0 AS sus_serious_injry_cnt,
    0 AS tot_injry_cnt,
    0 AS death_cnt,
    0 AS unkn_injry_cnt,
    aab.est_comp_cost_crash_based AS est_comp_cost,
    ''::text AS collsn_desc,
    ''::text AS travel_direction,
    ''::text AS movement_desc,
    ''::text AS veh_body_styl_desc,
    ''::text AS veh_unit_desc_desc
   FROM atd_apd_blueform aab
  WHERE aab.date >= (now() - '5 years'::interval)::date;

CREATE OR REPLACE VIEW view_location_injry_count_cost_summary AS
 SELECT atcloc.location_id::character varying(32) AS location_id,
    COALESCE(ccs.total_crashes, 0::bigint) + COALESCE(blueform_ccs.total_crashes, 0::bigint) AS total_crashes,
    COALESCE(ccs.total_deaths, 0::bigint) AS total_deaths,
    COALESCE(ccs.total_serious_injuries, 0::bigint) AS total_serious_injuries,
    COALESCE(ccs.est_comp_cost, 0::numeric) + COALESCE(blueform_ccs.est_comp_cost, 0::numeric) AS est_comp_cost
   FROM atd_txdot_locations atcloc
     LEFT JOIN ( SELECT atc.location_id,
            count(1) AS total_crashes,
            sum(atc.death_cnt) AS total_deaths,
            sum(atc.sus_serious_injry_cnt) AS total_serious_injuries,
            sum(atc.est_comp_cost_crash_based) AS est_comp_cost
           FROM atd_txdot_crashes atc
          WHERE 1 = 1 AND atc.crash_date > (now() - '5 years'::interval) AND atc.location_id IS NOT NULL AND atc.location_id::text <> 'None'::text
          GROUP BY atc.location_id) ccs ON ccs.location_id::text = atcloc.location_id::text
     LEFT JOIN ( SELECT aab.location_id,
            sum(aab.est_comp_cost_crash_based) AS est_comp_cost,
            count(1) AS total_crashes
           FROM atd_apd_blueform aab
          WHERE 1 = 1 AND aab.date > (now() - '5 years'::interval) AND aab.location_id IS NOT NULL AND aab.location_id::text <> 'None'::text
          GROUP BY aab.location_id) blueform_ccs ON blueform_ccs.location_id::text = atcloc.location_id::text;

-- 8. Drop functions that were removed and rolled into update_noncr3_location function
DROP FUNCTION find_noncr3_mainlane_crash;
DROP FUNCTION find_location_for_noncr3_collision;
