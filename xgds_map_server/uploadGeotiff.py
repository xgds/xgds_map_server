#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

from requests import put, post
from requests.auth import HTTPBasicAuth
from django.conf import settings

def upload_geotiff(file_handle, workspace_name, store_name, minimum_value=None, maximum_value=None):
    """
    Upload a GeoTIFF file to the connected Geoserver
    
    file_handle: python file handle object that supports read and write operations
    workspace_name: the geoserver workspace for this geotiff
    store_name: the name of this geotiff inside geoserver
    """

    url = settings.GEOSERVER_URL + "rest/workspaces"

    r = post(
        url=url,
        auth=HTTPBasicAuth(
            settings.GEOSERVER_USERNAME,
            settings.GEOSERVER_PASSWORD,
        ),
        verify=False,
        headers={
            'Content-type': 'text/xml',
        },
        data="<workspace><name>" + workspace_name + "</name></workspace>",
    )
    
    url = settings.GEOSERVER_URL + "rest/workspaces/" + workspace_name + \
          "/coveragestores/" + store_name + \
          "/file.geotiff?configure=all"
    data = file_handle.read()
    r = put(
        url=url,
        auth=HTTPBasicAuth(
            settings.GEOSERVER_USERNAME,
            settings.GEOSERVER_PASSWORD,
        ),
        verify=False,
        headers={
            'Content-type': 'image/tiff',
        },
        data=data,
    )

    assert r.status_code < 300

    if minimum_value is not None and maximum_value is not None:
        modifying_json = {
            "coverage": {
                "dimensions": {
                    "coverageDimension": [
                        {
                            "name": "GRAY_INDEX",
                            "description": "GridSampleDimension[-Infinity,Infinity]",
                            "range": {
                                "min": minimum_value,
                                "max": maximum_value,
                            },
                            "nullValues": {
                                "double": [
                                    -99999,
                                ]
                            },
                            "dimensionType": {
                                "name": "REAL_32BITS",
                            }
                        }
                    ]
                }
            }
        }

        url = settings.GEOSERVER_URL + "rest/workspaces/" + workspace_name + \
          "/coveragestores/" + store_name + "/coverages/" + store_name + ".json"

        r = put(
            url=url,
            auth=HTTPBasicAuth(
                settings.GEOSERVER_USERNAME,
                settings.GEOSERVER_PASSWORD,
            ),
            verify=False,
            headers={
                'Content-type': 'application/json',
            },
            json=modifying_json,
        )

        assert r.status_code == 200
