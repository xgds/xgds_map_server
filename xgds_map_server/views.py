# __BEGIN_LICENSE__
#  Copyright (c) 2015, United States Government, as represented by the
#  Administrator of the National Aeronautics and Space Administration.
#  All rights reserved.
#
#  The xGDS platform is licensed under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with the License
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0.
#
#  Unless required by applicable law or agreed to in writing, software distributed
#  under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
#  CONDITIONS OF ANY KIND, either express or implied. See the License for the
#  specific language governing permissions and limitations under the License.
# __END_LICENSE__

# Create your views here.

from cStringIO import StringIO
import json
import re
import glob
import logging
import urllib
import os
import datetime

from django.views.decorators.csrf import csrf_protect
from django.contrib.staticfiles.storage import staticfiles_storage
from django.shortcuts import render_to_response
from django.http import HttpResponse, Http404
from django.http import HttpResponseServerError
from django.http import HttpResponseRedirect
from django.http import HttpResponseBadRequest
from django.http import HttpResponseNotFound
from django.template import RequestContext
from django.core.urlresolvers import reverse
from django.db import transaction
from django.views.decorators.cache import never_cache
from django.contrib.gis.geos import Point as geosPoint
from django.contrib.gis.geos import LineString as geosLineString
from django.contrib.gis.geos import Polygon as geosPolygon

from xgds_map_server import settings
from xgds_map_server.models import KmlMap, MapGroup, MapLayer, MAP_NODE_MANAGER
from xgds_map_server.models import Polygon, LineString, Point, Drawing, GroundOverlay
from xgds_map_server.forms import MapForm, MapGroupForm, MapLayerForm
from geocamUtil.geoEncoder import GeoDjangoEncoder

# pylint: disable=E1101,R0911

latestRequestG = None

HANDLEBARS_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates/handlebars')
_template_cache = None


def get_handlebars_templates(inp=HANDLEBARS_TEMPLATES_DIR):
    global _template_cache
    if settings.XGDS_MAP_SERVER_TEMPLATE_DEBUG or not _template_cache:
        templates = {}
        for template_file in glob.glob(os.path.join(inp, '*.handlebars')):
            with open(template_file, 'r') as infile:
                template_name = os.path.splitext(os.path.basename(template_file))[0]
                templates[template_name] = infile.read()
        _template_cache = templates
    return _template_cache


def get_map_tree_templates(inp=HANDLEBARS_TEMPLATES_DIR):
    fullCache = get_handlebars_templates()
    filenames = ['layer-tree']
    reducedCache = {}
    for template_file in filenames:
        reducedCache[template_file] = fullCache[template_file]
    return reducedCache


def getMapServerIndexPage(request):
    """
    HTML list of maps with description and links to individual maps,
    and a link to the kml feed
    """
    mapList = KmlMap.objects.all().select_related('parent').order_by('name')
    for m in mapList:
        if (m.kmlFile.startswith('/') or
                m.kmlFile.startswith('http://') or
                m.kmlFile.startswith('https://')):
            url = m.kmlFile
        else:
            url = settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + m.kmlFile
        m.url = request.build_absolute_uri(url)
        logging.debug('kmlFile=%s url=%s', m.kmlFile, m.url)
        if m.openable:
            m.openable = 'yes'
        else:
            m.openable = 'no'
        if m.visible:
            m.visible = 'yes'
        else:
            m.visible = 'no'
        if m.parent is None:
            m.groupname = ''
        else:
            m.groupname = m.parent.name
    feedUrl = (request.build_absolute_uri(reverse(getMapFeed, kwargs={'feedname': ''}))) + '?doc=0'
    filename = settings.XGDS_MAP_SERVER_TOP_LEVEL['filename']
    templates = get_map_tree_templates()
    return render_to_response('MapServerLandingPage.html',
                              {'mapList': mapList,
                               'feedUrl': feedUrl,
                               'filename': filename,
                               'settings': settings,
                               'templates': templates},
                              context_instance=RequestContext(request))


