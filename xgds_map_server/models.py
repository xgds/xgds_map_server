# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

import re

from django.db import models
from django.contrib.gis.db import models
from xgds_map_server import settings

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
    creator = models.CharField('creator', max_length=200)
    modifier = models.CharField('modifier', max_length=200, null=True, blank=True)
    creation_time = models.DateTimeField(null=True, blank=True)
    last_modified_time = models.DateTimeField(null=True, blank=True)
    
    def __unicode__(self):
        return self.id

    
class Style(models.Model):
    label = models.CharField('label', max_length=200, null=True, blank=True)
    drawOrder = models.IntegerField('drawOrder', null=True, blank=True)

    def __unicode__(self):
        return self.id


class PolygonStyle(Style):
    def __unicode__(self):
        return self.id


class LineStyle(Style):
    def __unicode__(self):
        return self.id


class PlacemarkStyle(Style):
    def __unicode__(self):
        return self.id


class DrawingStyle(Style):
    def __unicode__(self):
        return self.id


class OverlayStyle(Style):
    def __unicode__(self):
        return self.id


class Feature(models.Model):
    mapLayer = models.ForeignKey(MapLayer)
    name = models.CharField('name', max_length=200)
    description = models.CharField('description', max_length=1024, blank=True)
    type = models.CharField('type', max_length=200)
    visibility = models.BooleanField(default=True)
    
    def __unicode__(self):
        return self.id


class Polygon(Feature):
    polygon = models.PolygonField()
    style = models.ForeignKey(PolygonStyle)

    def __unicode__(self):
        return self.id


class Line(Feature):
    line = models.LineStringField()
    style = models.ForeignKey(LineStyle)

    def __unicode__(self):
        return self.id


class Placemark(Feature):
    placemark = models.PointField()
    style = models.ForeignKey(PlacemarkStyle)

    def __unicode__(self):
        return self.id


class Drawing(Feature):
    style = models.ForeignKey(DrawingStyle)
    pass


class Overlay(Feature):
    style = models.ForeignKey(OverlayStyle)
    pass



