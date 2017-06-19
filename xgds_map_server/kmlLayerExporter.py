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

import string
from geocamUtil import KmlUtil
from django.contrib.staticfiles.templatetags.staticfiles import static

"""
Exports map layer as KML String
"""

def getPolygonKml(feature):
    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.polygon, "Polygon"),
                       'style': '#xgds'
                       })

    return result

def getLineKml(feature):
    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.lineString, "LineString"),
                       'style': '#xgds'
                       })

    return result

def getPointKml(feature):
    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.point, "Point"),
                       'style': '#xgds'
                       })

    return result

def makeStyles(request, mapLayer):
    style = KmlUtil.makeStyle("xgds", 
                              iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')), 
                              iconScale=0.5,
                              lineColor='FFFF0000',
                              lineWidth=4,
                              polyColor='44FF0000')
    return style

def exportMapLayer(request, mapLayer):
    resultString = ''
    features = mapLayer.getFeatureJson().features

    for f in features:
        if (f.type == "Point"):
            resultString += '\n' + getPointKml(f)

        elif (f.type == "Polygon"):
            resultString += '\n' + getPolygonKml(f)

        else:
            resultString += '\n' + getLineKml(f)

    return makeStyles(request, mapLayer) + '\n' + resultString

def toKml(featureGeom, type):
    result = ''

    if (type == "Point"):
        result = pointFormatter(featureGeom)

    elif (type == "LineString"):
        result = lineFormatter(featureGeom)

    else:
        result = polygonFormatter(featureGeom)

    return result

def pointFormatter(featureGeom):
    result = '<Point><coordinates>'

    for point in featureGeom:
        result += str(point);
        result += ','

    result += "0</coordinates></Point>"

    return result

def lineFormatter(featureGeom):
    result = '<LineString><coordinates>'
    temp = ''

    for point in featureGeom:
        temp = str(point)
        temp = temp.replace(" ", "")
        result += temp + ",0 "

    result = result.replace("[", "")
    result = result.replace("]", "")
    result += "</coordinates></LineString>"

    return result

def polygonFormatter(featureGeom):
    result = '<Polygon><outerBoundaryIs><LinearRing><coordinates>'
    temp = ''

    for point in featureGeom:
        temp = str(point)
        temp = temp.replace(" ", "")
        result += temp + ",0 "

    result += "</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>"

    for point in featureGeom:
        temp = str(point)
        temp = temp.replace(" ", "")
        result += temp + ",0 "

    result = result.replace("[", "")
    result = result.replace("]", "")
    result += "</coordinates></LinearRing></innerBoundaryIs></Polygon>"

    return result