def getMapTreePage(request):
    """
    HTML tree of maps using fancytree
    """
    jsonMapTreeUrl = (request.build_absolute_uri(reverse('mapTreeJSON')))
    addLayerUrl = (request.build_absolute_uri(reverse('addLayer')))
    addKmlUrl = (request.build_absolute_uri(reverse('addKml')))
    addFolderUrl = (request.build_absolute_uri(reverse('folderAdd')))
    deletedMapsUrl = (request.build_absolute_uri(reverse('deletedMaps')))
    moveNodeURL = (request.build_absolute_uri(reverse('moveNode')))
    setVisibilityURL = (request.build_absolute_uri(reverse('setNodeVisibility')))
    return render_to_response("MapTree.html",
                              {'JSONMapTreeURL': jsonMapTreeUrl,
                               'addKmlUrl': addKmlUrl,
                               'addLayerUrl': addLayerUrl,
                               'addFolderUrl': addFolderUrl,
                               'deletedMapsUrl': deletedMapsUrl,
                               'moveNodeURL': moveNodeURL,
                               'setVisibilityURL': setVisibilityURL},
                              context_instance=RequestContext(request))


def getMapEditorPage(request, layerID=None):
    templates = get_handlebars_templates()
    if layerID:
        mapLayer = MapLayer.objects.get(uuid=layerID)
        mapLayerDict = mapLayer.toDict()
    else:
        return HttpResponse(json.dumps({'error': 'Map layer is not valid'}), content_type='application/json')
    return render_to_response("MapEditor.html",
        RequestContext(request, {'templates': templates,
                                 'settings': settings,
                                 'saveUrl': reverse('featureJsonToDB'),
                                 'mapLayerDict': json.dumps(mapLayerDict, indent=4, cls=GeoDjangoEncoder)
                                 }),
        )


def createGeosObjectFromCoords(data, type):
    """
    Reference: http://stackoverflow.com/questions/1504288/adding-a-polygon-directly-in-geodjango-postgis
    
    """
    feature = None
    if type == 'Point':
        feature = Point()
        feature.point = geosPoint(data['point'])
    elif type == 'Polygon':
        feature = Polygon()
        feature.polygon = geosPolygon(['polygon'])
    elif type == 'LineString':
        feature = LineString()
        feature.lineString = geosLineString(['lineString'])
    elif type == 'Drawing':
        feature = Drawing()
    elif type == 'GroundOverlay':
        feature = GroundOverlay()
    else:
        print "invalid feature type specified in json"


def saveFeatureJsonToDB(request):
    """
    Read and write feature JSON.
    jsonFeatureId is ignored. It's for human-readability in the URL
    
    Side note: to initialize a GeoDjango polygon object
        Coordinate dimensions are separated by spaces
        Coordinate pairs (or tuples) are separated by commas
        Coordinate ordering is (x, y) -- that is (lon, lat)
    """
    if request.method == "POST":
        data = json.loads(request.body)
        print "request"
        print request
        print "request.body"
        print request.body
        # use the data to create a feature object.
        type = data['type']
        feature = createGeosObjectFromCoords(data, type)
        feature.mapLayer = data['mapLayerId']
        feature.name = data['name']
        feature.popup = data['popup']
        feature.visible = data['visible']
        feature.showLabel = data['showLabel']
        feature.description = data['description']
        feature.save() 
        return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')
    return HttpResponse(json.dumps({'failed': 'Must be a POST but got %s instead' % request.method }), content_type='application/json')


def moveNode(request):
    if request.method == 'POST':
        try:
            nodeUuid = request.POST['nodeUuid']
            parentUuid = request.POST['parentUuid']
            parent = MapGroup.objects.get(uuid=parentUuid)
            node = MAP_NODE_MANAGER.get(uuid=nodeUuid)
            node.parent = parent
            node.save()
            return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')
        except:
            return HttpResponse(json.dumps({'error': 'Move Failed'}), content_type='application/json')
    return HttpResponse(json.dumps({'failed': 'Must be a POST'}), content_type='application/json')


