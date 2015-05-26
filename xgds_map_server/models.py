# __BEGIN_LICENSE__
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
# __END_LICENSE__

import re
import json

from django.db import models
from django.contrib.gis.db import models
from xgds_map_server import settings
from geocamUtil.models.UuidField import UuidField
from geocamUtil.models.managers import ModelCollectionManager
from geocamUtil.modelJson import modelToJson, modelsToJson, modelToDict, dictToJson
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
    name = models.CharField('name', max_length=200)
    description = models.CharField('description', max_length=1024, blank=True)
    creator = models.CharField('creator', max_length=200)
    modifier = models.CharField('modifier', max_length=200, null=True, blank=True)
    creation_time = models.DateTimeField(null=True, blank=True)
    modification_time = models.DateTimeField(null=True, blank=True)
    deleted = models.BooleanField(blank=True, default=False)

    @property
    def parent(self):
        """ child classes must define parent"""
        return None

    def __unicode__(self):
        return self.name

    class Meta:
        abstract = True


class MapGroup(AbstractMapNode):
    """
    A Map Group, or folder in the map tree.
    """
    parent = models.ForeignKey('self', db_column='parentId',
                               null=True, blank=True,
                               verbose_name='parent group')


class AbstractMap(AbstractMapNode):
    """
    Abstract Map for an entry in a MapGroup (which is not a group, but something we can render)
    """
    locked = models.BooleanField(blank=True, default=False)
    visible = models.BooleanField(blank=False, default=False)
    parent = models.ForeignKey(MapGroup, db_column='parentId',
                               null=True, blank=True,
                               verbose_name='group')

    class Meta:
        abstract = True


class KmlMap(AbstractMap):
    """
    A reference to an external or local KML file.  Note we can't render all KML features in all libraries
    """
    kmlFile = models.CharField('KML File', max_length=200)  # actual name of the kml file
    localFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MEDIA_SUBDIR, max_length=256,
                                 null=True, blank=True)
    openable = models.BooleanField(default=True)

    @property
    def isLogo(self):
        global LOGO_REGEXES
        if LOGO_REGEXES is None:
            LOGO_REGEXES = [re.compile(pattern)
                            for pattern in settings.XGDS_MAP_SERVER_LOGO_PATTERNS]
        return any([r.search(self.name)
                    for r in LOGO_REGEXES])


class MapTile(AbstractMap):
    """
    A reference to an external or local KML file.  Note we can't render all KML features in all libraries
    """
    sourceFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_GEOTIFF_SUBDIR, max_length=256,
                                  null=True, blank=True)
    processed = models.BooleanField(default=False)


class MapLayer(AbstractMap):
    """ A map layer which will have a collection of features that have content in them. """
    polygonIndex = models.IntegerField(default=0)  # indeces for naming user created features.
    lineStringIndex = models.IntegerField(default=0)
    pointIndex = models.IntegerField(default=0)
    groundOverlayIndex = models.IntegerField(default=0)
    drawingIndex = models.IntegerField(default=0)
    def toDict(self):
        result = modelToDict(self)
        result['uuid'] = self.uuid
        featuresList = []
        features = FEATURE_MANAGER.filter(mapLayer__pk=self.uuid)
        for feature in features:
            featuresList.append(feature.toDict())
        result['features'] = featuresList
        return result


class AbstractStyle(models.Model):
    """ An abstract style for rendering map features"""
    uuid = UuidField(primary_key=True)
    name = models.CharField(max_length=200, null=True, blank=True)
    drawOrder = models.IntegerField('drawOrder', null=True, blank=True)

    def toDict(self):
        return modelToDict(self)

    def __unicode__(self):
        return self.uuid

    class Meta:
        abstract = True


class LabelStyle(AbstractStyle):
    fontFamily = models.CharField(max_length=32, null=True, blank=True, 
                                  help_text='name of font to use')
    bold = models.BooleanField(default=False)
    italic = models.BooleanField(default=False)
    underline = models.BooleanField(default=False)
    textColor = models.CharField(max_length=32, null=True, blank=True, 
                                 default='Black', 
                                 help_text='hex value or CSS color name')
    textOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')
    textOffsetY = models.IntegerField(null=True, blank=True, default=0)
    text = models.CharField(max_length=100, null=True, blank=True)    


class PolygonStyle(AbstractStyle):
    strokeColor = models.CharField(max_length=32, null=True, blank=True, 
                                 default='Black', 
                                 help_text='hex value or CSS color name')
    strokeWidth = models.IntegerField(null=True, blank=True, 
                                      help_text='polygon border width')
    strokeOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')
    fillColor = models.CharField(max_length=32, null=True, blank=True, 
                                 help_text='hex value or CSS color name')
    fillOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')


