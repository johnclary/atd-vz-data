#
# Resolves the location for a crash.
#

import json
import requests
import time
import os

HASURA_ADMIN_SECRET = os.getenv("HASURA_ADMIN_SECRET", "")
HASURA_ENDPOINT = os.getenv("HASURA_ENDPOINT", "")


def hasura_request(record):
    """
    Processes a location update event.
    :param dict data: The json payload from Hasura
    """
    # Get data/crash_id from Hasura Event request

    print("Handling request: ")
    print(json.dumps(record))

    data = {}
    response = {}

    try:
        data = json.loads(record)
    except:
        data = {}
        exit(0)

    try:
        crash_id = data["event"]["data"]["new"]["crash_id"]
        old_location_id = data["event"]["data"]["new"]["location_id"]
    except Exception as e:
        print(
            json.dumps(
                {
                    "message": "Unable to parse REQUEST body to identify a Location Record" + str(e)
                }
            )
        )

    # Prep Hasura query
    HEADERS = {
        "Content-Type": "application/json",
        "X-Hasura-Admin-Secret": HASURA_ADMIN_SECRET,
    }

    find_location_query = """
       query getLocationForNonCR3($crash_id:Int) {
            find_location_for_noncr3_collision(args: {id: $crash_id}){
                location_id
            }
       }
    """

    query_variables = {
        "crash_id": crash_id
    }

    json_body = {
        "query": find_location_query,
        "variables": query_variables,
    }

    # Make request to Hasura expecting a Location Record in the response
    try:
        response = requests.post(
            HASURA_ENDPOINT, data=json.dumps(json_body), headers=HEADERS
        )
        print(response.json())
    except Exception as e:
        print(
            json.dumps(
                {
                    "message": "Unable to parse RESPONSE body to identify a Location Record: " + str(e)
                }
            )
        )

    try:
        new_location_id = response.json()["data"]["find_location_for_noncr3_collision"][0][
            "location_id"
        ]
    except:
        new_location_id = None

    if new_location_id == old_location_id:
        print(json.dumps({"message": "Success. No Location ID update required"}))
    else:
        # Prep the mutation
        update_location_mutation = """
            mutation updateNonCR3CrashLocationID($crash_id: Int!, $locationId: String!) {
                update_atd_apd_blueform(where: {crash_id: {_eq: $crash_id}}, _set: {location_id: $locationId}) {
                    affected_rows
                }
            }
        """

        query_variables = {
            "crash_id": crash_id,
            "locationId": new_location_id
        }
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