def setNodeVisibility(request):
    if request.method == 'POST':
        try:
            nodeUuid = request.POST['nodeUuid']
            visible = request.POST['visible']
            node = MAP_NODE_MANAGER.get(uuid=nodeUuid)
            node.visible = visible
            node.save()
            return HttpResponse(json.dumps({'success': 'true'}), content_type='application/json')
        except:
            return HttpResponse(json.dumps({'error': 'Set Visibility Failed'}), content_type='application/json')
    return HttpResponse(json.dumps({'failed': 'Must be a POST'}), content_type='application/json')


def getAddKmlPage(request):
    """
    HTML view to create new map
    """
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))

    if request.method == 'POST':
        # quick and dirty hack to handle kmlFile field if user
        # uploads file
        if request.POST['typeChooser'] == 'file' and 'localFile' in request.FILES:
            request.POST['kmlFile'] = request.FILES['localFile'].name
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
            return render_to_response("AddKml.html",
                                      {'mapTreeUrl': mapTreeUrl,
                                       'mapForm': map_form,
                                       'error': True,
                                       'errorText': 'Invalid form entries'},
                                      context_instance=RequestContext(request))
        return HttpResponseRedirect(mapTreeUrl)

    else:
        map_form = MapForm()
        return render_to_response("AddKml.html",
                                  {'mapTreeUrl': mapTreeUrl,
                                   'mapForm': map_form},
                                  context_instance=RequestContext(request))


def getAddLayerPage(request):
    """
    HTML view to create a new layer
    """
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    if request.method == 'POST':
        layer_form = MapLayerForm(request.POST)
        if layer_form.is_valid():
            map_layer = MapLayer()
            map_layer.name = layer_form.cleaned_data['name']
            map_layer.description = layer_form.cleaned_data['description']
            map_layer.creator = request.user.username
            map_layer.modifier = request.user.username
            map_layer.creation_time = datetime.datetime.now()
            map_layer.modification_time = datetime.datetime.now()
            map_layer.deleted = False
            map_layer.locked = layer_form.cleaned_data['locked']
            map_layer.visible = layer_form.cleaned_data['visible']
            mapGroup = layer_form.cleaned_data['parent']  
            map_layer.parent = MapGroup.objects.get(name=mapGroup)
            map_layer.save()
        else: 
            return render_to_response("AddLayer.html",
                                  {'mapTreeUrl': mapTreeUrl,
                                   'layerForm': layer_form,
                                   'error': True},
                                   context_instance=RequestContext(request))
        return HttpResponseRedirect(mapTreeUrl)
    else:
        layer_form = MapLayerForm()
        return render_to_response("AddLayer.html",
                      {'mapTreeUrl': mapTreeUrl,
                       'layerForm': layer_form,
                       'error': False},
                       context_instance=RequestContext(request))


def getAddFolderPage(request):
    """
    HTML view to create new folder (group)
    """
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))

    if request.method == 'POST':
        group_form = MapGroupForm(request.POST)
        if group_form.is_valid():
            map_group = MapGroup()
            map_group.name = group_form.cleaned_data['name']
            map_group.description = group_form.cleaned_data['description']
            map_group.parent = group_form.cleaned_data['parent']
            map_group.save()
        else:
            return render_to_response("AddFolder.html",
                                      {'groupForm': group_form,
                                       'error': True,
                                       'errorText': "Invalid form entries"},
                                      context_instance=RequestContext(request))
        return HttpResponseRedirect(mapTreeUrl)

    else:
        group_form = MapGroupForm()
        return render_to_response("AddFolder.html",
                                  {'mapTreeUrl': mapTreeUrl,
                                   'groupForm': group_form,
                                   'error': False},
                                  context_instance=RequestContext(request))


