#!/usr/bin/python
import MySQLdb, json, requests

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
    data = json.loads(response.text)

    features = "{\"features\": " + json.dumps(data['data']['layerData']['features']) + "}"
    features = features.replace("'", "''")

    # print features

    cur.execute("update xgds_map_server_maplayer "
                "set jsonFeatures = '{0}' "
                "where uuid = '{1}'".format(features, row[0]))

    db.commit()

    count += 1
    print "updated jsonFeatures for: " + row[0] + "\n"

db.close()
