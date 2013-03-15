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

from django.shortcuts import render_to_response
from django.http import HttpResponse, Http404, HttpResponseServerError
from django.template import RequestContext
from django.core.urlresolvers import reverse

from xgds_map_server import settings
from xgds_map_server.models import Map, MapGroup
from xgds_map_server.forms import MapForm

latestRequestG = None


# HTML list of maps with description and links to individual maps, and a link to the kml feed
def getMapListPage(request):
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapList = Map.objects.all().order_by('name')
    for m in mapList:
        if (m.kmlFile.startswith('/') or m.kmlFile.startswith('http://') or
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
        if m.parentId == None:
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

# HTML tree of maps using jstree
def getMapTreePage(request):
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    jsonMapTreeUrl = (request.build_absolute_uri
                      (reverse('mapListJSON')))
    return render_to_response("MapTree.html",
                              {'projectIconUrl': projectIconUrl,
                               'xgdsIconUrl': xgdsIconUrl,
                               'JSONMapTreeURL': jsonMapTreeUrl},
                              context_instance=RequestContext(request))

# HTML Form of a map
def getMapDetailPage(request, mapID):
    projectIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.STATIC_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapDetailUrl = (request.build_absolute_uri
                    (reverse('mapDetail',
                             kwargs={'mapID':mapID})))
    mapTreeUrl = (request.build_absolute_uri
                  (reverse('mapTree')))
    try:
        map_obj = Map.objects.get(id=mapID)
    except Map.DoesNotExist:
        raise Http404
    except Map.MultipleObjectsReturned:
        # this really shouldn't happen, ever
        return HttpResponseServerError()
    map_form = MapForm(instance=map_obj)
    return render_to_response("MapDetail.html",
                              {"projectIconUrl": projectIconUrl,
                               "xgdsIconUrl": xgdsIconUrl,
                               "mapDetailUrl": mapDetailUrl,
                               "mapTreeUrl": mapTreeUrl,
                               "mapForm": map_form},
                              context_instance=RequestContext(request))
    
# json tree of map groups
# note that this does json for jstree
def getMapTreeJSON(request):
    global latestRequestG
    latestRequestG = request
    map_tree = getMapTree()
    map_tree_json = []
    addGroupToJSON(map_tree, map_tree_json, request)
    json_data = json.dumps(map_tree_json, indent=4)
    return HttpResponse(content=json_data,
                        mimetype="application/json")

# recursively adds group to json tree
# in the style of jstree
def addGroupToJSON(group, map_tree, request):
    group_json = {
        "data": group.name,
        "metadata": {"id":group.id, "description":group.description,
                     "parentId":None},
        "state": "open",
        "icon": "folder"
        }
    if group.parentId is not None:
        group_json['metadata']['parentId'] = group.parentId.id
    if group.subGroups or group.subMaps:
        group_json['children'] = []
    for group in group.subGroups:
        addGroupToJSON(group, group_json['children'], request)
    for group_map in group.subMaps:
        group_map_json = {
            "data": {
                "title": group_map.name,
                "attr": {"href": request.build_absolute_uri(reverse('mapDetail', kwargs={'mapID':group_map.id}))}
                },
            "metadata": {"id":group_map.id, "description":group_map.description,
                         "kmlFile":group_map.kmlFile, "openable":group_map.openable,
                         "visible":group_map.visible, "parentId":None},
            "state": "leaf"}
        if group_map.parentId is not None:
            group_map_json['metadata']['parentId'] = group_map.parentId.id
        group_json['children'].append(group_map_json)
    if 'children' not in group_json:
        group_json['state'] = 'leaf'
    map_tree.append(group_json)

def setMapProperties(m):
    if (m.kmlFile.startswith('/') or m.kmlFile.startswith('http://') or
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
    print 'kml file is %s' % m.kmlFile
    print 'url is %s' % m.url
    print 'visibility is %s' % m.visibility
    print 'listItemType is %s' % m.listItemType


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

    rootMap = [g for g in groups if g.parentId_id == None][0]

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
