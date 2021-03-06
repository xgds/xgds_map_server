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

import traceback
from cStringIO import StringIO
import datetime
import inspect
import json
import logging
import os
import pytz
import re
import string
from subprocess import Popen, PIPE
import threading
import urllib
import zipfile
import csv
from dateutil.parser import parse as dateparser

from django.conf import settings
from django.contrib.gis.geos import LineString as geosLineString
from django.contrib.gis.geos import LinearRing as geosLinearRing
from django.contrib.gis.geos import Point as geosPoint
from django.contrib.gis.geos import Polygon as geosPolygon
from django.core import mail
from django.core.urlresolvers import resolve
from django.core.urlresolvers import reverse
from django.db import transaction
from django.forms.formsets import formset_factory
from django.http import HttpResponse, Http404, JsonResponse
from django.http import HttpResponseRedirect
from django.http import HttpResponseServerError, HttpResponseNotAllowed
from django.shortcuts import render, redirect
from django.http import StreamingHttpResponse
from django.template import RequestContext
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import condition
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist

from geocamUtil.datetimeJsonEncoder import DatetimeJsonEncoder
from geocamUtil.geoEncoder import GeoDjangoEncoder
from geocamUtil import TimeUtil
from geocamUtil.loader import LazyGetModelByName, getClassByName, getModelByName, getFormByName
from geocamUtil.modelJson import modelToJson, modelsToJson, modelToDict, dictToJson
from geocamUtil.models import SiteFrame
from xgds_core.models import HasDataFrame
from xgds_core.views import get_handlebars_templates, OrderListJson
from xgds_core.util import addPort
from xgds_map_server.forms import MapForm, MapGroupForm, MapLayerForm, MapLayerFromSelectedForm, MapTileForm, \
    MapDataTileForm, EditMapTileForm, EditGeotiffForm, EditMapDataTileForm, WMSTileForm, GeoJSONForm, GeotiffForm
from xgds_map_server.models import KmlMap, MapGroup, MapLayer, MapTile, MapDataTile, MapLink, MAP_NODE_MANAGER, \
    MAP_MANAGER, GroundOverlayTime, WMSTile, GeoJSON, Geotiff, MapCollection, MapCollectionItem
from xgds_map_server.kmlLayerExporter import exportMapLayer
from geocamUtil.KmlUtil import wrapKmlForDownload
from fastkml import kml
from shapely.geometry import Point, LineString, Polygon
from xgds_core.views import buildFilterDict
from xgds_core.util import insertIntoPath

from xgds_map_server.uploadGeotiff import update_geotiff_values

if 'xgds_timeseries' in settings.INSTALLED_APPS:
    from xgds_timeseries.views import get_time_series_classes_metadata


#from django.http import StreamingHttpResponse
# pylint: disable=E1101,R0911
latestRequestG = None

XGDS_MAP_SERVER_GEOTIFF_PATH = os.path.join(settings.DATA_ROOT, settings.XGDS_MAP_SERVER_GEOTIFF_SUBDIR)
SEARCH_FORMS = {}
FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_CORE_FLIGHT_MODEL)
GROUP_FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_CORE_GROUP_FLIGHT_MODEL)


def setTransparency(request, uuid, mapType, value):
    try:
        theClass = getModelByName('xgds_map_server.' + mapType)
        foundElement = theClass.objects.get(uuid=uuid)
        foundElement.transparency = value
        foundElement.save()
        msg = "Transparency saved for " + foundElement.name
        return JsonResponse({'status':'true','message':msg})
    except:
        traceback.print_exc()
        msg = "Could not save transparency: " + uuid
        return JsonResponse({'status':'false','message':msg}, status=500)

def get_map_tree_templates(source):
    fullCache = get_handlebars_templates(source, 'XGDS_MAP_SERVER_HANDLEBARS_DIRS')
    return {'layer-tree': fullCache['layer-tree']}


