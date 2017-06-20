#!/usr/bin/python
import MySQLdb
import json
import requests
import traceback

db = MySQLdb.connect(host="localhost",
                     user="root",
                     passwd="xgds",
                     db="xgds_basalt")

cur = db.cursor()

cur.execute("select uuid, deleted from xgds_map_server_maplayer where deleted != 1 order by uuid")

count = 0
for row in cur.fetchall():
    url = "https://localhost/xgds_map_server/mapLayerJSON/"
    url += row[0]
    url += "/"

    response = requests.get(url=url, verify=False)
    try:
        data = json.loads(response.text)
        features = "{\"features\": " + json.dumps(data['data']['layerData']['features']) + "}"
        features = features.replace("'", "''")

        cur.execute("update xgds_map_server_maplayer "
                    "set jsonFeatures = '{0}' "
                    "where uuid = '{1}'".format(features, row[0]))

        # Resets all jsonFeatures attributes to empty.
        # cur.execute("update xgds_map_server_maplayer "
        #             "set jsonFeatures = '{}' ")

        db.commit()

        print "updated jsonFeatures for: " + row[0] + "\n"

    except Exception, e:
        print 'problem for row %s' % row[0]
        traceback.print_exc()

    count += 1

print "Updated " + str(count) + " rows."

db.close()
