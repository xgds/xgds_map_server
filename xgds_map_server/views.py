# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Create your views here.

import os
import sys
from cStringIO import StringIO
import json
import re

from django.views.decorators.csrf import csrf_protect
from django.shortcuts import render_to_response
from django.http import HttpResponse, Http404
from django.http import HttpResponseServerError
from django.http import HttpResponseRedirect
from django.http import HttpResponseBadRequest
from django.http import HttpResponseGone
from django.template import RequestContext
from django.core.urlresolvers import reverse
from django.db import transaction

from xgds_map_server import settings
from xgds_map_server.models import Map, MapGroup
from xgds_map_server.forms import MapForm, MapGroupForm

# pylint: disable=E1101,R0911

latestRequestG = None


def getMapListPage(request):
    """
    HTML list of maps with description and links to individual maps,
    and a link to the kml feed
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapList = Map.objects.all().select_related('parentId').order_by('name')
    for m in mapList:
        if (m.kmlFile.startswith('/') or
                m.kmlFile.startswith('http://') or
                m.kmlFile.startswith('https://')):
            url = m.kmlFile
        else:
            url = settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + m.kmlFile
        m.url = request.build_absolute_uri(url)
        print >> sys.stderr, 'kmlFile=%s url=%s' % (m.kmlFile, m.url)
        if m.openable:
            m.openable = 'yes'
        else:
            m.openable = 'no'
        if m.visible:
            m.visible = 'yes'
        else:
            m.visible = 'no'
        if m.parentId is None:
            m.groupname = ''
        else:
            m.groupname = m.parentId.name
    feedUrl = (request
               .build_absolute_uri
               (reverse(getMapFeed, kwargs={'feedname': ''})))
    print 'serving %d maps to MapList.html' % len(mapList)
    return render_to_response('MapList.html',
                              {'mapList': mapList,
                               'feedUrl': feedUrl,
                               'projectIconUrl': projectIconUrl,
                               'xgdsIconUrl': xgdsIconUrl},
                              context_instance=RequestContext(request))


def getMapTreePage(request):
    """
    HTML tree of maps using jstree
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    jsonMapTreeUrl = (request.build_absolute_uri
                      (reverse('mapListJSON')))
    addMapUrl = (request.build_absolute_uri
                 (reverse('addMap')))
    addFolderUrl = (request.build_absolute_uri
                    (reverse('folderAdd')))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))
    jsonMoveUrl = (request.build_absolute_uri
                   (reverse('jsonMove')))
    # numDeletedMaps = len(Map.objects.filter(deleted=True)) +\
    # len(MapGroup.objects.filter(deleted=True))
    return render_to_response("MapTree.html",
                              {'projectIconUrl': projectIconUrl,
                               'xgdsIconUrl': xgdsIconUrl,
                               'JSONMapTreeURL': jsonMapTreeUrl,
                               'addMapUrl': addMapUrl,
                               'addFolderUrl': addFolderUrl,
                               'deletedMapsUrl': deletedMapsUrl,
                               # 'numDeletedMaps': numDeletedMaps,
                               'JSONMoveURL': jsonMoveUrl},
                              context_instance=RequestContext(request))


def handleJSONMove(request):
    """
    JSON-accepting url that moves maps/folders around
    """
    if ('move' not in request.REQUEST or
            'move_type' not in request.REQUEST or
            'to' not in request.REQUEST or
            'to_type' not in request.REQUEST):
        return HttpResponseBadRequest()

    if request.REQUEST['move_type'] == 'map':
        try:
            move = Map.objects.get(id=request.REQUEST['move'])
        except Map.DoesNotExist:
            return HttpResponseGone()
    elif request.REQUEST['move_type'] == 'folder':
        try:
            move = MapGroup.objects.get(id=request.REQUEST['move'])
        except MapGroup.DoesNotExist:
            return HttpResponseGone()
    else:
        print "move-type is not map or folder"
        return HttpResponseBadRequest()

    if request.REQUEST['to_type'] != 'folder':
        print "To-type is not folder"
        return HttpResponseBadRequest()

    try:
        to = MapGroup.objects.get(id=request.REQUEST['to'])
    except MapGroup.DoesNotExist():
        return HttpResponseGone()

    move.parentId = to
    move.save()
    return HttpResponse()  # empty response with 200 means success