def getMapServerIndexPage(request):
    """
    An actual map, with the tree.
    """
    templates = get_map_tree_templates(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    return render(request,
                  'MapView.html',
                  {'templates': templates,
                   'title': 'Map View',
                   'help_content_path': 'xgds_map_server/help/viewMaps.rst',
                   'app': 'xgds_map_server/js/map_viewer/mapViewerApp.js'})


def getGoogleEarthFeedPage(request):
    """
    Page with description and link to the kml feed
    """
    feedUrl = (request.build_absolute_uri(reverse('xgds_map_server_feed', kwargs={'feedname': ''}))) + '?doc=0'
    filename = settings.XGDS_MAP_SERVER_TOP_LEVEL['filename']
    return render(request,
                  'GoogleEarthFeed.html',
                  {'title': 'Google Earth Feed',
                   'help_content_path': 'xgds_map_server/help/feedPage.rst',
                   'feedUrl': feedUrl,
                   'filename': filename
                   })


def getMapTreePage(request):
    """
    HTML tree of maps using fancytree
    """
    # Not sure why these were absolute since they are for browswer not GE.  Trying with just "reverse"
    
    #    jsonMapTreeUrl = request.build_absolute_uri(reverse('mapTreeJSON'))
    #    moveNodeURL = request.build_absolute_uri(reverse('moveNode'))
    #    setVisibilityURL = request.build_absolute_uri(reverse('setNodeVisibility'))
    jsonMapTreeUrl = reverse('mapTreeJSON')
    moveNodeURL = reverse('moveNode')
    setVisibilityURL = reverse('setNodeVisibility')
    return render(request,
                  "MapTree.html",
                  {'JSONMapTreeURL': jsonMapTreeUrl,
                   'moveNodeURL': moveNodeURL,
                   'title': 'Edit Maps',
                   'help_content_path': 'xgds_map_server/help/editMaps.rst',
                   'setVisibilityURL': setVisibilityURL},
                  )


def populateSearchFormHash(key, entry, SEARCH_FORMS, filter=None):
    if 'search_form_class' in entry:
        theForm = getFormByName(entry['search_form_class'])
        initial = buildFilterDict(filter)
        theFormSet = theForm(initial=initial)
        SEARCH_FORMS[key] = [theFormSet, entry['model']]


def getSearchForms(key=None, filter=None):
    # get the dictionary of forms for searches
    SEARCH_FORMS = {}
    if not key:
        for key, entry in settings.XGDS_MAP_SERVER_JS_MAP.iteritems():
            populateSearchFormHash(key, entry, SEARCH_FORMS, filter)
    else:
        entry = settings.XGDS_MAP_SERVER_JS_MAP[key]
        populateSearchFormHash(key, entry, SEARCH_FORMS, filter)
    return SEARCH_FORMS


def getMapEditorPage(request, layerID=None):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(os.path.join('xgds_map_server', 'templates', 'handlebars', 'edit'))
    templates = get_handlebars_templates(fullTemplateList, 'XGDS_MAP_SERVER_MAP_EDITOR')
    copiedFeatures = json.dumps(request.session.get('copiedFeatures', False))
    if layerID:
        mapLayer = MapLayer.objects.get(pk=layerID)
        mapLayerDict = mapLayer.toDict()
    else:
        return HttpResponse(json.dumps({'error': 'Map layer is not valid'}), content_type='application/json', status=406)
    return render(request,
                  "MapEditor.html",
                  {'templates': templates,
                   'copiedFeatures': copiedFeatures,
                   'layerForm': MapLayerFromSelectedForm(),
                   #'saveSearchForm': MapSearchForm(),
                   'searchForms': getSearchForms(),
                   'app': 'xgds_map_server/js/map_editor/mapEditorApp.js',
                   'saveMaplayerUrl': reverse('saveMaplayer'),
                   'uuid': mapLayer.uuid,
                   'mapLayerDict': json.dumps(mapLayerDict, cls=GeoDjangoEncoder),
                   'layerName': mapLayer.name
                   })


def getFeatureCoordinates(data, typeName):
    coords = None
    if typeName == 'Point':
        coords = data['point'] or data.get('point')
    elif typeName == 'Polygon':
        coords = data['polygon'] or data.get('polygon')
    elif typeName == 'LineString':
        coords = data['lineString'] or data.get('lineString')
    else:
        print "invalid feature type specified in json"
    return coords


def setFeatureCoordinates(feature, coords, typeName):
    """
    Reference: http://stackoverflow.com/questions/1504288/adding-a-polygon-directly-in-geodjango-postgis
    """
    if typeName == 'Point':
        feature.point = geosPoint(coords)
    elif typeName == 'Polygon':
        try:
            internalCoords = geosLinearRing(coords)
        except:
            return "GEOS_ERROR: IllegalArgumentException: Points of LinearRing do not form a closed linestring!"
        externalCoords = geosLinearRing(coords)
        feature.polygon = geosPolygon(internalCoords, externalCoords)
    elif typeName == 'LineString':
        feature.lineString = geosLineString(coords)
    else:
        return "invalid feature type specified in json " + typeName
#     feature.save()
    return None


def createFeatureObject(typeName):
    """
    create feature object.
    """
    feature = None
    if typeName == 'Point':
        feature = Point()
    elif typeName == 'Polygon':
        feature = Polygon()
    elif typeName == 'LineString':
        feature = LineString()
    elif typeName == 'Drawing':
        feature = Drawing()
    elif typeName == 'GroundOverlay':
        feature = GroundOverlay()
    else:
        print "invalid feature type specified in json"
    return feature


def saveMaplayer(request):
    """
    Update map layer properties: this also saves feature properties that belong to this map layer.
    """
    if (request.method == "PUT") or (request.method == "POST"):  # map layer already exists so backbone sends a PUT request to update it.
        data = json.loads(request.body)
        uuid = data.get('uuid', None)
        #print(data)
        try:
            mapLayer = MapLayer.objects.get(uuid = uuid)
        except:
            return HttpResponse(json.dumps({'failed': 'MapLayer of uuid of %s cannot be found' % uuid}), content_type='application/json', status=406)
        mapLayer.name = data.get('name', "")
        mapLayer.description = data.get('description', "")
        mapLayer.modification_time = datetime.datetime.now(pytz.utc)
        mapLayer.modifier = request.user.first_name + " " + request.user.last_name
        mapLayer.defaultColor = data.get('defaultColor', "")
        mapLayer.minLon = data.get('minLon', "")
        mapLayer.minLat = data.get('minLat', "")
        mapLayer.maxLon = data.get('maxLon', "")
        mapLayer.maxLat = data.get('maxLat', "")
        mapLayer.jsonFeatures = data.get('jsonFeatures', '{}')
        mapLayer.save()

        #TODO have to return 
        return HttpResponse(json.dumps(mapLayer.toDict(), cls=GeoDjangoEncoder), content_type='application/json')
    return HttpResponse(json.dumps({'failed': 'Must be a POST but got %s instead' % request.method}), content_type='application/json', status=406)


def moveNode(request):
    if request.method == 'POST':
        try:
            nodeUuid = request.POST['nodeUuid']
            parentUuid = request.POST['parentUuid']
            parent = MapGroup.objects.get(pk=parentUuid)
            node = MAP_NODE_MANAGER.get(pk=nodeUuid)
            node.parent = parent
            node.save()
            return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')
        except:
            return HttpResponse(json.dumps({'error': 'Move Failed'}), content_type='application/json', status=406)
    return HttpResponse(json.dumps({'failed': 'Must be a POST'}), content_type='application/json', status=406)


def setNodeVisibility(request):
    if request.method == 'POST':
        try:
            nodeUuid = request.POST['nodeUuid']
            visibleString = request.POST['visible']
            if visibleString.encode('ascii','ignore') == 'true':
                visible = True
            else:
                visible = False
            node = MAP_NODE_MANAGER.get(pk=nodeUuid)
            node.visible = visible
            node.save()
#             print "saved visibility for " + node.uuid + ' and visible is ' + str(node.visible) + ' and post is ' + str(request.POST['visible'])
            return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')
        except:
            return HttpResponse(json.dumps({'error': 'Set Visibility Failed'}), content_type='application/json', status=406)
    return HttpResponse(json.dumps({'failed': 'Must be a POST'}), content_type='application/json', status=406)


def getAddKmlPage(request):
    """
    HTML view to create new map
    """
    if request.method == 'POST':
        # quick and dirty hack to handle kmlFile field if user uploads file
        if request.POST['typeChooser'] == 'file' and 'localFile' in request.FILES:
            mutable = request.POST._mutable
            request.POST._mutable = True
            request.POST['kmlFile'] = request.FILES['localFile'].name
            request.POST._mutable = mutable

        map_form = MapForm(request.POST, request.FILES)
        haveLocalFile = False
        if map_form.is_valid():
            map_obj = KmlMap()
            map_obj.name = map_form.cleaned_data['name']
            map_obj.description = map_form.cleaned_data['description']
            if 'localFile' in request.FILES and request.POST['typeChooser'] == 'file':
                map_obj.localFile = request.FILES['localFile']
                map_obj.kmlFile = request.FILES['localFile'].name
                haveLocalFile = True
            else:
                map_obj.kmlFile = map_form.cleaned_data['kmlFile']
            map_obj.openable = map_form.cleaned_data['openable']
            map_obj.visible = map_form.cleaned_data['visible']
            map_obj.parent = map_form.cleaned_data['parent']
            map_obj.transparency = map_form.cleaned_data['transparency']
            map_obj.save()
            #
            # The file field may have changed our file name at save time
            #
            if haveLocalFile:
                justName = re.sub("^" + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR, "", map_obj.localFile.name)
                if justName != map_obj.kmlFile:
                    map_obj.kmlFile = justName
                    map_obj.save()
        else:
            return render(request,
                          "AddKml.html",
                          {'mapForm': map_form,
                           'error': True,
                           'help_content_path': 'xgds_map_server/help/addKML.rst',
                           'title': 'Add KML',
                           'errorText': 'Invalid form entries'})
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        map_form = MapForm()
        return render(request,
                      "AddKml.html",
                      {'mapForm': map_form,
                       'help_content_path': 'xgds_map_server/help/addKML.rst',
                       'title': 'Add KML',
                       },
                      )


def getAddGeotiffPage(request):
    """
    HTML view to create new map
    """
    if request.method == 'POST':
        map_form = GeotiffForm(request.POST, request.FILES)

        # print(map_form)

        if map_form.is_valid():
            map_form.save()
        else:
            return render(request,
                          "AddGeotiff.html",
                          {'mapForm': map_form,
                           'error': True,
                           'help_content_path': 'xgds_map_server/help/addGeoTiff.rst',
                           'title': 'Add GeoTiff',
                           'errorText': 'Invalid form entries'})

        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        map_form = GeotiffForm()
        return render(request,
                      "AddGeotiff.html",
                      {'mapForm': map_form,
                       'error': False,
                       'help_content_path': 'xgds_map_server/help/addGeoTiff.rst',
                       'title': 'Add GeoTiff',
                       },
                      )


def getAddGeoJSONPage(request):
    """
    HTML view to create new map
    """
    if request.method == 'POST':
        map_form = GeoJSONForm(request.POST)

        if map_form.is_valid():
            map_obj = GeoJSON()
            map_obj.name = map_form.cleaned_data['name']
            map_obj.region = map_form.cleaned_data['region']
            map_obj.parent = map_form.cleaned_data['parent']
            map_obj.description = map_form.cleaned_data['description']
            map_obj.geoJSON = map_form.cleaned_data['geoJSON']
            map_obj.save()
        else:
            return render(request,
                          "AddGeoJSON.html",
                          {'mapForm': map_form,
                           'error': True,
                           'help_content_path': 'xgds_map_server/help/addGeoJson.rst',
                           'title': 'Add GeoJSON',
                           'errorText': 'Invalid form entries'})

        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        map_form = GeoJSONForm()
        return render(request,
                      "AddGeoJSON.html",
                      {'mapForm': map_form,
                       'help_content_path': 'xgds_map_server/help/addGeoJson.rst',
                       'title': 'Add GeoJSON',
                       },
                      )


def getAddLayerPage(request):
    """
    HTML view to create a new layer
    """
    if request.method == 'POST':
        layer_form = MapLayerForm(request.POST)
        if layer_form.is_valid():
            map_layer = MapLayer()
            map_layer.name = layer_form.cleaned_data['name']
            map_layer.description = layer_form.cleaned_data['description']
            map_layer.creator = request.user.first_name + " " +  request.user.last_name
            map_layer.modifier = map_layer.creator
            map_layer.creation_time = datetime.datetime.now(pytz.utc)
            map_layer.modification_time = datetime.datetime.now(pytz.utc)
            map_layer.deleted = False
            map_layer.locked = layer_form.cleaned_data['locked']
            map_layer.visible = layer_form.cleaned_data['visible']
            map_layer.transparency = layer_form.cleaned_data['transparency']
            mapGroup = layer_form.cleaned_data['parent']
            map_layer.parent = MapGroup.objects.get(name=mapGroup)
            map_layer.save()
        else:
            return render(request,
                          "AddLayer.html",
                          {'layerForm': layer_form,
                           'help_content_path':'xgds_map_server/help/addMapLayer.rst',
                           'title': 'Add Map Layer',
                           'error': True},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapEditLayer', kwargs={'layerID': map_layer.uuid})))
    else:
        layer_form = MapLayerForm()
        return render(request,
                      "AddLayer.html",
                      {'layerForm': layer_form,
                       'help_content_path':'xgds_map_server/help/addMapLayer.rst',
                       'title': 'Add Map Layer',
                       'error': False},
                      )

@csrf_protect
@condition(etag_func=None)
def getAddTilePage(request):
    """
    HTML view to create a new map tile
    """
    title = "Add Map Tile"
    instructions = "Upload a GeoTiff file to create a map tile layer.<br/>Processing of GeoTiff files can take some time, please allow at least 30 minutes after the upload finishes.<br/>"
    if request.method == 'POST':
        tile_form = MapTileForm(request.POST, request.FILES)
        if tile_form.is_valid():
            tile_form.save()
            mapTile = tile_form.instance
#             sourceFile = tile_form.cleaned_data['sourceFile']
#             mapTile = MapTile(sourceFile=sourceFile)
#             mapTile.name = tile_form.cleaned_data['name']
#             mapTile.description = tile_form.cleaned_data['description']
#             mapTile.creator = request.user.username
#             mapTile.creation_time = datetime.datetime.now(pytz.utc)
#             mapTile.transparency = tile_form.cleaned_data['transparency']
#             mapTile.deleted = False
#             mapGroupName = tile_form.cleaned_data['parent']
#             foundParents = MapGroup.objects.filter(name=mapGroupName)
#             mapTile.parent = foundParents[0] #TODO better handle same name folder
#             mapTile.save()
            minZoom = -1
            maxZoom = -1
            if settings.XGDS_MAP_SERVER_GDAL2TILES_ZOOM_LEVELS:
                minZoom = tile_form.cleaned_data['minZoom']
                maxZoom = tile_form.cleaned_data['maxZoom']
            processTiles(request, mapTile.uuid, minZoom, maxZoom, tile_form.cleaned_data['resampleMethod'], mapTile)
        else:
            return render(request,
                          'AddTile.html',
                          {'form': tile_form,
                           'error': True,
                           'help_content_path' : 'xgds_map_server/help/addMapTile.rst',
                           'instructions': instructions,
                           'title': title},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        tile_form = MapTileForm(initial={'username': request.user.username})
        return render(request,
                      'AddTile.html',
                      {'form': tile_form,
                       'error': False,
                       'help_content_path' : 'xgds_map_server/help/addMapTile.rst',
                       'instructions': instructions,
                       'title': title},
                      )


def getEditTilePage(request, tileID):
    """
    HTML Form of a map
    """
    fromSave = False
    try:
        mapTile = MapTile.objects.get(pk=tileID)
    except MapTile.DoesNotExist:
        raise Http404
    except MapTile.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    # handle post data before loading everything
    if request.method == 'POST':
        tile_form = EditMapTileForm(request.POST, request.FILES)
        if tile_form.is_valid():
            newname = tile_form.cleaned_data['name']
            if mapTile.name != newname:
                mapTile.rename(newname)
            mapTile.modifier = request.user.username
            mapTile.modification_time = datetime.datetime.now(pytz.utc)
            mapTile.description = tile_form.cleaned_data['description']
            mapTile.locked = tile_form.cleaned_data['locked']
            mapTile.visible = tile_form.cleaned_data['visible']
            mapTile.parent = tile_form.cleaned_data['parent']
            mapTile.transparency = tile_form.cleaned_data['transparency']
            mapTile.save()
            return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
        else:
            return render(request,
                          "EditNode.html",
                          {"form": tile_form,
                           "fromSave": False,
                           'help_content_path' : 'xgds_map_server/help/addMapTile.rst',
                           "title": "Edit Map Tile",
                           "error": True,
                           "extras": mapTile.sourceFileLink,
                           "errorText": "Invalid form entries"},
                          )

    # return form page with current form data
    tile_form = EditMapTileForm(instance=mapTile, initial={'username': request.user.username})
    return render(request,
                  "EditNode.html",
                  {"form": tile_form,
                   "title": "Edit Map Tile",
                   'help_content_path' : 'xgds_map_server/help/addMapTile.rst',
                   "extras": mapTile.sourceFileLink,
                   "fromSave": fromSave,
                   },
                  )


def getEditGeotiffPage(request, geotiffID):
    fromSave = False
    try:
        geotiff = Geotiff.objects.get(pk=geotiffID)
    except Geotiff.DoesNotExist:
        raise Http404
    except Geotiff.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    # handle post data before loading everything
    if request.method == 'POST':
        geotiff_form = EditGeotiffForm(request.POST, request.FILES)
        if geotiff_form.is_valid():
            # handle a name change
            geotiff.name = geotiff_form.cleaned_data['name']
            
            # handle a minimum color change
            geotiff.minimumColor = geotiff_form.cleaned_data['minimumColor']
            
            # handle a maximum color change
            geotiff.maximumColor = geotiff_form.cleaned_data['maximumColor']
            
            # handle a minimum value change
            geotiff.minimumValue = geotiff_form.cleaned_data['minimumValue']
            
            # handle a maximum value change
            geotiff.maximumValue = geotiff_form.cleaned_data['maximumValue']
            
            geotiff.modifier = request.user.username
            geotiff.modification_time = datetime.datetime.now(pytz.utc)
            geotiff.description = geotiff_form.cleaned_data['description']
            geotiff.locked = geotiff_form.cleaned_data['locked']
            geotiff.visible = geotiff_form.cleaned_data['visible']
            geotiff.parent = geotiff_form.cleaned_data['parent']
            geotiff.transparency = geotiff_form.cleaned_data['transparency']

            geotiff.save()

            # persist the changes to geoserver
            update_geotiff_values(geotiff)

            return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
        else:
            return render(
                request,
                "EditGeotiff.html",
                {
                    "form": geotiff_form,
                    "fromSave": False,
                    'help_content_path': 'xgds_map_server/help/addMapTile.rst', # TODO change me!
                    "title": "Edit Geotiff",
                    "error": True,
                    "errorText": "Invalid form entries",
                },
            )

    # return form page with current form data
    geotiff_form = EditGeotiffForm(instance=geotiff, initial={'username': request.user.username})
    return render(
        request,
        "EditGeotiff.html",
        {
            "form": geotiff_form,
            "title": "Edit Geotiff",
            'help_content_path': 'xgds_map_server/help/addMapTile.rst', # TODO change me!
            "fromSave": fromSave,
        },
    )

@csrf_protect
@condition(etag_func=None)
def getAddMapDataTilePage(request):
    """
    HTML view to create a new map data tile
    """
    title = "Add Map Data Tile"
    instructions = "Upload a GeoTiff file to create a map tile layer.<br/>Upload a file to provide the data value, and an optional legend image.<br/>Processing of GeoTiff files can take some time, please allow at least 30 minutes after the upload finishes.<br/>"

    if request.method == 'POST':
        tile_form = MapDataTileForm(request.POST, request.FILES)
        if tile_form.is_valid():
            tile_form.save()
            mapTile = tile_form.instance
            minZoom = -1
            maxZoom = -1
            if settings.XGDS_MAP_SERVER_GDAL2TILES_ZOOM_LEVELS:
                minZoom = tile_form.cleaned_data['minZoom']
                maxZoom = tile_form.cleaned_data['maxZoom']
            processTiles(request, mapTile.uuid, minZoom, maxZoom, tile_form.cleaned_data['resampleMethod'], mapTile)
        else:
            return render(request,
                          "AddDataTile.html",
                          {'form': tile_form,
                           'error': True,
                           'help_content_path' : 'xgds_map_server/help/addMapDataTile.rst',
                           'instructions': instructions,
                           'title': title},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        tile_form = MapDataTileForm(initial={'username': request.user.username})
        return render(request,
                      "AddDataTile.html",
                      {'form': tile_form,
                       'error': False,
                       'help_content_path' : 'xgds_map_server/help/addMapDataTile.rst',
                       'instructions': instructions,
                       'title': title},
                      )
        
@csrf_protect
@condition(etag_func=None)
def getEditMapDataTilePage(request, tileID):
    """
    HTML view to edit an existing map data tile
    """
    try:
        mapTile = MapDataTile.objects.get(pk=tileID)
    except MapDataTile.DoesNotExist:
        raise Http404
    except MapDataTile.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()
    title = "Edit Map Data Tile"
    instructions = "You may modify anything except the original GeoTiff file.<br/>Upload a file to provide the data value, and an optional legend image.<br/>"

    if request.method == 'POST':
        tile_form = EditMapDataTileForm(request.POST, request.FILES, instance=mapTile)
        if tile_form.is_valid():
            tile_form.save()
        else:
            return render(request,
                          "EditNode.html",
                          {'form': tile_form,
                           'error': True,
                           'help_content_path' : 'xgds_map_server/help/addMapDataTile.rst',
                           'instructions': instructions,
                           'title': title},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        tile_form = EditMapDataTileForm(instance=mapTile, initial={'username': request.user.username})
        return render(request,
                      "EditNode.html",
                      {'form': tile_form,
                       'error': False,
                       'help_content_path' : 'xgds_map_server/help/addMapDataTile.rst',
                       'instructions': instructions,
                       'title': title},
                      )


@csrf_protect
@condition(etag_func=None)
def getAddWMSTilePage(request):
    """
    HTML view to create a new wms tile
    """
    title = "Add WMS Layer"
    instructions = "Reference a WMS layer on a remote server"

    if request.method == 'POST':
        tile_form = WMSTileForm(request.POST, request.FILES)
        if tile_form.is_valid():
            tile_form.save()
        else:
            return render(request,
                          "AddNode.html",
                          {'form': tile_form,
                           'error': True,
                           'instructions': instructions,
                           'title': title},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        tile_form = WMSTileForm(initial={'username': request.user.username})
        return render(request,
                      "AddNode.html",
                      {'form': tile_form,
                       'error': False,
                       'help_content_path': 'xgds_map_server/help/addWMSTile.rst',
                       'instructions': instructions,
                       'title': title},
                      )


@csrf_protect
@condition(etag_func=None)
def getEditWMSTilePage(request, tileID):
    """
    HTML view to edit an existing wms tile
    """
    try:
        mapTile = WMSTile.objects.get(pk=tileID)
    except WMSTile.DoesNotExist:
        raise Http404
    except WMSTile.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()
    title = "Edit WMS Layer"
    instructions = "You may modify anything."

    if request.method == 'POST':
        tile_form = WMSTileForm(request.POST, request.FILES, instance=mapTile)
        if tile_form.is_valid():
            tile_form.save()
        else:
            return render(request,
                          "EditNode.html",
                          {'form': tile_form,
                           'error': True,
                           'instructions': instructions,
                           'title': title},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        tile_form = WMSTileForm(instance=mapTile, initial={'username': request.user.username})
        return render(request,
                      "EditNode.html",
                      {'form': tile_form,
                       'error': False,
                       'instructions': instructions,
                       'title': title},
                      )


def getAddFolderPage(request):
    """
    HTML view to create new folder (group)
    """
    if request.method == 'POST':
        group_form = MapGroupForm(request.POST)
        if group_form.is_valid():
            map_group = MapGroup()
            map_group.name = group_form.cleaned_data['name']
            map_group.description = group_form.cleaned_data['description']
            map_group.parent = group_form.cleaned_data['parent']
            map_group.save()
        else:
            return render(request,
                          "AddFolder.html",
                          {'groupForm': group_form,
                           'error': True,
                           'help_content_path': 'xgds_map_server/help/addFolder.rst',
                           'title': 'Add Folder',
                           'errorText': "Invalid form entries"},
                          )
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
    else:
        group_form = MapGroupForm()
        return render(request,
                      "AddFolder.html",
                      {'groupForm': group_form,
                       'help_content_path': 'xgds_map_server/help/addFolder.rst',
                       'title': 'Add Folder',
                       'error': False},
                      )


# def getAddMapSearchPage(request):
#     """
#     HTML view to create new map search
#     """
#     if request.method == 'POST':
#         form = MapSearchForm(request.POST)
#         if form.is_valid():
#             msearch = MapSearch()
#             msearch.name = form.cleaned_data['name']
#             msearch.description = form.cleaned_data['description']
#             msearch.parent = form.cleaned_data['parent']
#             msearch.creator = request.user.username
#             msearch.creation_time = datetime.datetime.now(pytz.utc)
#             msearch.deleted = False
#             msearch.locked = form.cleaned_data['locked']
#             msearch.visible = form.cleaned_data['visible']
#             msearch.requestLog = form.cleaned_data['requestLog']
#             msearch.save()
#         else:
#             return render(request,
#                           "AddMapSearch.html",
#                           {'form': form,
#                            'error': True,
#                            'help_content_path' : 'xgds_map_server/help/editMapSearch.rst',
#                            'title': 'Edit Map Search',
#                            'errorText': "Invalid form entries"},
#                           )
#         return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
#     else:
#         form = MapSearchForm()
#         return render(request,
#                       "AddMapSearch.html",
#                       {'form': form,
#                        'help_content_path' : 'xgds_map_server/help/editMapSearch.rst',
#                        'title': 'Edit Map Search',
#                        'error': False},
#                       )
#
#
# def getEditMapSearchPage(request, mapSearchID):
#     title = "Edit Map Search"
#     fromSave = False
#     try:
#         msearch = MapSearch.objects.get(pk=mapSearchID)
#     except MapSearch.DoesNotExist:
#         raise Http404
#     except MapSearch.MultipleObjectsReturned:
#         # this really shouldn't happen, ever
#         return HttpResponseServerError()
#
#     # handle post data before loading everything
#     if request.method == 'POST':
#         form = MapSearchForm(request.POST)
#         if form.is_valid():
#             msearch = MapSearch()
#             msearch.name = form.cleaned_data['name']
#             msearch.description = form.cleaned_data['description']
#             msearch.parent = form.cleaned_data['parent']
#             msearch.creator = request.user.username
#             msearch.creation_time = datetime.datetime.now(pytz.utc)
#             msearch.locked = form.cleaned_data['locked']
#             msearch.visible = form.cleaned_data['visible']
#             msearch.requestLog = form.cleaned_data['requestLog']
#             msearch.save()
#         else:
#             return render(request,
#                           "EditNode.html",
#                           {"form": form,
#                            "title": title,
#                            "fromSave": False,
#                            'help_content_path' : 'xgds_map_server/help/editMapSearch.rst',
#                            "error": True,
#                            "errorText": "Invalid form entries"},
#                           )
#         return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
#
#     # return form page with current form data
#     form = MapSearchForm(instance=msearch)
#     return render(request,
#                   "EditNode.html",
#                   {"form": form,
#                    "title": title,
#                    'help_content_path' : 'xgds_map_server/help/editMapSearch.rst',
#                    "fromSave": fromSave,
#                    },
#                   )
#
#
# def getAddMapCollectionPage(request):
#     """
#     HTML view to create new map collection
#     """
#     instruction = "Create a new map collection -- that is a collection of objects that can be turned on and off on the map."
#     title = "Add Map Collection"
#     if request.method == 'POST':
#         form = MapCollectionForm(request.POST)
#         if form.is_valid():
#             mcollection = MapCollection()
#             mcollection.name = form.cleaned_data['name']
#             mcollection.description = form.cleaned_data['description']
#             mcollection.parent = form.cleaned_data['parent']
#             mcollection.creator = request.user.username
#             mcollection.creation_time = datetime.datetime.now(pytz.utc)
#             mcollection.deleted = False
#             mcollection.locked = form.cleaned_data['locked']
#             mcollection.visible = form.cleaned_data['visible']
#             mcollection.collection = form.cleaned_data['collection']
#             mcollection.save()
#         else:
#             return render(request,
#                           "AddNode.html",
#                           {'form': form,
#                            'error': True,
#                            'title': title,
#                            'instruction': instruction,
#                            'errorText': "Invalid form entries"},
#                           )
#         return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
#     else:
#         form = MapCollectionForm()
#         return render(request,
#                       "AddNode.html",
#                       {'form': form,
#                        'error': False,
#                        'title': title,
#                        'instruction': instruction},
#                       )
#
#
# def getEditMapCollectionPage(request, mapCollectionID):
#     title = "Edit Map Collection"
#     fromSave = False
#     try:
#         mcollection = MapCollection.objects.get(pk=mapCollectionID)
#     except MapCollection.DoesNotExist:
#         raise Http404
#     except MapCollection.MultipleObjectsReturned:
#         # this really shouldn't happen, ever
#         return HttpResponseServerError()
#
#     # handle post data before loading everything
#     if request.method == 'POST':
#         form = MapCollectionForm(request.POST)
#         if form.is_valid():
#             mcollection.name = form.cleaned_data['name']
#             mcollection.description = form.cleaned_data['description']
#             mcollection.parent = form.cleaned_data['parent']
#             mcollection.creator = request.user.username
#             mcollection.creation_time = datetime.datetime.now(pytz.utc)
#             mcollection.locked = form.cleaned_data['locked']
#             mcollection.visible = form.cleaned_data['visible']
#             mcollection.save()
#         else:
#             return render(request,
#                           "EditNode.html",
#                           {"form": form,
#                            "title": title,
#                            "fromSave": False,
#                            "error": True,
#                            "errorText": "Invalid form entries"},
#                           )
#         return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))
#
#     # return form page with current form data
#     form = MapCollectionForm(instance=mcollection)
#     return render(request,
#                   "EditNode.html",
#                   {"form": form,
#                    "title": title,
#                    "fromSave": fromSave,
#                    },
#                   )


@csrf_protect
def getDeleteNodePage(request, nodeID):
    """
    HTML view to delete map
    """
    try:
        map_objs = MAP_NODE_MANAGER.filter(pk=nodeID)
        map_obj = map_objs[0]
    except:
        raise Http404

    if request.method == 'POST':
        # csrf protection means this has to happen
        # in a relatively intentional way
        # switch the state of the map (undelete and delete)
        map_obj.deleted = not map_obj.deleted
        map_obj.save()
        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapTree')))

    else:
        return render(request,
                      "NodeDelete.html",
                      {'mapObj': map_obj},
                      )


def getDeletedNodesPage(request):
    """
    HTML list of deleted nodes that can be un-deleted
    """
    nodes = MAP_NODE_MANAGER.filter(deleted=True)
    return render(request,
                  "DeletedNodes.html",
                  {'nodes': nodes},
                  )


@csrf_protect
def getDeleteFolderPage(request, groupID):
    """
    HTML view to delete a folder
    """
    try:
        map_group = MapGroup.objects.get(pk=groupID)
    except MapGroup.DoesNotExist:
        raise Http404
    except MapGroup.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    if request.method == 'POST':
        # csrf protection means this has to happen
        # in a relatively intentional way
        # deleting a group means deleting everything under it too
        # this can be undone so it's ok to automatically do it
        transaction.set_autocommit(False)
        try:
            deleteGroup(map_group, not map_group.deleted)
            map_group.deleted = not map_group.deleted
            map_group.save()
            # commit everything at once
            transaction.commit()
        finally:
            transaction.set_autocommit(True)
        return HttpResponseRedirect(request.build_absolute_uri(reverse("mapTree")))

    else:
        return render(request,
                      "FolderDelete.html",
                      {'groupObj': map_group})


def getFolderDetailPage(request, groupID):
    """
    HTML Form of a map group (folder)
    """
    fromSave = False

    try:
        map_group = MapGroup.objects.get(pk=groupID)
    except MapGroup.DoesNotExist:
        raise Http404
    except KmlMap.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    # handle post data before loading everything
    if request.method == 'POST':
        group_form = MapGroupForm(request.POST)
        if group_form.is_valid():
            map_group.name = group_form.cleaned_data['name']
            map_group.description = group_form.cleaned_data['description']
            map_group.parent = group_form.cleaned_data['parent']
            map_group.save()
            fromSave = True
        else:
            return render(request,
                          "EditFolder.html",
                          {"groupForm": group_form,
                           "group_obj": map_group,
                           "fromSave": fromSave,
                           'help_content_path': 'xgds_map_server/help/addFolder.rst',
                           'title': 'Edit Folder',
                           "error": True,
                           "errorText": "Invalid form entries"},
                          )

    # return form page with current data
    group_form = MapGroupForm(instance=map_group)
    return render(request,
                  "EditFolder.html",
                  {"groupForm": group_form,
                   "group_obj": map_group,
                   'help_content_path': 'xgds_map_server/help/addFolder.rst',
                   'title': 'Edit Folder',
                   "fromSave": fromSave},
                  )


def getMapDetailPage(request, mapID):
    """
    HTML Form of a map
    """
    fromSave = False
    try:
        map_obj = KmlMap.objects.get(pk=mapID)
    except KmlMap.DoesNotExist:
        raise Http404
    except KmlMap.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    # handle post data before loading everything
    if request.method == 'POST':
        # quick and dirty hack to handle kmlFile field when uploading file
        if request.POST['typeChooser'] == 'file' and 'localFile' in request.FILES:
            request.POST['kmlFile'] = request.FILES['localFile'].name
        map_form = MapForm(request.POST, request.FILES, auto_id="id_%s")
        if map_form.is_valid():
            map_obj.name = map_form.cleaned_data['name']
            map_obj.description = map_form.cleaned_data['description']
            map_obj.kmlFile = map_form.cleaned_data['kmlFile']
            if 'localFile' in request.FILES and request.POST['typeChooser'] == 'file':
                map_obj.localFile = request.FILES['localFile']
            map_obj.openable = map_form.cleaned_data['openable']
            map_obj.visible = map_form.cleaned_data['visible']
            map_obj.parent = map_form.cleaned_data['parent']
            map_obj.save()
            fromSave = True
        else:
            if map_obj.kmlFile and not map_obj.localFile:
                kmlChecked = True
            else:
                kmlChecked = False
            return render(request,
                          "EditKmlMap.html",
                          {"mapForm": map_form,
                           "fromSave": False,
                           "kmlChecked": kmlChecked,
                           "error": True,
                           "errorText": "Invalid form entries",
                           "map_obj": map_obj},
                          )

    # return form page with current form data
    map_form = MapForm(instance=map_obj, auto_id="id_%s")
    if map_obj.kmlFile and not map_obj.localFile:
        kmlChecked = True
    else:
        kmlChecked = False
    return render(request,
                  "EditKmlMap.html",
                  {"mapForm": map_form,
                   "kmlChecked": kmlChecked,
                   "fromSave": fromSave,
                   "map_obj": map_obj},
                  )


def getMapLayerJSON(request, layerID):
    mapLayer = MapLayer.objects.get(pk=layerID)
    mapLayer_json = {"title": mapLayer.name,
                     "key": mapLayer.uuid,
                     "selected": mapLayer.visible,
                     "tooltip": mapLayer.description,
                     "data": {"href": request.build_absolute_uri(reverse('mapEditLayer', kwargs={'layerID': mapLayer.uuid})),
                              "parentId": None,
                              "layerData": mapLayer.toDict()
                              },
                     }
    if mapLayer.parent is not None:
        mapLayer_json['data']['parentId'] = mapLayer.parent.uuid
    json_data = json.dumps(mapLayer_json, indent=4, cls=GeoDjangoEncoder)
    resp = HttpResponse(content=json_data,
                        content_type="application/json")
    resp['Content-Disposition'] = 'attachment; filename=%s.json' % mapLayer.name.replace(" ", "_")
    return  resp


def getContentType(the_type):
    """
    Get the content type based on the type name which is in settings
    :param the_type:
    :return:
    """
    if the_type not in settings.XGDS_MAP_SERVER_JS_MAP:
        return None

    the_model_name = settings.XGDS_MAP_SERVER_JS_MAP[the_type]['model']
    splits = the_model_name.split('.')
    content_type = ContentType.objects.get(app_label=splits[0], model=splits[1])
    return content_type


def createMapCollection(request):
    """
    Create and store a map collection record (typically over ajax)
    :param request:
    :return: json response of the collection or error
    """
    if request.POST:
        selected_items = request.POST.getlist(u'selected[]', None)
        if not selected_items:
            return JsonResponse({'error': 'Nothing Selected'}, status=400);
        name = request.POST.get(u'name', None)
        description = request.POST.get(u'description', None)
        # region = # todo get region from map dropdown
        parent_id = request.POST.get(u'parent', 'saved_selections')  # for now we are not asking but just hardcoding, todo fix
        try:
            parent = MapGroup.objects.get(uuid=parent_id)
        except ObjectDoesNotExist:
            print ' could not find map group with uuid %s ' % parent_id
            parent = MapGroup.objects.first()

        mc = MapCollection(name=name,
                           description=description,
                           creation_time=timezone.now(),
                           creator=request.user.username,
                           parent=parent)
        mc.save()

        for i in selected_items:
            # selected_items are type_pk
            splits = i.split('_')
            content_type = getContentType(splits[0])
            if content_type:
                mci = MapCollectionItem(content_type=content_type, object_id=int(splits[1]), container=mc)
                mci.save()
        return JsonResponse(mc.get_tree_json(), encoder=DatetimeJsonEncoder)
    return JsonResponse({'error': 'needs to be POST'}, status=400)


def getMapCollectionJSON(request, mapCollectionID):
    map_collection = MapCollection.objects.get(uuid=mapCollectionID)
    collection = map_collection.mapcollectionitem_set.all()
    map_dict_list = []
    if collection:
        for c in collection:
            map_dict_list.append(c.content_object.toMapDict())
    return JsonResponse(map_dict_list, encoder=DatetimeJsonEncoder, safe=False)  # heretamar


def getMapJsonDict(contents):
    dict_data = []
    if contents:
        for content in contents:
            if inspect.isroutine(content.toMapDict):
                resultDict = content.toMapDict()
            else:
                resultDict = modelToDict(content)
            if resultDict:
                dict_data.append(resultDict)
    json_data = json.dumps(dict_data, indent=4, cls=DatetimeJsonEncoder)
    return json_data


def getMapSearchJSON(request, mapSearchID):
    mapSearch = MapSearch.objects.get(pk=mapSearchID)
    requestLog = mapSearch.requestLog
    json_data = None
    if requestLog:
        rerequest = requestLog.recreateRequest(request)
        view, args, kwargs = resolve(requestLog.path)
        kwargs['request'] = rerequest
        modelClass = str(rerequest.GET['modelClass'])
        left, sep, right = modelClass.rpartition(".")
        contents = searchHandoff(rerequest, left, right, resultsIdentity, True)
        json_data = getMapJsonDict(contents)

    return HttpResponse(content=json_data,
                        content_type="application/json")


def handoffIdentity(request, results):
    return request, results


# def saveSearchWithinMap(request):
#     # TODO this needs to be overhauled because it used to depend on xgds_data
#     """ Save the submitted search as a map layer.
#     This does not include any paging or filtering."""
#     postData = request.GET
#     modelClass = str(postData['modelClass'])
#     left, sep, right = modelClass.rpartition(".")
#
#     reqlog = recordRequest(request)
#     req, results = searchHandoff(request, left, right, handoffIdentity, True)
#     reslog = ResponseLog.create(request=reqlog)
#     reslog.save()
#     recordList(reslog, results)
#
#     # make the search node for the map
#     msearch = MapSearch()
#     msearch.name = postData['mapSearchName']
#     msearch.description = postData['mapSearchDescription']
#     msearch.parent = MapGroup.objects.get(pk=postData['mapSearchParent'])
#     msearch.creator = request.user.username
#     msearch.creation_time = datetime.datetime.now(pytz.utc)
#     msearch.deleted = False
#     msearch.requestLog = reqlog
#     msearch.save()
#
#     return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')


# def searchWithinMap(request):
#     # TODO This needs to be rewritten to not depend on xgds_data
#     """ do a dynamic search within the map, not from a saved search.
#     Note this uses formsets because xgds_data is based around formsets. """
#     postData = request.GET
#     modelClass = str(postData['modelClass'])
#     left, sep, right = modelClass.rpartition(".")
#     contents = searchHandoff(request, left, right, resultsIdentity, True)
#     json_data = getMapJsonDict(contents)
#     return HttpResponse(content=json_data,
#                         content_type="application/json")


def getRootNode():
    roots = MapGroup.objects.filter(parent=None)
    if roots:
        return roots[0]


def getSelectedNodesJSON(request):
    """ json for fancy tree for selected nodes
    """
    node_dict = []
    nodes = MAP_MANAGER.filter(deleted=False, visible=True)
    for node in nodes:
        node_dict.append(node.get_tree_json())
    json_data = json.dumps(node_dict, indent=4, cls=GeoDjangoEncoder)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def getNodesByUuidJSON(request):
    if request.POST:
        uuids = request.POST['uuids'].split('~')
        nodes = MAP_MANAGER.filter(uuid__in=uuids)
        node_dict = []
        for node in nodes:
            node_dict.append(node.get_tree_json())
        json_data = json.dumps(node_dict, indent=4, cls=GeoDjangoEncoder)
        return HttpResponse(content=json_data,
                            content_type="application/json")

@never_cache
def getFancyTreeJSON(request):
    """
    json tree of map groups
    note that this does json for fancytree
    """
    root = getRootNode()
    map_tree_json = addGroupToFancyJSON(root, [])
    json_data = json.dumps(map_tree_json, indent=4, cls=GeoDjangoEncoder)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def addGroupToFancyJSON(group, map_tree_json):
    """
    recursively adds group to json tree
    in the style of fancy tree
    """
    if group is None:
        return  # don't do anything if group is None
    sub_nodes = []
    group_json = group.get_tree_json()
    if not group_json['data']['parentId']:
        # ensure that we don't have conflicts with the base map
        # for the detail page, and that nobody deletes every map
        del group_json['data']['href']
        group_json['expanded'] = True

    nodes = MAP_NODE_MANAGER.filter(parent=group, deleted=False).order_by('name')
    for node in nodes:
        if node.__class__.__name__ == MapGroup.__name__:  # @UndefinedVariable
            sub_nodes.append(addGroupToFancyJSON(node, [])[0])
        else:
            treeJson = node.get_tree_json()
            if treeJson:
                sub_nodes.append(treeJson)
    group_json['children'] = sub_nodes
    map_tree_json.append(group_json)
    return map_tree_json


def deleteGroup(map_group, state):
    """
    recursively deletes maps and groups under a group
    using manual commit control might be a good idea for this
    """
    for node in MAP_NODE_MANAGER.filter(parent=map_group):
        # this is to avoid deleting maps when undeleting
        node.deleted = state
        node.save()
    for group in MapGroup.objects.filter(parent=map_group.uuid):
        deleteGroup(group, state)


def setMapProperties(m, request):
    """
    This is for properties for nodes in map tree
    """
    url = m.getGoogleEarthUrl(request)
    if (url.startswith('/') or
            url.startswith('http://') or
            url.startswith('https://')):
        m.url = url
    else:
        m.url = latestRequestG.build_absolute_uri(url)
    if m.visible:
        m.visibility = 1
    else:
        m.visibility = 0
    try:
        if m.openable:
            m.listItemType = 'check'
        else:
            m.listItemType = 'checkHideChildren'
    except:
        m.listItemType = 'check'


def getMapTreeForKML(request):
    ''' This is left here to support older kml feed views 
    It builds up the tree to be exported to kml
    '''
    groups = MapGroup.objects.filter(deleted=0)
    kmlMaps = KmlMap.objects.filter(deleted=0)
#     links = MapLink.objects.filter(deleted=0)
    layers = MapLayer.objects.filter(deleted=0)
#     tiles = MapTile.objects.filter(deleted=0)

    groupLookup = dict([(group.uuid, group) for group in groups])

    for group in groups:
        group.subGroups = []
        group.subMaps = []
        group.subLinks = []
        group.subLayers = []
#         group.subTiles = []

    for subGroup in groups:
        if subGroup.parent:
            parent = groupLookup[subGroup.parent.uuid]
            parent.subGroups.append(subGroup)

    for subMap in kmlMaps:
        setMapProperties(subMap, request)
        if subMap.parent:
            parent = groupLookup[subMap.parent.uuid]
            parent.subMaps.append(subMap)
    
#     for subLink in links:
#         setMapProperties(subLink)
#         if subLink.parent:
#             parent = groupLookup[subLink.parent.uuid]
#             parent.subLinks.append(subLink)

    for subLayer in layers:
        setMapProperties(subLayer, request)
        if subLayer.parent:
            parent = groupLookup[subLayer.parent.uuid]
            parent.subLayers.append(subLayer)
# 
#     for subTile in tiles:
#         if subTile.parent:
#             parent = groupLookup[subTile.parent.uuid]
#             parent.subTiles.append(subTile)

    rootMapList = [g for g in groups if g.parent is None]
    if len(rootMapList) != 0:
        rootMap = rootMapList[0]
    else:
        rootMap = None
    return rootMap


def printTreeToKml(out, opts, node):
    # url params control whether a document wrapper is needed.
    wrapDocument = opts['wrapDocument']

    out.write("""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.0">
""")
    if wrapDocument:
        out.write("<Document>\n<name>%ss</name>\n\
        <visibility>1</visibility>" % getattr(node, 'name', ''))
    level = 0
    printGroupToKml(out, opts, node, level)
    if wrapDocument:
        out.write('</Document>\n')
    out.write('</kml>\n')


def printGroupToKml(out, opts, node, level=0):
    if (0 == len(getattr(node, 'subGroups', [])))\
       and (0 == len(getattr(node, 'subMaps', [])))\
       and (0 == len(getattr(node, 'subLayers', []))):
        print "Found no maps!!"
        return
    out.write("""
<Folder>
  <name>%(name)s</name>
""" % vars(node))
    for n in node.subGroups:
        printGroupToKml(out, opts, n, level + 1)
    for n in node.subMaps:
        printMapToKml(out, opts, n, level + 1)
    for n in node.subLinks:
        printMapToKml(out, opts, n, level + 1)
    for n in node.subLayers:
        printMapToKml(out, opts, n, level + 1)
    out.write('</Folder>\n')


def printMapToKml(out, opts, node, level=0):
    # turn logo visibility off, as requested in url params.
    if not opts['logo'] and node.isLogo:
        node.visibility = 0

    out.write("""
<NetworkLink>
  <name>%(name)s</name>
  <visibility>%(visibility)s</visibility>\n
  <Style>
    <ListStyle>
      <listItemType>%(listItemType)s</listItemType>
    </ListStyle>
  </Style>
  <Link>
    <href>%(url)s</href>
    <refreshMode>onInterval</refreshMode>
    <refreshInterval>14400</refreshInterval>
  </Link>
</NetworkLink>
""" % vars(node))


def printLinkToKml(out, opts, node, level=0):
    # turn logo visibility off, as requested in url params.
    if not opts['logo'] and node.isLogo:
        node.visibility = 0

    out.write("""
<NetworkLink>
  <name>%(name)s</name>
  <visibility>%(visibility)s</visibility>\n
  <Style>
    <ListStyle>
      <listItemType>%(listItemType)s</listItemType>
    </ListStyle>
  </Style>
  <Link>
    <href>%(url)s</href>
    <refreshMode>onInterval</refreshMode>
    <refreshInterval>14400</refreshInterval>
  </Link>
</NetworkLink>
""" % vars(node))


@never_cache
def getMapFeed(request, feedname):
#     logging.debug('called getMapFeed(%s)', feedname)
    if feedname == '':
        return getMapFeedTop(request)
    if 'all' in feedname:
        return getMapFeedAllForKML(request)
    return None


def getMapFeedTop(request):
    """
    Returns a auto-refreshing KML NetworkLink to the top-level KML index.
    (Basically a wrapper object that points to the result from getMapFeedAllForKML().)

    Options you can control with URL parameters:

    doc: int, default=1

       If 0, allow bare top-level KML NetworkLinks. Otherwise, wrap
       top-level KML NetworkLinks in a KML Document. Some clients (such
       as kmltree.js used in xgds_planner2) can't handle a bare
       NetworkLink. But if the client *can* handle a bare NetworkLink
       (such as the GE desktop client), it's nicer for the user to not
       have to drill down so far to get to the actual content.

    logo: int, default=1

       If 0, force visibility=0 for Map objects that have the 'isLogo'
       property set to True. This overrides their normal visibility
       setting. This is so we can have logos on by default in the GE
       desktop client, but off by default in the planner (which already
       has logos at the top of the web page). Currently, the isLogo
       property is controlled by settings.XGDS_MAP_SERVER_LOGO_PATTERNS.

    """
    m = KmlMap()
    topLevel = settings.XGDS_MAP_SERVER_TOP_LEVEL
    m.name = topLevel['name']
    m.description = topLevel['description']
    # This *has* to be a full URL.  The problem is that the KML file
    # returned by this request lands on the user's filesystem and
    # needs to be able to open up from anywhere and point to the
    # top-level URL for our map feed.  That has to be a fully
    # qualified URL.  The target of that URL is full of relative URL's
    # from there on.  The good news is Django can reverse the view
    # name to get the URL that resolves to that view.
    m.url = (request.build_absolute_uri(insertIntoPath(reverse(getMapFeed,kwargs={'feedname': 'all.kml'}),'rest')))
    
    if settings.GEOCAM_TRACK_URL_PORT:
        m.url = addPort(m.url, settings.GEOCAM_TRACK_URL_PORT)

    # pass on url parameters, if any
    if request.GET:
        m.url += '?' + urllib.urlencode(request.GET)

    m.visibility = 1
    m.listItemType = 'check'
    #logging.debug('top level map kmlFile: %s', m.kmlFile)
    wrapDocument = int(request.GET.get('doc', '1'))
    resp = render(request,
                  'Maps.kml',
                  {'documentName': topLevel['name'],
                   'map': m,
                   'wrapDocument': wrapDocument},
                  content_type='application/vnd.google-earth.kml+xml',
                  )
    resp['Content-Disposition'] = 'attachment; filename=%s' % topLevel['filename']
    return resp


def getMapFeedAllForKML(request):
    """
    Returns the top-level KML index: a folder with network links to all
    active map layers.

    See getMapFeedTop() for a list of URL parameters that affect the output.
    The same parameters are available for getMapFeedAllForKML().
    """
    global latestRequestG
    latestRequestG = request

    opts = {
        'logo': int(request.GET.get('logo', '1')),
        'wrapDocument': int(request.GET.get('doc', '1'))
    }

    root = getMapTreeForKML(request)
    out = StringIO()
    printTreeToKml(out, opts, root)
    s = out.getvalue()
    resp = HttpResponse(content=s,
                        content_type='application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=all.kml'
    return resp

process_tile_email_template = string.Template(
"""

Your map tile $mapTileName has finished processing.

Output: 
$out

Errors:
$err

"""
)
def processTileSuccess(email, mapTile, out, err):
    # TODO we don't know if it worked
    print "PROCESS TILE finished for " + mapTile.name
    print out
    print err
    mapTile.processed = True
    mapTile.initResolutions()
    mapTile.initBounds()
    mapTile.save()
    mail.send_mail(
        "Map tile has finished processing " + mapTile.name,
        process_tile_email_template.substitute({
                    'mapTileName': mapTile.name,
                    'out': out,
                    'err': err
                }),
        settings.SERVER_EMAIL,
        [email],
    )
   
    
def popenAndCall(tileCmd, email, mapTile):
    """
    Runs the given args in a subprocess.Popen, and then calls the function
    onExit when the subprocess completes.
    onExit is a callable object, and popenArgs is a list/tuple of args that 
    would give to subprocess.Popen.
    """
    def runInThread(tileCmd, email, mapTile):
        print "about to kick off " + tileCmd
        proc = Popen([tileCmd], shell=True, stdout=PIPE, stderr=PIPE)
        print "process Started"
        out, err = proc.communicate()
#         proc.wait()
        processTileSuccess(email, mapTile, out, err)
        return
    
    thread = threading.Thread(target=runInThread, args=(tileCmd, email, mapTile))
    thread.start()
    # returns immediately after the thread starts
    return thread

#TODO implement celery
def processTiles(request, uuid, minZoom, maxZoom, resampleMethod, mapTile):
    sourceFiles = []
    sourceFile = mapTile.sourceFile
    outPath = os.path.join(settings.PROJ_ROOT, mapTile.getTilePath()[1:])
    if not os.path.exists(outPath):
        os.makedirs(outPath)
    if sourceFile.name.endswith('.tif') or sourceFile.name.endswith('.tiff'):
        sourceFiles.append(sourceFile.name)
    elif sourceFile.name.endsWith('.zip'):
        fh = sourceFile.open('rb')
        z = zipfile.ZipFile(fh)
        basename = os.path.basename(sourceFile.name)
        unzipPath = os.path.join(settings.XGDS_MAP_SERVER_GEOTIFF_PATH, basename.replace('.', '_'))
        for name in z.namelist():
            if name.endswith('.tif') or name.endswith('.tiff'):
                z.extract(name, unzipPath)
                sourceFiles.append(os.path.join(unzipPath, name))
            fh.close()

    for source in sourceFiles:
        executable = '%s' % os.path.join(settings.PROJ_ROOT, "apps", settings.XGDS_MAP_SERVER_GDAL2TILES)
        zooms = ''
        if settings.XGDS_MAP_SERVER_GDAL2TILES_ZOOM_LEVELS:
            zooms = '-z %d-%d' % (minZoom, maxZoom)
        tileCmd = ('%s %s --resampling=%s %s %s %s'
                   % (executable,
                      zooms,
                      resampleMethod,
                      settings.XGDS_MAP_SERVER_GDAL2TILES_EXTRAS,
                      os.path.join(settings.DATA_ROOT,source),
                      outPath))
        print "Map Tile command: %s" % tileCmd

#         os.chdir(geotiffSubdir)
#             p = Popen(['cd ' + geotiffSubdir, tileCmd], stdout=PIPE, stderr=PIPE) 
#             stdout, stderr = p.communicate()
        popenAndCall(tileCmd, request.user.email, mapTile)
#         p = Popen([tileCmd], stdout=PIPE, stderr=PIPE) 
#             mapTile.processed = True
#             p.terminate()
#             os.system(tileCmd)

def getMapLayerKML(request, layerID):
    if layerID:
        mapLayer = MapLayer.objects.get(pk=layerID)
        result = exportMapLayer(request, mapLayer)
        return wrapKmlForDownload(result, mapLayer.name)

@never_cache
def getMappedObjectsJson(request, object_name, filter=None, range=0, isLive=False, force=False):
    """ Get the object json information to show in table or map views.
    """
    try:
        try:
            THE_OBJECT = LazyGetModelByName(getattr(settings, object_name))
        except:
            THE_OBJECT = LazyGetModelByName(object_name)
        isLive = int(isLive)
        if filter:
            filterDict = buildFilterDict(filter)
        range = int(range)
        if not force and (isLive or range):
            if range==0:
                range = settings.XGDS_MAP_SERVER_DEFAULT_HOURS_RANGE
            now = datetime.datetime.now(pytz.utc)
            yesterday = now - datetime.timedelta(seconds=3600 * range)
            try:
                if not filter:
                    objects = THE_OBJECT.get().objects.filter(creation_time__lte=now).filter(creation_time__gte=yesterday)
                else:
                    allobjects = THE_OBJECT.get().objects.filter(**filterDict)
                    objects = allobjects.filter(creation_time__lte=now).filter(creation_time__gte=yesterday)
            except:
                # may not have a creation_time
                if not filter:
                    objects = THE_OBJECT.get().objects.all()
                else:
                    objects = THE_OBJECT.get().objects.filter(**filterDict)
        elif filter:
            objects = THE_OBJECT.get().objects.filter(**filterDict)
        else:
            objects = THE_OBJECT.get().objects.all()
    except:
        traceback.print_exc()
        return HttpResponse(json.dumps({'error': {'message': 'I think you passed in an invalid filter.',
                                                  'filter': filter}
                                        }),
                            content_type='application/json')

    if objects:
        keepers = []
        for o in objects:
            resultDict = o.toMapDict()
            if resultDict:
                keepers.append(resultDict)
        json_data = json.dumps(keepers, indent=4, cls=DatetimeJsonEncoder)
        return HttpResponse(content=json_data,
                            content_type="application/json")
    else:
        return HttpResponse(json.dumps({'error': {'message': 'No objects found.',
                                                  'filter': filter}
                                        }),
                            content_type='application/json',
                            status=406)


@never_cache
def getLastObjectJson(request, object_name, theFilter=None):
    """ Get the object json information to show in table or map views.
    """
    try:
        try:
            THE_OBJECT = LazyGetModelByName(getattr(settings, object_name))
        except:
            THE_OBJECT = LazyGetModelByName(object_name)
        if theFilter:
            filterDict = buildFilterDict(theFilter)
            theObject = THE_OBJECT.get().objects.filter(**filterDict).last()
        else:
            theObject = THE_OBJECT.get().objects.last()
    except:
        traceback.print_exc()
        return HttpResponse(json.dumps({'error': {'message': 'I think you passed in an invalid filter.',
                                                  'filter': filter}
                                        }),
                            content_type='application/json')

    if theObject:
        resultDict = object.toMapDict()
        if resultDict:
            json_data = json.dumps([resultDict], indent=4, cls=DatetimeJsonEncoder)
            return HttpResponse(content=json_data,
                                content_type="application/json")
    else:
        return HttpResponse(json.dumps({'error': {'message': 'No objects found.',
                                                  'filter': filter}
                                        }),
                            content_type='application/json',
                            status=406)

@never_cache
def getMappedObjectsExtens(request, object_name, extens, today=False):
    """ Get the note json information to show in the fancy tree. This gets all notes in the mapped area, ie map bounded search.
    """
    splits = str(extens).split(',')
    minLon = float(splits[0])
    minLat = float(splits[1])
    maxLon = float(splits[2])
    maxLat = float(splits[3])

    THE_OBJECT = LazyGetModelByName(getattr(settings, object_name))

    queryString = THE_OBJECT.get().getMapBoundedQuery(minLon, minLat, maxLon, maxLat)
    if queryString:
        found_objects = THE_OBJECT.get().objects.raw(queryString)
        if found_objects:
            keepers = []
            for o in found_objects:
                resultDict = o.toMapDict()
                if resultDict:
                    keepers.append(resultDict)
            json_data = json.dumps(keepers, indent=4, cls=DatetimeJsonEncoder)
            return HttpResponse(content=json_data,
                                content_type="application/json")
        return ""


def getFlightPlaybackPage(request, flight_name, templatePath='xgds_map_server/flight_playback.html'):
    flight = FLIGHT_MODEL.get().objects.get(name=flight_name)

    #load time series data
    timeseries_config = []
    if 'xgds_timeseries' in settings.INSTALLED_APPS:
        timeseries_config = get_time_series_classes_metadata(flight_ids=[flight.id])

    modelName = None
    if 'xgds_notes2' in settings.INSTALLED_APPS:
        modelName = LazyGetModelByName(settings.XGDS_NOTES_NOTE_MODEL).get().cls_type()

    searchForms = getSearchForms(modelName, {'flight__id': flight.id})

    return render(request,
                  templatePath,
                  {'help_content_path': 'xgds_map_server/help/flightPlayback.rst',
                   'title': '%s playback' % settings.XGDS_CORE_FLIGHT_MONIKER,
                   'templates': get_handlebars_templates(list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS),
                                                         'XGDS_MAP_SERVER_HANDLEBARS_DIRS'),
                   'modelName': modelName,
                   'searchForms': searchForms,
                   'flight': flight,
                   'timeseries_config': timeseries_config,
                   'forceUserSession': forceUserSession,  # this has to be true to make the role location stuff work
                   'app': 'xgds_map_server/js/replay/mapReplayApp.js'},
                  )


def getGroupFlightPlaybackPage(request, group_flight_name, templatePath='xgds_map_server/group_flight_playback.html',
                               video=True):
    """
    :param request:
    :param group_flight_name: the group flight name
    :param templatePath: the path to where the template for this page is
    :param video: true to include video if it is available, false to skip it
    :return: render the request
    """
    group_flight = GROUP_FLIGHT_MODEL.get().objects.get(name=group_flight_name)

    templates = get_handlebars_templates(list(settings.XGDS_MAP_SERVER_REPLAY_HANDLEBARS_DIRS),
                                         'XGDS_MAP_SERVER_MAP_REPLAY')

    searchForms = getSearchForms(filter={'flight__group': group_flight})

    live = False
    if not group_flight.end_time:
        live = True
        if templatePath == 'xgds_map_server/group_flight_playback.html':
            templatePath = 'xgds_map_server/live_group_flight_playback.html'

        # one assumes there is a start time?
        end_time = group_flight.start_time
        if not end_time:
            end_time = timezone.now()
        end_time = end_time + datetime.timedelta(hours=settings.XGDS_CORE_DEFAULT_GROUP_FLIGHT_DURATION_HOURS)

    else:
        end_time = group_flight.end_time
    context = {'help_content_path': 'xgds_map_server/help/groupFlightPlayback.rst', # TODO IMPLEMENT
               'title': '%s playback' % settings.XGDS_CORE_GROUP_FLIGHT_MONIKER,
               'templates': templates,
               'modelName': None,
               'searchForms': searchForms,
               'group_flight': group_flight,
               'live': live,
               'end_time': end_time.isoformat(),
               'forceUserSession': True,
               'app': 'xgds_map_server/js/replay/groupFlightReplayApp.js'}

    if video and 'xgds_video' in settings.INSTALLED_APPS:
        context_method = getClassByName('xgds_video.views.getVideoContext')
        video_context = context_method(request, group_flight_name)
        video_context.update(context)
        context = video_context

    return render(request,
                  templatePath,
                  context,
                  )


def getSearchPage(request, modelName=None, templatePath='xgds_map_server/mapSearch.html', forceUserSession=False, searchForms=None, filter=None):
    searchModelDict = settings.XGDS_MAP_SERVER_JS_MAP
    if modelName and not searchForms:
        searchForms = getSearchForms(modelName, filter)

    help_title = 'Map Search'
    if modelName:
        help_title += ' ' + modelName
    return render(request,
                  templatePath, 
                  {'modelName': modelName,
                   # TODO make this dynamic depending on the model in question
                   'sseChannelNames': settings.XGDS_SSE_CHANNELS,
                   'help_content_path': 'xgds_map_server/help/mapSearch.rst',
                   'title': help_title,
                   'templates': get_handlebars_templates(list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS), 'XGDS_MAP_SERVER_HANDLEBARS_DIRS'),
                   'searchForms': searchForms,
                   'searchModelDict': searchModelDict,
                   'forceUserSession': forceUserSession,
                   #'saveSearchForm': MapSearchForm(),
                   'app': 'xgds_map_server/js/search/mapViewerSearchApp.js'},
                  )



def getMapBoundedSearchPage(request, templatePath='xgds_map_server/mapBoundedSearch.html', forceUserSession=False, searchForms=None, filter=None):
    searchModelDict = settings.XGDS_MAP_SERVER_JS_MAP
    help_title = 'Map Bounded Search'
    return render(
        request,
        templatePath,
        {
            'sseChannelNames': settings.XGDS_SSE_CHANNELS,
            'help_content_path': 'xgds_map_server/help/mapSearch.rst',
            'title': help_title,
            'templates': get_handlebars_templates(list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS), 'XGDS_MAP_SERVER_HANDLEBARS_DIRS'),
            'searchForms': searchForms,
            'searchModelDict': searchModelDict,
            'forceUserSession': forceUserSession,
            'app': 'xgds_map_server/js/search/mapBoundedViewerSearchApp.js',
        },
    )


def getViewSingleModelPage(request, modelName, modelPK):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    templates = get_handlebars_templates(fullTemplateList, 'XGDS_MAP_SERVER_HANDLEBARS_DIRS')

    return render(request,
                  "xgds_map_server/mapViewSingleModel.html",
                  {'modelName': modelName,
                   'modelPK': modelPK,
                   'templates': templates,
                   'app': 'xgds_map_server/js/search/mapViewerSingleModelApp.js'},
                  )


def getViewMultiModelPage(request, object_names, object_pks=None, filters=None, latest=True):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    templates = get_handlebars_templates(fullTemplateList, 'XGDS_MAP_SERVER_HANDLEBARS_DIRS')
    
    object_urls = [];
    if latest:
        for index, obj in enumerate(object_names):
            object_name = settings.XGDS_MAP_SERVER_JS_MAP[obj]['model']
            if filters:
                url = reverse('xgds_map_server_lastJson_filter', kwargs={'object_name': object_name, 'filter': filters[index]})
            elif object_pks:
                url = reverse('xgds_map_server_lastJson_filter', kwargs={'object_name': object_name, 'filter': 'pk:'+object_pks[index]})
            else:
                url = reverse('xgds_map_server_lastJson', kwargs={'object_name': object_name})
            object_urls.append(str(url))
    else:
        for index, obj in enumerate(object_names):
            object_name = settings.XGDS_MAP_SERVER_JS_MAP[obj]['model']
            if filters:
                url = reverse('xgds_map_server_objectsJson_force', kwargs={'object_name': object_name, 'filter': filters[index]})
            elif object_pks:
                url = reverse('xgds_map_server_objectsJson_force', kwargs={'object_name': object_name, 'filter': 'pk:'+object_pks[index]})
            else:
                url = reverse('xgds_map_server_lastJson', kwargs={'object_name': object_name})
            object_urls.append(str(url))
    return render(request,
                  "xgds_map_server/mapViewMultiModel.html", 
                              {'model_names': object_names,
                               'model_urls' : object_urls,
                               'templates': templates,
                               'app': 'xgds_map_server/js/search/mapViewerMultiModelApp.js'},
                              context_instance=RequestContext(request))


def viewMultiLast(request, mapNames):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    templates = get_handlebars_templates(fullTemplateList, 'XGDS_MAP_SERVER_HANDLEBARS_DIRS')
    
    object_urls = [];
    for obj in mapNames:
        url = reverse('xgds_map_server_lastJson2', kwargs={'mapName': obj})
        object_urls.append(str(url))
    return render(request,
                  "xgds_map_server/mapViewMultiModel.html", 
                  {'model_names': mapNames,
                   'model_urls' : object_urls,
                   'templates': templates,
                   'app': 'xgds_map_server/js/search/mapViewerMultiModelApp.js'},
                  )
    
def lookupModelAndMap(mapName):
    try:
        modelMap = settings.XGDS_MAP_SERVER_JS_MAP[mapName]
        object_name = modelMap['model']
        THE_OBJECT = LazyGetModelByName(getattr(settings, object_name))
    except:
        THE_OBJECT = LazyGetModelByName(object_name)
    return (THE_OBJECT, modelMap)

def lookupForm(form_name):
    try:
        if form_name:
            return getFormByName(form_name)
    except:
        pass
    return None

def viewDictResponse(request, current, modelMap):
    jsonResult = current.toMapList(modelMap['columns'])
    return HttpResponse(json.dumps(jsonResult, cls=DatetimeJsonEncoder),
                        content_type='application/json')

def getObject(request, mapName, currentPK):
    try:
        (THE_OBJECT, modelMap) = lookupModelAndMap(mapName)
        current = THE_OBJECT.get().objects.get(pk=currentPK)
        return viewDictResponse(request, current, modelMap)
    except:
        traceback.print_exc()
        return HttpResponse(json.dumps({'error': {'message': 'Could not find last %s.' % mapName
                                                  }
                                        }),
                            content_type='application/json', status=406)


def getLastObject(request, mapName):
    try:
        (THE_OBJECT, modelMap) = lookupModelAndMap(mapName)
        current = THE_OBJECT.get().objects.last()
        return viewDictResponse(request, current, modelMap)
    except:
        traceback.print_exc()
        return HttpResponse(json.dumps({'error': {'message': 'Could not find last %s.' % mapName
                                                  }
                                        }),
                            content_type='application/json', status=406)
        
def getPrevNextObject(request, currentPK, mapName, which='previous'):
    """ which is previous or next.  This builds up get_next_by_timeName or get_previous_by_timeName"""
    try:
        (THE_OBJECT, modelMap) = lookupModelAndMap(mapName)
        current = THE_OBJECT.get().objects.get(pk=currentPK)
        timeName = modelMap['event_time_field']
        methodName = 'get_%s_by_%s' % (which, timeName)
        methodToCall = getattr(current, methodName)
        try:
            result = methodToCall()
            return viewDictResponse(request, result, modelMap)
        except:
            return HttpResponse(json.dumps({'error': {'message': 'No %s %s' % (which, mapName)
                                                  }
                                        }),
                            content_type='application/json', status=406)
    except:
        traceback.print_exc()
        return HttpResponse(json.dumps({'error': {'message': 'I think you passed in an invalid filter.'
                                                  }
                                        }),
                            content_type='application/json', status=406)

def addLayerFromSelected(request):
    if request.method == 'POST':
        layer_form = MapLayerFromSelectedForm(request.POST)
        if layer_form.is_valid():
            map_layer = MapLayer()
            map_layer.name = layer_form.cleaned_data['name']
            map_layer.description = layer_form.cleaned_data['description']
            map_layer.creator = request.user.first_name + " " +  request.user.last_name
            map_layer.modifier = map_layer.creator
            map_layer.creation_time = datetime.datetime.now(pytz.utc)
            map_layer.modification_time = datetime.datetime.now(pytz.utc)
            map_layer.deleted = False
            map_layer.locked = layer_form.cleaned_data['locked']
            map_layer.visible = layer_form.cleaned_data['visible']
            map_layer.transparency = layer_form.cleaned_data['transparency']
            map_layer.jsonFeatures = layer_form.cleaned_data['jsonFeatures']
            mapGroup = layer_form.cleaned_data['parent']
            map_layer.parent = MapGroup.objects.get(name=mapGroup)
            map_layer.save()
        else:
            return HttpResponse(json.dumps({'failed': 'Form was not valid'}),
                                content_type='application/json', status=500)

        return HttpResponseRedirect(request.build_absolute_uri(reverse('mapEditLayer', kwargs={'layerID': map_layer.uuid})))

    return HttpResponse(json.dumps({'failed': 'Must be a POST but got %s instead' % request.method}),
                        content_type='application/json', status=406)

def copyFeatures(request):
    if not request.is_ajax() or not request.method == 'POST':
        return HttpResponseNotAllowed(['POST'])

    features = json.loads(request.POST.get('features'))
    request.session['copiedFeatures'] = features
    return HttpResponse('ok')


class MapOrderListJson(OrderListJson):
    
    def dispatch(self, request, *args, **kwargs):
        if 'mapName' in kwargs:
            mapName = kwargs.get('mapName', None)
            if mapName in settings.XGDS_MAP_SERVER_JS_MAP:
                modelMap = settings.XGDS_MAP_SERVER_JS_MAP[mapName]
                modelName = modelMap['model']
                self.lookupModel(modelName)
                self.form = lookupForm(modelMap['search_form_class'])
                self.columns = modelMap['columns']
                if 'order_columns' in modelMap:
                    self.order_columns = modelMap['order_columns']
                else:
                    self.order_columns = self.columns
        return super(MapOrderListJson, self).dispatch(request, *args, **kwargs)


def prepOverlayTimeRequest(overlayId, timeString):
    got = GroundOverlayTime.objects.get(uuid=overlayId)
    if timeString:
        theTime = dateparser(timeString).replace(tzinfo=pytz.UTC)
    else:
        theTime = None
    return (got, theTime)


def getOverlayTimeImage(request, overlayId, timeString=None):
    got, theTime = prepOverlayTimeRequest(overlayId, timeString)
    isRest = '/rest/' in str(request.path)
    result = got.getImagePath(theTime, isRest)
    if result:
        return redirect(result)
    else:
        return JsonResponse({'time': None}, status=404);


def getOverlayTime(request, overlayId, timeString=None):
    got, theTime = prepOverlayTimeRequest(overlayId, timeString)
    result = got.getTimeForImage(theTime)
    if result:
        return JsonResponse({'time': result}, encoder=DatetimeJsonEncoder, safe=False);
    else:
        return JsonResponse({'time': None}, status=404);

# Used to export either an entire model's data or a subset of that data.
# Must extend OrderListJson to use its filter functions.
# Responses can timeout due to very large data exports.
class ExportOrderListJson(OrderListJson):

    def cleanAdvancedSearch(self, data):
        field_name = self.model.get_time_bounds_field_name()

        clean_timezone = TimeUtil.clean_timezone(data[field_name + 'zone'])

        kill_timezone = False
        if 'min_' + field_name in data:
            min_time_string = data['min_' + field_name]
            min_time = dateparser(min_time_string)
            min_time = TimeUtil.convert_time_with_zone(min_time, clean_timezone)
            data['min_' + field_name] = min_time
            kill_timezone = True

        if 'max_' + field_name in data:
            max_time_string = data['max_' + field_name]
            max_time = dateparser(max_time_string)
            max_time = TimeUtil.convert_time_with_zone(max_time, clean_timezone)
            data['max_' + field_name] = max_time
            kill_timezone = True

        if kill_timezone:
            del data[field_name + 'zone']
        return data

    def dispatch(self, request, *args, **kwargs):
        if request.method == 'POST':
            self.modelName = request.POST.get('modelName', None)
            self.modelDict = settings.XGDS_MAP_SERVER_JS_MAP[self.modelName]
            rowIds = json.loads(request.POST.get('rowIds', None))
            simpleSearchData = json.loads(request.POST.get('simpleSearchData', None))
            advancedSearchData = json.loads(request.POST.get('advancedSearchData', None))
            filetype = request.POST.get('filetype', None)
            filename = request.POST.get('filename', None)

            self.lookupModel(self.modelDict["model"])

            if rowIds:
                data = self.filterData(rowIds, simpleSearchData, advancedSearchData)
                if (filetype == "CSV"):
                    response = self.exportCSV(data, self.modelDict, filename + ".csv")
                elif (filetype == "KML"):
                    response = self.exportKML(data, self.modelDict, self.modelName, filename + ".kml")
                elif (filetype == "ZIP"):
                    response = self.exportZIP(data, filename + ".zip")
                else:
                    response = HttpResponse(json.dumps({'error': 'unknown file type.'}), content_type='application/json', status=500)

            else:
                return HttpResponse(json.dumps({'error': 'no rows given.'}), content_type='application/json', status=500)

            return response

    # Filter the model's data using the advanced search, simple search, or both
    def filterData(self, rowIds, simpleSearchData, advancedSearchData):
        if rowIds[-1] == "All":
            # We have to refilter the data based on the form
            form_class = getFormByName(self.modelDict['search_form_class'])
            search_form = form_class(advancedSearchData)
            valid = search_form.is_valid()
            if not valid:
                # TODO throw error?
                raise Exception("Form not valid", search_form.errors)

            self.formQueries = search_form.getQueries()

            all = self.model.objects.all()
            data = self.filter_queryset(all)

        else:
            data = self.model.objects.filter(pk__in=rowIds)

        return data

    def exportCSV(self, data, modelDict, filename):
        if data and isinstance(data[0], HasDataFrame):
            dataframe = data[0].mergeDataFrames([d.getDataFrame() for d in data])
            response = HttpResponse(content_type='text/csv')
            dataframe.to_csv(response)

        else:
            pseudo_buffer = PsuedoBuffer()
            writer = csv.writer(pseudo_buffer)
            rows = []

            # unfold the extras
            full_columns = []
            for column in modelDict['columns'][1:]:
                if column != 'extras':
                    full_columns.append(column)
                else:
                    extras = data[0].toMapDict()['extras']
                    for key in extras:
                        full_columns.append(key)

            rows.append(full_columns)
            for obj in data:
                row = []
                map_dict = obj.toMapDict()
                for column in modelDict['columns'][1:]:
                    value = map_dict[column]
                    if column == 'extras':
                        for key, extras_value in value.iteritems():
                            if isinstance(extras_value, basestring):
                                extras_value = extras_value.encode('utf-8')
                            row.append(extras_value)
                    else:
                        if isinstance(value, basestring):
                            value = value.encode('utf-8')
                        row.append(value)
                rows.append(row)

            # Needs to be streaming response because of the large number of rows in some cases (notes + photos especially)
            response = StreamingHttpResponse((writer.writerow(row) for row in rows), content_type='text/csv')

        response['Content-Disposition'] = 'attachment; filename="' + filename + '"'
        return response

    def exportKML(self, data, modelDict, selectedModel, filename):
        # kml = self.model.to_kml()
        k = kml.KML()
        ns = '{http://www.opengis.net/kml/2.2}'

        # Create a KML Document and add it to the KML root object
        d = kml.Document(ns, selectedModel + "_id", filename, 'Placemarks for type ' + selectedModel)
        k.append(d)

        # Create a Placemark with a simple polygon geometry and add it to the folder

        for obj in data:
            if (obj.lat is not None) and (obj.lon is not None):
                description = ''
                if hasattr(obj, 'content'):
                    description = obj.content
                elif hasattr(obj, 'description'):
                    description = obj.description
                placemark = obj.to_kml()
                d.append(placemark)

        response = HttpResponse(k.to_string(prettyprint=True), content_type='application/vnd.google-earth.kml+xml')
        response['Content-Disposition'] = 'attachment; filename="' + filename + '"'
        return response

    def exportZIP(self, data, filename):
        """
        Export a ZIP file that contains all full resolution images inside

        :param data: iterable object containing models
        :param filename: file name of the zip file (not inc. the suffix)
        :return: HttpResponse
        """
        from zipfile import ZipFile
        from tempfile import mkstemp
        from os import close
        from xgds_core.models import HasDownloadableFiles

        # create a temporary zip file to fill in
        temp_file_handle, abs_file_path = mkstemp(suffix=".zip")

        temporary_zip_file = ZipFile(abs_file_path, 'w')
        for data_object in data:
            if isinstance(data_object, HasDownloadableFiles):
                for downloadable_file in data_object.getDownloadableFiles():
                    path_inside_zip = str(downloadable_file)
                    if "/" in path_inside_zip: path_inside_zip = path_inside_zip.split("/")[-1]
                    temporary_zip_file.writestr(path_inside_zip, downloadable_file.read())

        # stop writing to the temporary zip file
        temporary_zip_file.close()

        # write the file as an http response
        with open(abs_file_path, "r") as f:
            response = HttpResponse(f.read(), content_type='application/zip')

        # delete the temporary zip file
        close(temp_file_handle)

        response['Content-Disposition'] = 'attachment; filename="' + filename + '"'

        return response


# This is for the exportSearchResultsToCSV view. Speeds things up a bit and
# allows the use of a StreamingHttpResponse for larger files
class PsuedoBuffer:
    """An object that implements just the write method of the file-like
    interface.
    """
    def write(self, value):
        """Write the value by returning it, instead of storing in a buffer."""
        return value

def getMapServerJSMap(request):
    return JsonResponse(settings.XGDS_MAP_SERVER_JS_MAP)

def mapBoundedSearch(request):
    json_data = json.loads(request.body)

    models = []
    for model_name in json_data['models']:
        models.append(
            LazyGetModelByName(settings.XGDS_MAP_SERVER_JS_MAP[model_name]['model']).get()
        )

    geospatial_constraints = json_data['geography']

    min_lat, max_lat = geospatial_constraints['latitude']['min'],  geospatial_constraints['latitude']['max']
    min_lon, max_lon = geospatial_constraints['longitude']['min'], geospatial_constraints['longitude']['max']

    result = {}

    results_array = []

    for i, m in enumerate(models):
        model_name = str(json_data['models'][i])

        if hasattr(m, 'event_time') and hasattr(m, 'position'):
            result[model_name] = m.objects.filter(
                position__latitude__gte=min_lat,
                position__latitude__lte=max_lat,
                position__longitude__gte=min_lon,
                position__longitude__lte=max_lon,
            ).order_by('-event_time')[:100]
        elif hasattr(m, 'creation_time') and hasattr(m, 'track_position'):
            result[model_name] = m.objects.filter(
                track_position__latitude__gte=min_lat,
                track_position__latitude__lte=max_lat,
                track_position__longitude__gte=min_lon,
                track_position__longitude__lte=max_lon,
            ).order_by('-creation_time')[:100]
        elif hasattr(m, 'acquisition_time') and hasattr(m, 'track_position'):
            result[model_name] = m.objects.filter(
                track_position__latitude__gte=min_lat,
                track_position__latitude__lte=max_lat,
                track_position__longitude__gte=min_lon,
                track_position__longitude__lte=max_lon,
            ).order_by('-acquisition_time')[:100]
        elif hasattr(m, 'collection_time') and hasattr(m, 'track_position'):
            result[model_name] = m.objects.filter(
                track_position__latitude__gte=min_lat,
                track_position__latitude__lte=max_lat,
                track_position__longitude__gte=min_lon,
                track_position__longitude__lte=max_lon,
            ).order_by('-collection_time')[:100]
        else:
            assert False, dir(m)

        result[model_name] = [r.getBroadcastData() for r in result[model_name]]

        for j, instance in enumerate(result[model_name]):
            instance["type"] = model_name
            instance["show_on_map"] = True

            if 'thumbnail_image_url' in instance:
                instance['content'] = instance['thumbnail_image_url']

            if 'event_time' in instance:
                instance['time'] = instance['event_time']
            elif 'acquisition_time' in instance:
                instance['time'] = instance['acquisition_time']
            elif 'collection_time' in instance:
                instance['time'] = instance['collection_time']

            if 'tag_names' in instance:
                instance['tags'] = instance['tag_names']

            results_array.append(instance)


    return JsonResponse({
            'results': results_array,
            'columns': [{'title': 'Type'}, {'title':'Time'}, {'title':'Content'}, {'title':'Tags'}]
        })
