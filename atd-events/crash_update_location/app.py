#
# Resolves the location for a crash.
#
from typing import Optional
import json
import requests
import time
import os
from string import Template

HASURA_ADMIN_SECRET = os.getenv("HASURA_ADMIN_SECRET", "")
HASURA_ENDPOINT = os.getenv("HASURA_ENDPOINT", "")
HASURA_EVENT_API = os.getenv("HASURA_EVENT_API", "")

# Prep Hasura query
HEADERS = {
    "Content-Type": "application/json",
    "X-Hasura-Admin-Secret": HASURA_ADMIN_SECRET,
}


def raise_critical_error(
        message: str,
        data: dict,
        exception_type: object = Exception
):
    """
    Logs an error in Lambda
    :param dict data: The event data
    :param str message: The message to be logged
    :param object exception_type: An optional exception type object
    :return:
    """
    critical_error_message = json.dumps(
        {
            "event_object": data,
            "message": message,
        }
    )
    print(critical_error_message)
    raise exception_type(critical_error_message)


def is_insert(data: dict) -> bool:
    """
    Returns True if the current operation is an insertion, False otherwise.
    :param dict data: The event payload object
    :return bool:
    """
    try:
        return data["event"]["op"] == "INSERT"
    except (TypeError, KeyError):
        raise_critical_error(
            message="No operation description available, data['op'] key not available.",
            data=data,
            exception_type=KeyError
        )


def hasura_request(record: str):
    """
    Processes a location update event.
    :param str record: The json payload from Hasura
    """
    # Get data/crash_id from Hasura Event request
    data = load_data(record=record)

    # Try getting the crash data
    crash_id = get_crash_id(data)
    old_location_id = get_location_id(data)

    """
        Order of execution:
          1. Check if crash is a main-lane
          2. If main-lane:
              - The make location_id = None
              - Ignore trying to find a location
             Else:
              - Check if it falls in a location
          3. Update record    
    """
    # Resolve new location
    if is_crash_mainlane(crash_id):
        new_location_id = None
    else:
        new_location_id = find_crash_location(crash_id)

    # Now compare the location values:
    if new_location_id == old_location_id:
        print(json.dumps({"message": "Success. No Location ID update required"}))
    else:
        # Prep the mutation
        update_location_mutation = """
                mutation updateCrashLocationID($crashId: Int!, $locationId: String) {
                    update_atd_txdot_crashes(where: {crash_id: {_eq: $crashId}}, _set: {location_id: $locationId}) {
                        affected_rows
                    }
                }
            """

        query_variables = {"crashId": crash_id, "locationId": new_location_id}
        mutation_json_body = {
            "query": update_location_mutation,
            "variables": query_variables,
        }

        # Execute the mutation
        try:
            mutation_response = requests.post(
                HASURA_ENDPOINT, data=json.dumps(mutation_json_body), headers=HEADERS
            )
        except:
            print(
                json.dumps(
                    {
                        "message": "Unable to parse request body for location_id update"
                    }
                )
            )

        print("Mutation Successful")
        print(mutation_response.json())


def handler(event, context):
    """
    Event handler main loop. It handles a single or multiple SQS messages.
    :param dict event: One or many SQS messages
    :param dict context: Event context
    """
    for record in event["Records"]:
        timeStr = time.ctime()
        print("Current Timestamp : ", timeStr)
        print(json.dumps(record))
        if "body" in record:
            hasura_request(record["body"])
        timeStr = time.ctime()
        print("Done executing: ", timeStr)
