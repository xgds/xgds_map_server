
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

import re
import os
import shutil
import gdal
import untangle
import traceback

from django.core.urlresolvers import reverse
from django.core.validators import MaxValueValidator
from django.db import models
from django.contrib.gis.db import models
from django.conf import settings

from geocamUtil.models.UuidField import UuidField
from geocamUtil.models.managers import ModelCollectionManager
from geocamUtil.modelJson import modelToJson, modelsToJson, modelToDict, dictToJson
from geocamUtil.models.ExtrasDotField import ExtrasDotField
from xgds_data.models import Collection, RequestLog
from xgds_core.couchDbStorage import CouchDbStorage
from xgds_core.util import insertIntoPath


# from Carbon.TextEdit import WIDTHHook
# from aetypes import Boolean
# from Carbon.QuickDraw import underline
from cookielib import offset_from_tz_string
# pylint: disable=C1001

LOGO_REGEXES = None


class AbstractMapNode(models.Model):
    """
    Abstract Map Node for an entry in the map tree, which can have a parent.
    """
    uuid = UuidField(primary_key=True)
    name = models.CharField('name', max_length=128, db_index=True)
    description = models.CharField('description', max_length=1024, blank=True)
    creator = models.CharField('creator', max_length=200)
    modifier = models.CharField('modifier', max_length=200, null=True, blank=True)
    creation_time = models.DateTimeField(null=True, blank=True, db_index=True)
    modification_time = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted = models.BooleanField(blank=True, default=False)
    minLat = models.FloatField(blank=True, null=True)
    minLon = models.FloatField(blank=True, null=True)
    maxLat = models.FloatField(blank=True, null=True)
    maxLon = models.FloatField(blank=True, null=True)
    region = models.ForeignKey('geocamUtil.SiteFrame', null=True)

    @property
    def parent(self):
        """ child classes must define parent"""
        return None

    def getEditHref(self):
        """ child classes must define edit href
        """
        return None

    @property
    def start(self):
        """ If this is a map layer with time, return the start time """
        return None

    @property
    def end(self):
        """ If this is a map layer with time, return the end time """
        return None

    @property
    def interval(self):
        """ If this is a map layer with time, return the interval in decimal seconds """
        return None

    def getTimeUrl(self, theTime):
        """ If this is a map layer with time, return the url to get the data for that time """
        return None

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = {"title": self.name,
                  "key": self.uuid,
                  "tooltip": self.description,
                  "data": {"type": self.__class__.__name__,
                           "parentId": None,
                           "href": self.getEditHref()}
                  }
        if self.parent:
            result['data']['parentId'] = self.parent.uuid
        if self.start:
            result['data']['start'] = self.start
        if self.end:
            result['data']['end'] = self.end
        if self.interval:
            result['data']['interval'] = self.interval
        if self.getKmlUrl():
            result['data']['kmlFile'] = self.getKmlUrl()

        return result

    def getKmlUrl(self):
        """ If this element has an url which returns kml, override this function to return that url. """
        return None

    def __unicode__(self):
        return self.name

    class Meta:
        abstract = True
        ordering = ['name']


class MapGroup(AbstractMapNode):
    """
    A Map Group, or folder in the map tree.
    """
    parent = models.ForeignKey('self', db_column='parentId',
                               null=True, blank=True,
                               verbose_name='parent group')

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapGroup, self).getTreeJson()
        result["folder"] = True
        return result

    def getEditHref(self):
        return reverse('folderDetail', kwargs={'groupID': self.uuid})


class AbstractMap(AbstractMapNode):
    """
    Abstract Map for an entry in a MapGroup (which is not a group, but something we can render)
    """
    locked = models.BooleanField(blank=True, default=False)
    visible = models.BooleanField(blank=False, default=False)
    transparency = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)], help_text="100=transparent") #100=fully transparent, 0=fully opaque
    parent = models.ForeignKey(MapGroup, db_column='parentId',
                               null=True, blank=True,
                               verbose_name='group')

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(AbstractMap, self).getTreeJson()
        result["data"]["transparency"] = self.transparency
        result["selected"] = self.visible
        return result

    def getUrl(self):
        """ subclass must implement """
        pass
    
    def getGoogleEarthUrl(self):
        # make sure the subclass provides this, or overrides
        return insertIntoPath(self.getUrl(), 'rest')
    
    class Meta:
        abstract = True