@csrf_protect
def getDeleteMapPage(request, mapID):
    """
    HTML view to delete map
    """
    mapDetailUrl = (request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID': mapID})))
    mapTreeUrl = (request.build_absolute_uri(reverse('mapTree')))
    deletedMapsUrl = (request.build_absolute_uri(reverse('deletedMaps')))

    try:
        map_obj = KmlMap.objects.get(uuid=mapID)
    except KmlMap.DoesNotExist:
        raise Http404
    except KmlMap.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    if request.method == 'POST':
        # csrf protection means this has to happen
        # in a relatively intentional way
        # switch the state of the map (undelete and delete)
        map_obj.deleted = not map_obj.deleted
        map_obj.save()
        return HttpResponseRedirect(mapTreeUrl)

    else:
        return render_to_response("MapDelete.html",
                                  {'mapTreeUrl': mapTreeUrl,
                                   'mapDetailUrl': mapDetailUrl,
                                   'deletedMapsUrl': deletedMapsUrl,
                                   'mapObj': map_obj},
                                  context_instance=RequestContext(request))


def getDeletedMapsPage(request):
    """
    HTML list of deleted maps that can be un-deleted
    """
    baseUrl = request.build_absolute_uri(reverse("xgds_map_server_index"))
    mapTreeUrl = request.build_absolute_uri(reverse("mapTree"))

    maps = KmlMap.objects.filter(deleted=True)
    folders = MapGroup.objects.filter(deleted=True)
    return render_to_response("DeletedMaps.html",
                              {'mapDeleteUrl': baseUrl + 'delete',
                               'mapTreeUrl': mapTreeUrl,
                               'folderDeleteUrl': baseUrl + 'folderDelete',
                               'maps': maps,
                               'folders': folders},
                              context_instance=RequestContext(request))


@csrf_protect
def getDeleteFolderPage(request, groupID):
    """
    HTML view to delete a folder
    """
    folderDetailUrl = (request.build_absolute_uri
                       (reverse('folderDetail',
                                kwargs={'groupID': groupID})))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))

    try:
        map_group = MapGroup.objects.get(uuid=groupID)
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
        return HttpResponseRedirect(mapTreeUrl)

    else:
        # either there's some transaction I'm not aware of happening,
        # or transaction just expects a call regardless of any database activity
        transaction.rollback()
        return render_to_response("FolderDelete.html",
                                  {'mapTreeUrl': mapTreeUrl,
                                   'folderDetailUrl': folderDetailUrl,
                                   'groupObj': map_group,
                                   'deletedMapsUrl': deletedMapsUrl},
                                  context_instance=RequestContext(request))


def getFolderDetailPage(request, groupID):
    """
    HTML Form of a map group (folder)
    """
    folderDetailUrl = (request.build_absolute_uri
                       (reverse('folderDetail',
                                kwargs={'groupID': groupID})))
    folderDeleteUrl = (request.build_absolute_uri
                       (reverse('folderDelete',
                                kwargs={'groupID': groupID})))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))
    fromSave = False

    try:
        map_group = MapGroup.objects.get(uuid=groupID)
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
            return render_to_response("FolderDetail.html",
                                      {"folderDetailUrl": folderDetailUrl,
                                       "mapTreeUrl": mapTreeUrl,
                                       "deletedMapsUrl": deletedMapsUrl,
                                       "groupForm": group_form,
                                       "group_obj": map_group,
                                       "fromSave": fromSave,
                                       "folderDeleteUrl": folderDeleteUrl,
                                       "error": True,
                                       "errorText": "Invalid form entries"},
                                      context_instance=RequestContext(request))

    # return form page with current data
    group_form = MapGroupForm(instance=map_group)
    return render_to_response("FolderDetail.html",
                              {"folderDetailUrl": folderDetailUrl,
                               "deletedMapsUrl": deletedMapsUrl,
                               "mapTreeUrl": mapTreeUrl,
                               "groupForm": group_form,
                               "group_obj": map_group,
                               "fromSave": fromSave,
                               "folderDeleteUrl": folderDeleteUrl},
                              context_instance=RequestContext(request))


