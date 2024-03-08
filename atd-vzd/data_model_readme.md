# John's Data Model

In which everyone else's ideas have been plagiarized.

## Overview

The data model uses the concept of "private" pre-processing tables which hold data from CRIS and user edits. Data from private tables is pushed (via trigger) into a public table that is used as the official source of truth. A more detailed diagram is available [here](https://excalidraw.com/#json=NuBo04VYd2x53aJZBFt9c,o-JWjT8z02KJig02E2DUTg).

![data model overview diagram](data_model_overview.png)

## Get it running

Start the VZ cluster and apply migrations as you would normally, from this branch (`15976-jc-data-model-proto`). You can inspect the migration file in  `1709836840391_data_model_init` to inspect the table + trigger definitions.

To start over, you can run:

```shell
$ hasura migrate apply --down 1 && hasura migrate apply
```

## Tests

### Set up

#### Import data

⚠️ BEFORE YOU IMPORT DATA, make sure to disable the debug notices! The `psql` commands below take care of this automatically. If using a different SQL client, do this before you import 👇 ⚠️

```sql
SET client_min_messages TO WARNING;
```

Download `crashes.csv` and `units.csv` from the Drive folder and save them in this directory (`/atd-vzd`). Import each file into `cris_crashes` and `cris_units`, respectively. This will take a few minutes.

```shell
# import crashes into db.cris_crashes
$ psql postgres://visionzero:visionzero@localhost:5432/atd_vz_data -c "SET client_min_messages TO WARNING;" -c "\copy db.cris_crashes(crash_id,latitude,longitude,primary_address,road_type_id) FROM 'crashes.csv' HEADER CSV;"

# import units into db.cris_units
$ psql postgres://visionzero:visionzero@localhost:5432/atd_vz_data -c "SET client_min_messages TO WARNING;" -c "\copy db.cris_units(unit_id, crash_id, unit_type_id)  FROM 'units.csv' HEADER CSV;"
```

#### Validation queries

Throughout the testing, you can use these `select` queries to observe the results. We're going to be working with crash ID `9999999`. 

```sql
-- the original CRIS data (each row is a unit with a crash joined to it)
select
    cris_units.*,
    unit_types.description as unit_type_description,
    cris_crashes.*,
    road_types.description as road_type_description
from
    cris_units
    left join cris_crashes on cris_units.crash_id = cris_crashes.crash_id
    left join road_types on cris_crashes.road_type_id = road_types.id
    left join unit_types on cris_units.unit_type_id = unit_types.id
    where cris_units.crash_id = 9999999;

-- the VZ data which holds edits (each row is a unit with a crash joined to it)
select
    vz_units.*,
    unit_types.description as unit_type_description,
    vz_crashes.*,
    road_types.description as road_type_description
from
    vz_units
    left join vz_crashes on vz_units.crash_id = vz_crashes.crash_id
    left join road_types on vz_crashes.road_type_id = road_types.id
    left join unit_types on vz_units.unit_type_id = unit_types.id
    where vz_units.crash_id = 9999999;

-- the "truth" which includes the calculated `location_id` column (each row is a unit with a crash joined to it)
select
    units.*,
    unit_types.description as unit_type_description,
    crashes.*,
    road_types.description as road_type_description
from
    units
    left join crashes on units.crash_id = crashes.crash_id
    left join road_types on crashes.road_type_id = road_types.id
    left join unit_types on units.unit_type_id = unit_types.id
    where units.crash_id = 9999999;
```

### Tests 👨‍🔬

0. In order to see the debugging messages, set the message level to NOTICE

```sql
SET client_min_messages TO NOTICE;
```

#### 1. CRIS user creates a crash record with two unit records. 

```sql
insert into cris_crashes (
    crash_id, primary_address, road_type_id, latitude, longitude
) values (9999999, '1 Fake St', 1, 30.2800238, -97.743370);

insert into cris_units (unit_id, crash_id, unit_type_id) values (987654321, 9999999, 1), (987654322, 9999999, 1);
```

#### 2. VZ user changes a crash’s Location ID by updating the crash lat/lon

```sql
update vz_crashes set latitude = 30.36444128, longitude = -97.72865645 where crash_id = 9999999;
```

Observe that the `location_id` of the `crashes` record changes to `AA7729AE83`.

#### 3. VZ user edits a unit type

```sql
update vz_units set unit_type_id = 3 where unit_id = 987654321;
```

#### 4. CRIS user updates the crash lat/lon and road type

```sql
update cris_crashes set latitude = 1, longitude = 1, road_type_id = 5 where crash_id = 9999999;
```

Observe that the lat/lon changes are not reflected by querying the `crashes` table because they are overridden by VZ values.

#### 5. CRIS user updates a unit type 

```sql
update cris_units set unit_type_id = 4 where unit_id = 987654322;
```

#### 6. VZ user adds a custom lookup value and uses it

```sql
insert into unit_types (id, description) values (90001, 'custom unit type');
update vz_units set unit_type_id = 90001 where unit_id = 987654322;
```

#### 7. Create a query that demonstrates the correct source of truth when crashes and units have edits from both CRIS and the VZ user

The truth is stored in the `crashes` and `units` table. So we can just query them as needed. These queries also construct the `unique_unit_types` column, per the requirements. In reality we would establish dedicated views for columns such as this which be efficiently calculated on the fly.

```sql
-- 7a. Query for a single crash by ID
select
    crashes.*,
    road_types.description as road_type_description,
    unit_types.unique_unit_types
from
    crashes
    left join road_types on crashes.road_type_id = road_types.id
    left join (
        select
            crash_id,
            array_agg(distinct unit_types.description) as unique_unit_types
        from
            units
            left join unit_types on unit_types.id = units.unit_type_id
        group by
            crash_id
    ) unit_types on unit_types.crash_id = crashes.crash_id
    where crashes.crash_id = 123456;

-- 7b. query for 100k crashes
select
    crashes.*,
    road_types.description as road_type_description,
    unit_types.unique_unit_types
from
    crashes
    left join road_types on crashes.road_type_id = road_types.id
    left join (
        select
            crash_id,
            array_agg(distinct unit_types.description) as unique_unit_types
        from
            units
            left join unit_types on unit_types.id = units.unit_type_id
        group by
            crash_id
    ) unit_types on unit_types.crash_id = crashes.crash_id
    limit 100000;
```

#### 8. Create a query/view that powers a simplified version of the locations table  by calculating total number of units per location 

```sql
-- this is the top 100 locations ranked by # of crashes 🚀
select
    atd_txdot_locations.location_id,
    count(crashes.crash_id) count_of_crashes
from
    atd_txdot_locations
    left join crashes ON crashes.location_id = atd_txdot_locations.location_id
group by
    (atd_txdot_locations.location_id)
order by
    count_of_crashes DESC
limit 100;
```

#### 9. Add a new editable column to crashes

To accomplish this, we must add the column to all three crashes tables, and update three triggers (CRIS insert, CRIS update, VZ update).

```sql
-- create the new column x 3
alter table cris_crashes add column is_txdot_awesome boolean default true;
alter table vz_crashes add column is_txdot_awesome boolean;
alter table crashes add column is_txdot_awesome boolean;

-- patch function that runs on CRIS insert
create or replace function db.cris_crash_insert_rows()
returns trigger
language plpgsql
as
$$
BEGIN
    RAISE NOTICE 'Inserting vz_crash and crash rows';
    -- insert new (editable) vz record (only crash ID)
    INSERT INTO db.vz_crashes (crash_id) values (new.crash_id);
    -- insert new combined / official record
    INSERT INTO db.crashes (crash_id, primary_address, road_type_id, latitude, longitude) values (
        new.crash_id, new.primary_address, new.road_type_id, new.latitude, new.longitude, new.is_txdot_awesome
    );
    RETURN NULL;
END;
$$;

-- patch function that runs on VZ crash update
create or replace function db.vz_crash_update()
returns trigger
language plpgsql
as $$
BEGIN
    RAISE NOTICE 'Refreshing crash ID % due to vz_crash update', new.crash_id;
    UPDATE
        db.crashes
    SET
        primary_address = COALESCE(new.primary_address, cris_crashes.primary_address),
        road_type_id = COALESCE(new.road_type_id, cris_crashes.road_type_id),
        latitude = COALESCE(new.latitude, cris_crashes.latitude),
        longitude = COALESCE(new.longitude, cris_crashes.longitude),
        is_txdot_awesome = COALESCE(new.is_txdot_awesome, cris_crashes.is_txdot_awesome)
    FROM (
        SELECT
            *
        FROM
            db.cris_crashes where cris_crashes.crash_id = new.crash_id) AS cris_crashes
WHERE
    crashes.crash_id = new.crash_id;
    RETURN NULL;
END;
$$;


-- patch function that runs on CRIS crash update
create or replace function db.cris_crash_update()
returns trigger
language plpgsql
as $$
DECLARE
   vz_record  record;
BEGIN
    RAISE NOTICE 'Updating crash ID % due to crish_crash update', new.crash_id;

    SELECT INTO vz_record *
        FROM db.vz_crashes where crash_id = new.crash_id;

    UPDATE
        db.crashes
    SET
        primary_address = COALESCE(vz_record.primary_address, NEW.primary_address),
        road_type_id = COALESCE(vz_record.road_type_id, NEW.road_type_id),
        latitude = COALESCE(vz_record.latitude, NEW.latitude),
        longitude = COALESCE(vz_record.longitude, NEW.longitude),
        is_txdot_awesome = COALESCE(vz_record.is_txdot_awesome, NEW.is_txdot_awesome)
    WHERE
        crashes.crash_id = new.crash_id;
    RETURN NULL;
END;
$$;
```

And now we can use the new column :) 