def getAddMapPage(request):
    """
    HTML view to create new map
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
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
            map_obj = Map()
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
            map_obj.parentId = map_form.cleaned_data['parentId']
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
            return render_to_response("AddMap.html",
                                      {'projectIconUrl': projectIconUrl,
                                       'xgdsIconUrl': xgdsIconUrl,
                                       'mapTreeUrl': mapTreeUrl,
                                       'mapForm': map_form,
                                       'error': True,
                                       'errorText': 'Invalid form entries'},
                                      context_instance=RequestContext(request))
        return HttpResponseRedirect(mapTreeUrl)

    else:
        map_form = MapForm()
        return render_to_response("AddMap.html",
                                  {'projectIconUrl': projectIconUrl,
                                   'xgdsIconUrl': xgdsIconUrl,
                                   'mapTreeUrl': mapTreeUrl,
                                   'mapForm': map_form},
                                  context_instance=RequestContext(request))


def getAddFolderPage(request):
    """
    HTML view to create new folder (group)
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))

    if request.method == 'POST':
        group_form = MapGroupForm(request.POST)
        if group_form.is_valid():
            map_group = MapGroup()
            map_group.name = group_form.cleaned_data['name']
            map_group.description = group_form.cleaned_data['description']
            map_group.parentId = group_form.cleaned_data['parentId']
            map_group.save()
        else:
            return render_to_response("AddFolder.html",
                                      {'projectIconUrl': projectIconUrl,
                                       'xgdsIconUrl': xgdsIconUrl,
                                       'groupForm': group_form,
                                       'error': True,
                                       'errorText': "Invalid form entries"},
                                      context_instance=RequestContext(request))
        return HttpResponseRedirect(mapTreeUrl)

    else:
        group_form = MapGroupForm()
        return render_to_response("AddFolder.html",
                                  {'projectIconUrl': projectIconUrl,
                                   'xgdsIconUrl': xgdsIconUrl,
                                   'mapTreeUrl': mapTreeUrl,
                                   'groupForm': group_form,
                                   'error': False},
                                  context_instance=RequestContext(request))


@csrf_protect
def getDeleteMapPage(request, mapID):
    """
    HTML view to delete map
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapDetailUrl = (request.build_absolute_uri
                    (reverse('mapDetail',
                             kwargs={'mapID': mapID})))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))

    try:
        map_obj = Map.objects.get(id=mapID)
    except Map.DoesNotExist:
        raise Http404
    except Map.MultipleObjectsReturned:
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
                                  {'projectIconUrl': projectIconUrl,
                                   'xgdsIconUrl': xgdsIconUrl,
                                   'mapTreeUrl': mapTreeUrl,
                                   'mapDetailUrl': mapDetailUrl,
                                   'deletedMapsUrl': deletedMapsUrl,
                                   'mapObj': map_obj},
                                  context_instance=RequestContext(request))


def getDeletedMapsPage(request):
    """
    HTML list of deleted maps that can be un-deleted
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    baseUrl = request.build_absolute_uri(reverse("xgds_map_server_index"))
    mapTreeUrl = request.build_absolute_uri(reverse("mapTree"))

    maps = Map.objects.filter(deleted=True)
    folders = MapGroup.objects.filter(deleted=True)
    return render_to_response("DeletedMaps.html",
                              {'projectIconUrl': projectIconUrl,
                               'xgdsIconUrl': xgdsIconUrl,
                               'mapDeleteUrl': baseUrl + 'delete',
                               'mapTreeUrl': mapTreeUrl,
                               'folderDeleteUrl': baseUrl + 'folderDelete',
                               'maps': maps,
                               'folders': folders},
                              context_instance=RequestContext(request))


