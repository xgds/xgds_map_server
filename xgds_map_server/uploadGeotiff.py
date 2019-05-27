# __BEGIN_LICENSE__
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
# __END_LICENSE__

from requests import put, post
from requests.auth import HTTPBasicAuth
from django.conf import settings
from django.contrib.sites.models import Site

import time
import urllib
import string


def get_store_name(instance):
    store_name = instance.name.replace(" ", "_")
    acceptable_characters = string.ascii_letters + string.digits + "_"
    for c in store_name:
        assert c in acceptable_characters
    return store_name


def get_geoserver_basic_auth():
    return HTTPBasicAuth(
        settings.GEOSERVER_USERNAME,
        settings.GEOSERVER_PASSWORD,
    )


def upload_geotiff(instance):
    """
    Upload a GeoTIFF file to the connected Geoserver

    instance: instance of a geotiff form
    """

    workspace_name = settings.GEOSERVER_DEFAULT_WORKSPACE

    file_handle = instance.sourceFile
    colorized = instance.colorized
    current_timestamp = str(int(time.time()))

    store_name = get_store_name(instance)

    minimum_value, maximum_value = instance.minimumValue, instance.maximumValue
    minimum_color, maximum_color = instance.minimumColor, instance.maximumColor

    geoserver_basic_auth = get_geoserver_basic_auth()

    url = settings.GEOSERVER_URL + "rest/workspaces"

    r = post(
        url=url,
        auth=geoserver_basic_auth,
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
        auth=geoserver_basic_auth,
        verify=False,
        headers={
            'Content-type': 'image/tiff',
        },
        data=data,
    )

    assert r.status_code < 300

    if not colorized and minimum_value is not None and maximum_value is not None:
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
            auth=geoserver_basic_auth,
            verify=False,
            headers={
                'Content-type': 'application/json',
            },
            json=modifying_json,
        )

        if r.status_code >= 200:
            print r.text
        assert r.status_code == 200

    if not colorized and minimum_color is not None and maximum_color is not None:
        url = settings.GEOSERVER_URL + "rest/styles"
        # since geoserver complains if we have multiple styles with the same name,
        # we will add the current timestamp to the style name to make it unique
        new_style_name = "%s_%s_style_%s" % (
            workspace_name, store_name, current_timestamp)
        creation_json = {
            "style": {
                "name": new_style_name,
                "filename": "%s.pal" % new_style_name
            }
        }
        r = post(
            url=url,
            auth=geoserver_basic_auth,
            verify=False,
            headers={
                'Content-type': 'application/json',
            },
            json=creation_json,
        )

        assert r.status_code < 300

        url = settings.GEOSERVER_URL + "rest/styles/" + new_style_name
        r = put(
            url=url,
            auth=geoserver_basic_auth,
            verify=False,
            headers={
                'Content-type': "text/vnd.ncwms.palette",
            },
            data="%s\n%s" % (minimum_color, maximum_color),
        )

        assert r.status_code < 300
    else:
        new_style_name = "raster"

    instance.wmsUrl = "/geoserver/%s/wms" % (workspace_name)
    instance.layers = "%s:%s" % (workspace_name, store_name)
    if not colorized:
        instance.colorPalette = new_style_name
    else:
        instance.colorPalette = ""


def update_geotiff_values(instance):
    minimum_value, maximum_value = instance.minimumValue, instance.maximumValue
    minimum_color, maximum_color = instance.minimumColor, instance.maximumColor
    colorized = instance.colorized
    style_name = instance.colorPalette

    if colorized or minimum_color is None or maximum_color is None or minimum_value is None or maximum_value is None:
        return

    workspace_name = settings.GEOSERVER_DEFAULT_WORKSPACE
    store_name = get_store_name(instance)

    geoserver_basic_auth = get_geoserver_basic_auth()

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
        auth=geoserver_basic_auth,
        verify=False,
        headers={
            'Content-type': 'application/json',
        },
        json=modifying_json,
    )

    if r.status_code >= 200:
        print r.text

    assert r.status_code == 200

    url = settings.GEOSERVER_URL + "rest/styles/" + style_name
    r = put(
        url=url,
        auth=geoserver_basic_auth,
        verify=False,
        headers={
            'Content-type': "text/vnd.ncwms.palette",
        },
        data="%s\n%s" % (minimum_color, maximum_color),
    )

    assert r.status_code < 300
