# John's Data Model

Which is plagiarized from everyone else's ideas.

## Overview

The data model uses the concept of "private" pre-processing tables which holds data from CRIS and user edits. Data from private tables is pushed (via trigger) into a public table that is used as the official source of truth Vision Zero data consumers.

![data model overview diagram](data_model_overview.png)

A more detailed diagram is available [here](https://excalidraw.com/#json=NuBo04VYd2x53aJZBFt9c,o-JWjT8z02KJig02E2DUTg).


## Get it running

## Tests

### Test tet up

To keep things simple for testing, add `db` to the schema search path.

```sql
SET search_path TO db,public;
```

After running each test, you can return to these `select` queries to observe the results:

```sql
-- the original CRIS data (each row is a unit with a crash joined to it)
SELECT
    *
FROM
    cris_units
    LEFT JOIN cris_crashes ON cris_units.crash_id = cris_crashes.crash_id;

-- the empty VZ data which will hold edits (each row is a unit with a crash joined to it)
SELECT
    *
FROM
    vz_units
    LEFT JOIN vz_crashes ON vz_units.crash_id = vz_crashes.crash_id;

-- the "truth" which includes the calculated `location_id` column (each row is a unit with a crash joined to it)
SELECT
    *
FROM
    units
    LEFT JOIN crashes ON units.crash_id = crashes.crash_id;
```


1. CRIS user creates a crash record with two unit records. 

```sql
insert into cris_crashes (
    crash_id, primary_address, road_type_id, latitude, longitude
) values (1, '1 Fake St', 1, 30.2800238, -97.743370);

insert into cris_units (unit_id, crash_id, unit_type_id) values (1, 1, 1), (2, 1, 2);
```
