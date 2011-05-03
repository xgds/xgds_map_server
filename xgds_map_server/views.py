# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Create your views here.

import datetime, time, itertools
import re #Dave
import os #Dave
import urllib2
import uuid

from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect
from django.template import RequestContext
from django.views.decorators.cache import cache_control
from django.views.static import serve as staticServe
from django.core.urlresolvers import reverse
from pyproj import Geod

from xgds_map_server import settings
from xgds_map_server.models import *

# HTML list of maps with description and links to individual maps, and a link to the kml feed
def getMapListPage(request):
    projectIconUrl = request.build_absolute_uri(reverse(staticServe,args=[settings.PROJECT_LOGO_URL]))
    xgdsIconUrl = request.build_absolute_uri(reverse(staticServe,args=[settings.XGDS_LOGO_URL]))
    mapList = Map.objects.all().order_by('name')
    groupList = MapGroup.objects.all().order_by('name')
    for m in mapList:
        if m.kmlFile.startswith('/'):
            url = m.kmlFile
        else:
            url =reverse(staticServe,args=['mapserver/%s'%m.kmlFile])
        m.url = request.build_absolute_uri(url)
        print 'kmlFile=%s url=%s' % (m.kmlFile, m.url)
        if m.openable:
            m.openable = 'yes'
        else:
            m.openable = 'no'
        if m.visible:
            m.visible = 'yes'
        else:
            m.visible = 'no'
        m.groupname = m.parentId.name
    feedUrl = request.build_absolute_uri(reverse(getMapFeed,kwargs={'feedname':''}))
    print 'serving %d maps to MapList.html' % len(mapList)
    return render_to_response('MapList.html',
                              {'mapList':mapList,
                               'feedUrl':feedUrl,
                               'projectIconUrl':projectIconUrl,
                               'xgdsIconUrl':xgdsIconUrl})

def setMapProperties(m):
    #m.url = '/../../%s%s' % (settings.MAPSERVER_DATA_URL,m.kmlFile)
    if m.kmlFile.startswith('/'):
        m.url = latestRequestG.build_absolute_uri(m.kmlFile)
    else:
        m.url = '../../%s%s' % (settings.MAPSERVER_DATA_URL,m.kmlFile)
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
    root = getChildren()
    return root

def getChildren(object=None):
    print 'getting children for %s' % object
    if object==None:
        groupList = MapGroup.objects.filter(parentId=None).order_by('name')
        object = groupList[0]
        object.children = []
        print 'root is %s' % object
    myGroupList = MapGroup.objects.filter(parentId=object.id).order_by('name')
    for g in myGroupList:
        print 'child is %s' % g
        g.children = []
        g = getChildren(g)
        object.children.append(g)
    myMapList = Map.objects.filter(parentId=object.id).order_by('name')
    for m in myMapList:
        print 'child is %s' % m
        setMapProperties(m)
        m.children = []
        object.children.append(m)
        print '   now has %s children' % len(object.children)
    return object

def printTree(node,level=0):
    indent = ''
    for i in range(level):
        indent = indent + '    '
    if 'kmlFile' in dir(node):
        print '%s - Map = %s' % (indent,node.name)
    else:
        print '%s - Folder = %s (with %s children)' % (indent,node.name,len(node.children))
    for c in node.children:
        printNode(c,level=level+1)

def printTreeToKml(node):
    str = ''
    str = str + '<?xml version="1.0" encoding="UTF-8"?>\n'
    str = str + '<kml xmlns="http://earth.google.com/kml/2.0">\n'
    str = str + '<Document>\n'
    str = str + '<name>%s</name>\n' % node.name
    str = str + '<visibility>1</visibility>\n'
    level = 0
    str = printNodeToKml(node,level,str)
    str = str + '</Document>\n'
    str = str + '</kml>\n'
    return str

def printNodeToKml(node,level=0,str=''):
    if 'kmlFile' in dir(node): # This is a map
        str = str + '<NetworkLink>\n'
        str = str + '  <name>%s</name>\n' % node.name
        str = str + '  <visibility>%s</visibility>\n' % node.visibility
        str = str + '  <Style>\n'
        str = str + '    <ListStyle>\n'
        str = str + '      <listItemType>%s</listItemType>\n' % node.listItemType
        str = str + '    </ListStyle>\n'
        str = str + '  </Style>\n'
        str = str + '  <Link>\n'
        #str = str + '  <Url>\n'
        str = str + '    <href>%s</href>\n' % node.url
        str = str + '    <refreshMode>onInterval</refreshMode>\n'
        str = str + '    <refreshInterval>14400</refreshInterval>\n'
        #str = str + '  </Url>\n'
        str = str + '  </Link>\n'
        str = str + '</NetworkLink>\n'
    else: # This is a folder
        str = str + '<Folder>\n'
        str = str + '  <name>%s</name>\n' % node.name
        for n in node.children:
            str = printNodeToKml(n,level+1,str)
        str = str + '</Folder>\n'
    return str


def getMapFeed(request,feedname):
    print 'called getMapFeed(%s)' % feedname
    if (feedname==''):
        return getMapFeedTop(request)
    if ('all' in feedname):
        return getMapFeedAll(request)
    return None

# This URL should retrieve a top-level KML file with network link to the top-level feed
def getMapFeedTop(request):
    m = Map()
    m.name = 'PLRP 2011 Map'
    m.description = 'Top level KML feed for all PLRP 2011 maps.'
    # This *has* to be a full URL.  The problem is that the KML file
    # returned by this request lands on the user's filesystem and
    # needs to be able to open up from anywhere and point to the
    # top-level URL for our map feed.  That has to be a fully
    # qualified URL.  The target of that URL is full of relative URL's
    # from there on.  The good news is Django can reverse the view
    # name to get the URL that resolves to that view.
    m.url = request.build_absolute_uri(reverse(getMapFeed,kwargs={'feedname':'all.kml'}))
    m.visibility = 1
    m.listItemType = 'check'
    mapList = []
    mapList.append(m)
    print 'serving %d maps to ' % len(mapList)
    for m in mapList:
        print m.kmlFile
    resp = render_to_response('Maps.kml',
                              {'documentName':'PLRP 2011 Map',
                               'mapList':mapList},
                              mimetype = 'application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=PLRP2011MapFeed.kml'
    return resp

# This URL should retrieve a top-level KML file with network links to all files
def getMapFeedAll(request):
    global latestRequestG
    latestRequestG = request
    root = getMapTree()
    str = printTreeToKml(root)
    resp = HttpResponse(content=str,
                        mimetype = 'application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=all.kml'
    return resp

# This URL should retrieve a file called <mapname>
def getMapFileDeprecated(request,filename):
    if (filename == ''):
        return getMapFeedAll(request)
    diskfile = '%s/%s' % (settings.MAPSERVER_FILE_ROOT,filename)
    url = '%s/%s' % ('static',filename)
    if os.path.exists(diskfile):
        print 'file %s exists' % diskfile
        print 'responding with url = %s' % url
    else:
        print 'file %s does not exist' % diskfile
    return None
