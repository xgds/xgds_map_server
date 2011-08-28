# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Create your views here.

import datetime
import time
import itertools
import re #Dave
import os #Dave
import urllib2
import uuid
import sys
from cStringIO import StringIO

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
    projectIconUrl = settings.MEDIA_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_PROJECT_LOGO_URL
    xgdsIconUrl = settings.MEDIA_URL + settings.XGDS_MAP_SERVER_MEDIA_SUBDIR + settings.XGDS_LOGO_URL
    mapList = Map.objects.all().order_by('name')
    groupList = MapGroup.objects.all().order_by('name')
    for m in mapList:
        if m.kmlFile.startswith('/'):
            url = m.kmlFile
        else:
            url = settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + m.kmlFile
        m.url = request.build_absolute_uri(url)
        print >>sys.stderr, 'kmlFile=%s url=%s' % (m.kmlFile, m.url)
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
    feedUrl = request.build_absolute_uri(reverse(getMapFeed,kwargs={'feedname':''}))
    print 'serving %d maps to MapList.html' % len(mapList)
    return render_to_response('MapList.html',
                              {'mapList':mapList,
                               'feedUrl':feedUrl,
                               'projectIconUrl':projectIconUrl,
                               'xgdsIconUrl':xgdsIconUrl},
                              context_instance=RequestContext(request))

def setMapProperties(m):
    if m.kmlFile.startswith('/'):
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

def printTree(out,node,level=0):
    indent = ''
    for i in range(level):
        indent = indent + '    '
    if hasattr(node, 'kmlFile'):
        print '%s - Map = %s' % (indent,node.name)
    else:
        print '%s - Folder = %s (with %s children)' % (indent,node.name,len(node.children))
    for c in node.children:
        printNode(out,c,level=level+1)

def printTreeToKml(out, node):
    out.write("""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.0">
<Document>
<name>%(name)s</name>
<visibility>1</visibility>
""" % dict(name=node.name))
    level = 0
    printNodeToKml(out,node,level)
    out.write("""
</Document>
</kml>
""")

def printNodeToKml(out,node,level=0):
    if hasattr(node, 'kmlFile'): # This is a map
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
    else: # This is a folder
        out.write("""
<Folder>
  <name>%(name)s</name>
""" % vars(node))
        for n in node.children:
            printNodeToKml(out,n,level+1)
        out.write('</Folder>\n')

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
    m.url = request.build_absolute_uri(reverse(getMapFeed,kwargs={'feedname':'all.kml'}))
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
    str = out.getvalue()
    resp = HttpResponse(content=str,
                        mimetype = 'application/vnd.google-earth.kml+xml')
    resp['Content-Disposition'] = 'attachment; filename=all.kml'
    return resp

# This URL should retrieve a file called <mapname>
def getMapFileDeprecated(request,filename):
    if (filename == ''):
        return getMapFeedAll(request)
    diskfile = settings.DATA_ROOT + settings.XGDS_MAP_SERVER_DATA_SUBDIR + filename
    url = '%s/%s' % ('static',filename)
    if os.path.exists(diskfile):
        print 'file %s exists' % diskfile
        print 'responding with url = %s' % url
    else:
        print 'file %s does not exist' % diskfile
    return None