couchStore = CouchDbStorage()
class KmlMap(AbstractMap):
    """
    A reference to an external or local KML file.  Note we can't render all KML features in all libraries
    """
    kmlFile = models.CharField('KML File', max_length=200)  # actual name of the kml file
    localFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MEDIA_SUBDIR, max_length=256,
                                 null=True, blank=True, storage=couchStore)
    openable = models.BooleanField(default=True)
    hasNetworkLink = models.BooleanField(default=False) # if something has a network link, right now do not include it for openlayers

    def getEditHref(self):
        return reverse('mapDetail', kwargs={'mapID': self.uuid})

    @property
    def isLogo(self):
        global LOGO_REGEXES
        if LOGO_REGEXES is None:
            LOGO_REGEXES = [re.compile(pattern)
                            for pattern in settings.XGDS_MAP_SERVER_LOGO_PATTERNS]
        return any([r.search(self.name)
                    for r in LOGO_REGEXES])

    def getGoogleEarthUrl(self, request):
        if self.localFile:
            restString = insertIntoPath(self.localFile.url, 'rest')
            return request.build_absolute_uri(restString)
        elif self.kmlFile:
            if (self.kmlFile.startswith('/')):
                # starts with a slash, is a feed from our server.
                # inject the word rest after the first slash
                restString = insertIntoPath(self.kmlFile, 'rest')
                return request.build_absolute_uri(restString)
            else:
                # not sure what these files are
                return request.build_absolute_uri(self.kmlFile.url)
        return ''
        
    def getUrl(self):
        if self.kmlFile and not self.localFile:
            if (self.kmlFile.startswith('/')):
                return self.kmlFile
            else:
                return settings.DATA_URL + settings.XGDS_MAP_SERVER_DATA_SUBDIR + self.kmlFile
        elif self.localFile:
            return self.localFile.url

    def getKmlUrl(self):
            """ If this element has an url which returns kml, override this function to return that url. """
            return self.getUrl()

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        if self.hasNetworkLink:
            return None
        result = super(KmlMap, self).getTreeJson()
        result["data"]["openable"] = self.openable
#         result["data"]["transparency"] = self.transparency
        if self.localFile:
            result["data"]["localFile"] = self.localFile.url
        return result


