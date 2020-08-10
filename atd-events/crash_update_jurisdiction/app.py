#
# Resolves the location for a crash.
#
import json
import requests
import time
import os

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
        data: dict = None,
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


def get_crash_id(data: dict) -> int:
    """
    Attempts to retrieve the crash_id from a data dictionary
    :param dict data: The event data
    :return int: An int containing the crash_id
    """
    try:
        return data["event"]["data"]["new"]["crash_id"]
    except (TypeError, KeyError):
        raise_critical_error(
            message="Unable to parse request body to identify a crash_id",
            data=data
        )


def get_jurisdiction_flag(data: dict) -> str:
    """
    Returns location_id from a data dictionary, or defaults to None
    :param dict data: The event data
    :return str|None: A string containing the location id, or None
    """
    try:
        within_juris = data["event"]["data"]["new"]["austin_full_purpose"] == "Y"
        return "Y" if within_juris else "N"
    except (TypeError, KeyError):
        return "N"


def load_data(record: str) -> dict:
    """
    Attempts to parse the event data
    :param str record: The event data as string
    :return dict: The event data as an object
    """
    try:
        return json.loads(record)
    except (TypeError, json.decoder.JSONDecodeError) as e:
        raise_critical_error(
            message=f"Unable to parse event data payload: {str(e)}",
            data={"record": record},
            exception_type=TypeError
        )


def is_crash_in_jurisdiction(crash_id: int) -> str:
    """
    Attempts to find the jurisdiction of a crash by it's ID
    :param int crash_id: The crash_id to be evaluated
    :return str: The location_id string
    """
    if not str(crash_id).isdigit():
        return "N"

    find_jurisdiction_query = """
        query($crash_id:Int) {
            find_crash_in_jurisdiction(args: {jurisdiction_id: 5, given_crash_id: $crash_id}) {
                crash_id
                austin_full_purpose
            }
        }
    """

    try:
        response = requests.post(
            HASURA_ENDPOINT,
            data=json.dumps(
                {
                    "query": find_jurisdiction_query,
                    "variables": {
                        "crash_id": crash_id
                    }
                }
            ),
            headers=HEADERS
        )
        within_jurisdiction = len(response.json()["data"]["find_crash_in_jurisdiction"]) > 0
        return "Y" if within_jurisdiction else "N"
    except:
        return "N"


def get_full_purpose_flag(crash_id: int) -> str:
    """
    Attempts to find the jurisdiction flag of a crash by it's ID
    :param int crash_id: The crash_id to be evaluated
    :return str: Y or N
    """
    if not str(crash_id).isdigit():
        return "N"

    get_full_purpose_flag_query = """
        query getCR3($crash_id:Int!){
            atd_txdot_crashes(where: {
                crash_id: {_eq:$crash_id}
            }){
                austin_full_purpose
            }
        }
    """

    try:
        response = requests.post(
            HASURA_ENDPOINT,
            data=json.dumps(
                {
                    "query": get_full_purpose_flag_query,
                    "variables": {
                        "crash_id": crash_id
                    }
                }
            ),
            headers=HEADERS
        )
        return response.json()["data"]["atd_txdot_crashes"][0]["austin_full_purpose"]
    except:
        return "N"


def update_jurisdiction_flag(crash_id: int, new_flag: str) -> dict:
    """
    Returns a dictionary and HTTP response from the GraphQL query
    :param int crash_id: The crash_id of the record to be updated
    :param str new_flag: The new jurisdiction flag
    :return dict:
    """
    if crash_id is None:
        raise_critical_error(
            message=f"No crash_id provided to update the jurisdiction",
        )
    # Output
    mutation_response = {}
    # Prepare the query body
    mutation_json_body = {
        "query": """
            mutation updateCrashJurisdiction($crashId: Int!, $jurisdictionFlag: String!) {
                update_atd_txdot_crashes(where: {crash_id: {_eq: $crashId}}, _set: {austin_full_purpose: $jurisdictionFlag}) {
                    affected_rows
                }
            }
        """,
        "variables": {
            "crashId": crash_id,
            "jurisdictionFlag": new_flag
        },
    }
    # Execute the mutation
    try:
        mutation_response = requests.post(
            HASURA_ENDPOINT,
            data=json.dumps(mutation_json_body),
            headers=HEADERS
        )
    except Exception as e:
        raise_critical_error(
            message=f"Unable to update crash_id '{crash_id}' jurisdiction: {str(e)}"
        )

    return {
        "status": "Mutation Successful",
        "response": mutation_response.json()
    }


def hasura_request(record: dict) -> bool:
    """
    Processes a location update event.
    :param dict data: The json payload from Hasura
    """
    # Get data/crash_id from Hasura Event request
    data = load_data(record=record)

    # Try getting the crash data
    crash_id = get_crash_id(data)
    old_jurisdiction_flag = get_jurisdiction_flag(data)

    new_jurisdiction_flag = is_crash_in_jurisdiction(crash_id)

    # If the old and new flags are the same, then ignore...
    if old_jurisdiction_flag == new_jurisdiction_flag:
        return False
    else:
        update_jurisdiction_flag(
           crash_id=crash_id,
           new_flag=new_jurisdiction_flag,
        )
        return True


def handler(event, context):
    """
    Event handler main loop. It handles a single or multiple SQS messages.
    :param dict event: One or many SQS messages
    :param dict context: Event context
    """
    if event and "Records" in event:
        for record in event["Records"]:
            time_str = time.ctime()
            if "body" in record:
                try:
                    hasura_request(record["body"])
                except Exception as e:
                    print(f"Start Time: {time_str}", str(e))
                    time_str = time.ctime()
                    print("Done executing: ", time_str)
                    raise_critical_error(
                        message=f"Could not process record: {str(e)}",
                        data=record,
                        exception_type=Exception
                    )