@transaction.commit_manually
@csrf_protect
def getDeleteFolderPage(request, groupID):
    """
    HTML view to delete a folder
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    folderDetailUrl = (request.build_absolute_uri
                       (reverse('folderDetail',
                                kwargs={'groupID': groupID})))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))

    try:
        map_group = MapGroup.objects.get(id=groupID)
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
        deleteGroup(map_group, not map_group.deleted)
        map_group.deleted = not map_group.deleted
        map_group.save()
        # commit everything at once
        transaction.commit()
        return HttpResponseRedirect(mapTreeUrl)

    else:
        # either there's some transaction I'm not aware of happening,
        # or transaction just expects a call regardless of any database activity
        transaction.rollback()
        return render_to_response("FolderDelete.html",
                                  {'projectIconUrl': projectIconUrl,
                                   'xgdsIconUrl': xgdsIconUrl,
                                   'mapTreeUrl': mapTreeUrl,
                                   'folderDetailUrl': folderDetailUrl,
                                   'groupObj': map_group,
                                   'deletedMapsUrl': deletedMapsUrl},
                                  context_instance=RequestContext(request))


def getFolderDetailPage(request, groupID):
    """
    HTML Form of a map group (folder)
    """
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
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
        map_group = MapGroup.objects.get(id=groupID)
    except MapGroup.DoesNotExist:
        raise Http404
    except Map.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()

    # handle post data before loading everything
    if request.method == 'POST':
        group_form = MapGroupForm(request.POST)
        if group_form.is_valid():
            map_group.name = group_form.cleaned_data['name']
            map_group.description = group_form.cleaned_data['description']
            map_group.parentId = group_form.cleaned_data['parentId']
            map_group.save()
            fromSave = True
        else:
            return render_to_response("FolderDetail.html",
                                      {"projectIconUrl": projectIconUrl,
                                       "xgdsIconUrl": xgdsIconUrl,
                                       "folderDetailUrl": folderDetailUrl,
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
                              {"projectIconUrl": projectIconUrl,
                               "xgdsIconUrl": xgdsIconUrl,
                               "folderDetailUrl": folderDetailUrl,
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
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapDetailUrl = (request.build_absolute_uri
                    (reverse('mapDetail',
                             kwargs={'mapID': mapID})))
    mapDeleteUrl = (request.build_absolute_uri
                    (reverse('mapDelete',
                             kwargs={'mapID': mapID})))
    deletedMapsUrl = (request.build_absolute_uri
                      (reverse('deletedMaps')))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    fromSave = False
    try:
        map_obj = Map.objects.get(id=mapID)
    except Map.DoesNotExist:
        raise Http404
    except Map.MultipleObjectsReturned:
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
            map_obj.parentId = map_form.cleaned_data['parentId']
            map_obj.save()
            fromSave = True
        else:
            if map_obj.kmlFile and not map_obj.localFile:
                kmlChecked = True
            else:
                kmlChecked = False
            return render_to_response("MapDetail.html",
                                      {"projectIconUrl": projectIconUrl,
                                       "xgdsIconUrl": xgdsIconUrl,
                                       "mapDetailUrl": mapDetailUrl,
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
                              {"projectIconUrl": projectIconUrl,
                               "xgdsIconUrl": xgdsIconUrl,
                               "mapDetailUrl": mapDetailUrl,
                               "mapTreeUrl": mapTreeUrl,
                               "deletedMapsUrl": deletedMapsUrl,
                               "mapForm": map_form,
                               "kmlChecked": kmlChecked,
                               "fromSave": fromSave,
                               "mapDeleteUrl": mapDeleteUrl,
                               "map_obj": map_obj},
                              context_instance=RequestContext(request))


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
                        mimetype="application/json")


def addGroupToJSON(group, map_tree, request):
    """
    recursively adds group to json tree
    in the style of jstree
    """
    group_json = {
        "data": {
            "title": group.name,
            "attr": {
                "href": request.build_absolute_uri(reverse('folderDetail', kwargs={'groupID': group.id}))
            }
        },
        "metadata": {
            "id": group.id,
            "description": group.description,
            "parentId": None,
            "type": "folder"
        },
        "state": "open",
    }
    sub_folders = []
    sub_maps = []
    if group.id == 1:
        # ensure that we don't have conflicts with the base map
        # for the detail page, and that nobody deletes every map
        del group_json['data']['attr']['href']
    if group.parentId is not None:
        group_json['metadata']['parentId'] = group.parentId.id
    for map_group in group.subGroups:
        if map_group.deleted:
            continue
        addGroupToJSON(map_group, sub_folders, request)
    for group_map in group.subMaps:
        if group_map.deleted:
            continue
        group_map_json = {
            "data": {
                "title": group_map.name,
                "attr": {
                    "href": request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID': group_map.id}))
                }
            },
            "metadata": {
                "id": group_map.id,
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
        if group_map.parentId is not None:
            group_map_json['metadata']['parentId'] = group_map.parentId.id
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


def deleteGroup(map_group, state):
    """
    recursively deletes maps and groups under a group
    using manual commit control might be a good idea for this
    """
    for map_obj in Map.objects.filter(parentId=map_group.id):
        # this is to avoid deleting maps when undeleting
        map_obj.deleted = state
        map_obj.save()
    for group in MapGroup.objects.filter(parentId=map_group.id):
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
#     print 'kml file is %s' % m.kmlFile
#     print 'url is %s' % m.url
#     print 'visibility is %s' % m.visibility
#     print 'listItemType is %s' % m.listItemType


def getMapTree():
    groups = MapGroup.objects.all()
    maps = Map.objects.all()

    groupLookup = dict([(group.id, group) for group in groups])

    for m in maps:
        setMapProperties(m)

    for group in groups:
        group.subGroups = []
        group.subMaps = []

    for subGroup in groups:
        if subGroup.parentId_id:
            parent = groupLookup[subGroup.parentId_id]
            parent.subGroups.append(subGroup)

    for subMap in maps:
        if subMap.parentId_id:
            parent = groupLookup[subMap.parentId_id]
            parent.subMaps.append(subMap)

    rootMap = [g for g in groups if g.parentId_id is None][0]

    return rootMap


def printTreeToKml(out, node):
    out.write("""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.0">