class LineStringStyle(AbstractStyle):
    width = models.IntegerField(null=True, blank=True, 
                                help_text='thickness of line')
    color = models.CharField(max_length=32, null=True, blank=True, 
                                 default='Black', 
                                 help_text='hex value or CSS color name')
    opacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')
    dashes = models.BooleanField(default=False)
    dashLineSize = models.IntegerField(null=True, blank=True, 
                                      help_text='stroke dash size')
    dashSpaceSize = models.IntegerField(null=True, blank=True, 
                                      help_text='stroke dash space size')
    borderWidth = models.IntegerField(null=True, blank=True, 
                                      help_text='line border width')
    borderColor = models.CharField(max_length=32, null=True, blank=True, 
                                 help_text='hex value or CSS color name')


class PointStyle(AbstractStyle):
    radius = models.IntegerField('radius', default=5)
    strokeColor = models.CharField(max_length=32, null=True, blank=True, 
                                 default='Black', 
                                 help_text='hex value or CSS color name')
    strokeOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')
    strokeWidth = models.IntegerField(null=True, blank=True, 
                                      help_text='line border width')
    fillColor = models.CharField(max_length=32, null=True, blank=True, 
                                 help_text='hex value or CSS color name')
    fillOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')


class Icon(models.Model):
    iconImage = models.ImageField(upload_to='featureImages', height_field='height',
                              width_field='width')
    iconScale = models.CharField(max_length=5, null=True, blank=True, 
                                 help_text='a scaling factor in %')
    iconOpacity = models.FloatField(null=True, blank=True, default=1,
                                    help_text='between 0 and 1')
    offsetX = models.IntegerField(null=True, blank=True, 
                                      help_text='pixel offset in x from center of icon')
    offsetY = models.IntegerField(null=True, blank=True, 
                                      help_text='pixel offset in y from center of icon')


class DrawingStyle(AbstractStyle):
    strokeColor = models.CharField(max_length=32, null=True, blank=True, 
                                 help_text='hex value or CSS color name')


class GroundOverlayStyle(AbstractStyle):
    pass


class AbstractFeature(models.Model):
    """ An abstract feature, which is part of a Map Layer """
    uuid = UuidField(primary_key=True)
    mapLayer = models.ForeignKey(MapLayer)
    name = models.CharField('name', max_length=200)
    description = models.CharField('description', max_length=1024, blank=True)
    visible = models.BooleanField(default=True)
    popup = models.BooleanField(default=False)  # true if the feature will have a popup when the user clicks on it
    showLabel = models.BooleanField(default=False)
    labelStyle = models.ForeignKey(LabelStyle, null=True)
    objects = models.GeoManager()

    @property
    def style(self):
        """ You must define the specific style for the derived model """
        pass

    def __unicode__(self):
        return self.uuid

    def toDict(self):
        result = modelToDict(self)
        result['type'] = self.__class__.__name__
        result['uuid'] = self.uuid
        if self.style:
            result['style'] = modelToDict(STYLE_MANAGER.get(uuid=self.style.uuid))
        if self.labelStyle:
            result['labelStyle'] = modelToDict(self.labelStyle)
        return result

    class Meta:
        abstract = True


class Polygon(AbstractFeature):
    polygon = models.PolygonField()
    style = models.ForeignKey(PolygonStyle, null=True)


class LineString(AbstractFeature):
    lineString = models.LineStringField()
    style = models.ForeignKey(LineStringStyle, null=True)


class Point(AbstractFeature):
    point = models.PointField()
    style = models.ForeignKey(PointStyle, null=True)
    icon = models.ForeignKey(Icon, null=True)


class Drawing(AbstractFeature):
    style = models.ForeignKey(DrawingStyle)


class GroundOverlay(AbstractFeature):
    style = models.ForeignKey(GroundOverlayStyle, null=True)
    image = models.ImageField(upload_to=settings.XGDS_MAP_SERVER_OVERLAY_IMAGES_DIR, height_field='height',
                              width_field='width')
    height = models.IntegerField(null=True, blank=True)
    width = models.IntegerField(null=True, blank=True)
    polygon = models.PolygonField()


""" IMPORTANT These have to be defined after the models they refer to are defined."""
FEATURE_MANAGER = ModelCollectionManager(AbstractFeature,
                                         [Polygon,
                                          LineString,
                                          Point,
                                          Drawing,
                                          GroundOverlay])

STYLE_MANAGER = ModelCollectionManager(AbstractStyle,
                                       [PolygonStyle,
                                        LineStringStyle,
                                        PointStyle,
                                        DrawingStyle,
                                        GroundOverlayStyle])

MAP_NODE_MANAGER = ModelCollectionManager(AbstractMapNode, [MapGroup, MapLayer, KmlMap, MapTile])