```sql
update vz_crashes set is_txdot_awesome = false where crash_id = 9999999;
```
 
#### 10. Conflict management

*This not currently in scope for the Data Model mvp, but I did this work before we knew that.*

Create a conflict management table

```sql
create table db.conflicts (
    id serial primary key,
    crash_id integer not null,
    table_name text not null,
    created_at timestamp with time zone default now(),
    record jsonb not null
);
```

Say we want to block conflicts on `road_type_id`. We add a conflict check to the CRIS update trigger. The `if` condition for this will get rather long as we add additional fields.

```sql
if OLD.road_type_id != NEW.road_type_id and NEW.road_type_id != vz_record.road_type_id then
        RAISE NOTICE 'Conflict detected in road_type_id between new CRIS value (%), old CRIS value (%) and current VZ value (%)', NEW.road_type_id, OLD.road_type_id, vz_record.road_type_id;
        insert into db.conflicts (crash_id, table_name, record ) values (NEW.crash_id, 'crashes', row_to_json(NEW));
        RETURN NULL;
    end if;
```

Here's the complete updated function if you'd like to try it. 

```sql
create or replace function db.cris_crash_update()
returns trigger
language plpgsql
as $$
DECLARE
   vz_record  record;
BEGIN
    RAISE NOTICE 'Updating crash ID % due to crish_crash update', new.crash_id;

    SELECT INTO vz_record *
        FROM db.vz_crashes where crash_id = new.crash_id;

    if OLD.road_type_id != NEW.road_type_id and NEW.road_type_id != vz_record.road_type_id then
        RAISE NOTICE 'Conflict detected in road_type_id between new CRIS value (%), old CRIS value (%) and current VZ value (%)', NEW.road_type_id, OLD.road_type_id, vz_record.road_type_id;
        insert into db.conflicts (crash_id, table_name, record ) values (NEW.crash_id, 'crashes', row_to_json(NEW));
        RETURN NULL;
    end if;

    UPDATE
        db.crashes
    SET
        primary_address = COALESCE(vz_record.primary_address, NEW.primary_address),
        road_type_id = COALESCE(vz_record.road_type_id, NEW.road_type_id),
        latitude = COALESCE(vz_record.latitude, NEW.latitude),
        longitude = COALESCE(vz_record.longitude, NEW.longitude),
        is_txdot_awesome = COALESCE(vz_record.is_txdot_awesome, NEW.is_txdot_awesome)
    WHERE
        crashes.crash_id = new.crash_id;
    RETURN NULL;
END;
$$;
```
