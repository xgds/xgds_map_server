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
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.polygon, "Polygon"),
                       'style': '#' + style
                       })

    return result

def getLineKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.lineString, "LineString"),
                       'style': '#' + style
                       })

    return result

def getPointKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]


    if ('shape' in feature):
        shape = "_" + feature.shape

    else:
        shape = ""

    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.point, "Point"),
                       'style': '#' + style + shape
                       })

    return result

def makeStyles(request, mapLayer):
    blueStyle = KmlUtil.makeStyle("0000ff",
                                  iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                  iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF0000', lineWidth=4, polyColor='FFFF0000')
    pinkStyle = KmlUtil.makeStyle("ff00ff",
                                  iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                  iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF00FF', lineWidth=4, polyColor='64FF00FF')
    whiteStyle = KmlUtil.makeStyle("ffffff",
                                   iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                   iconColor='FFFF0000', iconScale=0.5, lineColor='FFFFFFFF', lineWidth=4, polyColor='64FFFFFF')
    orangeStyle = KmlUtil.makeStyle("ff9900",
                                    iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                    iconColor='FFFF0000', iconScale=0.5, lineColor='FF1478FF', lineWidth=4, polyColor='FF1478FF')
    yellowStyle = KmlUtil.makeStyle("ffff00",
                                    iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                    iconColor='FFFF0000', iconScale=0.5, lineColor='FF14F0FF', lineWidth=4, polyColor='FF14F0FF')
    greenStyle = KmlUtil.makeStyle("00ff00",
                                   iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/point.png')),
                                   iconColor='FFFF0000', iconScale=0.5, lineColor='FF00FF00', lineWidth=4, polyColor='6400FF00')

    blueSquareStyle = KmlUtil.makeStyle("0000ff_Square",
                                  iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                  iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF0000', lineWidth=4, polyColor='FFFF0000')
    pinkSquareStyle = KmlUtil.makeStyle("ff00ff_Square",
                                  iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                  iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF00FF', lineWidth=4, polyColor='64FF00FF')
    whiteSquareStyle = KmlUtil.makeStyle("ffffff_Square",
                                   iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                   iconColor='FFFF0000', iconScale=0.5, lineColor='FFFFFFFF', lineWidth=4, polyColor='64FFFFFF')
    orangeSquareStyle = KmlUtil.makeStyle("ff9900_Square",
                                    iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                    iconColor='FFFF0000', iconScale=0.5, lineColor='FF1478FF', lineWidth=4, polyColor='FF1478FF')
    yellowSquareStyle = KmlUtil.makeStyle("ffff00_Square",
                                    iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                    iconColor='FFFF0000', iconScale=0.5, lineColor='FF14F0FF', lineWidth=4, polyColor='FF14F0FF')
    greenSquareStyle = KmlUtil.makeStyle("00ff00_Square",
                                   iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/square-point.png')),
                                   iconColor='FFFF0000', iconScale=0.5, lineColor='FF00FF00', lineWidth=4, polyColor='6400FF00')

    blueTriStyle = KmlUtil.makeStyle("0000ff_Triangle",
                                     iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                     iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF0000', lineWidth=4, polyColor='FFFF0000')
    pinkTriStyle = KmlUtil.makeStyle("ff00ff_Triangle",
                                     iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                     iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF00FF', lineWidth=4, polyColor='64FF00FF')
    whiteTriStyle = KmlUtil.makeStyle("ffffff_Triangle",
                                      iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                      iconColor='FFFF0000', iconScale=0.5, lineColor='FFFFFFFF', lineWidth=4, polyColor='64FFFFFF')
    orangeTriStyle = KmlUtil.makeStyle("ff9900_Triangle",
                                       iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                       iconColor='FFFF0000', iconScale=0.5, lineColor='FF1478FF', lineWidth=4, polyColor='FF1478FF')
    yellowTriStyle = KmlUtil.makeStyle("ffff00_Triangle",
                                       iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                       iconColor='FFFF0000', iconScale=0.5, lineColor='FF14F0FF', lineWidth=4, polyColor='FF14F0FF')
    greenTriStyle = KmlUtil.makeStyle("00ff00_Triangle",
                                      iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png')),
                                      iconColor='FFFF0000', iconScale=0.5, lineColor='FF00FF00', lineWidth=4, polyColor='6400FF00')

    blueStarStyle = KmlUtil.makeStyle("0000ff_Star",
                                     iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                     iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF0000', lineWidth=4, polyColor='FFFF0000')
    pinkStarStyle = KmlUtil.makeStyle("ff00ff_Star",
                                     iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                     iconColor='FFFF0000', iconScale=0.5, lineColor='FFFF00FF', lineWidth=4, polyColor='64FF00FF')
    whiteStarStyle = KmlUtil.makeStyle("ffffff_Star",
                                      iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                      iconColor='FFFF0000', iconScale=0.5, lineColor='FFFFFFFF', lineWidth=4, polyColor='64FFFFFF')
    orangeStarStyle = KmlUtil.makeStyle("ff9900_Star",
                                       iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                       iconColor='FFFF0000', iconScale=0.5, lineColor='FF1478FF', lineWidth=4, polyColor='FF1478FF')
    yellowStarStyle = KmlUtil.makeStyle("ffff00_Star",
                                       iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                       iconColor='FFFF0000', iconScale=0.5, lineColor='FF14F0FF', lineWidth=4, polyColor='FF14F0FF')
    greenStarStyle = KmlUtil.makeStyle("00ff00_Star",
                                      iconUrl=request.build_absolute_uri(static('xgds_map_server/icons/star-point.png')),
                                      iconColor='FFFF0000', iconScale=0.5, lineColor='FF00FF00', lineWidth=4, polyColor='6400FF00')

    styles = {
        'blue' : blueStyle,
        'pink' : pinkStyle,
        'white' : whiteStyle,
        'orange' : orangeStyle,
        'yellow' : yellowStyle,
        'green' : greenStyle,

        'blueSquare': blueSquareStyle,
        'pinkSquare': pinkSquareStyle,
        'whiteSquare': whiteSquareStyle,
        'orangeSquare': orangeSquareStyle,
        'yellowSquare': yellowSquareStyle,
        'greenSquare': greenSquareStyle,

        'blueTri': blueTriStyle,
        'pinkTri': pinkTriStyle,
        'whiteTri': whiteTriStyle,
        'orangeTri': orangeTriStyle,
        'yellowTri': yellowTriStyle,
        'greenTri': greenTriStyle,

        'blueStar': blueStarStyle,
        'pinkStar': pinkStarStyle,
        'whiteStar': whiteStarStyle,
        'orangeStar': orangeStarStyle,
        'yellowStar': yellowStarStyle,
        'greenStar': greenStarStyle
    }


    return styles

def exportMapLayer(request, mapLayer):
    resultString = ''
    styleString = ''
    features = mapLayer.getFeatureJson().features
    styles = makeStyles(request, mapLayer)

    for f in features:
        if (f.type == "Point"):
            resultString += '\n' + getPointKml(f)

        elif (f.type == "Polygon"):
            resultString += '\n' + getPolygonKml(f)

        else:
            resultString += '\n' + getLineKml(f)

    for key, value in styles.iteritems():
        styleString += value + '\n'

    return styleString + resultString

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
