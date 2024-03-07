-- we'll do all our work in a schema called `db`
create schema db;

---------------------------------------------
--- Create tables ---------------------------
---------------------------------------------
create table db.road_types (
    id serial primary key,
    description text
);

create table db.cris_crashes (
    crash_id integer primary key,
    primary_address text,
    latitude numeric,
    longitude numeric,
    road_type_id integer references db.road_types (id)
    references db.road_types (id)
);

create table db.vz_crashes (
    crash_id integer primary key,
    primary_address text,
    latitude numeric,
    longitude numeric,
    road_type_id integer references db.road_types (id)
);

create table db.crashes (
    crash_id integer primary key,
    primary_address text,
    latitude numeric,
    longitude numeric,
    geog geography,
    location_id text,
    road_type_id integer references db.road_types (id)
);


create table db.unit_types (
    id serial primary key,
    description text
);

create table db.cris_units (
    unit_id integer primary key,
    crash_id integer,
    unit_type_id integer references db.unit_types (id)
);

create table db.vz_units (
    unit_id integer primary key,
    crash_id integer,
    unit_type_id integer references db.unit_types (id)
);

create table db.units (
    unit_id integer primary key,
    crash_id integer references db.crashes (crash_id),
    unit_type_id integer references db.unit_types (id)
);

create index on db.units (crash_id);

create table db.conflicts (
    id serial primary key,
    crash_id integer not null,
    table_name text not null,
    created_at timestamp with time zone default now(),
    record jsonb not null
);

---------------------------------------------
--- Create crash triggers -------------------
---------------------------------------------
create or replace function cris_crash_insert_rows()
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
        new.crash_id, new.primary_address, new.road_type_id, new.latitude, new.longitude
    );
    RETURN NULL;
END;
$$;

create trigger insert_new_cris_crash_into_vz_crash
after insert on db.cris_crashes
for each row
execute procedure cris_crash_insert_rows();

create or replace function vz_crash_update()
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
        longitude = COALESCE(new.longitude, cris_crashes.longitude)
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

create trigger update_crash_from_vz_crash_update
after update on db.vz_crashes
for each row
execute procedure vz_crash_update();

create or replace function cris_crash_update()
returns trigger
language plpgsql
as $$
DECLARE
   conflict_detected boolean := false; 
   vz_record  record;
BEGIN
    SELECT INTO vz_record *
        FROM  db.vz_crashes where crash_id = new.crash_id;

    if OLD.road_type_id != NEW.road_type_id and NEW.road_type_id != vz_record.road_type_id then
        RAISE NOTICE 'Conflict detected in road_type_id between new CRIS value (%), old CRIS value (%) and current VZ value (%)', NEW.road_type_id, OLD.road_type_id, vz_record.road_type_id;
        insert into db.conflicts (crash_id, table_name, record ) values (NEW.crash_id, 'crashes', row_to_json(NEW));
        RETURN NULL;
    end if;

    RAISE NOTICE 'Updating crash ID % due to crish_crash update', new.crash_id;
    
    UPDATE
        db.crashes
    SET
        primary_address = COALESCE(vz_record.primary_address, NEW.primary_address),
        road_type_id = COALESCE(vz_record.road_type_id, NEW.road_type_id),
        latitude = COALESCE(vz_record.latitude, NEW.latitude),
        longitude = COALESCE(vz_record.longitude, NEW.longitude)
    WHERE
        crashes.crash_id = new.crash_id;
    RETURN NULL;
END;
$$;

create trigger update_crash_from_cris_update
after update on db.cris_crashes
for each row
execute procedure cris_crash_update();



create or replace function update_crash_location()
returns trigger
language plpgsql
as $$
begin
    if (
        new.latitude IS NOT NULL AND new.longitude IS NOT NULL AND
        (new.latitude != old.latitude OR new.longitude != old.longitude)) THEN
        RAISE NOTICE 'Updating location ID for crash ID: %', new.crash_id;
        new.geog = ST_SETSRID(ST_MAKEPOINT(new.longitude, new.latitude), 4326);
        new.location_id = (
            SELECT
                location_id
            FROM
                atd_txdot_locations
            WHERE
                location_group = 1 -- level 1-4 polygons
                AND st_contains(geometry, new.geog::geometry)
            LIMIT 1);
            RAISE NOTICE 'Found location: %', new.location_id;
        ELSE
            RAISE NOTICE 'Setting geography and location ID to null';
            -- reset location ID
            new.geog = NULL;
            new.location_id = NULL;
    END IF;
    RETURN NEW;
END;
$$;

create trigger update_crash_location
before insert or update on db.crashes
for each row
execute procedure update_crash_location();

---------------------------------------------
--- Create unit triggers -------------------
---------------------------------------------
create or replace function cris_unit_insert_rows()
returns trigger
language plpgsql
as
$$
BEGIN
    RAISE NOTICE 'Inserting vz_units and units rows';
    -- insert new (editable) vz record (only unit + crash ID)
    INSERT INTO db.vz_units (unit_id) values (new.unit_id);
    -- insert new combined / official record
    INSERT INTO db.units (unit_id, crash_id, unit_type_id) values (
        new.unit_id, new.crash_id, new.unit_type_id
    );
    RETURN NULL;
END;
$$;

create trigger insert_new_cris_unit_into_vz_unit_and_units
after insert on db.cris_units
for each row
execute procedure cris_unit_insert_rows();



create or replace function vz_unit_update()
returns trigger
language plpgsql
as $$
BEGIN
    RAISE NOTICE 'Updating unit ID % due to vz_unit update', new.unit_id;
    UPDATE
        db.units
    SET
        crash_id = COALESCE(new.unit_id, cris_units.crash_id),
        unit_type_id = COALESCE(new.unit_type_id, cris_units.unit_type_id)
    FROM (
        SELECT
            *
        FROM
            db.cris_units where cris_units.unit_id = new.unit_id) AS cris_units
WHERE
    units.unit_id = new.unit_id;
    RETURN NULL;
END;
$$;

create trigger update_unit_from_vz_unit_update
after update on db.vz_units
for each row
execute procedure vz_unit_update();

create or replace function cris_unit_update()
returns trigger
language plpgsql
as $$
BEGIN
    RAISE NOTICE 'Updating unit ID % due to cris_unit update', new.unit_id;
    UPDATE
        db.units
    SET
        crash_id = COALESCE(vz_units.unit_id, new.crash_id),
        unit_type_id = COALESCE(vz_units.unit_type_id, new.unit_type_id)
    FROM (
        SELECT
            *
        FROM
            db.vz_units where vz_units.unit_id = new.unit_id) AS vz_units
WHERE
    units.unit_id = new.unit_id;
    RETURN NULL;
END;
$$;

create trigger update_unit_from_cris_update
after update on db.cris_units
for each row
execute procedure cris_unit_update();


---------------------------------------------
--- Insert lookup values --------------------
---------------------------------------------
insert into db.road_types (description) values
('alley'),
('collector'),
('arterial'),
('highway'),
('other');

insert into db.unit_types (description) values
('vehicle'),
('pedestrian'),
('motorcycle'),
('spaceship'),
('bicycle'),
('other');