def getMapDetailPage(request, mapID):
    """
    HTML Form of a map
    """
    mapDetailUrl = (request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID': mapID})))
    mapDeleteUrl = (request.build_absolute_uri(reverse('mapDelete', kwargs={'mapID': mapID})))
    deletedMapsUrl = (request.build_absolute_uri(reverse('deletedMaps')))
    mapTreeUrl = (request.build_absolute_uri(reverse('mapTree')))
    fromSave = False
    try:
        map_obj = KmlMap.objects.get(uuid=mapID)
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
            return render_to_response("MapDetail.html",
                                      {"mapDetailUrl": mapDetailUrl,
                                       "mapTreeUrl": mapTreeUrl,
                                       "deletedMapsUrl": deletedMapsUrl,
                                       "mapForm": map_form,
                                       "fromSave": False,
                                       "kmlChecked": kmlChecked,
                                       "mapDeleteUrl": mapDeleteUrl,
                                       "error": True,
                                       "errorText": "Invalid form entries",
                                       "map_obj": map_obj},
                                      context_instance=RequestContext(request))

    # return form page with current form data
    map_form = MapForm(instance=map_obj, auto_id="id_%s")
    if map_obj.kmlFile and not map_obj.localFile:
        kmlChecked = True
    else:
        kmlChecked = False
    return render_to_response("MapDetail.html",
                              {"mapDetailUrl": mapDetailUrl,
                               "mapTreeUrl": mapTreeUrl,
                               "deletedMapsUrl": deletedMapsUrl,
                               "mapForm": map_form,
                               "kmlChecked": kmlChecked,
                               "fromSave": fromSave,
                               "mapDeleteUrl": mapDeleteUrl,
                               "map_obj": map_obj},
                              context_instance=RequestContext(request))


@never_cache
def getMapTreeJSON(request):
    """
    json tree of map groups
    note that this does json for jstree
    """
    global latestRequestG
    latestRequestG = request
    map_tree = getMapTree()
    map_tree_json = []
    addGroupToJSON(map_tree, map_tree_json, request)
    json_data = json.dumps(map_tree_json, indent=4)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def addGroupToJSON(group, map_tree, request):
    """
    recursively adds group to json tree
    in the style of jstree
    """
    if group is None:
        return  # don't do anything if group is None
    group_json = {
        "data": {
            "text": group.name,
            "title": group.name,
            "attr": {
                "href": request.build_absolute_uri(reverse('folderDetail', kwargs={'groupID': group.uuid}))
            }
        },
        "metadata": {
            "id": group.uuid,
            "description": group.description,
            "parentId": None,
            "type": "folder"
        },
        "state": "open",
    }
    sub_folders = []
    sub_maps = []
    if group.uuid == 1:
        # ensure that we don't have conflicts with the base map
        # for the detail page, and that nobody deletes every map
        del group_json['data']['attr']['href']
    if group.parent is not None:
        group_json['metadata']['parentId'] = group.parent.uuid
    for map_group in getattr(group, 'subGroups', []):
        if map_group.deleted:
            continue
        addGroupToJSON(map_group, sub_folders, request)
    for group_map in getattr(group, 'subMaps', []):
        if group_map.deleted:
            continue
        group_map_json = {
            "data": {
                "text": group_map.name,
                "title": group_map.name,
                "attr": {
                    "href": request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID': group_map.uuid}))
                }
            },
            "metadata": {
                "id": group_map.uuid,
                "description": group_map.description,
                "kmlFile": group_map.kmlFile,
                "openable": group_map.openable,
                "visible": group_map.visible,
                "parentId": None,
                "type": "map"
            },
            "state": "leaf",
            "icon": settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + "icons/globe.png"
        }
        if group_map.parent is not None:
            group_map_json['metadata']['parentId'] = group_map.parent.uuid
        try:  # as far as I know, there is no better way to do this
            group_map_json['metadata']['localFile'] = request.build_absolute_uri(group_map.localFile.url)
        except ValueError:  # this means there is no file associated with localFile
            pass
        sub_maps.append(group_map_json)
    if len(sub_folders) == 0 and len(sub_maps) == 0:
        group_json['state'] = 'leaf'
    else:
        sub_folders.sort(key=lambda x: x['data']['title'].lower())
        sub_maps.sort(key=lambda x: x['data']['title'].lower())
        group_json['children'] = sub_folders + sub_maps
    map_tree.append(group_json)


@never_cache
def getFancyTreeJSON(request):
    """
    json tree of map groups
    note that this does json for fancytree
    """
    global latestRequestG
    latestRequestG = request
    map_tree = getMapTree()
    map_tree_json = []
    addGroupToFancyJSON(map_tree, map_tree_json, request, True)
    json_data = json.dumps(map_tree_json, indent=4, cls=GeoDjangoEncoder)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def addGroupToFancyJSON(group, map_tree, request, expanded=False):
    """
    recursively adds group to json tree
    in the style of jstree
    """
    if group is None:
        return  # don't do anything if group is None
    group_json = {"title": group.name,
                  "key": group.uuid,
                  "folder": True,
                  "tooltip": group.description,
                  "expanded": expanded,
                  "data": {"href": request.build_absolute_uri(reverse('folderDetail', kwargs={'groupID': group.uuid})),
                           "parentId": None,
                           },
                  }
    sub_folders = []
    sub_maps = []
    sub_layers = []
    if group.uuid == 1:
        # ensure that we don't have conflicts with the base map
        # for the detail page, and that nobody deletes every map
        del group_json['data']['href']
    if group.parent is not None:
        group_json['data']['parentId'] = group.parent.uuid
    for map_group in getattr(group, 'subGroups', []):
        if map_group.deleted:
            continue
        addGroupToFancyJSON(map_group, sub_folders, request)
    for group_map in getattr(group, 'subMaps', []):
        if group_map.deleted:
            continue
        group_map_json = {"title": group_map.name,
                          "key": group_map.uuid,
                          "selected": group_map.visible,
                          "tooltip": group_map.description,
                          "extraClasses": "kmlFile",
                          "data": {"href": request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID': group_map.uuid})),
                                   "parentId": None,
                                   "kmlFile": settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + group_map.kmlFile,
                                   "openable": group_map.openable,
                                   },
                          }
        if group_map.parent is not None:
            group_map_json['data']['parentId'] = group_map.parent.uuid
        try:  # as far as I know, there is no better way to do this
            group_map_json['data']['localFile'] = request.build_absolute_uri(group_map.localFile.url)
        except ValueError:  # this means there is no file associated with localFile
            pass
        sub_maps.append(group_map_json)
    for group_layer in getattr(group, 'subLayers', []):
        if group_layer.deleted:
            continue
        group_layer_json = {"title": group_layer.name,
                            "key": group_layer.uuid,
                            "selected": group_layer.visible,
                            "tooltip": group_layer.description,
                            "data": {"href": request.build_absolute_uri(reverse('editLayer', kwargs={'layerID': group_layer.uuid})),
                                     "parentId": None,
                                     "layerData": group_layer.toDict()
                                     },
                            }
        if group_layer.parent is not None:
            group_layer_json['data']['parentId'] = group_layer.parent.uuid
        sub_layers.append(group_layer_json)
    if len(sub_folders) > 0 or len(sub_maps) > 0 or len(sub_layers) > 0:
        sub_folders.sort(key=lambda x: x['title'].lower())
        sub_maps.sort(key=lambda x: x['title'].lower())
        sub_layers.sort(key=lambda x: x['title'].lower())
        group_json['children'] = sub_folders + sub_maps + sub_layers
    map_tree.append(group_json)


def deleteGroup(map_group, state):
    """
    recursively deletes maps and groups under a group
    using manual commit control might be a good idea for this
    """
    for map_obj in KmlMap.objects.filter(parentId=map_group.uuid):
        # this is to avoid deleting maps when undeleting
        map_obj.deleted = state
        map_obj.save()
    for group in MapGroup.objects.filter(parentId=map_group.uuid):
        deleteGroup(group, state)


def setMapProperties(m):
    if (m.kmlFile.startswith('/') or
            m.kmlFile.startswith('http://') or
            m.kmlFile.startswith('https://')):
        m.url = latestRequestG.build_absolute_uri(m.kmlFile)
    else:
        m.url = latestRequestG.build_absolute_uri(settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + m.kmlFile)
    if m.openable:
        m.listItemType = 'check'
    else:
        m.listItemType = 'checkHideChildren'
    if m.visible:
        m.visibility = 1
    else:
        m.visibility = 0
    # logging.debug('kml file is %s', m.kmlFile)
    # logging.debug('url is %s', m.url)
    # logging.debug('visibility is %s', m.visibility)
    # logging.debug('listItemType is %s', m.listItemType)


def getMapTree():
    groups = MapGroup.objects.filter(deleted=0)
    kmlMaps = KmlMap.objects.filter(deleted=0)
    layers = MapLayer.objects.filter(deleted=0)

    groupLookup = dict([(group.uuid, group) for group in groups])

    for m in kmlMaps:
        setMapProperties(m)

    for group in groups:
        group.subGroups = []
        group.subMaps = []
        group.subLayers = []

    for subGroup in groups:
        if subGroup.parent:
            parent = groupLookup[subGroup.parent.uuid]
            parent.subGroups.append(subGroup)

    for subMap in kmlMaps:
        if subMap.parent:
            parent = groupLookup[subMap.parent.uuid]
            parent.subMaps.append(subMap)

    for subLayer in layers:
        if subLayer.parent:
            parent = groupLookup[subLayer.parent.uuid]
            parent.subLayers.append(subLayer)

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
       and (0 == len(getattr(node, 'subMaps', []))):
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


@never_cache
def getMapFeed(request, feedname):
    logging.debug('called getMapFeed(%s)', feedname)
    if feedname == '':
        return getMapFeedTop(request)
    if 'all' in feedname:
        return getMapFeedAll(request)
    return None


def getMapFeedTop(request):
    """
    Returns a auto-refreshing KML NetworkLink to the top-level KML index.
    (Basically a wrapper object that points to the result from getMapFeedAll().)

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
    m.url = (request
             .build_absolute_uri
             (reverse(getMapFeed,
                      kwargs={'feedname': 'all.kml'})))

    # pass on url parameters, if any
    if request.GET:
        m.url += '?' + urllib.urlencode(request.GET)

    m.visibility = 1
    m.listItemType = 'check'
    logging.debug('top level map kmlFile: %s', m.kmlFile)
    wrapDocument = int(request.GET.get('doc', '1'))
    resp = render_to_response('Maps.kml',
                              {'documentName': topLevel['name'],
                               'map': m,
                               'wrapDocument': wrapDocument},
                              content_type='application/vnd.google-earth.kml+xml',
                              context_instance=RequestContext(request))
    resp['Content-Disposition'] = 'attachment; filename=%s' % topLevel['filename']
    return resp


def getMapFeedAll(request):
    """
    Returns the top-level KML index: a folder with network links to all
    active map layers.

    See getMapFeedTop() for a list of URL parameters that affect the output.
    The same parameters are available for getMapFeedAll().
    """
    global latestRequestG
    latestRequestG = request

    opts = {
        'logo': int(request.GET.get('logo', '1')),
        'wrapDocument': int(request.GET.get('doc', '1'))
    }

    root = getMapTree()
    out = StringIO()
    printTreeToKml(out, opts, root)
    s = out.getvalue()
    resp = HttpResponse(content=s,
                        content_type='application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=all.kml'
    return resp
