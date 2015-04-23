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
# pylint: disable=C1001

LOGO_REGEXES = None


class MapGroup(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000, null=True, blank=True)
    parentId = models.ForeignKey('self', db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='parent group')
    deleted = models.BooleanField(blank=True, default=False)

    class Meta:
        db_table = u'mapgroup'

    def __unicode__(self):
        # return '%s' % self.name + ' : ' + self.description + ' : ' + '%s' % self.parentId
        return self.name


class Map(models.Model):
    name = models.CharField('Name', max_length=80)
    description = models.CharField('Description', max_length=2000, null=True, blank=True)
    kmlFile = models.CharField('KML File', max_length=200)
    localFile = models.FileField(upload_to=settings.XGDS_MAP_SERVER_MEDIA_SUBDIR, max_length=256,
                                 null=True, blank=True)
    openable = models.BooleanField(default=True)
    visible = models.BooleanField(blank=False, default=False)
    parentId = models.ForeignKey(MapGroup, db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='group')
    deleted = models.BooleanField(blank=True, default=False)

    class Meta:
        db_table = u'map'

    @property
    def isLogo(self):
        global LOGO_REGEXES
        if LOGO_REGEXES is None:
            LOGO_REGEXES = [re.compile(pattern)
                            for pattern in settings.XGDS_MAP_SERVER_LOGO_PATTERNS]
        return any([r.search(self.name)
                    for r in LOGO_REGEXES])

    def __unicode__(self):
        # return self.name + ' : ' + self.kmlFile + ' = ' + self.description + ' visibility = %s' % self.visible + ' openable = %s' % self.openable
        return self.name


class MapLayer(models.Model):
    uuid = UuidField(primary_key=True)
    name = models.CharField('name', max_length=200)
    description = models.CharField('description', max_length=1024, blank=True)
    creator = models.CharField('creator', max_length=200)
    modifier = models.CharField('modifier', max_length=200, null=True, blank=True)
    creation_time = models.DateTimeField(null=True, blank=True)
    modification_time = models.DateTimeField(null=True, blank=True)
    locked = models.BooleanField(blank=True, default=False)
    visible = models.BooleanField(blank=False, default=False)
    parentId = models.ForeignKey(MapGroup, db_column='parentId',
                                 null=True, blank=True,
                                 verbose_name='group')
    deleted = models.BooleanField(blank=True, default=False)

    def toJson(self):
        result = modelToDict(self)
        featuresJson = []
        features = FEATURE_MANAGER.filter(mapLayer__pk=self.uuid)
        for feature in features:
            featuresJson.append(feature.toJson())
        result['features'] = featuresJson
        return result

    def __unicode__(self):
        return self.uuid


class AbstractStyle(models.Model):
    """ TODO Grace: refer here for style options, we don't have to take all of them
        http://wiki.openstreetmap.org/wiki/MapCSS/0.2
        """
    uuid = UuidField(primary_key=True)
    name = models.CharField(max_length=200, null=True, blank=True)
    drawOrder = models.IntegerField('drawOrder', null=True, blank=True)

    def toJson(self):
        return modelToDict(self)

    def __unicode__(self):
        return self.uuid

    class Meta:
        abstract = True


class LabelStyle(AbstractStyle):
    pass


class PolygonStyle(AbstractStyle):
    pass


class LineStringStyle(AbstractStyle):
    pass


class PointStyle(AbstractStyle):
    pass


class DrawingStyle(AbstractStyle):
    pass


class GroundOverlayStyle(AbstractStyle):
    pass


class AbstractFeature(models.Model):
    uuid = UuidField(primary_key=True)
    mapLayer = models.ForeignKey(MapLayer)
    name = models.CharField('name', max_length=200)
    description = models.CharField('description', max_length=1024, blank=True)
    visible = models.BooleanField(default=True)
    popup = models.BooleanField(default=False)
    showLabel = models.BooleanField(default=False)
    labelStyle = models.ForeignKey(LabelStyle, null=True)
    objects = models.GeoManager()

    @property
    def style(self):
        pass

    def __unicode__(self):
        return self.uuid

    def toJson(self):
        result = modelToDict(self)
        if self.style:
            result['style'] = STYLE_MANAGER.get(uuid=self.style.uuid).toJson()
        if self.labelStyle:
            result['labelStyle'] = self.labelStyle.toJson()
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