class AbstractMapTile(AbstractMap):
    """
    A reference to a tiled geoTiff.
    """
    sourceFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_GEOTIFF_SUBDIR, max_length=256,
                                  null=True, blank=True)
    processed = models.BooleanField(default=False)
    
    minx = models.FloatField(null=True)
    miny = models.FloatField(null=True)
    maxx = models.FloatField(null=True)
    maxy = models.FloatField(null=True)
    resolutions = models.CharField(null=True, max_length=256)
    
    def initResolutions(self):
        if not self.resolutions:
            try:
                result = ''
                filepath = os.path.join(settings.DATA_ROOT, settings.XGDS_MAP_SERVER_GEOTIFF_SUBDIR, self.name.replace(' ', '_'), 'tilemapresource.xml')
                tilemapresource = untangle.parse(str(filepath))
                for t in tilemapresource.TileMap.TileSets.children:
                    result += str(int(float(t['units-per-pixel']))) + ' '
                result = result.strip()
                if result:
                    self.resolutions = result
                    self.save()
            except:
                traceback.print_exc()
                pass
    
    @property
    def intResolutions(self):
        self.initResolutions()
        if self.resolutions:
            return [int(n) for n in self.resolutions.split()] 
    
    def initBounds(self):
        if not self.minx:
            try:
                bounds = self.getBounds()
                self.minx = bounds[0][0]
                self.miny = bounds[0][1]
                self.maxx = bounds[1][0]
                self.maxy = bounds[1][1]
                self.save()
            except:
                pass
    
    def getBounds(self):
        src = gdal.Open(self.sourceFile.path)
        minx, xres, xskew, maxy, yskew, yres  = src.GetGeoTransform()
        maxx = minx + (src.RasterXSize * xres)
        miny = maxy + (src.RasterYSize * yres)
        return [[minx, miny], [maxx, maxy]]
    
    @property
    def sourceFileLink(self):
        if self.sourceFile:
            return "<a href='%s'>Download %s (%d MB)</a>" % (self.sourceFile.url, os.path.basename(self.sourceFile.name), self.sourceFile.size / 1000000)
        else:
            return "No Source File"
        
    def getUrl(self):
        return self.getXYZTileSourceUrl()

    def getXYZTileSourceUrl(self):
        result = os.path.join(self.getTilePath(), '{z}/{x}/{-y}.png')
        return result

    def getTilePath(self):
        result = os.path.join(settings.DATA_URL, settings.XGDS_MAP_SERVER_GEOTIFF_SUBDIR, self.name.replace(' ', '_'))
        return result

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(AbstractMapTile, self).getTreeJson()
        result["data"]["tileURL"] = self.getUrl()
        result["data"]["tilePath"] = self.getTilePath()
        if self.minx:
            result["data"]["minx"] = self.minx
            result["data"]["miny"] = self.miny
            result["data"]["maxx"] = self.maxx
            result["data"]["maxy"] = self.maxy
        if self.resolutions:
            result["data"]["resolutions"] = self.intResolutions
        return result
    
    def rename(self, newName):
        oldPath = os.path.join(settings.PROJ_ROOT, self.getTilePath()[1:])
        self.name = newName
        newPath = os.path.join(settings.PROJ_ROOT, self.getTilePath()[1:])
        shutil.move(oldPath, newPath)

    class Meta:
        abstract = True

class MapTile(AbstractMapTile):
    
    def getEditHref(self):
        return reverse('mapEditTile', kwargs={'tileID': self.uuid})

class MapDataTile(AbstractMapTile):
    """
    A MapTile layer that has meaningful data, an optional legend, a file containing the data and javascript to render the data value below the map.
    """
    dataFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MAPDATA_SUBDIR, max_length=256,
                                null=True, blank=True)
    legendFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MAPDATA_SUBDIR, max_length=256,
                                  null=True, blank=True)
    legendDefaultVisible = models.BooleanField(default=True, verbose_name='Show Legend:', help_text='Check to show legend when tile layer is turned on')
    valueLabel = models.CharField(max_length=128, null=True, blank=True)
    unitsLabel = models.CharField(max_length=32, null=True, blank=True)
    jsFunction = models.TextField(null=True, blank=True)
    jsRawFunction = models.TextField(null=True, blank=True)
    
    def getDataFileUrl(self):
        if self.dataFile:
            return self.dataFile.url
        return None
    
    def getLegendFileUrl(self):
        if self.legendFile:
            return self.legendFile.url
        return None
    
    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapDataTile, self).getTreeJson()
        result["data"]["dataFileURL"] = self.getDataFileUrl()
        result["data"]["legendFileURL"] = self.getLegendFileUrl()
        result["data"]["legendVisible"] = self.legendDefaultVisible
        result["data"]["valueLabel"] = self.valueLabel
        result["data"]["unitsLabel"] = self.unitsLabel
        result["data"]["jsFunction"] = self.jsFunction
        result["data"]["jsRawFunction"] = self.jsRawFunction
        
        return result

    def getEditHref(self):
        return reverse('mapEditDataTile', kwargs={'tileID': self.uuid})
    

