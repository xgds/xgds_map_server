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
from polycircles import polycircles

"""
Exports map layer as KML String
"""

def exportMapLayer(request, mapLayer):
    resultString = ''
    styleString = ''
    features = mapLayer.getFeatureJson().features
    styles = {}

    for f in features:
        if f.style:
            style = f.style

        else:
            style = "0000ff"

        print f

        if (f.type == "Point"):
            resultString += '\n' + getPointKml(f)
            if hasattr(f, 'shape'):
                styles[style + "_" + f.type + "_" + f.shape] = createStyle(request, f)
            else:
                styles[style + "_" + f.type] = createStyle(request, f)

        elif (f.type == "Polygon"):
            resultString += '\n' + getPolygonKml(f)
            styles[style + "_" + f.type] = createStyle(request, f)

        elif (f.type == "Station"):
            resultString += '\n' + getStationKml(f)
            styles[style + "_" + f.type] = createStyle(request, f)
            styles["tolerance" + style] = createToleranceStyle(f)
            styles["boundary" + style] = createBoundaryStyle(f)

        else:
            resultString += '\n' + getLineKml(f)
            styles[style + "_" + f.type] = createStyle(request, f)


    for key, value in styles.iteritems():
        styleString += value + '\n'

    return styleString + resultString

def getPolygonKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    styleName = style + feature.type
    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.polygon, "Polygon"),
                       'style': styleName
                       })

    return result

def getLineKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    styleName = style + feature.type
    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.lineString, "LineString"),
                       'style': styleName
                       })

    return result

def getPointKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    styleName = style + feature.type

    if ('shape' in feature):
        shape = "_" + feature.shape
        styleName += shape

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
                       'style': styleName
                       })

    return result

def getStationKml(feature):
    if (feature.style == None or feature.style == ""):
        style = "0000ff"

    else:
        style = feature.style[1:]

    styleName = style + feature.type

    result = ('''
    <Placemark>
    <name>%(name)s</name>
    <description>%(description)s</description>
    <styleUrl>%(style)s</styleUrl>
    %(point)s
    </Placemark>''' % {'name': feature.name,
                       'description': feature.description,
                       'point': toKml(feature.point, "Point"),
                       'style': styleName
                       })

    if feature.tolerance:
        toleranceCircle = polycircles.Polycircle(latitude=feature.point[1],
                                                 longitude=feature.point[0],
                                                 radius=int(feature.tolerance),
                                                 number_of_vertices=36)

        result += ('''
                    <Placemark>
                        <name>%(name)s</name>
                        <styleUrl>%(style)s</styleUrl>
                        <LineString>
                            <tessellate>1</tessellate>
                             %(geom)s
                    </Placemark>''' % {'name': feature.name,
                                       'style': "tolerance" + feature.style[1:],
                                       'geom': toleranceKmlFormatter(toleranceCircle)
                                       })

    if feature.boundary:
        boundaryCircle = polycircles.Polycircle(latitude=feature.point[1],
                                                longitude=feature.point[0],
                                                radius=int(feature.boundary),
                                                number_of_vertices=36)

        result += ('''
            <Placemark>
                <name>%(name)s</name>
                <styleUrl>%(style)s</styleUrl>
                <MultiGeometry>
                    <LineString>
                        <tessellate>1</tessellate>
                        %(geom)s
            </Placemark>''' % {'name': feature.name,
                               'style': "boundary" + feature.style[1:],
                               'geom': boundaryKmlFormatter(boundaryCircle)
                              })

    return result


def createStyle(request, feature):
    if feature.style:
        style = feature.style[1:]

    else:
        style = "0000ff"

    styleName = style + feature.type
    color = getKmlColor(style, "ff")
    iconLink = ""

    if (feature.type == "Point"):
        if hasattr(feature, 'shape'):
            styleName = style + feature.type + "_" + feature.shape
            if (feature.shape == "Triangle"):
                iconLink = request.build_absolute_uri(static('xgds_map_server/icons/triangle-point.png'))
            elif (feature.shape == "Square"):
                iconLink = request.build_absolute_uri(static('xgds_map_server/icons/square-point.png'))
            elif(feature.shape == "Star"):
                iconLink = request.build_absolute_uri(static('xgds_map_server/icons/star-point.png'))
            else:
               iconLink = request.build_absolute_uri(static('xgds_map_server/icons/point.png'))
        else:
            iconLink = request.build_absolute_uri(static('xgds_map_server/icons/point.png'))
    elif (feature.type == "Station"):
        request.build_absolute_uri(static('xgds_map_server/icons/placemark_circle.png'))
    else:
        iconLink = request.build_absolute_uri(static('xgds_map_server/icons/point.png'))
    
    style = KmlUtil.makeStyle(styleName, iconUrl=iconLink, iconColor=color, iconScale=0.5,
                              lineColor=color, lineWidth=4, polyColor=color)

    return style


def createToleranceStyle(feature):
    if feature.style:
        style = feature.style[1:]

    else:
        style = "0000ff"

    color = getKmlColor(style, "80")
    styleName = "tolerance" + style

    style = KmlUtil.makeStyle(styleName, lineWidth=3, lineColor=color)
    return style


def createBoundaryStyle(feature):
    if feature.style:
        style = feature.style[1:]

    else:
        style = "0000ff"

    color = getKmlColor(style, "ff")
    styleName = "boundary" + style

    style = KmlUtil.makeStyle(styleName, lineWidth=3, lineColor=color)
    return style


def boundaryKmlFormatter(boundaryCircle):
    result = '<coordinates>'

    for coord in boundaryCircle.vertices:
        result = result + str(coord[1]) + ',' + str(coord[0]) + '\n'
    result = result + str(boundaryCircle.vertices[0][1]) + ',' + str(boundaryCircle.vertices[0][0]) + '\n'

    result += "</coordinates></LineString></MultiGeometry>"

    return result


def toleranceKmlFormatter(toleranceCircle):
    result = '<coordinates>'

    for coord in toleranceCircle.vertices:
        result = result + str(coord[1]) + ',' + str(coord[0]) + '\n'
    result = result + str(toleranceCircle.vertices[0][1]) + ',' + str(toleranceCircle.vertices[0][0]) + '\n'

    result += "</coordinates></LineString>"

    return result


def toKml(featureGeom, type):
    if (type == "Point"):
        result = pointFormatter(featureGeom)

    elif (type == "LineString"):
        result = lineFormatter(featureGeom)

    elif (type == "Station"):
        result = stationFormatter(featureGeom)

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

def stationFormatter(featureGeom):
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

def getKmlColor(hexColor, opacity):
    if (hexColor == "ffff00"):
        hexColor = "14f0ff"
    elif (hexColor == "ff9900"):
        hexColor = "1478ff"
    elif(hexColor == "0000ff"):
        hexColor = "f04614"

    kmlColor = opacity + hexColor

    return kmlColor