<Document>
<name>%(name)s</name>
<visibility>1</visibility>
""" % vars(node))
    level = 0
    printGroupToKml(out, node, level)
    out.write("""
</Document>
</kml>
""")


def printGroupToKml(out, node, level=0):
    if (0 == len(node.subGroups)) and (0 == len(node.subMaps)):
        return
    out.write("""
<Folder>
  <name>%(name)s</name>
""" % vars(node))
    for n in node.subGroups:
        printGroupToKml(out, n, level + 1)
    for n in node.subMaps:
        printMapToKml(out, n, level + 1)
    out.write('</Folder>\n')


def printMapToKml(out, node, level=0):
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


def getMapFeed(request, feedname):
    print 'called getMapFeed(%s)' % feedname
    if (feedname == ''):
        return getMapFeedTop(request)
    if ('all' in feedname):
        return getMapFeedAll(request)
    return None


# This URL should retrieve a top-level KML file with network link to the top-level feed
def getMapFeedTop(request):
    m = Map()
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
    m.visibility = 1
    m.listItemType = 'check'
    print 'top level map kmlFile:', m.kmlFile
    resp = render_to_response('Maps.kml',
                              {'documentName': topLevel['name'],
                               'map': m},
                              mimetype='application/vnd.google-earth.kml+xml',
                              context_instance=RequestContext(request))
    resp['Content-Disposition'] = 'attachment; filename=%s' % topLevel['filename']
    return resp


# This URL should retrieve a top-level KML file with network links to all files
def getMapFeedAll(request):
    global latestRequestG
    latestRequestG = request
    root = getMapTree()
    out = StringIO()
    printTreeToKml(out, root)
    s = out.getvalue()
    resp = HttpResponse(content=s,
                        mimetype='application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=all.kml'
    return resp


# This URL should retrieve a file called <mapname>
def getMapFileDeprecated(request, filename):
    if (filename == ''):
        return getMapFeedAll(request)
    diskfile = settings.DATA_ROOT + settings.XGDS_MAP_SERVER_DATA_SUBDIR + filename
    url = '%s/%s' % ('static', filename)
    if os.path.exists(diskfile):
        print 'file %s exists' % diskfile
        print 'responding with url = %s' % url
    else:
        print 'file %s does not exist' % diskfile
    return None