class MapLayer(AbstractMap):
    """ A map layer which will have a collection of features that have content in them. """
    jsonFeatures = ExtrasDotField()
    defaultColor = models.CharField(max_length=32, null=True, blank=True)

    def getEditHref(self):
        return reverse('mapEditLayer', kwargs={'layerID': self.uuid})

    def toDict(self):
        result = modelToDict(self)
        result['uuid'] = self.uuid
        return result

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapLayer, self).getTreeJson()
        result["data"]["layerJSON"] = reverse('mapLayerJSON', kwargs={'layerID': self.uuid})
        return result
    
    def getGoogleEarthUrl(self, request):
        theUrl = reverse('mapLayerKML', kwargs={'layerID': self.uuid})
        theUrl = insertIntoPath(theUrl, 'rest')
        return request.build_absolute_uri(theUrl)

    def getFeatureJson(self):
        return self.jsonFeatures

    def getKmlUrl(self):
        """ If this element has an url which returns kml, override this function to return that url. """
        return reverse('mapLayerKML', kwargs={'layerID': self.uuid})


class MapCollection(AbstractMap):
    """
    A layer that encapsulates a collection of found objects.
    """
    collection = models.ForeignKey(Collection)
    
    def getUrl(self):
        return reverse('mapCollectionJSON', kwargs={'mapCollectionID': self.uuid})

    def getEditHref(self):
        return reverse('mapEditMapCollection', kwargs={'mapCollectionID': self.uuid})

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapCollection, self).getTreeJson()
        result["data"]["collectionJSON"] = self.getUrl()
        return result


class MapSearch(AbstractMap):
    """
    A layer that repsresents a search which can be refreshing
    """
    requestLog = models.ForeignKey(RequestLog)
    mapBounded = models.BooleanField(blank=True, default=False)  # true if you want to pass the map extens to the query and redo search with the extens

    def getUrl(self):
        return reverse('mapSearchJSON', kwargs={'mapSearchID': self.uuid})

    def getEditHref(self):
        return reverse('mapEditMapSearch', kwargs={'mapSearchID': self.uuid})

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapSearch, self).getTreeJson()
        result["data"]["searchJSON"] = self.getUrl()
#         result["data"]["searchResultsJSON"] = reverse('data_searchResultsJSON', kwargs={'collectionID': self.requestLog.pk})
        return result


class MapLink(AbstractMap):
    """
    A layer that encapsulates an url that gives json objects
    """
    url = models.CharField('url', max_length=512)  # url to give map renderable json objects
    childNodesUrl = models.CharField('childNodesUrl', max_length=512)  # if the tree should have child nodes, return the json for the children from this url
    sseUrl = models.CharField('sseUrl', max_length=512)  # url for sse data
    mapBounded = models.BooleanField(blank=True, default=False)  # true if you want to pass the map extens to the query and redo search with the extens

    @property
    def openable(self):
        return self.childNodesUrl != None

    def getUrl(self):
        if self.url:
            return self.url
        elif self.childNodesUrl:
            return self.childNodesUrl
    
    def getEditHref(self):
        """ since we create map link ourselves do not provide a facility to edit them.
        """
        return ""

    def getTreeJson(self):
        """ Get the json block that the fancy tree needs to render this node """
        result = super(MapLink, self).getTreeJson()
        if self.url:
            result["data"]["json"] = self.url
        if self.childNodesUrl:
            result["data"]["childNodesUrl"] = self.childNodesUrl
            result['folder'] = True
            result['lazy'] = True
        result["data"]["mapBounded"] = self.mapBounded
        result["data"]["sseUrl"] = self.sseUrl
        try:
            del result["data"]["transparency"]
        except:
            pass
        return result


""" IMPORTANT These have to be defined after the models they refer to are defined."""
MAP_NODE_MANAGER = ModelCollectionManager(AbstractMapNode, [MapGroup, MapLayer, KmlMap, MapTile, MapDataTile, MapCollection, MapSearch, MapLink])

# this manager does not include groups
MAP_MANAGER = ModelCollectionManager(AbstractMap, [MapLayer, KmlMap, MapTile, MapDataTile, MapCollection, MapSearch, MapLink])
