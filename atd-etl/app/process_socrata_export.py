#!/usr/bin/env python
"""
Socrata - Exporter
Author: Austin Transportation Department, Data and Technology Office

Description: The purpose of this script is to gather data from Hasura
and export it to the Socrata database.

The application requires the requests and sodapy libraries:
    https://pypi.org/project/requests/
    https://pypi.org/project/sodapy/
"""

from sodapy import Socrata
from string import Template
from copy import deepcopy
import requests
import json
import os
import time
from process.config import ATD_ETL_CONFIG
print("Socrata - Exporter:  Started.")
print("SOCRATA_KEY_ID: " + ATD_ETL_CONFIG["SOCRATA_KEY_ID"])
print("SOCRATA_KEY_SECRET: " + ATD_ETL_CONFIG["SOCRATA_KEY_SECRET"])

# Setup connection to Socrata
client = Socrata("data.austintexas.gov", ATD_ETL_CONFIG["SOCRATA_APP_TOKEN"],
                 username=ATD_ETL_CONFIG["SOCRATA_KEY_ID"], password=ATD_ETL_CONFIG["SOCRATA_KEY_SECRET"])


def run_hasura_query(query):

    # Build Header with Admin Secret
    headers = {
        "x-hasura-admin-secret": ATD_ETL_CONFIG["HASURA_ADMIN_KEY"]
    }

   # Try making insertion
    try:
        return requests.post(ATD_ETL_CONFIG["HASURA_ENDPOINT"],
                             json={'query': query, "offset": offset},
                             headers=headers).json()
    except Exception as e:
        print("Exception, could not insert: " + str(e))
        print("Query: '%s'" % query)
        return None


crashes_query_template = Template(
    """
    query getCrashesSocrata {
        atd_txdot_crashes (limit: $limit, offset: $offset, order_by: {crash_id: asc}, where: {city_id: {_eq: 22}}) {
            crash_id
    		crash_fatal_fl
            crash_date
            crash_time
            case_id
            rpt_latitude
            rpt_longitude
            rpt_block_num
            rpt_street_pfx
            rpt_street_name
            rpt_street_sfx
            crash_speed_limit
            road_constr_zone_fl
            latitude
            longitude
            street_name
            street_nbr
            street_name_2
            street_nbr_2
            crash_sev_id
            sus_serious_injry_cnt
            nonincap_injry_cnt
            poss_injry_cnt
            non_injry_cnt
            unkn_injry_cnt
            tot_injry_cnt
            death_cnt
            units {
                contrib_factr_p1_id
                contrib_factr_p2_id
                body_style {
                    veh_body_styl_desc
                }
                unit_description {
                    veh_unit_desc_desc
                }
            }
        }
    }
"""
)

columns_to_rename = {
    "veh_body_styl_desc": "unit_desc",
    "veh_unit_desc_desc": "unit_mode",
}


def rename_record_columns(record):
    for k, v in columns_to_rename.items():
        if k in record.keys():
            record[v] = record.pop(k)
    return record


unit_modes = ["MOTOR VEHICLE",
              "TRAIN",
              "PEDALCYCLIST",
              "PEDESTRIAN",
              "MOTORIZED CONVEYANCE",
              "TOWED/PUSHED/TRAILER",
              "NON-CONTACT",
              "OTHER"]


def create_crash_mode_flags(record):
    if "unit_mode" in record.keys():
        for mode in unit_modes:
            formatted_mode = mode.replace(" ", "_").replace(
                "/", "_").replace("-", "_").lower()
            record_flag_column = f"{formatted_mode}_fl"
            if mode in record["unit_mode"]:
                record[record_flag_column] = "Y"
            else:
                record[record_flag_column] = "N"
    if "unit_desc" in record.keys():
        if "MOTORCYCLE" in record["unit_desc"]:
            record["motorcycle_fl"] = "Y"
        else:
            record["motorcycle_fl"] = "N"
    return record


def flatten_hasura_response(records):
    formatted_records = []
    for record in records:
        # Create copy of record to mutate
        formatted_record = deepcopy(record)
        # Look through key values for data lists
        for first_level_key, first_level_value in record.items():
            # If list is found, iterate to bring key values to top-level
            if type(first_level_value) == list:
                for item in first_level_value:
                    for second_level_key, second_level_value in item.items():
                        # Handle nested values
                        if type(second_level_value) == dict:
                            # Handles concat of values here
                            for third_level_key, third_level_value in second_level_value.items():
                                if third_level_key in formatted_record.keys():
                                    # If key already exists at top-level, concat with existing values
                                    next_record = f" & {third_level_value}"
                                    formatted_record[third_level_key] = formatted_record[third_level_key] + next_record
                                else:
                                    # Create key at top-level
                                    formatted_record[third_level_key] = third_level_value
                        # Copy non-nested key-values to top-level (if not null)
                        # Null records can create unwanted columns at top level of record
                        # from keys of nested data Ex.
                        # "body_style": {
                        #       "veh_body_styl_desc": "PICKUP"
                        # }
                        #         VS.
                        # "body_style": null
                        elif second_level_value is not None:
                            formatted_record[second_level_key] = second_level_value
                # Remove key with values that were moved to top-level
                del formatted_record[first_level_key]
        formatted_record = rename_record_columns(formatted_record)
        formatted_record = create_crash_mode_flags(formatted_record)
        formatted_records.append(formatted_record)
    return formatted_records


# Start timer
start = time.time()

# while loop to request records from Hasura and post to Socrata
records = None
offset = 0
limit = 6000
total_records_published = 0

# Get records from Hasura until res is []
while records != []:
    crashes_query = crashes_query_template.substitute(
        limit=limit, offset=offset)
    offset += limit
    crashes = run_hasura_query(crashes_query)
    records = crashes['data']['atd_txdot_crashes']

    # Upsert records to Socrata
    formatted_records = flatten_hasura_response(records)
    client.upsert("rrxh-grh6", formatted_records)
    total_records_published += len(records)
    print(f"{total_records_published} records published")

# Hasura test request

# crashes_query = crashes_query_template.substitute(
#     limit=limit, offset=offset)
# crashes = run_hasura_query(crashes_query)
# records = crashes['data']['atd_txdot_crashes']
# formatted_records = flatten_hasura_response(records)
# print(formatted_records[4])


# Terminate Socrata connection
client.close()

# Stop timer and print duration
end = time.time()
hours, rem = divmod(end-start, 3600)
minutes, seconds = divmod(rem, 60)
print("Finished in: {:0>2}:{:0>2}:{:05.2f}".format(
    int(hours), int(minutes), seconds))
