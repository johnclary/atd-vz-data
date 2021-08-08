#!/usr/bin/python3

import re
import os
import sys
import json
import boto3
import requests
import argparse
from operator import attrgetter
from botocore.config import Config

s3_resource = boto3.resource('s3')


ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
HASURA_ADMIN_KEY = os.getenv('HASURA_ADMIN_KEY')
HASURA_ENDPOINT = os.getenv('HASURA_ENDPOINT')

HEADERS = {
          "X-Hasura-Admin-Secret": HASURA_ADMIN_KEY,
          "Content-Type": "application/json",
          }

bucket = 'atd-vision-zero-editor'

#FIXME
# print errors to stderr where they belong


# setup and parse arguments
try:
    argparse = argparse.ArgumentParser(description = 'Utility to restore last valid PDF in S3 for ATD VZ')
    argparse.add_argument("-p", "--production", help = 'Specify the use of production environment', action = 'store_true')
    argparse.add_argument("--i-understand", help = 'Do not ask the user to acknoledge that this program changes the state of S3 objects.', action = 'store_true')
    argparse.add_argument("-c", "--crashes", help = 'Specify JSON file containing crashes to operate on. Format: { "crashes": [ crash_id_0, crash_id_1, .. ] }', required=True, metavar = 'crashes.json')
    args = argparse.parse_args()
except:
    sys.exit(1)


# This program will change the state of S3 objects.  Make sure the user is OK with what is about to happen.
try:
    if not args.i_understand:
        print('')
        print("Warning: This program changes S3 Objects.")
        print('')
        print("This program will restore previous file versions which are larger than 10K for crashes specified in the JSON object you provide.")
        print("This program does NOT validate the suitability of the file its replacing nor the contents of the replacement.")
        print("If you specify a crash ID in the JSON, and there is a previous version larger than 10K for that crash, this program will overwrite the current version.")
        print("Please type 'I understand' to continue.")
        print('')
        ack = input()
        assert(re.match("^i understand$", ack, re.I))
except:
    print("User acknoledgement failed.")
    sys.exit(1)


# verify that environment AWS variables were available and have populated values to be used to auth to AWS
try:
    assert(ACCESS_KEY is not None and SECRET_KEY is not None)
except:
    print("Please set environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
    sys.exit(1)


# verify that environment Hasura variables were available and have populated values
try:
    assert(HASURA_ADMIN_KEY is not None and HASURA_ENDPOINT is not None)
except:
    print("Please set environment variables HASURA_ADMIN_KEY and HASURA_ENDPOINT")
    sys.exit(1)



# connect to AWS/S3 and validate connection
try:
    aws_config = Config(
            region_name = 'us-east-1',
            )

    s3 = boto3.client(
            's3', 
            aws_access_key_id = ACCESS_KEY, 
            aws_secret_access_key = SECRET_KEY, 
            config = aws_config
            )
    prefix = ('production' if args.production else 'staging') + '/cris-cr3-files/'
    s3.list_objects(Bucket = bucket, Prefix = prefix)
except:
    print("Unable to complete call to S3; check AWS credentials")
    sys.exit(1)


# check to see if file is available on disk
try:
    assert(os.path.isfile(args.crashes))
except:
    print("Crashes file is not available on disk")
    sys.exit(1)


# parse JSON file containing crashes
with open(args.crashes) as input_file:
    try:
        crashes = json.load(input_file)['crashes']
    except:
        print("Crashes file is invalid JSON")
        sys.exit(1)


# iterate over crashes found in JSON object
for crash in crashes:
    print("Crash: " + str(crash))

    try:
        get_metadata = """
        query get_cr3_metadata($crashId: Int) {
            atd_txdot_crashes(where: {crash_id: {_eq: $crashId}}) {
                cr3_file_metadata
                }
            }
        """

        cr3_metadata = requests.post(HASURA_ENDPOINT, headers = HEADERS, data = json.dumps(
            {
            "query": get_metadata,
            "variables": {
                "crashId": 14683802
                }
            }))

    except:
        print("Request to get existing CR3 metadata failed.")
        sys.exit(1)

    print(cr3_metadata.json())


    key = prefix +  str(crash) + '.pdf'

    # get versions of object sorted most recent to oldest
    versions = sorted(s3_resource.Bucket(bucket).object_versions.filter(Prefix = key), 
                        key=attrgetter('last_modified'), reverse=True)

    # keep track of if we found one for diagnostic message logging
    previous_version_found = False
    for version in versions:
        obj = version.get()

        # check if version is larger than 10K to seperate PDFs from HTML documents
        if obj.get('ContentLength') > 10 * 2**10: # 10K

            # if we get here, we have found one, so note it and log it
            previous_version_found = True
            print(obj.get('VersionId'), obj.get('ContentLength'), obj.get('LastModified'))
            print("Restoring " +  obj.get('VersionId') + " to " + key)

            # restore the file, in situ on s3, from the previous version
            s3_resource.Object(bucket, key).copy_from(CopySource = { 'Bucket': bucket, 'Key': key, 'VersionId': obj.get('VersionId') } )

            # once we've restored, we don't want to restore anymore, as we only want the most recent valid file
            break;

    # this bool remains false if we never did a restore, so alert the user
    if not previous_version_found:
        print("No previous versions found for crash " + str(crash))

    # drop a new line for more human readable stdout
    print("")
